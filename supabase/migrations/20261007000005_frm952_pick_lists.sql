-- FRM-952 Training Competency Verification Record: the same two pick-lists FRM-953 was given.
--
-- Owner's request, 2026-10-07. Employee Name gets `teamPick` (TextField.teamPick): it offers the
-- people in the team directory, and entering one fills "Job Title / Dept." if it is empty.
-- Training / Skill Assessed gets `docPick`: it offers the issued TRN modules and SOPs. Both are
-- offers, not closed lists - anything else is typed in.
--
-- Nothing a person reads on the form changes, so the revision stays "New" and the approval and
-- effective date are not touched. The history trigger still snapshots the row.
-- Guarded on the three fields being where they were read on 2026-10-07. ONE UPDATE.

begin;

do $guard$
declare f jsonb;
begin
  select content->'form_schema'->'sections'->0->'fields' into f
    from public.sop_documents where sop_number = 'FRM-952' and status = 'active' and revision = 'New';
  if f is null or f->0->>'id' <> 'employee_name' or f->0->>'type' <> 'text'
     or f->1->>'id' <> 'job_title_dept' or f->1->>'type' <> 'text'
     or f->2->>'id' <> 'training_skill_assessed' or f->2->>'type' <> 'text' then
    raise exception 'FRM-952 fields are not where this migration expects them.';
  end if;
  if f->0 ? 'teamPick' or f->2 ? 'docPick' then raise exception 'FRM-952 already has a pick-list.'; end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content, '{form_schema,sections,0,fields,0,teamPick}', '{"titleField": "job_title_dept"}'::jsonb),
                   '{form_schema,sections,0,fields,2,docPick}', '{"prefixes": ["TRN", "SOP"]}'::jsonb)
 where sop_number = 'FRM-952' and status = 'active' and revision = 'New';

do $verify$
declare d record;
begin
  select status, revision, approved_by, effective_date,
         content->'form_schema'->'sections'->0->'fields' as f into d
    from public.sop_documents where sop_number = 'FRM-952';
  if d.status <> 'active' or d.revision <> 'New' or d.approved_by <> 'GJM' or d.effective_date <> date '2026-06-27' then
    raise exception 'FRM-952 revision, approval or date changed.';
  end if;
  if d.f->0->'teamPick'->>'titleField' <> 'job_title_dept'
     or d.f->2->'docPick' is distinct from '{"prefixes": ["TRN", "SOP"]}'::jsonb or jsonb_array_length(d.f) <> 6 then
    raise exception 'the pick-lists were not set as intended.';
  end if;
end $verify$;

commit;
