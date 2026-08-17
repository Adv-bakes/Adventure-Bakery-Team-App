-- Reconstruction of a migration that was applied directly and never committed.
--
-- Provenance, because half of this file is recovered source and half is reconstructed and the
-- difference matters to anyone auditing it:
--
--   * 2026-08-14  The work was run straight from the Supabase SQL editor and recorded in
--                 supabase_migrations.schema_migrations as 20260814000002
--                 (repoint_pandebono_prf_and_drop_junk_lead). No file was ever committed --
--                 `git log --all` finds no commit that has ever touched this path.
--   * 2026-08-17  The history row was deleted while untangling a `supabase db pull` mismatch,
--                 taking its `statements[]` column -- the only stored copy of the SQL -- with it.
--                 The database kept the effects; every record of what they were disappeared.
--
-- The DELETE block below is recovered VERBATIM from the saved SQL editor snippet
-- (ff40ff1b-f085-4083-8202-b7501fe33a46, 2026-08-14 21:37 UTC).
--
-- The UPDATE is RECONSTRUCTED from the observed end state, because the repoint half was never
-- saved as a snippet. It is not a guess: prf_submissions 5740ba7c ("Pandebono", company
-- "Guilt Free Bites LLC") points at sales_leads f5bd3165, whose company_name is the same
-- "Guilt Free Bites LLC" -- the PRF and the lead agree, so the intended target is unambiguous.
-- What cannot be recovered is the original statement's exact shape, which does not matter: this
-- reproduces the same end state.
--
-- Every statement is idempotent. On the production database, where all of this is already
-- applied, the whole file is a no-op. On a rebuild from scratch it reproduces the intended state.

-- Repoint the Pandebono PRF onto the correct client lead.
-- Guarded on the lead existing so a partial restore cannot trip the lead_id foreign key.
update public.prf_submissions
set    lead_id = 'f5bd3165-a5b7-4044-b634-b2bdfd9d4c6e'
where  id = '5740ba7c-4482-4714-bb41-612457b625b9'
  and  lead_id is distinct from 'f5bd3165-a5b7-4044-b634-b2bdfd9d4c6e'
  and  exists (
         select 1 from public.sales_leads
          where id = 'f5bd3165-a5b7-4044-b634-b2bdfd9d4c6e'
       );

-- Drop the junk test lead and its PRF (verbatim from the recovered snippet; the surrounding
-- begin/commit is dropped because migrations already run inside a transaction).
delete from public.prf_submissions
where id = 'ae61bad1-71da-45ba-866a-7f43962e1b59';

delete from public.sales_leads
where id = 'df989ca6-c23a-4e47-baa9-966f83cd43ac'
  and lower(email) = 'newbuyer@example.com';

do $$
declare
  repointed boolean;
  junk_gone boolean;
begin
  select exists (
           select 1 from public.prf_submissions
            where id = '5740ba7c-4482-4714-bb41-612457b625b9'
              and lead_id = 'f5bd3165-a5b7-4044-b634-b2bdfd9d4c6e'
         )
    into repointed;

  select not exists (
           select 1 from public.sales_leads
            where id = 'df989ca6-c23a-4e47-baa9-966f83cd43ac'
         )
    into junk_gone;

  raise notice 'repoint_pandebono_prf_and_drop_junk_lead: pandebono_repointed=% junk_lead_absent=%',
    repointed, junk_gone;
end
$$;
