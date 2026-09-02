-- FRM-002 gains a CAPA Ref field, and REP-003's CAPA Ref column starts carrying it. D-07.
--
-- THIS IS A GAP THE CODEBASE HAD ALREADY FOUND, DOCUMENTED, AND LEFT OPEN. FORM_REPORTS.md, in the
-- REP-003 mapping table, lists the column as:
--
--   | CAPA Ref | const | *blank* - FRM-002 has no CAPA/CAR-number field yet |
--
-- followed by "Known gap: to fill CAPA Ref, add a capa_ref field to FRM-002 and switch that column
-- from const to field." That is exactly what this migration does. The column has rendered an empty
-- string on every complaint since REP-003 was seeded, because there was nothing on the source form
-- to put in it and no CAPA numbers to write there in the first place. D-07 mints both.
--
-- WHY IT MATTERS BEYOND TIDINESS. 2.1.3.3 requires records of customer complaints, THEIR
-- INVESTIGATION AND THEIR RESOLUTION, with corrective and preventive action taken as outlined in
-- 2.5.3. A complaint log with a permanently blank CAPA column is a log that cannot show an auditor
-- the link between a complaint and the action it caused - which is the specific thing the finding
-- against 2.1.3.3 says the site could not do.
--
-- WHERE THE FIELD GOES, AND WHY NOT AT THE END. It is inserted as the FIRST field of Section 6
-- (Corrective & Preventive Action), immediately after that section's instruction block, so the
-- question "did this complaint open a CAPA, and which one" is answered before the section's own
-- free-text action fields rather than after them. The section index is looked up by its id rather
-- than hardcoded, so a future re-section of FRM-002 cannot make this migration write into the wrong
-- place if it is ever replayed.
--
-- IT IS ADDITIVE AND TOUCHES NO EXISTING FIELD ID. Response data is a flat {fieldId: value} map and
-- ids are the join key between an answer and the schema, so renaming or reordering one would orphan
-- an answer. Nothing here is renamed; one id is added.
--
-- FRM-002 HAS ONE SUBMITTED ENTRY, AND THE REVISION BUMP IS WHAT PROTECTS IT. That entry pins
-- form_revision='New'. Bumping FRM-002 to v2 fires the sop_document_history trigger (it watches
-- revision, and content->'form_schema'), which snapshots the PRIOR row - so the existing entry
-- keeps resolving against the schema it was actually filled under, and renders exactly as it did
-- yesterday, without the new field. The assertion below proves that snapshot was created; without
-- it, this would be a silent schema change under a live record.
--
-- REP-003 IS BUMPED TOO. Its content change is to report_schema, which the history trigger does NOT
-- watch (it watches content->'form_schema' only) - but the revision field IS watched, so the bump
-- itself creates the snapshot. Both documents move to v2 with today's effective date, because
-- content that changes while the revision does not is precisely the drift INT-14's document control
-- report exists to catch.
--
-- Written with jsonb_insert / jsonb_set on the specific path, so content->'attachments' is never in
-- the write path on either document.

begin;

do $$
declare
  r record;
begin
  select
    (select status   from public.sop_documents where sop_number = 'FRM-002')            as s002,
    (select revision from public.sop_documents where sop_number = 'FRM-002')            as r002,
    (select status   from public.sop_documents where sop_number = 'REP-003')            as s003,
    (select revision from public.sop_documents where sop_number = 'REP-003')            as r003,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-002' and f->>'id' = 'capa_ref')                         as already,
    (select c->'source'->>'kind'
       from public.sop_documents d,
            jsonb_array_elements(d.content->'report_schema'->'columns') c
      where d.sop_number = 'REP-003' and c->>'id' = 'capa_ref')                         as col_kind
  into r;

  if r.s002 is distinct from 'active' or r.s003 is distinct from 'active' then
    raise exception 'Expected both active; found FRM-002=%, REP-003=%.', r.s002, r.s003;
  end if;
  if r.r002 is distinct from 'New' or r.r003 is distinct from 'New' then
    raise exception 'Expected both at revision New; found FRM-002=%, REP-003=%. Re-derive before applying.',
      r.r002, r.r003;
  end if;
  if r.already <> 0 then
    raise exception 'FRM-002 already has a capa_ref field.';
  end if;
  if r.col_kind is distinct from 'const' then
    raise exception 'REP-003 capa_ref column is % rather than the expected const placeholder.',
      coalesce(r.col_kind, 'missing');
  end if;
end $$;

-- ---------------------------------------------------------------- FRM-002
do $$
declare
  sec_idx int;
begin
  select (so - 1)::int into sec_idx
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality s(s, so)
   where d.sop_number = 'FRM-002'
     and s->>'id' = 'corrective_preventive_action_capa';

  if sec_idx is null then
    raise exception 'FRM-002 has no corrective_preventive_action_capa section - re-derive.';
  end if;

  update public.sop_documents
     set content = jsonb_insert(
                     content,
                     array['form_schema','sections', sec_idx::text, 'fields', '1'],
                     $f$
{
  "id": "capa_ref",
  "type": "text",
  "label": "CAPA No.",
  "width": "half",
  "showInList": true,
  "help": "The FRM-007 number, where this complaint opened a corrective action. FSQM-009 Part 3: a critical complaint, or one alleging illness, injury, foreign material or an undeclared allergen, always opens one."
}
$f$::jsonb),
         revision = 'v2',
         effective_date = date '2026-09-02'
   where sop_number = 'FRM-002'
     and status = 'active'
     and revision = 'New';
end $$;

-- ---------------------------------------------------------------- REP-003
do $$
declare
  col_idx int;
begin
  select (co - 1)::int into col_idx
    from public.sop_documents d,
         jsonb_array_elements(d.content->'report_schema'->'columns') with ordinality x(c, co)
   where d.sop_number = 'REP-003'
     and c->>'id' = 'capa_ref';

  if col_idx is null then
    raise exception 'REP-003 has no capa_ref column - re-derive.';
  end if;

  update public.sop_documents
     set content = jsonb_set(
                     content,
                     array['report_schema','columns', col_idx::text, 'source'],
                     '{"kind": "field", "field": "capa_ref"}'::jsonb),
         revision = 'v2',
         effective_date = date '2026-09-02'
   where sop_number = 'REP-003'
     and status = 'active'
     and revision = 'New';
end $$;

do $$
declare
  r record;
begin
  select
    (select revision from public.sop_documents where sop_number = 'FRM-002')            as r002,
    (select revision from public.sop_documents where sop_number = 'REP-003')            as r003,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-002' and f->>'id' = 'capa_ref')                         as added,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-002')                                                   as fields,
    -- the new field must sit in the CAPA section, not wherever an index happened to land
    (select s->>'id'
       from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-002' and f->>'id' = 'capa_ref')                         as in_section,
    -- every pre-existing id must survive; the one entry's answers key on them
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-002'
        and f->>'id' in ('complaint_ref_no','root_cause_sqf_2_5_3_1','closure_date',
                         'corrective_and_preventive_action_taken','signature'))         as kept,
    (select c->'source'->>'kind'
       from public.sop_documents d,
            jsonb_array_elements(d.content->'report_schema'->'columns') c
      where d.sop_number = 'REP-003' and c->>'id' = 'capa_ref')                         as col_kind,
    (select c->'source'->>'field'
       from public.sop_documents d,
            jsonb_array_elements(d.content->'report_schema'->'columns') c
      where d.sop_number = 'REP-003' and c->>'id' = 'capa_ref')                         as col_field,
    (select jsonb_array_length(content->'report_schema'->'columns')
       from public.sop_documents where sop_number = 'REP-003')                          as cols,
    -- the live entry's schema must still be recoverable at the revision it pinned
    (select count(*) from public.sop_document_history h
       join public.sop_documents d on d.id = h.document_id
      where d.sop_number = 'FRM-002' and h.revision = 'New')                            as snapshot,
    (select count(*) from public.sop_document_responses p
       join public.sop_documents d on d.id = p.document_id
      where d.sop_number = 'FRM-002')                                                   as entries,
    (select jsonb_array_length(content->'attachments')
       from public.sop_documents where sop_number = 'FRM-002')                          as atts
  into r;

  if r.r002 <> 'v2' or r.r003 <> 'v2' then
    raise exception 'Revisions did not bump: FRM-002=%, REP-003=%.', r.r002, r.r003;
  end if;
  if r.added <> 1 then
    raise exception 'FRM-002 has % capa_ref fields, expected exactly 1.', r.added;
  end if;
  if r.fields <> 38 then
    raise exception 'FRM-002 now has % fields, expected 38 (37 + capa_ref). Something else changed.',
      r.fields;
  end if;
  if r.in_section <> 'corrective_preventive_action_capa' then
    raise exception 'capa_ref landed in section % rather than the CAPA section.', r.in_section;
  end if;
  if r.kept <> 5 then
    raise exception 'Only % of the 5 sampled pre-existing FRM-002 field ids survive - answers key on these.',
      r.kept;
  end if;
  if r.col_kind <> 'field' or r.col_field <> 'capa_ref' then
    raise exception 'REP-003 column not rewired: kind=%, field=%.', r.col_kind, r.col_field;
  end if;
  if r.cols <> 10 then
    raise exception 'REP-003 now has % columns, expected 10.', r.cols;
  end if;
  -- FRM-002's one entry pinned form_revision='New'; without this snapshot it would resolve
  -- against the live v2 schema and gain a field it was never filled under.
  if r.entries > 0 and r.snapshot < 1 then
    raise exception 'FRM-002 has % entries pinned at revision New but no history snapshot was created.',
      r.entries;
  end if;
  if r.atts is null then
    raise exception 'FRM-002 attachments list was disturbed.';
  end if;
end $$;

commit;
