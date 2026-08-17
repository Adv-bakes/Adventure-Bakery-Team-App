-- Normalize the write-only `auto_approved` review status.
--
-- `finalize-pss-submission` (the PSS wizard's submit handler) inserted its client_documents row
-- with review_status = 'auto_approved'. Nothing anywhere read that value: every consumer tests
-- `review_status === 'approved'`, so it read as NOT approved everywhere it mattered --
--
--   * the project workspace showed a permanent "PSS uploaded but not yet approved (auto_approved)"
--     banner and a warning chip, and
--   * the Documents Inbox lists only pending / ai_passed / ai_flagged, so the document never
--     surfaced there either.
--
-- Which left a wizard-submitted PSS stuck displaying "not yet approved" with no path in the UI to
-- ever clear it. The edge function now writes 'approved'; that a human never reviewed it is
-- recorded on review_notes.source = 'pss_wizard', which is the right home for that provenance.
--
-- This pass catches rows written by the old function, including any created between this migration
-- being authored and the function being redeployed. It is idempotent and safe to re-run.

do $$
declare
  n integer;
begin
  select count(*) into n
    from public.client_documents
   where review_status = 'auto_approved';

  raise notice 'normalize_pss_auto_approved: % row(s) to normalize', n;
end
$$;

update public.client_documents
set    review_status = 'approved'
where  review_status = 'auto_approved';
