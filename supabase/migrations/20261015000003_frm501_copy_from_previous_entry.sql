-- FRM-501 Formula Sheet & Batch Data: "Copy from a previous entry".
--
-- Owner's request, 2026-10-15: to make a new flavor's formula from an existing one (the Pumpkin Spice
-- sheet for a Pineapple Rum Cake). The form gains settings.copyFrom (copyFromEntry in
-- src/lib/formSchema.ts, the feature FRM-520 already has): a new or draft entry shows a card that
-- lists the other formula sheets and carries the chosen one's formula across, unsaved, with Undo.
--
-- Copied: Made as, the two batch sizes, the ingredient table and the process parameters.
-- NOT copied, because each belongs to the new product and must be stated for it: product name,
-- formula version, trial number, date, developed by, linked request, bar code number, ALLERGENS IN
-- FORMULA (a new flavor can bring a new allergen - the summary is restated, while each ingredient
-- line keeps its own allergen cell to be checked), the trial data, the validation ticks, and the
-- signatures (copyFromEntry never copies a signature).
--
-- The form also gains settings.instanceTitleTemplate "{product_name} {formula_version}": without it
-- every entry is titled "FRM-501 - <date>", so the copy picker (and the Entries list) could not tell
-- the Pumpkin Spice sheet from the Original. A title template already there is kept.
--
-- Nothing printed on the form changes and the revision stays as it is: every formula sheet is an
-- open draft pinned to that revision. Safe to run twice: a form already carrying exactly this
-- setting is left alone, so no second history snapshot is taken.

do $$
declare
  doc_id uuid;
  n_docs int;
  setting constant jsonb := jsonb_build_object('fields', jsonb_build_array(
    'made_as', 'benchtop_batch_size', 'scaled_production_batch_size',
    'prototype_formulation_grid', 'process_parameters_grid'));
  title constant text := '{product_name} {formula_version}';
  ids_before text;
  ids_after text;
  missing text;
  cur jsonb;
  want jsonb;
begin
  select count(*) into n_docs from public.sop_documents where sop_number = 'FRM-501' and status = 'active';
  if n_docs <> 1 then
    raise exception 'FRM-501: expected one active document, found %', n_docs;
  end if;
  select id into doc_id from public.sop_documents where sop_number = 'FRM-501' and status = 'active';

  select string_agg(f->>'id', ',' order by so, fo) into ids_before
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;

  -- Every field named must exist on the form.
  select string_agg(n, ', ') into missing
    from jsonb_array_elements_text(setting->'fields') as t(n)
   where n <> all (string_to_array(ids_before, ','));
  if missing is not null then
    raise exception 'FRM-501: fields not on the form: %', missing;
  end if;

  select coalesce(d.content->'form_schema'->'settings', '{}'::jsonb) into cur from public.sop_documents d where d.id = doc_id;
  if cur->'copyFrom' is not null and cur->'copyFrom' <> setting then
    raise exception 'FRM-501: carries a different copyFrom setting; this migration was not written for it';
  end if;
  want := cur || jsonb_build_object('copyFrom', setting);
  if coalesce(cur->>'instanceTitleTemplate', '') = '' then
    want := want || jsonb_build_object('instanceTitleTemplate', title);
  end if;
  -- One write, and none when nothing changes: each write to a published form is a history snapshot.
  if want = cur then
    raise notice 'FRM-501: already carries these settings, left alone';
  else
    update public.sop_documents d
       set content = jsonb_set(d.content, '{form_schema,settings}', want)
     where d.id = doc_id;
  end if;

  select string_agg(f->>'id', ',' order by so, fo) into ids_after
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as y(s, so),
         jsonb_array_elements(s->'fields') with ordinality as x(f, fo)
   where d.id = doc_id;
  if ids_after is distinct from ids_before then
    raise exception 'FRM-501: the list of fields changed, and this migration must not change it';
  end if;
  if (select d.content->'form_schema'->'settings'->'copyFrom' from public.sop_documents d where d.id = doc_id) is distinct from setting then
    raise exception 'FRM-501: copyFrom setting was not written';
  end if;
end $$;
