-- Two corrections to the facility layout drawing, both found by reading the remediation plan
-- workbook after the document had already been seeded.
--
-- 1. RENUMBER FSQM-037 -> FSQM-039.
--    FSQM-037 was already allocated by the plan to D-36 Waste Management Program, and FSQM-038 to
--    D-19 Internal Audit Program. The whole run FSQM-001..038 is reserved in the workbook. The
--    number was picked by reading the MIGRATIONS -- what has been built -- instead of the PLAN,
--    which reserves numbers ahead of construction. FSQM-039 is free in both.
--
-- 2. FIX THE GMP CROSS-REFERENCE: FSQM-013 -> FSQM-012.
--    The seeded content says "FSQM-013 governs the premises and the GMP controls". That is wrong.
--    FSQM-012 is the Good Manufacturing Practices Program, issued 2026-09-01. FSQM-013 is the
--    Module 11 Applicability & Exemption Analysis. The D-14 row in the workbook records the
--    renumbering that caused the confusion: that row had reserved FSQM-013, which was then used on
--    2026-09-01 for the exemption analysis.
--    Three places in content name FSQM-013 -- procedure, governing_reference and revision_history --
--    and all three mean the GMP programme.
--
-- WHY A NEW FILE RATHER THAN AN EDIT TO 20260915000001. That migration has already been pushed.
-- db push records a migration by FILENAME, so an edit to it could never run: production would hold
-- the first version while the repo described the second. That divergence has bitten this project
-- twice (2026-09-09) and is the reason a pushed file is treated as immutable.
--
-- ATTACHMENTS ARE UNAFFECTED by the rename: they are keyed on the row's uuid, not on sop_number.
-- NO HISTORY SNAPSHOT IS EXPECTED: the trigger only fires for published documents and this is draft.
-- IDEMPOTENT: a state already matching what this produces is a clean no-op; a different state raises.

begin;

do $$
declare
  n37 int; n39 int; t37 text; t39 text; st37 text; refs int;
begin
  select count(*), max(title), max(status) into n37, t37, st37
    from public.sop_documents where sop_number = 'FSQM-037';
  select count(*), max(title) into n39, t39
    from public.sop_documents where sop_number = 'FSQM-039';

  if n37 = 0 and n39 = 1 and t39 = 'Facility Layout and Product Flow' then
    raise notice 'Rename already applied.';
  else
    if n37 <> 1 then
      raise exception 'Expected exactly one FSQM-037, found %.', n37;
    end if;
    if t37 is distinct from 'Facility Layout and Product Flow' then
      raise exception 'FSQM-037 is %, not the facility layout drawing. Refusing to renumber.', t37;
    end if;
    if st37 is distinct from 'draft' then
      raise exception 'FSQM-037 is %, not draft. An issued document is renumbered by a reviewed '
                      'crosswalk, not by this migration.', st37;
    end if;
    if n39 <> 0 then
      raise exception 'FSQM-039 already exists (%). Pick another number.', t39;
    end if;
    select count(*) into refs from public.sop_documents
     where sop_number <> 'FSQM-037'
       and (content::text like '%FSQM-037%' or coalesce(sqf_reference, '') like '%FSQM-037%');
    if refs <> 0 then
      raise exception '% other document(s) cite FSQM-037; fix those before renumbering.', refs;
    end if;

    update public.sop_documents set sop_number = 'FSQM-039' where sop_number = 'FSQM-037';
    raise notice 'Renumbered FSQM-037 -> FSQM-039. FSQM-037 is free for D-36 Waste Management.';
  end if;
end $$;

-- The document this drawing points at for premises and GMP must be the one that actually is it.
do $$
declare n int;
begin
  select count(*) into n from public.sop_documents
   where sop_number = 'FSQM-012' and title = 'Good Manufacturing Practices Program'
     and status = 'active';
  if n <> 1 then
    raise exception 'FSQM-012 Good Manufacturing Practices Program is not active; '
                    'do not repoint the reference at it.';
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(
           jsonb_set(content, '{governing_reference}',
                     to_jsonb(replace(content->>'governing_reference', 'FSQM-013', 'FSQM-012'))),
           '{revision_history}',
                     to_jsonb(replace(content->>'revision_history', 'FSQM-013', 'FSQM-012'))),
         '{procedure}',
         (select jsonb_agg(replace(e, 'FSQM-013', 'FSQM-012') order by ord)
            from jsonb_array_elements_text(content->'procedure') with ordinality as t(e, ord)))
 where sop_number = 'FSQM-039'
   and content::text like '%FSQM-013%';

do $$
declare r record;
begin
  select sop_number, title, status, revision, type, category,
         sqf_reference, sqf_required, approved_by, effective_date,
         jsonb_array_length(content->'attachments') as files,
         jsonb_array_length(content->'procedure')   as lines,
         content::text like '%FSQM-013%'            as still_wrong,
         (content->>'governing_reference') like '%FSQM-012 governs the premises%' as gmp_fixed
    into r
    from public.sop_documents where sop_number = 'FSQM-039';

  if r.sop_number is null then
    raise exception 'FSQM-039 not present after renumber.';
  end if;
  if r.title is distinct from 'Facility Layout and Product Flow'
     or r.status is distinct from 'draft' or r.revision is distinct from 'New'
     or r.type is distinct from 'fsqm' then
    raise exception 'FSQM-039 is %/%/%/%; expected the draft facility layout drawing.',
      r.title, r.status, r.revision, r.type;
  end if;
  if r.sqf_reference is not null or r.sqf_required is not false then
    raise exception 'FSQM-039 gained a clause reference (%/%).', r.sqf_reference, r.sqf_required;
  end if;
  if r.approved_by is not null or r.effective_date is not null then
    raise exception 'FSQM-039 gained an approver or effective date.';
  end if;
  if coalesce(r.files, 0) <> 3 then
    raise exception 'FSQM-039 has % attachment(s); expected 3 to survive.', coalesce(r.files, 0);
  end if;
  -- 27 procedure lines were seeded; a jsonb_agg that lost or reordered elements would show here
  if r.lines <> 27 then
    raise exception 'FSQM-039 procedure is % lines, expected 27; the array rebuild lost elements.',
      r.lines;
  end if;
  if r.still_wrong then
    raise exception 'FSQM-039 still names FSQM-013 somewhere in content.';
  end if;
  if not r.gmp_fixed then
    raise exception 'FSQM-039 governing_reference does not point at FSQM-012 for premises/GMP.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number = 'FSQM-037') then
    raise exception 'FSQM-037 still exists; it must be free for D-36.';
  end if;

  raise notice 'FSQM-039 verified: draft / New / % lines / 3 attachments / GMP ref = FSQM-012. '
               'FSQM-037 free for D-36.', r.lines;
end $$;

commit;

-- STILL TO DO AFTER THIS PUSHES:
--   1. Re-export both sheets from the .drawio master (its title block and both sheet lines now read
--      FSQM-039) and replace the two PDFs on the record. The .drawio attachment is already correct.
--   2. The SQF Practitioner confirms the zone boundaries on the floor -- the one open item.
--   3. Then the issue migration: status active, approved_by GJM, effective_date stamped.
