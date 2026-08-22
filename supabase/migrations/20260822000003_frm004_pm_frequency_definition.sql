-- FRM-004 — spell out what "PM" means on the PM frequency column.
--
-- The column header reads "PM frequency" with the abbreviation defined nowhere the person
-- filling the form can see it. Someone on the floor could read it as preventive maintenance,
-- planned maintenance, or nothing at all — on a register whose job is to be unambiguous to an
-- auditor, that is a small defect. The owner chose to keep the header and define the term
-- rather than rename the column.
--
-- The definition goes in the SECTION DESCRIPTION, not in a column help text, for two reasons:
--   1. GridColumn has no `help` property at all (src/lib/formSchema.ts) — the grid FIELD has one,
--      but it renders under the whole table, not against the column.
--   2. More importantly, `help` never reaches paper. Neither src/lib/formPdf.ts nor
--      scripts/generate-form-blank.py renders `help` for any field type, so a printed blank or a
--      downloaded entry would still carry the bare abbreviation. Section `description` renders on
--      screen (FormRenderer.tsx:120) AND in the printed blank (generate-form-blank.py:28), which
--      is the coverage this needs.
--
-- FRM-004 is status='draft' with no entries, so:
--   * no revision bump — the document has never been approved, so there is no approved version to
--     supersede;
--   * no history snapshot — the trigger is WHEN (OLD.status = 'active') (20260709000001), so a
--     draft edit is not an audit event.
--
-- Idempotent: guarded on the definition not already being present. The path index is asserted
-- against the section id rather than trusted, so a schema reshuffle fails the guard instead of
-- writing the description onto the wrong section.

begin;

update public.sop_documents
set content = jsonb_set(
      content,
      '{form_schema,sections,1,description}',
      to_jsonb('Every item of equipment on site, with the documents that govern it and its maintenance frequency (SQF 11.2.1.2). PM frequency = preventive maintenance: how often the item is scheduled for planned maintenance.'::text))
where sop_number = 'FRM-004'
  and content #>> '{form_schema,sections,1,id}' = 'register'
  and content #>> '{form_schema,sections,1,description}' not like '%preventive maintenance%';

do $$
begin
  if not exists (
    select 1 from public.sop_documents
     where sop_number = 'FRM-004'
       and content #>> '{form_schema,sections,1,description}' like '%PM frequency = preventive maintenance%'
  ) then
    raise exception 'FRM-004: the PM definition did not apply — section 1 is not the register section, or the description has drifted from what this migration expects.';
  end if;
end $$;

commit;
