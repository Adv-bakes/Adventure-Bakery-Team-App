-- FRM-952: the request for the employee's signature starts with a standard message.
--
-- Owner's wording, 2026-10-07. `signedBy.note` is the message the request block starts with;
-- {training_skill_assessed} is replaced by what the record says was trained (see
-- signatureRequestNote). The person asking can still change it before sending.
-- Nothing a person reads on the form changes; revision, approval and date are untouched. ONE UPDATE.

begin;

do $guard$
declare f jsonb;
begin
  select content->'form_schema'->'sections'->3->'fields'->3 into f
    from public.sop_documents where sop_number = 'FRM-952' and status = 'active' and revision = 'New';
  if f is null or f->>'id' <> 'employee_acknowledgment_signature' or not (f ? 'signedBy') or f->'signedBy' ? 'note' then
    raise exception 'FRM-952 employee acknowledgment is not as this migration expects.';
  end if;
  if not exists (select 1 from public.sop_documents d,
                   jsonb_array_elements(d.content->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') x
                  where d.sop_number = 'FRM-952' and d.status = 'active' and x->>'id' = 'training_skill_assessed') then
    raise exception 'FRM-952 has no training_skill_assessed field for the message to name.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{form_schema,sections,3,fields,3,signedBy,note}', to_jsonb($t$Please acknowledge that you have received this training ({training_skill_assessed}).

1. Open the form by clicking on the link below.

2. Navigate to the bottom and select the acknowledgement.$t$::text))
 where sop_number = 'FRM-952' and status = 'active' and revision = 'New';

do $verify$
declare d record;
begin
  select status, revision, approved_by, effective_date,
         content->'form_schema'->'sections'->3->'fields'->3->'signedBy' as sb into d
    from public.sop_documents where sop_number = 'FRM-952';
  if d.status <> 'active' or d.revision <> 'New' or d.approved_by <> 'GJM' or d.effective_date <> date '2026-06-27' then
    raise exception 'FRM-952 revision, approval or date changed.';
  end if;
  if d.sb->>'note' not like 'Please acknowledge that you have received this training ({training_skill_assessed}).%'
     or d.sb->>'nameField' <> 'employee_name' or d.sb->>'dateField' <> 'employee_acknowledgment_date' then
    raise exception 'the message was not set as intended.';
  end if;
end $verify$;

commit;
