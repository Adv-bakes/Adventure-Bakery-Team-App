-- The monthly review of open and overdue corrective actions is recorded on the monthly SQF update
-- (FRM-009), not on the CAPA report (FRM-007).
--
-- Found by the owner, 2026-10-16. The verification schedule listed "Review of open and overdue
-- corrective actions" with FRM-007 as its record. FRM-007 is the report of ONE corrective action,
-- so no submission of it shows that the month's CAPAs were reviewed: the reminder read "no record
-- of this activity has ever been made" and could not be discharged. The same fault was corrected
-- for the complaint review on 2026-10-12 (20261012000001). FSQM-009 Parts 8 and 9 require the
-- review but never named where it is recorded. It is done at the monthly SQF update, whose
-- "Open corrective actions" row is filled from the records (monthlyUpdate.ts, capaReview).
--
--   verification_schedule  capa_review: evidence FRM-007 -> FRM-009, description says where
--   FSQM-009  New -> v2    Part 8 and Part 9 say the review is recorded on FRM-009; FRM-009 added to
--                          the forms referenced; Records corrected (CAPA performance is minuted at
--                          the ANNUAL management review on FRM-001, not a "monthly" one) and the
--                          monthly review added
--   FSQM-017  v15 -> v16   the Part 6 schedule line
--   the open reminder raised for the old row is closed (resolved, no name stamped)
--
-- FOR GABRIELA (GJM) TO APPROVE BEFORE THIS IS PUSHED. It records her approval, effective
-- 2026-10-16; if it is pushed on a later day, change the two effective dates first.
-- Frequency and the position responsible are unchanged.
--
-- Safe to run twice: anything that already reads as intended is left alone, so no second history
-- snapshot is taken. Anything in another shape stops the whole migration.

do $mig$
declare
  d record;
  s record;
  eff constant date := '2026-10-16';

  desc_old constant text := $t$Confirms open CAPAs are progressing and closed ones were verified effective.$t$;
  desc_new constant text := $t$Confirms open CAPAs are progressing, overdue ones followed up with a revised date and its reason, and closed ones verified effective; looks for repeats and recurring sources (FSQM-009 Parts 8 and 9). Done at the monthly SQF update and recorded there, on FRM-009, under "Open corrective actions"; each CAPA itself is recorded on FRM-007 and listed on REP-007.$t$;

  -- FSQM-017 Part 6
  l17_old constant text := $t$• Review of open and overdue corrective actions — Monthly — SQF Practitioner — FRM-007$t$;
  l17_new constant text := $t$• Review of open and overdue corrective actions — Monthly — SQF Practitioner — FRM-009, under "Open corrective actions"; each CAPA itself is recorded on FRM-007 and listed on REP-007$t$;
  h17_head_old constant text := $t$v15 - 2026-10-12 - $t$;
  h17_entry constant text := $t$v16 - 2026-10-16 - The monthly CAPA review is evidenced by the monthly SQF update.

Part 6 listed the review of open and overdue corrective actions against FRM-007. FRM-007 is the report of one corrective action, so it cannot show that the month's corrective actions were reviewed, and the schedule's reminder could never be discharged - the same fault v15 corrected for the complaint review. The review is done at the monthly SQF update and recorded on FRM-009 under "Open corrective actions", against the CAPA log REP-007; FSQM-009 v2 says so, and the schedule line and the reminder now do too (owner's decision, 2026-10-16). Frequency and the position responsible are unchanged.

$t$;

  -- FSQM-009 Part 8 and Part 9
  l09a_old constant text := $t$> **Open and overdue CAPAs are reviewed at least monthly** against REP-007. An overdue action is followed up with its owner and a revised date is recorded with the reason — a due date that silently moves is not a controlled record.$t$;
  l09a_new constant text := $t$> **Open and overdue CAPAs are reviewed at least monthly** against REP-007, at the monthly SQF update, and **the review is recorded on FRM-009 Monthly SQF Update Record** under "Open corrective actions". An overdue action is followed up with its owner and a revised date is recorded with the reason on its FRM-007 — a due date that silently moves is not a controlled record.$t$;
  l09b_old constant text := $t$> The SQF Practitioner reviews the register at least monthly for overdue actions, repeats, and sources that keep recurring.$t$;
  l09b_new constant text := $t$> The SQF Practitioner reviews the register at least monthly for overdue actions, repeats, and sources that keep recurring, in the same review, recorded on FRM-009. It covers the corrective actions opened and closed since the last monthly update - every one on record at the first - with the result of each effectiveness check, and every corrective action still open, whenever it was raised.$t$;
  refs_add constant text := $t$
FRM-009 — Monthly SQF Update Record (the monthly review of open and overdue CAPAs)$t$;
  rec_old constant text := $t$CAPA performance minuted with the monthly management review on FRM-001.$t$;
  rec_new constant text := $t$The monthly review of open and overdue CAPAs, recorded on FRM-009 Monthly SQF Update Record under "Open corrective actions".

CAPA performance minuted at the annual management review on FRM-001.$t$;
  h09_head_old constant text := $t$New — 2026-09-02 — $t$;
  h09_entry constant text := $t$v2 — 2026-10-16 — Where the monthly CAPA review is recorded.

Part 8 required open and overdue CAPAs to be reviewed at least monthly, and Part 9 the register to be reviewed for overdue actions, repeats and recurring sources, but neither said where the review is recorded. The verification schedule named FRM-007, the report of one corrective action, which cannot show a month's review, so its reminder could never be discharged. The review is done at the monthly SQF update and recorded on FRM-009 Monthly SQF Update Record under "Open corrective actions"; Parts 8 and 9 now say so, and Part 9 states what the review covers. FRM-009 is added to the forms referenced. Records corrected: CAPA performance is minuted at the ANNUAL management review on FRM-001 - the earlier text called it monthly - and the monthly review on FRM-009 is listed. No step of the program changes (owner's decision, 2026-10-16; FSQM-017 v16 changes the schedule line).

$t$;
begin
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-009' and status = 'active') then
    raise exception 'FRM-009 is not an issued form';
  end if;

  -- The schedule row
  select * into s from public.verification_schedule where activity_key = 'capa_review';
  if not found then
    raise exception 'verification_schedule has no capa_review row';
  elsif s.evidence_document_number = 'FRM-009' and s.description = desc_new then
    raise notice 'capa_review already reads as intended, left alone';
  elsif s.evidence_document_number = 'FRM-007' and s.description = desc_old and s.evidence_kind = 'form_entry' and s.status = 'active' then
    update public.verification_schedule
       set evidence_document_number = 'FRM-009', description = desc_new
     where activity_key = 'capa_review';
  else
    raise exception 'the capa_review row is not the row this migration was written against';
  end if;

  -- FSQM-017
  select * into d from public.sop_documents where sop_number = 'FSQM-017' and status = 'active';
  if d.revision = 'v16' and d.content->'procedure'->>49 = l17_new and starts_with(d.content->>'revision_history', h17_entry) then
    raise notice 'FSQM-017 already at v16 as intended, left alone';
  elsif d.revision = 'v15' and d.content->'procedure'->>49 = l17_old and starts_with(d.content->>'revision_history', h17_head_old) then
    update public.sop_documents
       set content = jsonb_set(jsonb_set(content, '{procedure,49}', to_jsonb(l17_new)),
                               '{revision_history}', to_jsonb(h17_entry || (content->>'revision_history'))),
           revision = 'v16', effective_date = eff, approved_by = 'GJM'
     where id = d.id;
  else
    raise exception 'FSQM-017 is not the document this migration was written against';
  end if;

  -- FSQM-009
  select * into d from public.sop_documents where sop_number = 'FSQM-009' and status = 'active';
  if d.revision = 'v2' and d.content->'procedure'->>66 = l09a_new and d.content->'procedure'->>69 = l09b_new
     and starts_with(d.content->>'revision_history', h09_entry) then
    raise notice 'FSQM-009 already at v2 as intended, left alone';
  elsif d.revision = 'New' and d.content->'procedure'->>66 = l09a_old and d.content->'procedure'->>69 = l09b_old
        and position(rec_old in d.content->>'records') > 0 and position('FRM-009' in d.content->>'form_references') = 0
        and starts_with(d.content->>'revision_history', h09_head_old) then
    update public.sop_documents
       set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
               '{procedure,66}', to_jsonb(l09a_new)),
               '{procedure,69}', to_jsonb(l09b_new)),
               '{form_references}', to_jsonb((content->>'form_references') || refs_add)),
               '{records}', to_jsonb(replace(content->>'records', rec_old, rec_new))),
               '{revision_history}', to_jsonb(h09_entry || (content->>'revision_history'))),
           revision = 'v2', effective_date = eff, approved_by = 'GJM'
     where id = d.id;
  else
    raise exception 'FSQM-009 is not the document this migration was written against';
  end if;

  -- The reminder raised for the row as it was: it asked for a record that could not exist.
  update public.internal_notifications
     set resolved_at = now(), resolved_reason = 'Schedule corrected: the review is recorded on FRM-009'
   where dedupe_key = 'verification:capa_review:never' and resolved_at is null;
end $mig$;
