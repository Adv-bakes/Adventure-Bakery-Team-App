-- Constrain client_documents.review_status to the values the application actually understands.
--
-- The column is free text, and that is precisely why the `auto_approved` bug (fixed in
-- 20260817000002) went unnoticed for so long: every consumer tests `review_status = 'approved'`,
-- so an unrecognised value does not fail anything -- it silently reads as "not approved"
-- everywhere, and the row also drops out of the Documents Inbox filter, which lists only
-- pending/ai_passed/ai_flagged. The document ends up stranded with no way to resolve it, and
-- nothing anywhere complains. A typo, or a well-meant new status added in one place, reproduces
-- that exact failure.
--
-- The permitted set is every value written anywhere in the system, verified by enumerating both
-- the repo and the database's own functions:
--   pending      column default (20260516012745); SalesProjectWorkspace + PssIntake uploads
--   ai_passed    review-client-document, AI verdict
--   ai_flagged   review-client-document, AI verdict
--   approved     DocumentReviewPanel.decide(), finalize-pss-submission,
--                and the enforce_nda_auto_approval trigger (20260817000001)
--   rejected     DocumentReviewPanel.decide()
--
-- NULL remains permitted. The column is nullable and tightening that is a separate decision. Note
-- an IN-list alone would already admit NULL -- `NULL IN (...)` is unknown, and a CHECK passes on
-- unknown -- so it is spelled out below to make that a choice rather than an accident.

-- Fail with a readable message rather than a bare constraint violation if the data has drifted
-- since this was written.
do $$
declare
  bad text;
begin
  select string_agg(distinct quote_literal(review_status), ', ')
    into bad
    from public.client_documents
   where review_status is not null
     and review_status not in ('pending', 'ai_passed', 'ai_flagged', 'approved', 'rejected');

  if bad is not null then
    raise exception
      'client_documents.review_status holds unexpected value(s): %. Normalize these before adding the constraint.',
      bad;
  end if;
end
$$;

alter table public.client_documents
  drop constraint if exists client_documents_review_status_check;

alter table public.client_documents
  add constraint client_documents_review_status_check
  check (
    review_status is null
    or review_status in ('pending', 'ai_passed', 'ai_flagged', 'approved', 'rejected')
  );
