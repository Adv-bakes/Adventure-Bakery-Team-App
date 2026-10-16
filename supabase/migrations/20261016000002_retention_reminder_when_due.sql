-- The retention sample reminder is raised when a sample on the shelf passes its discard date,
-- not every week.
--
-- Found by the owner, 2026-10-16. The verification schedule carried "Retention sample review and
-- disposal" as a WEEKLY activity evidenced by a submitted FRM-703. One FRM-703 is one sample and is
-- submitted only when that sample leaves the shelf, so with every sample still within its period
-- the reminder ("no record of this activity has ever been made") could only be cleared by recording
-- a sample as gone that is still on the shelf - which is what the form led the owner towards.
-- FSQM-014 never asked for a weekly review: a sample is kept until thirty days after the date on its
-- pack and its disposal recorded on FRM-703 when it leaves. The reminder now asks for exactly that.
--
--   verification_schedule  evidence_kind gains 'shelf_discard'; retention_sample_review uses it:
--                          due on the earliest discard date among samples still on the shelf,
--                          linking to each sample past (or within a week of) its date, and
--                          discharged by recording that sample's disposal. An empty shelf, or one
--                          with nothing past its date, raises nothing. (shelfState in
--                          _shared/verificationSchedule.ts; the frequency is no longer used.)
--   FSQM-017  v16 -> v17   the Part 6 schedule line
--   the open "never recorded" reminder is closed (resolved, no name stamped)
--
-- DEPLOY THE FUNCTION FIRST: npx supabase functions deploy verification-notifications. The old
-- function does not know 'shelf_discard' and would read the row as never recorded.
--
-- FOR GABRIELA (GJM) TO APPROVE BEFORE THIS IS PUSHED. It records her approval, effective
-- 2026-10-16; if it is pushed on a later day, change the effective date first.
--
-- Safe to run twice: anything that already reads as intended is left alone, so no second history
-- snapshot is taken. Anything in another shape stops the whole migration.

alter table public.verification_schedule
  drop constraint if exists verification_schedule_evidence_kind_check;
alter table public.verification_schedule
  add constraint verification_schedule_evidence_kind_check
  check (evidence_kind in ('form_entry', 'document_revision', 'shelf_discard', 'none'));

do $mig$
declare
  d record;
  s record;
  eff constant date := '2026-10-16';

  desc_old constant text := $t$Reviews the retention shelf and disposes of samples past their discard date.$t$;
  desc_new constant text := $t$Raised when a retention sample still on the shelf passes its discard date (thirty days after the date printed on its pack, FSQM-014), with a link to each such sample. Discharged by disposing of the sample and recording it on that sample's own FRM-703 entry, which is then submitted. Nothing on the shelf past its date, nothing due - there is no weekly record to make.$t$;

  l17_old constant text := $t$• Retention sample review and disposal — Weekly — SQF Practitioner — FRM-703$t$;
  l17_new constant text := $t$• Retention sample review and disposal — When a sample on the shelf passes its discard date — SQF Practitioner — that sample's own entry on FRM-703$t$;
  h17_head_old constant text := $t$v16 - 2026-10-16 - $t$;
  h17_entry constant text := $t$v17 - 2026-10-16 - The retention sample reminder is raised when a sample is due.

Part 6 listed the retention sample review and disposal as weekly, evidenced by FRM-703. One FRM-703 is one sample and is submitted only when that sample leaves the shelf, so while every sample was within its period the weekly reminder could never be discharged, and the only way to clear it was to record a sample as gone that was still on the shelf. FSQM-014 asks for no weekly review: a sample is kept until thirty days after the date on its pack and its disposal is recorded on FRM-703 when it leaves. The activity is now raised when a sample on the shelf passes its discard date, links to that sample, and is discharged by recording its disposal (owner's decision, 2026-10-16). The position responsible is unchanged.

$t$;
begin
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-703' and status = 'active') then
    raise exception 'FRM-703 is not an issued form';
  end if;

  -- The schedule row
  select * into s from public.verification_schedule where activity_key = 'retention_sample_review';
  if not found then
    raise exception 'verification_schedule has no retention_sample_review row';
  elsif s.evidence_kind = 'shelf_discard' and s.description = desc_new then
    raise notice 'retention_sample_review already reads as intended, left alone';
  elsif s.evidence_kind = 'form_entry' and s.evidence_document_number = 'FRM-703' and s.description = desc_old
        and s.status = 'active' and s.covers_until_field is null then
    update public.verification_schedule
       set evidence_kind = 'shelf_discard', description = desc_new
     where activity_key = 'retention_sample_review';
  else
    raise exception 'the retention_sample_review row is not the row this migration was written against';
  end if;

  -- FSQM-017
  select * into d from public.sop_documents where sop_number = 'FSQM-017' and status = 'active';
  if d.revision = 'v17' and d.content->'procedure'->>43 = l17_new and starts_with(d.content->>'revision_history', h17_entry) then
    raise notice 'FSQM-017 already at v17 as intended, left alone';
  elsif d.revision = 'v16' and d.content->'procedure'->>43 = l17_old and starts_with(d.content->>'revision_history', h17_head_old) then
    update public.sop_documents
       set content = jsonb_set(jsonb_set(content, '{procedure,43}', to_jsonb(l17_new)),
                               '{revision_history}', to_jsonb(h17_entry || (content->>'revision_history'))),
           revision = 'v17', effective_date = eff, approved_by = 'GJM'
     where id = d.id;
  else
    raise exception 'FSQM-017 is not the document this migration was written against';
  end if;

  -- The reminder raised for the row as it was: it asked for a record that could not exist.
  update public.internal_notifications
     set resolved_at = now(), resolved_reason = 'Schedule corrected: raised when a sample passes its discard date'
   where dedupe_key = 'verification:retention_sample_review:never' and resolved_at is null;
end $mig$;
