-- SOP-2.3.4 v3 - pin the form references to real document numbers.
--
-- v2 added a numbered reference to FRM-206 and left two unnumbered ones beside it: "FRM Vendor &
-- Supplier Questionnaire" and "FRM Approved Supplier Register". Vague rather than wrong, which is
-- why v2 did not touch them - but one of the two is wrong in a way worth fixing:
--
--   "FRM Vendor & Supplier Questionnaire"  ->  FRM-203, which is exactly that.
--   "FRM Approved Supplier Register"       ->  REP-201, and it is NOT an FRM. It is a derived
--                                              report projected from FRM-202's entries, with no
--                                              entries of its own. Calling it a form tells somebody
--                                              to go and fill it in, which is not a thing that can
--                                              be done to it.
--
-- THE SAME TWO DOCUMENTS APPEAR IN `records` UNDER DIFFERENT NAMES AGAIN - "Vendor Questionnaire"
-- and "Approved Supplier List", the latter not being any document's title. Fixing form_references
-- and leaving records naming the same things loosely would reproduce the inconsistency one field
-- down, so both are pinned here. That is the plain reading of the request rather than a widening
-- of it.
--
-- SECOND REVISION OF THIS DOCUMENT TODAY, and that is the honest way to do it. v2 is issued; going
-- back and editing an issued revision in place would leave the change with no trail, which is the
-- thing document control exists to prevent.
--
-- WHAT IS NOT ADDED, AND WHY. FRM-202 (Supplier Approval & Evaluation Record), FRM-204 (Annual
-- Supplier Performance Evaluation Checklist) and FRM-205 (Supplier Non-Conformance & Corrective
-- Action Report) all exist and all belong to this procedure's subject, but the BODY of SOP-2.3.4
-- does not mention them - it predates them. Listing forms the procedure never tells anybody to use
-- would be a reference list that does not describe the procedure. That gap is D-11 Approved
-- Supplier Program Gaps, which is WIP, and it is a rewrite rather than a reference fix.

begin;

do $guard$
declare st text; rev text; fr text; rec text;
begin
  select status, revision, content->>'form_references', content->>'records'
    into st, rev, fr, rec
    from public.sop_documents where sop_number = 'SOP-2.3.4';

  if (st, rev) is distinct from ('active', 'v2') then
    raise exception 'SOP-2.3.4 is %/% - expected active/v2.', st, rev;
  end if;
  if fr not like '%FRM Vendor & Supplier Questionnaire%'
     or fr not like '%FRM Approved Supplier Register%' then
    raise exception 'SOP-2.3.4 form_references does not carry the two unnumbered entries this fixes.';
  end if;
  if fr not like '%FRM-206%' then
    raise exception 'SOP-2.3.4 has lost the FRM-206 reference added by v2.';
  end if;
  if rec not like '%Approved Supplier List%' then
    raise exception 'SOP-2.3.4 records does not carry the loose names this fixes.';
  end if;
  -- the documents being pointed at have to be the ones assumed
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FRM-203' and status = 'active'
                    and title ilike '%Vendor%Supplier Questionnaire%') then
    raise exception 'FRM-203 is not the active Vendor & Supplier Questionnaire.';
  end if;
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'REP-201' and status = 'active' and type = 'report'
                    and title ilike '%Approved Supplier Register%') then
    raise exception 'REP-201 is not the active Approved Supplier Register report.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(
           jsonb_set(content, '{form_references}', to_jsonb($fr$FRM-203 - Vendor & Supplier Questionnaire
REP-201 - Approved Supplier Register (a report projected from FRM-202 entries; nothing is filled in on it)
FRM-206 - Contract Services Register (contract service providers, SQF 2.3.2.8)$fr$::text)),
           '{records}', to_jsonb($rec$• FRM-203 Vendor & Supplier Questionnaire (completed and signed)
• REP-201 Approved Supplier Register
• Purchase Orders with supplier-verification checkbox
Review Frequency
Supplier list and documentation reviewed annually by QA Manager / Owner.$rec$::text)),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || E'\n\n' || $rh$v3 — 2026-09-16 — Form references pinned to document numbers.

v2 added a numbered reference to FRM-206 and left two unnumbered ones beside it. One was merely vague — "FRM Vendor & Supplier Questionnaire" is FRM-203. The other was wrong in a way that matters: "FRM Approved Supplier Register" is REP-201, and it is not a form at all. It is a report projected from FRM-202's entries, with no entries of its own, so calling it an FRM tells somebody to go and fill in a document that cannot be filled in.

The same two documents appeared again in the records list under different loose names — "Vendor Questionnaire" and "Approved Supplier List", the latter not being any document's title. Both are pinned, because fixing one field and leaving the other would reproduce the inconsistency one line down.

FRM-202, FRM-204 and FRM-205 are deliberately not added. They exist and they belong to this subject, but the body of this procedure does not mention them — it predates them — and a reference list should describe the procedure it sits on rather than the filing cabinet around it. Closing that gap is a rewrite, and it belongs to D-11.$rh$::text)),
       revision       = 'v3',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM'
 where sop_number = 'SOP-2.3.4';

do $verify$
declare r record; bad text;
begin
  select status, revision, effective_date, approved_by, sqf_reference,
         jsonb_array_length(content->'procedure')  as lines,
         content->>'form_references'               as fr,
         content->>'records'                       as rec
    into r
    from public.sop_documents where sop_number = 'SOP-2.3.4';

  if r.revision <> 'v3' or r.status <> 'active' or r.approved_by <> 'GJM'
     or r.effective_date <> date '2026-09-16' then
    raise exception 'SOP-2.3.4 wrong: %/%/%/%.', r.status, r.revision, r.approved_by, r.effective_date;
  end if;

  -- every reference now carries a number, and REP-201 is not described as a form
  foreach bad in array array['FRM Vendor & Supplier Questionnaire', 'FRM Approved Supplier Register',
                             'Approved Supplier List'] loop
    if r.fr like '%' || bad || '%' or r.rec like '%' || bad || '%' then
      raise exception 'SOP-2.3.4 still carries the loose reference "%".', bad;
    end if;
  end loop;
  if r.fr not like '%FRM-203%' or r.fr not like '%REP-201%' or r.fr not like '%FRM-206%' then
    raise exception 'SOP-2.3.4 form_references is missing one of FRM-203 / REP-201 / FRM-206.';
  end if;
  if r.rec not like '%FRM-203%' or r.rec not like '%REP-201%' then
    raise exception 'SOP-2.3.4 records is missing one of FRM-203 / REP-201.';
  end if;

  -- nothing else may have moved: the body, the scope claim and the clause coverage
  if r.lines <> 15 then
    raise exception 'SOP-2.3.4 procedure changed length to %; this revision touches references only.',
      r.lines;
  end if;
  if r.sqf_reference <> '2.3.4' then
    raise exception 'sqf_reference changed to %.', r.sqf_reference;
  end if;
  if (select content->'procedure'->>14 from public.sop_documents where sop_number = 'SOP-2.3.4')
     not like '%FRM-206 Contract Services Register%' then
    raise exception 'The v2 cross-reference paragraph was lost.';
  end if;
  -- the records field keeps everything it had beyond the two renamed lines
  if r.rec not like '%Purchase Orders with supplier-verification checkbox%'
     or r.rec not like '%reviewed annually by QA Manager / Owner%' then
    raise exception 'The records field lost content beyond the two references.';
  end if;

  raise notice 'SOP-2.3.4 v3: references pinned to FRM-203, REP-201 and FRM-206; body untouched.';
end $verify$;

commit;
