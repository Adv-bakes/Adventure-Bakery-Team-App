-- Stamp Effective Date (2026-06-01) and Approved By (GJM) on the equipment SOPs and forms.
--
-- Per the owner these are approved effective 2026-06-01 by GJM. Covers the five equipment sets:
--   mixer (SOP-501/901/FRM-909), Kook-E-King (SOP-502/902/FRM-910), Beldos (SOP-503/903/FRM-911),
--   Smipack shrink wrapper (SOP-601), Groen kettle (SOP-504/904/FRM-912) — 13 docs.
--
-- effective_date and approved_by are BOTH snapshot-watched fields and all 13 rows are active, so each
-- UPDATE fires the sop_document_history trigger (an audit snapshot recording the approval). Guarded on
-- the values not already being set, so re-running is a no-op and won't create duplicate snapshots.

begin;

update public.sop_documents
set effective_date = date '2026-06-01',
    approved_by    = 'GJM'
where sop_number in
    ('SOP-501','SOP-502','SOP-503','SOP-504','SOP-601',
     'SOP-901','SOP-902','SOP-903','SOP-904',
     'FRM-909','FRM-910','FRM-911','FRM-912')
  and (effective_date is distinct from date '2026-06-01' or approved_by is distinct from 'GJM');

commit;
