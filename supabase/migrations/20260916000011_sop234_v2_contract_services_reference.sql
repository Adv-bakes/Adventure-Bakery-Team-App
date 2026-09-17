-- SOP-2.3.4 v2 - point Vendor Approval at the contract services register.
--
-- FRM-206 was issued yesterday with nothing referring to it: no active document named it and none
-- carried 2.3.2.8. The register stands on its own and the Document Register lists it, so that was
-- not wrong - but somebody following the procedure that governs supplier approval had no way to
-- reach it, and a register nobody is sent to is a register nobody fills.
--
-- THE LINE IS A CROSS-REFERENCE, NOT A SCOPE EXTENSION, and the distinction is the whole point.
-- SOP-2.3.4's scope is "suppliers that provide ingredients, packaging, or cleaning chemicals", and
-- its approval steps are a COA, an SDS, an allergen statement, a certificate of origin, a GFSI
-- certificate. Running a pest control company through that list would produce nothing useful and
-- would misstate what approving a contract service means. So the new line says plainly what a
-- contract service provider is NOT - approved through the steps above - before saying where it IS
-- recorded. Without that, the reference would read as bringing them into scope.
--
-- sqf_reference IS DELIBERATELY UNCHANGED. Adding 2.3.2.8 here would have the Document Register
-- show this SOP as satisfying that clause, and it does not - FRM-206 does. A cross-reference is not
-- a claim of coverage.
--
-- WRITTEN AS PROSE, not a step. The `> ` marker is the SOP body convention for a paragraph of
-- prose (see groupProcedureSteps in sopDocxParser.ts); a plain line would render as a numbered step
-- and this is a clarification, not something anybody performs.
--
-- NOT TOUCHED, AND WORTH KNOWING: form_references already carried "FRM Vendor & Supplier
-- Questionnaire" and "FRM Approved Supplier Register" with no numbers - they are FRM-203 and
-- REP-201. Vague rather than wrong, so they are left alone rather than widened unasked, but the new
-- entry is numbered and they now sit inconsistently beside it.

begin;

do $guard$
declare st text; rev text; n int;
begin
  select status, revision, jsonb_array_length(content->'procedure')
    into st, rev, n
    from public.sop_documents where sop_number = 'SOP-2.3.4';

  if st is null then raise exception 'SOP-2.3.4 does not exist.'; end if;
  if (st, rev) is distinct from ('active', 'v1') or n <> 14 then
    raise exception 'SOP-2.3.4 is %/% with % procedure lines - expected active/v1/14.', st, rev, n;
  end if;
  if (select content->'procedure'->>13 from public.sop_documents where sop_number = 'SOP-2.3.4')
     not like '%Rejected%' then
    raise exception 'SOP-2.3.4 procedure[13] is not the last Supplier Status line; re-derive.';
  end if;
  if (select (content->'procedure')::text from public.sop_documents where sop_number = 'SOP-2.3.4')
     like '%FRM-206%' then
    raise exception 'SOP-2.3.4 already references FRM-206.';
  end if;
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FRM-206' and status = 'active') then
    raise exception 'FRM-206 is not active; this would point at an unissued document.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(
           content || jsonb_build_object('procedure',
             (content->'procedure') || to_jsonb(array[$p$> **Contract service providers are not approved through the steps above.** Pest control, chemical supply, laundry, waste haulage, calibration, external laboratory and sanitation providers supply a service rather than a material, and a certificate of analysis or an allergen statement asks them nothing. The description of their services, the training and licences their personnel must hold, and their contract are recorded on **FRM-206 Contract Services Register**, one entry per provider, as SQF 2.3.2.8 requires.$p$::text])),
           '{form_references}',
           to_jsonb((content->>'form_references') || E'\n' ||
                    'FRM-206 - Contract Services Register (contract service providers, SQF 2.3.2.8)')),
         '{revision_history}',
         to_jsonb($rh$v2 — 2026-09-16 — Cross-reference to FRM-206 Contract Services Register added, under D-10.

FRM-206 was issued with nothing referring to it. The register stands on its own and appears in the Document Register, but somebody following this procedure had no way to reach it, and a register nobody is sent to is a register nobody fills.

THE LINE IS A CROSS-REFERENCE, NOT A SCOPE EXTENSION. This procedure's scope is suppliers of ingredients, packaging and cleaning chemicals, and its approval steps are a COA, an SDS, an allergen statement and a third-party certificate. A pest control company has none of those and should not be run through the list. The new paragraph therefore says what a contract service provider is not — approved through these steps — before saying where it is recorded.

The SQF reference on this document is unchanged for the same reason: 2.3.2.8 is satisfied by FRM-206, not by this procedure, and pointing at a register is not a claim to cover the clause behind it.$rh$::text)),
       revision       = 'v2',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM'
 where sop_number = 'SOP-2.3.4';

do $verify$
declare r record;
begin
  select status, revision, effective_date, approved_by, sqf_reference,
         jsonb_array_length(content->'procedure') as lines
    into r
    from public.sop_documents where sop_number = 'SOP-2.3.4';

  if r.revision <> 'v2' or r.status <> 'active' or r.approved_by <> 'GJM'
     or r.effective_date <> date '2026-09-16' then
    raise exception 'SOP-2.3.4 wrong after update: %/%/%/%.',
      r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  if r.lines <> 15 then
    raise exception 'SOP-2.3.4 should have 15 procedure lines, has %.', r.lines;
  end if;

  -- the new line must be prose, not a numbered step, and must name the form
  if (select content->'procedure'->>14 from public.sop_documents where sop_number = 'SOP-2.3.4')
     not like '> %' then
    raise exception 'The new line is not marked as prose; it would render as a numbered step.';
  end if;
  if (select content->'procedure'->>14 from public.sop_documents where sop_number = 'SOP-2.3.4')
     not like '%FRM-206 Contract Services Register%' then
    raise exception 'The new line does not name FRM-206.';
  end if;
  -- it must say what these providers are NOT, or it reads as a scope extension
  if (select content->'procedure'->>14 from public.sop_documents where sop_number = 'SOP-2.3.4')
     not like '%not approved through the steps above%' then
    raise exception 'The new line does not exclude contract providers from this procedure''s approval steps.';
  end if;
  -- and the existing body must be untouched
  if (select content->'procedure'->>13 from public.sop_documents where sop_number = 'SOP-2.3.4')
     not like '%Rejected%' then
    raise exception 'The append displaced the existing procedure.';
  end if;
  if r.sqf_reference <> '2.3.4' then
    raise exception 'sqf_reference changed to % - a cross-reference is not a claim to cover 2.3.2.8.',
      r.sqf_reference;
  end if;
  if (select content->>'form_references' from public.sop_documents where sop_number = 'SOP-2.3.4')
     not like '%FRM-206%' then
    raise exception 'form_references does not list FRM-206.';
  end if;

  raise notice 'SOP-2.3.4 v2: FRM-206 cross-referenced as prose, scope and SQF reference unchanged.';
end $verify$;

commit;
