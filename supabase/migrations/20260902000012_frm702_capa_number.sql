-- FRM-702 gains an Associated CAPA Number field. D-07 follow-on, for FSQM-018.
--
-- FSQM-018 now raises its investigation as a CAPA under FSQM-009 rather than restating root cause
-- and effectiveness in its own words, and says the CAPA number is written back onto the hold so the
-- two are traceable to each other. FRM-702 had nowhere to write it. Section 2 offers an "Associated
-- SCAR Number", and a SCAR is not a CAPA - a SCAR goes out to a supplier under FRM-205, while a
-- CAPA is the internal investigation. Putting a CAPA number in the SCAR field would make the
-- register unqueryable and would tell a reader the supplier had been served a report they had not.
--
-- THIS IS THE SAME GAP FRM-908 HAS HAD SINCE IT WAS WRITTEN - a car_ref field pointing at a CAR
-- that did not exist until 2026-09-02 - and the same fix FRM-913 received in 20260902000005. The
-- number is the whole cross-reference mechanism in a documents-only CAPA design: there is no
-- foreign key, so a field on the source record is what makes a hold and its investigation findable
-- from each other.
--
-- NOW, BECAUSE FRM-702 HAS ZERO ENTRIES. It is active but has never been filled; the guard
-- re-checks at apply time and refuses if that has changed. Adding a field to a form with live
-- entries is materially more careful work - existing responses carry no key for it, and the printed
-- blank goes out of date against records already filed. FSQM-018's first hold has not happened yet.
--
-- IT IS NOT REQUIRED, ON PURPOSE. Not every hold raises a CAPA: FSQM-009 Part 3 is explicit that a
-- routine correction stays on the form that found it, and 2.1.3.3 endorses deciding "based on the
-- seriousness of the incident". A required field would force a number to be invented for holds that
-- correctly never open one.
--
-- PLACED IMMEDIATELY AFTER Associated SCAR Number, by id rather than by index, so the two
-- cross-references sit together and a hand-edit that reorders the section cannot silently put it
-- somewhere else. Only content->'form_schema' and the revision/effective date are written; the DO
-- block hashes everything else before and after.

begin;

do $$
declare
  r record;
begin
  select d.status, d.revision, d.type,
         (select count(*) from public.sop_document_responses x where x.document_id = d.id) as entries,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'associated_scar_number')                                      as scar,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'associated_capa_number')                                      as capa
    into r
    from public.sop_documents d where d.sop_number = 'FRM-702';

  if r is null then
    raise exception 'FRM-702 does not exist.';
  end if;
  if r.status <> 'active' or r.type <> 'form' then
    raise exception 'FRM-702 is % / type % - expected an active form.', r.status, r.type;
  end if;
  if r.revision <> 'New' then
    raise exception 'FRM-702 is at revision %, not New. Re-derive before bumping it to v2.', r.revision;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-702 now has % entries. Adding a field to a form in use is a different operation - stop and re-plan.',
      r.entries;
  end if;
  if r.scar <> 1 then
    raise exception 'Expected exactly one associated_scar_number field, found %.', r.scar;
  end if;
  if r.capa <> 0 then
    raise exception 'FRM-702 already has an associated_capa_number field.';
  end if;
end $$;

create temporary table frm702_before on commit drop as
select md5((content - 'form_schema')::text)                                    as h,
       (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                             jsonb_array_elements(s->'fields') f)              as fields
  from public.sop_documents where sop_number = 'FRM-702';

do $$
declare
  sec_idx int;
  fld_idx int;
begin
  -- Locate the SCAR field by id, not by a hardcoded position.
  select (si - 1), (fi - 1) into sec_idx, fld_idx
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality as a(s, si),
         jsonb_array_elements(s->'fields')                         with ordinality as b(f, fi)
   where d.sop_number = 'FRM-702' and f->>'id' = 'associated_scar_number';

  if sec_idx is null then
    raise exception 'associated_scar_number not found.';
  end if;

  update public.sop_documents
     set content = jsonb_insert(
           content,
           array['form_schema','sections', sec_idx::text, 'fields', (fld_idx + 1)::text],
           jsonb_build_object(
             'id',    'associated_capa_number',
             'type',  'text',
             'label', 'Associated CAPA Number',
             'width', 'full')),
         revision = 'v2',
         effective_date = date '2026-09-02'
   where sop_number = 'FRM-702' and status = 'active' and revision = 'New';
end $$;

do $$
declare
  r record;
  b record;
begin
  select d.revision, d.effective_date, d.status,
         (select count(*) from public.sop_document_responses x where x.document_id = d.id) as entries,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'associated_capa_number')                                      as capa,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                        as fields,
         -- it must sit immediately after the SCAR field, in the same section
         (select bool_or(f2->>'id' = 'associated_capa_number')
            from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') with ordinality as b1(f1, i1),
                 jsonb_array_elements(s->'fields') with ordinality as b2(f2, i2)
           where f1->>'id' = 'associated_scar_number' and i2 = i1 + 1)                     as adjacent,
         -- and it must not be required: not every hold raises a CAPA
         (select bool_or(coalesce((f->>'required')::boolean, false))
            from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f
           where f->>'id' = 'associated_capa_number')                                      as is_required,
         md5((d.content - 'form_schema')::text)                                            as h
    into r
    from public.sop_documents d where d.sop_number = 'FRM-702';

  select * into b from frm702_before;

  if r.capa <> 1 then
    raise exception 'Expected exactly one associated_capa_number field, found %.', r.capa;
  end if;
  -- coalesce: bool_or over no rows is null, and "if null then" would silently pass
  if not coalesce(r.adjacent, false) then
    raise exception 'associated_capa_number is not immediately after associated_scar_number.';
  end if;
  if coalesce(r.is_required, false) then
    raise exception 'associated_capa_number was made required - not every hold raises a CAPA.';
  end if;
  if r.fields <> b.fields + 1 then
    raise exception 'Field count went % -> %, expected exactly one more.', b.fields, r.fields;
  end if;
  if r.revision <> 'v2' or r.effective_date <> date '2026-09-02' or r.status <> 'active' then
    raise exception 'FRM-702 header wrong after the change: % / % / %.',
      r.revision, r.effective_date, r.status;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-702 gained entries during the migration (%).', r.entries;
  end if;
  if r.h is distinct from b.h then
    raise exception 'Something outside form_schema changed on FRM-702. Rolled back.';
  end if;
end $$;

commit;
