-- Glass & Brittle Plastic Control — reconcile the SOP against SQF Food Safety Code:
-- Food Manufacturing, Edition 9, clause 11.7.3.
--
-- Findings this migration closes:
--   1. The SOP listed 11.7.3.4 in sqf_reference but its procedure had NO start-of-shift check.
--      11.7.3.4 is the only fixed frequency in the code ("Glass instrument dial covers on
--      processing equipment and MIG thermometers shall be inspected at the start of each shift").
--      Monthly was the only cadence in the body. Step 2 below adds it, recorded on FRM-903.
--   2. The SOP pointed at "FRM003" (a legacy number) for both the register and breakage records.
--      Current numbers are FRM-907 (register) and FRM-908 (Glass Breakage Incident Report) —
--      FRM-908 existed but the SOP never cited it.
--   3. sop_number 'SOP-11.7.5' contradicted the document's own sqf_reference (11.7.3.1–.5) and the
--      Ed. 9 clause map in src/lib/sqfFoodClauses.ts, where glass sits at 11.7.3 and 11.7.5 does
--      not exist as a foreign-matter clause (11.7.4 is Detection of Foreign Objects). SOPs are
--      numbered by the clause they implement (DOCUMENT_REGISTER.md), so this renumbers to
--      SOP-11.7.3 and preserves the prior identifier in legacy_sop_number.
--   4. FRM-907's info notes cited SOP-11.7.5 and promised 12-month retention while the SOP said
--      >= 2 years. Reconciled to 2 years per the SOP (owner decision, 2026-07-15).
--
-- Notes on mechanics:
--   * sop_documents.content is jsonb. Both updates MERGE (|| / jsonb_set) so `attachments` and any
--     other keys survive.
--   * No field ids change. The FRM-907 edit rewrites info-note *text* only, so the 3 existing
--     responses keep resolving cleanly against the live schema.
--   * SOP-11.7.5 is status='active', so its UPDATE fires sop_documents_snapshot and writes a
--     sop_document_history row (changed_fields will include sop_number, revision, effective_date).
--     That snapshot IS the audit trail for this renumber. FRM-907 is status='draft', so it does not
--     snapshot (the trigger is WHEN old.status='active') — intended; it has no approved revision yet.
--   * Id-keyed and safe to run once. Re-running is a no-op for the renumber but the FRM-907
--     replaces are idempotent (the search strings no longer match after the first run).
--
-- REVIEW BEFORE RUNNING:
--   * effective_date is set to 2026-07-15. Change it to the date this revision is actually
--     approved and trained out, if different.
--   * revision goes 'New' -> 'Rev A'. The table has no consistent convention today
--     ("New" x71, "v1" x8, "Rev A", "Rev C", "v2", "1"), so pick whatever matches your paper.
--   * "Production Lead (or shift designee)" in `responsibility` is an assumption — set the role
--     that actually owns the start-of-shift check.

begin;

-- 1. SOP-11.7.5 -> SOP-11.7.3, with the per-shift check and corrected form references -----------
update public.sop_documents set
  sop_number        = 'SOP-11.7.3',
  legacy_sop_number = 'SOP-11.7.5',
  revision          = 'Rev A',
  effective_date    = '2026-07-15',
  content = content || jsonb_build_object(
    'procedure', jsonb_build_array(
      '1. Maintain an updated Glass & Brittle Plastic Register (FRM-907) listing every glass, hard/brittle plastic, and ceramic item in food handling, processing, and storage zones, together with its location and condition. [SQF 11.7.3.2]',
      '2. At the start of each shift, inspect glass instrument dial covers on processing equipment and any MIG thermometers to confirm they have not been damaged. Record on FRM-903 (GMP Pre-Operation Inspection). [SQF 11.7.3.4]',
      '3. Inspect all areas monthly against the register; record location, condition, risk rating, and any corrective action on FRM-907. [SQF 11.7.3.3]',
      '4. Label non-removable glass items with unique ID numbers.',
      '5. In case of breakage:',
      '• Stop production in the affected area and isolate it.',
      '• Remove all exposed product and debris.',
      '• Clean, thoroughly inspect (including cleaning equipment and footwear), and have a suitably responsible person clear the area before operations restart.',
      '• Document on FRM-908 (Glass Breakage Incident Report). [SQF 11.7.3.5]',
      '6. Keep records for a minimum of 2 years.'
    ),
    'records',
      'FRM-903 — GMP Pre-Operation Inspection (start-of-shift dial cover / MIG thermometer check) · ' ||
      'FRM-907 — Glass & Brittle Plastic Register (monthly inspection) · ' ||
      'FRM-908 — Glass Breakage Incident Report (breakage events). Retained a minimum of 2 years.',
    'form_references', 'FRM-903, FRM-907, FRM-908',
    'responsibility',
      '• SQF Practitioner: maintains the master register (FRM-907).' || chr(10) ||
      '• Production Lead (or shift designee): performs the start-of-shift glass dial cover and MIG thermometer check and records it on FRM-903.' || chr(10) ||
      '• QA Technician: performs the monthly inspection and documents results on FRM-907.' || chr(10) ||
      '• Maintenance: replaces damaged items immediately and records disposition.'
  )
where id = '2ec4b753-5b4f-4d19-a3aa-10a50311debc';

-- 2. FRM-907 — repoint SOP references, reconcile retention, cite FRM-908 for breakage ----------
-- Scoped to content->'form_schema' so nothing else in content is touched. Each search string
-- occurs only in the info notes it targets (verified against the live row 2026-07-15).
update public.sop_documents set
  content = jsonb_set(
    content,
    '{form_schema}',
    replace(
      replace(
        replace(
          (content -> 'form_schema')::text,
          'SOP-11.7.5', 'SOP-11.7.3'
        ),
        'minimum of 12 months', 'minimum of 2 years'
      ),
      'and clear before resuming', 'and clear before resuming, and be recorded on FRM-908'
    )::jsonb
  )
where id = '1a328ec9-9102-4f59-82c1-4ffce171a1c6';

commit;
