-- The five projected reports become REP-numbered report documents.
--
-- Each of these is already a report wearing a form's clothes, and the data says so without
-- interpretation: none has a form_schema, none has ever held a single entry, and every one projects
-- another form's responses through content.report_schema.
--
--   FRM-003 Customer Complaint Log            <- FRM-002   ->  REP-003
--   FRM-201 Approved Supplier Register        <- FRM-202   ->  REP-201
--   FRM-602 Approved Label Register           <- FRM-601   ->  REP-602
--   FRM-603 Label Change Control Log          <- FRM-601   ->  REP-603
--   FRM-701 QA Product & Material Release Log <- FRM-702   ->  REP-701
--
-- FRM means "form": a blank somebody fills. Nobody fills these; they are a live view of somebody
-- else's entries. This is the same correction 20260831000008 made to the Training Matrix, applied
-- to the documents that had the identical problem.
--
-- ONLY THE PREFIX MOVES. Every number keeps its digits, so every document keeps its DOC_STAGES
-- block - REP-003 stays in Food Safety System next to its source FRM-002, REP-602/603 stay in
-- Packaging & Labeling next to FRM-601, REP-701 stays in QC next to FRM-702. The adjacency between
-- a report and the form it reads is worth preserving; it is how somebody finds one from the other.
-- legacy_sop_number keeps the old number on each row.
--
-- ONE CITATION IN THE WHOLE ESTATE. FRM-001 Management Review Record names FRM-003 inside a fixed
-- grid row label ("Analyze trends from FRM-002 and FRM-003"). The other four are cited by nobody.
-- FRM-001 goes v2 to v3 for that one line.
--
-- WHY FRM-001 GETS A REVISION BUMP RATHER THAN A SILENT EDIT. It has one submitted entry, and
-- responses pin form_revision at creation. Bumping fires the history trigger, which snapshots the
-- v2 row, so that entry keeps resolving against the label it was actually filled under while new
-- entries get the corrected one. Editing the schema in place without the bump would retroactively
-- change what a filed record appears to say.
--
-- THE APP CHANGE IS NOT OPTIONAL AND SHIPS WITH THIS. SopsLibrary gated the Report tab on
-- type='form'. Typed correctly and without that fix, all five reports would render a drawer with no
-- Report tab at all - the report becomes invisible in its own document. The gate now keys on
-- type='report'.

begin;

do $$
declare
  before_schema text;
  after_schema text;
  n_renamed int;
  bad text;
begin
  select content->>'form_schema' into before_schema
    from public.sop_documents where sop_number = 'FRM-001';

  update public.sop_documents d
     set type = 'report',
         sop_number = v.new_number,
         legacy_sop_number = v.old_number
    from (values
      ('FRM-003', 'REP-003'),
      ('FRM-201', 'REP-201'),
      ('FRM-602', 'REP-602'),
      ('FRM-603', 'REP-603'),
      ('FRM-701', 'REP-701')
    ) as v(old_number, new_number)
   where d.sop_number = v.old_number
     and d.status = 'active'
     and d.type = 'form'
     -- belt and braces: only ever reclassify something that really is a projected report
     and d.content ? 'report_schema'
     and not (d.content ? 'form_schema');

  get diagnostics n_renamed = row_count;

  -- FRM-001's grid row label is the only place any of these numbers is cited.
  update public.sop_documents
     set content = jsonb_set(content, '{form_schema}',
           replace(content->>'form_schema', 'FRM-003', 'REP-003')::jsonb),
         revision = 'v3',
         effective_date = date '2026-08-31'
   where sop_number = 'FRM-001' and status = 'active'
     and content->>'form_schema' like '%FRM-003%';

  select content->>'form_schema' into after_schema
    from public.sop_documents where sop_number = 'FRM-001';

  select string_agg(x, '; ') into bad from (
    select 'renamed ' || n_renamed::text || ' documents, expected 5' as x where n_renamed <> 5
    union all
    select 'REP number missing or wrong type: ' || n from (values
      ('REP-003'),('REP-201'),('REP-602'),('REP-603'),('REP-701')) as w(n)
     where not exists (select 1 from public.sop_documents
                        where sop_number = w.n and status = 'active' and type = 'report')
    union all
    select 'legacy number not recorded on ' || sop_number from public.sop_documents
     where sop_number in ('REP-003','REP-201','REP-602','REP-603','REP-701')
       and legacy_sop_number is null
    union all
    select 'an active document still carries the old number ' || sop_number
      from public.sop_documents
     where sop_number in ('FRM-003','FRM-201','FRM-602','FRM-603','FRM-701') and status = 'active'
    union all
    -- after this, no form may carry a report_schema: reports are their own documents, and the
    -- SopsLibrary Report tab now only renders for type='report'
    select 'a form still carries a report_schema: ' || sop_number from public.sop_documents
     where type = 'form' and status = 'active' and content ? 'report_schema'
    union all
    -- reports must not have gained entries or a fillable schema in the process
    select 'a report document has a form_schema: ' || sop_number from public.sop_documents
     where type = 'report' and content ? 'form_schema'
    union all
    select 'FRM-001 still cites FRM-003' from public.sop_documents
     where sop_number = 'FRM-001' and content->>'form_schema' like '%FRM-003%'
    union all
    select 'FRM-001 does not cite REP-003' from public.sop_documents
     where sop_number = 'FRM-001' and content->>'form_schema' not like '%REP-003%'
    union all
    select 'FRM-001 is revision ' || coalesce(revision,'null') || ', expected v3'
      from public.sop_documents where sop_number = 'FRM-001' and revision is distinct from 'v3'
    union all
    -- the ONLY difference in that schema may be the number: a jsonb round-trip that reordered or
    -- dropped a key would show up as a length change here
    select 'FRM-001 form_schema changed by more than the citation ('
           || length(before_schema)::text || ' -> ' || length(after_schema)::text || ' chars)'
     where length(after_schema) is distinct from length(before_schema)
    union all
    -- the source forms must be untouched; they are what these reports read
    select 'a source form was renumbered: ' || n from (values
      ('FRM-001'),('FRM-002'),('FRM-202'),('FRM-601'),('FRM-702')) as w(n)
     where not exists (select 1 from public.sop_documents
                        where sop_number = w.n and status = 'active')
  ) t;

  if bad is not null then
    raise exception 'the projected-report renumber did not apply cleanly: %', bad;
  end if;

  raise notice 'reclassified % projected reports as REP-numbered report documents', n_renamed;
end $$;

commit;
