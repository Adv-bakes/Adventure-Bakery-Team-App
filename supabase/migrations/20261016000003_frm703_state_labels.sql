-- FRM-703 Retention Sample Log: its entries' states and buttons in the form's own words.
--
-- Owner's request, 2026-10-16. A retention sample is a DRAFT for as long as it is on the shelf and
-- is submitted only when it leaves, and nothing on screen said so - "draft" read as unfinished and
-- "Submit" as the next thing to do. The form gains settings.stateLabels (entryStateLabel in
-- src/lib/formSchema.ts), shown on the entry, the form's Entries list and Form Records:
--   draft, "Sample taken by" not signed -> Being logged
--   draft, "Sample taken by" signed     -> On the shelf until <discard date>
--   submitted                           -> Disposed
--   Save Draft -> Save, Submit -> Record disposal, with its own confirmation.
-- Words only: the stored status is still draft / submitted, so permissions, reminders, the lot
-- trace and the Today page are unchanged.
--
-- Nothing printed on the form changes and the revision stays as it is. Safe to run twice: a form
-- already carrying exactly this setting is left alone, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  cur jsonb;
  setting constant jsonb := jsonb_build_object(
    'draft', 'Being logged',
    'signed', jsonb_build_object('field', 'taken_by', 'label', 'On the shelf', 'untilField', 'discard_due'),
    'submitted', 'Disposed',
    'save', 'Save',
    'submit', 'Record disposal',
    'confirmTitle', 'Record this sample''s disposal?',
    'confirmBody', 'Do this only once the sample has left the shelf - the entry will then read as Disposed.');
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-703' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-703: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-703' and status = 'active';

  -- The two fields the labels read must be on the form.
  if (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
       where d.id = doc_id and f->>'id' in ('taken_by', 'discard_due')) <> 2 then
    raise exception 'FRM-703: taken_by and discard_due are not both on the form';
  end if;

  select coalesce(d.content->'form_schema'->'settings', '{}'::jsonb) into cur from public.sop_documents d where d.id = doc_id;
  if cur->'stateLabels' = setting then
    raise notice 'FRM-703: already carries these state labels, left alone';
  elsif cur->'stateLabels' is not null then
    raise exception 'FRM-703: carries different state labels; this migration was not written for them';
  else
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,settings}', cur || jsonb_build_object('stateLabels', setting))
     where d.id = doc_id;
  end if;
end $$;
