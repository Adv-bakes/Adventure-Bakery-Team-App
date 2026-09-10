# Verification Schedule & Notifications — technical runbook

The scheduled job that raises due SQF verification activities into the Team Portal, and the
framework around it. Built for **D-18** (FSQM-017, SQF 2.5.1.1 / 2.5.2.1 / 2.5.2.2).

> **The one thing to know before anything else.** `cron.job_run_details.status = 'succeeded'` means
> **the SQL ran** — it does *not* mean the HTTP request reached the function or that anything was
> written. The job posts asynchronously via `pg_net`, so a run can be recorded as succeeded while the
> request timed out and nothing happened. **Always check `net._http_response`, never `job_run_details`
> alone.** This exact confusion hid a silent failure on the first live run; see
> [Troubleshooting #2](#2-cron-says-succeeded-but-nothing-was-written).

---

## Cheat sheet

All SQL runs against production via the Supabase Management API or the dashboard SQL editor.

### Is it alive?

```sql
-- The schedule itself
select jobid, jobname, schedule, active from cron.job
 where jobname = 'verification-notifications-check';

-- Did the last few HTTP calls actually land? THIS is the real health check.
select id, status_code, error_msg, created, left(content, 200) as body
  from net._http_response
 order by id desc limit 5;
```

A healthy response body looks like:

```json
{"success":true,"today":"2026-09-10","horizon":"2026-09-17",
 "checked":12,"opened":0,"escalated":12,"resolved":0,"skipped":8,"errors":[]}
```

| field | meaning |
|---|---|
| `checked` | active activities assessed |
| `skipped` | non-active rows (`planned` / `retired`) — never raised, by design |
| `opened` | new notifications created |
| `escalated` | occurrences already raised; severity, message and links refreshed |
| `resolved` | closed because no longer due, or the temperature alert settled |
| `errors[]` | **should be empty**. Non-fatal; the run continues |

### Run it by hand

`supabase functions invoke` does not exist in CLI 2.x. Post from the database, reusing the token
already in `cron.job` so the service-role key never leaves it:

```sql
select net.http_post(
  url := 'https://zsukaixinoqmggpxxonn.supabase.co/functions/v1/verification-notifications',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer ' || (select substring(command from 'Bearer\s+([A-Za-z0-9._\-]+)')
                                    from cron.job
                                   where jobname = 'verification-notifications-check')),
  body := '{}'::jsonb,
  timeout_milliseconds := 30000) as request_id;
```

Then read the result with the `net._http_response` query above. **It is safe to run repeatedly** — the
dedupe index means a second run creates nothing.

### What is in the feed right now?

```sql
select severity, responsible_position, due_on,
       jsonb_array_length(links) as links, title
  from public.internal_notifications
 where notification_type = 'verification_due'
   and dismissed_at is null and resolved_at is null
 order by severity desc, due_on;
```

### The schedule

```sql
select sort_order, activity_key, activity, frequency_unit, frequency_count,
       responsible_position, evidence_kind, evidence_document_number,
       status, pending_deliverable
  from public.verification_schedule
 order by sort_order;
```

### Local checks (no database, no deploy)

```bash
node scripts/test-verification-schedule.mjs   # due-date logic + twin agreement
npm run build                                 # the UI half
python scripts/check-migration-sql.py supabase/migrations/2026*.sql
```

### Deploy

```bash
supabase functions deploy verification-notifications   # after ANY change under supabase/functions/
supabase db push                                       # migrations
```

There is **no CI**. Both are manual, from a machine with the Supabase CLI linked.

---

## The shape of it

```
verification_schedule ──┐
  (what is due, and how often)
                        │
sop_document_responses ─┼──► verification-notifications ──► internal_notifications
  (when it was last done)         (edge function, 2×/day)      (the feed)
sop_document_history ───┘                  ▲                          │
  (for document-evidenced activities)      │                          ▼
                                    pg_cron + pg_net          Notifications page
                                    0 11,19 * * * UTC          + sidebar badge
```

| piece | where |
|---|---|
| Schedule table | `supabase/migrations/20260910000012_verification_schedule.sql` |
| Feed columns + dismissal RPC | `…20260910000013_internal_notifications_feed.sql` |
| Cron schedule | `…20260910000014…` , timeout fix `…20260910000015…` |
| The job | `supabase/functions/verification-notifications/index.ts` |
| Due-date logic (pure) | `supabase/functions/_shared/verificationSchedule.ts` |
| Client twin of that logic | `src/lib/verificationSchedule.ts` |
| Tests | `scripts/test-verification-schedule.mjs` |
| Feed data access | `src/lib/notifications.ts` |
| Pages | `src/pages/team/Notifications.tsx`, `…/compliance/VerificationSchedule.tsx` |
| Entry resolver | `src/pages/team/compliance/FormEntryStart.tsx` |
| Sidebar badge | `src/components/TeamLayout.tsx` (`NavItem.badge`) |

---

## How it decides what is due

1. **Read the schedule.** Rows with `status <> 'active'` are dropped immediately and counted as
   `skipped`. A `planned` activity **never** raises a notification — its governing programme has not
   been issued.
2. **Find when it was last done.** Never stored; always derived.
   - `evidence_kind = 'form_entry'` → newest `submitted_at` on that form's **submitted** responses.
     Drafts do not count: a draft FRM-913 is an inspection somebody started.
   - `evidence_kind = 'document_revision'` → newest `sop_document_history.snapshotted_at` for the
     named document. Used where the evidence is the document being revised.
   - `evidence_kind = 'none'` → only valid on non-active rows.
3. **Compute the next due date.** `last_completed + frequency`, calendar arithmetic with month-end
   clamping (31 Jan + 1 month = 28 Feb). With no completion, `first_due_on` **is** the due date. With
   neither, the activity has never been done and is raised once with a stable `:never` dedupe key.
4. **Decide severity.** Raised from `next_due - lead_days`; `overdue` past `next_due + grace_days`.
5. **Write.** One row per `(activity, due date)`, enforced by a unique index. `23505` means already
   raised → refresh severity, message and links on the **open** row only.
6. **Close what is done.** Open notifications whose occurrence is no longer live get `resolved_at`.
   Temperature notifications close when their alert is acknowledged or cleared.

**`resolved_at` vs `dismissed_at`:** the system closing something sets `resolved_at` and is never
stamped with a name; a person clearing it sets `dismissed_at` + `dismissed_by`. Keeping them apart is
what lets a stamp mean "a human acted".

---

## Troubleshooting

### 1. The badge shows nothing / the feed is empty

Work outwards:

```sql
select count(*) from public.verification_schedule where status = 'active';   -- expect > 0
select count(*) from public.internal_notifications
 where notification_type = 'verification_due' and dismissed_at is null and resolved_at is null;
```

If rows exist in the table but not on the page, check `FEED_TYPES` in `src/lib/notifications.ts` —
it is an **allowlist**. A new `notification_type` does not appear until it is added there. That is
deliberate: four pre-existing writers put batch-sheet chatter in this table.

If the count is right but the pill is 0, the sidebar swallows count errors on purpose (so a blip
cannot blank a pill that was right a moment ago). Look in the browser console.

### 2. Cron says "succeeded" but nothing was written

**The most important entry here.** `cron.job_run_details` records whether the *SQL statement* ran.
`net.http_post` queues a request and returns immediately, so the statement succeeds even when the
HTTP call later times out or 401s.

```sql
select id, status_code, error_msg, created from net._http_response order by id desc limit 10;
```

- `error_msg` containing `Timeout of 5000 ms reached` → the request outlived pg_net's **default 5 s**.
  The schedule passes `timeout_milliseconds := 30000` (migration `…000015`); if a new job was
  scheduled without it, that is the cause. **Any pg_cron → edge function job needs this parameter.**
- `status_code` 401 → the bearer token is wrong or missing; see #3.
- `status_code` 404 → the function is not deployed. `supabase functions deploy verification-notifications`.
- No row at all → `pg_net` did not queue it; check the job's `command` is well-formed.

This exact failure happened on the first live run: the job wrote nothing twice a day while looking
healthy. It is the failure mode the whole feature exists to prevent, so it is worth over-checking.

### 3. 401 from the function

The token is **scraped out of an existing `cron.job` row** at migration time, never written into git.

```sql
select jobname, command ~ 'Bearer\s+[A-Za-z0-9._\-]+' as has_token from cron.job;
```

If the donor job (`temperature-alert-check`) was unscheduled, a fresh install of the cron migration
raises with copy-paste instructions rather than installing a job that 401s silently. To repair, run
`cron.schedule` by hand in the dashboard SQL editor with the service-role key — **from the dashboard,
never from a file that could be committed**.

### 4. `errors: ["<activity>: FRM-XXX not found"]`

The schedule names `evidence_document_number` for a document that does not exist — usually a typo, a
renumbered document, or a form not yet seeded. The job reports it rather than treating the activity
as never done, because a notification nobody can act on is worse than a visible error.

```sql
select activity_key, evidence_document_number from public.verification_schedule
 where evidence_document_number is not null
   and evidence_document_number not in (select sop_number from public.sop_documents);
```

### 5. Duplicate notifications for one activity

Should be impossible — `internal_notifications_dedupe_uniq` is a **total** unique index on
`dedupe_key`. If you see duplicates, one of them almost certainly has a **different due date** in its
key, which means the underlying completion date moved (an entry was submitted, reopened, or
deleted). Check:

```sql
select dedupe_key, dismissed_at, resolved_at, created_at
  from public.internal_notifications
 where notification_type = 'verification_due' and title like '%<activity>%'
 order by created_at desc;
```

The index is deliberately **not** partial on dismissal — that is what stops the afternoon run
resurrecting what somebody cleared in the morning.

### 6. A notification will not clear

There is **no UPDATE policy** on `internal_notifications`; dismissal goes only through the RPC.

- *"not authorised to dismiss notifications"* → the caller is not staff/admin/owner
  (`is_staff_or_admin`).
- *"notification … not found, or already cleared"* → somebody else cleared it first. First
  dismissal wins by design.
- **Temperature notifications have no Clear button at all.** Clearing one would make the badge go
  away without the SOP-401 corrective-action record ever being written. They close themselves once
  the alert is acknowledged (on `/team/compliance/temperature`) or clears.

### 7. An activity shows "Never recorded" but it was done

Last-completed is derived, so this means the job cannot see the evidence:

- The entry is still a **draft**. Only `status = 'submitted'` counts.
- It was recorded on a different form than `evidence_document_number` names.
- For a `document_revision` activity, the document has never been **revised since it was published** —
  `sop_document_history` only snapshots published documents. Set `first_due_on` to give it an anchor
  (this is why the annual programme review has `first_due_on = 2027-09-10`).

```sql
select r.status, r.submitted_at, r.created_at
  from public.sop_document_responses r
  join public.sop_documents d on d.id = r.document_id
 where d.sop_number = 'FRM-913' order by r.created_at desc limit 5;
```

### 8. A `planned` activity raised a notification

It should be impossible — `assessDue()` drops anything not `active`, and there is a test for it. If
it happens, the row's `status` was changed to `active` without its programme being issued. **Do not
"fix" a planned row by activating it**; activate it when its deliverable lands.

### 9. Dates are off by one

The job computes "today" in `SITE_TZ` (`America/New_York`), not UTC, because *due today* must mean
the day the floor is standing in. **`SITE_TZ` and the cron's UTC hours are one decision made twice.**
If the site timezone changes, change both — a job firing at 07:00 local while the function believes it
is already tomorrow raises everything a day early, every day, and nothing looks broken.

Current: `0 11,19 * * *` UTC = 06:00/14:00 EST, 07:00/15:00 EDT. pg_cron has no DST awareness; these
hours were chosen so both runs stay inside the working day year-round.

### 10. The schedule page and the notifications disagree

The due-date logic exists in **two identical copies** — `supabase/functions/_shared/` for the job and
`src/lib/` for the page — because a browser bundle must not pull in server code. If they drift, the
page shows one next-due date while the job raises another.

```bash
node scripts/test-verification-schedule.mjs
```

bundles **both** and asserts they agree over 105 frequency cases. **Edit one, run this, edit the
other.** The client copy is generated from the shared one below its header.

---

## Changing things

### Add, retire or re-time an activity

Do it in the app: **Compliance → Verification Schedule** is backed by the same table the job reads, and
staff have INSERT/UPDATE. Changes take effect on the next run.

Two consequences:

- **Retire, do not delete.** Set `status = 'retired'`. DELETE is admin/owner only, and the schedule is
  the evidence of what was scheduled when.
- **The schedule is FSQM-017 Part 6**, generated at issue. Changing the table means the issued
  document is now out of date, so a schedule change is a **document revision**. Part 10's annual
  review is the occasion that catches it. That is the trade for having one document instead of two.

`activity_key` is the stable identity — notification dedupe keys are built from it. Renaming the
`activity` text is safe; changing `activity_key` orphans open notifications.

### Change the run times

Do not edit an applied migration. Write a new one re-registering the job (`cron.schedule` upserts by
name), keeping `timeout_milliseconds`, copying the bearer from the job being replaced, and guarding
that both landed in the command. `20260910000015` is the worked example.

Then change `SITE_TZ` in the function if the timezone moved, and redeploy.

### Add a new evidence kind

1. `ScheduleRow["evidence_kind"]` in the shared module, regenerate the client twin.
2. A branch in the job that resolves last-completed for it.
3. A branch in `VerificationSchedule.tsx` doing the same for display.
4. Widen the CHECK constraint on `verification_schedule.evidence_kind` in a migration.
5. A test case.

### Add a notification source that is not the schedule

Insert into `internal_notifications` with a `dedupe_key`, then add the `notification_type` to
`FEED_TYPES` in `src/lib/notifications.ts` — an allowlist, so it will not appear until you do.
Decide deliberately whether it should be dismissable (`isDismissable`).

---

## Gotchas that have already bitten

| | |
|---|---|
| **pg_net defaults to a 5 s timeout** | Silent failure that still reports `succeeded`. Always pass `timeout_milliseconds`. |
| **`job_run_details` ≠ HTTP success** | Check `net._http_response`. |
| **A draft entry is not a completion** | Only `submitted_at` counts, or an unfinished inspection resets the clock. |
| **Never write to `sop_document_responses` from a job** | The `…_touch` trigger bumps `updated_at`, handing a `StaleResponseError` to whoever has that form open. The job is read-only against it. |
| **`data` has no index** | Filter by `document_id` first; compare ISO dates as **text**, never `::date` — the key is `''` on unfilled entries. |
| **A grid row has no stable identity** | Why the schedule is a table, not a register grid. Renaming a row would orphan its notification. |
| **Reopened + disposed FRM-703 drafts are gone, not on the shelf** | `reopened_at IS NOT NULL AND data->>'disposal_date' <> ''`. |
| **`has_role(uid,'admin')` excludes owner** | Every admin gate is `has_role(...) OR is_owner(...)`. |
| **A notification link must be safe to click twice** | `/forms/:docId/start` resumes an open draft before creating one. |
| **An applied migration filename is immutable** | Corrections are new migrations. |

---

## Design decisions, and why they are not accidents

- **The schedule is a table, not a grid inside a form entry.** A fixed-grid row is addressed by array
  position (or `_label`), so renaming an activity would orphan its open notification and deleting one
  would silently stop the alerting while the printed schedule still showed it as scheduled.
- **There is no `last_completed` column.** Derived at read time from the evidence itself, so it cannot
  be stale and the date an auditor sees *is* the record.
- **Frequency is unit + count, never days.** 365-day arithmetic drifts a day per leap year until
  "reviewed annually" quietly is not.
- **`planned` is a first-class status.** Eight activities are scheduled and not performed because
  their programmes do not exist. A schedule that hid them would look complete and would not be.
- **Notifications are team-wide and labelled with a position**, not routed to individuals. SQF 2.5.2.2
  requires the *schedule* to name who is responsible; with three or four people, per-user routing
  would collapse to "staff sees everything" while adding a mapping to maintain.
- **A notification is a prompt, not a record.** Clearing one is not evidence the activity happened —
  the record is the form entry it links to. FSQM-017 Part 7 states this, because a feed that feels
  like a checklist becomes one that gets ticked.
