-- FRM-953 Training Sign-In Sheet: two pick-lists - the attendee's name and the training topic.
--
-- Owner's request, 2026-10-07. The Employee Name column of the attendee list gets `teamPick`
-- (see GridColumn.teamPick): the cell offers the people in the team directory, and entering one
-- of them fills "Job Title / Dept." on that row if it is empty. It is an offer, not a closed
-- list - a contractor or a temporary worker is still typed in.
--
-- Training Title / Topic gets `docPick` (see TextField.docPick): it offers the issued TRN modules
-- and SOPs, as "TRN-003 Allergens Part 1". Also an offer: any other topic is typed in.
--
-- Nothing a person reads on the form changes: no field, label or wording is added or removed,
-- so the revision stays v2 and the approval and effective date are not touched. The history
-- trigger still snapshots the row, because form_schema changed.
-- Guarded on the two columns being where they were read on 2026-10-07. ONE UPDATE.

begin;

do $guard$
declare g jsonb; f jsonb;
begin
  select content->'form_schema'->'sections'->2->'fields'->1 into g
    from public.sop_documents where sop_number = 'FRM-953' and status = 'active' and revision = 'v2';
  if g is null or g->>'id' <> 'attendees_grid' or g->'columns'->0->>'id' <> 'employee_name'
     or g->'columns'->0->>'type' <> 'text' or g->'columns'->1->>'id' <> 'job_title_dept' then
    raise exception 'FRM-953 attendee grid is not where this migration expects it.';
  end if;
  if g->'columns'->0 ? 'teamPick' then raise exception 'FRM-953 already has teamPick.'; end if;
  select content->'form_schema'->'sections'->0->'fields'->0 into f
    from public.sop_documents where sop_number = 'FRM-953' and status = 'active' and revision = 'v2';
  if f->>'id' <> 'training_title_topic' or f->>'type' <> 'text' or f ? 'docPick' then
    raise exception 'FRM-953 topic field is not where this migration expects it.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content, '{form_schema,sections,2,fields,1,columns,0,teamPick}', '{"titleColumn": "job_title_dept"}'::jsonb),
                   '{form_schema,sections,0,fields,0,docPick}', '{"prefixes": ["TRN", "SOP"]}'::jsonb)
 where sop_number = 'FRM-953' and status = 'active' and revision = 'v2';

do $verify$
declare d record;
begin
  select revision, approved_by, effective_date, status,
         content->'form_schema'->'sections'->2->'fields'->1->'columns' as cols,
         content->'form_schema'->'sections'->0->'fields'->0->'docPick' as pick into d
    from public.sop_documents where sop_number = 'FRM-953';
  if d.status <> 'active' or d.revision <> 'v2' or d.approved_by <> 'GJM' or d.effective_date <> date '2026-06-27' then
    raise exception 'FRM-953 revision, approval or date changed.';
  end if;
  if d.cols->0->'teamPick'->>'titleColumn' <> 'job_title_dept' or jsonb_array_length(d.cols) <> 4 then
    raise exception 'teamPick was not set as intended.';
  end if;
  if d.pick is distinct from '{"prefixes": ["TRN", "SOP"]}'::jsonb then raise exception 'docPick was not set as intended.'; end if;
end $verify$;

commit;
