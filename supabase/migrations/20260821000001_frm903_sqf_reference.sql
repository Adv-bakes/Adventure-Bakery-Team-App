-- FRM-903 (Daily Sanitation, Pre-Operation & Release Record): complete the SQF clause list.
--
-- The row cites only 11.2.5.7 and 11.7.3.4, but the form discharges five requirements, one per
-- section:
--   1. Pre-Operation Cleanliness Check     -> 11.2.5.7  pre-op inspection after cleaning, by qualified staff
--   2. Production Equipment per SSOP       -> 11.2.5.1  cleaning methods and responsibility
--   3. Detergent & Sanitizer Verification  -> 11.2.5.3  "Mix concentrations shall be verified and
--                                                        records maintained"                  <- the gap
--   4. Glass & Brittle Plastic Check       -> 11.7.3.4  dial covers / MIG thermometers each shift
--   6. Corrective Actions & Release        -> 11.2.5.9  cleaning-effectiveness verification + records
--
-- 11.2.5.3 is the one that matters now: section 3 was extended on 2026-08-21 to record DETERGENT
-- concentration alongside sanitizer, which is what closes the Module 11 non-compliance against that
-- clause (the gap assessment's finding was that FRM-903 recorded sanitizer concentration only).
-- Without the clause on the row, the SOPs Library and Document Register clause chips do not point an
-- auditor from 11.2.5.3 to the form that satisfies it.
--
-- Section 5 (Operational GMP Check) is deliberately NOT represented. It spans several 11.3/11.4
-- clauses (jewelry 11.3.3.8, clothing and hair 11.3.3.1, processing practices 11.4.1.2); listing
-- them all would bury the five that actually carry the form. Revisit when the GMP program (FSQM-012)
-- lands and gives those checks their own home.
--
-- All five numbers were verified to exist in src/lib/sqfFoodClauses.ts before being written here —
-- a clause number that does not exist sends the auditor to a dead link, which is worse than none.
--
-- NOTE ON AUDIT TRAIL: sqf_reference is not one of the sop_document_history trigger's watched fields
-- (revision, sop_number, title, effective_date, approved_by, status, content->'form_schema'), so this
-- UPDATE does not create a snapshot. The prior value is therefore recorded here instead:
--     previous: '11.2.5.7, 11.7.3.4'
--
-- Idempotent: guarded on the target value, so re-running is a no-op.

begin;

update public.sop_documents
set sqf_reference = '11.2.5.1, 11.2.5.3, 11.2.5.7, 11.2.5.9, 11.7.3.4'
where sop_number = 'FRM-903'
  and sqf_reference is distinct from '11.2.5.1, 11.2.5.3, 11.2.5.7, 11.2.5.9, 11.7.3.4';

commit;
