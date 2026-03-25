
Fix plan: get the Lovable project and the repo-generated Supabase config pointing to the same database, then reapply schema to Adv-bakes.

1. Confirm the mismatch
- Right now the codebase is still pointed at the old project:
  - `supabase/config.toml` → `ztykjygdojeeoldjrglu`
  - `.env` → `ztykjygdojeeoldjrglu`
  - `src/integrations/supabase/client.ts` → `https://ztykjygdojeeoldjrglu.supabase.co`
- The intended database is `zsukaixinoqmggpxxonn` (Adv-bakes).

2. Fix the actual project connection in Lovable
- This must be corrected at the Lovable project integration level first.
- Desktop:
  - Open the project
  - Click the Cloud view (cloud icon above preview), or click project name → Settings
  - Go to the Supabase/Integration area
  - Disconnect the old linked project if shown
  - Connect/select the Adv-bakes project (`zsukaixinoqmggpxxonn`)
- Mobile:
  - In Chat mode tap `...` bottom-right → Cloud or Settings
  - Open the Supabase/Integration area
  - Disconnect old project
  - Connect/select Adv-bakes (`zsukaixinoqmggpxxonn`)

3. Verify the reconnect actually propagated into code-generated config
- After reconnect, these must all change to `zsukaixinoqmggpxxonn`:
```text
supabase/config.toml
.env
src/integrations/supabase/client.ts
```
- If those files still show `ztykjygdojeeoldjrglu`, the project is still effectively bound to the old database for code/migrations.

4. Reapply schema to the correct database
- Once the connection is truly switched, re-run the missing migrations against Adv-bakes.
- This includes:
  - all existing migration files in `supabase/migrations/`
  - especially `20260325185922_ce30e0bf-18e7-44a0-a2fe-e3578f1ac1f8.sql` for `prf_submissions`
- Reason: the migration files exist in the repo, but Adv-bakes may not have received them yet.

5. Validate with two checks
- Schema check:
  - confirm Adv-bakes now has the expected tables, including `prf_submissions`
- End-to-end check:
  - submit a test PRF
  - verify the row lands in Adv-bakes, not the old database

6. Important constraint
- Do not “fix” this only by manually editing `.env` or `client.ts`.
- That would only change part of the app and can still leave migrations/backend actions pointed at the wrong project.
- The real fix is: update the linked Supabase integration first, then confirm the generated files changed, then reapply migrations.

7. Fallback if Lovable will not refresh the binding
- If reconnecting does not regenerate the project config, the clean fallback is:
  - duplicate/remix the project
  - connect the new copy to Adv-bakes first
  - then carry over the same codebase/migrations there
- That avoids continuing on a project with a stale backend binding.

Technical detail
```text
Correct state should be:

Lovable Supabase integration
        ↓
generated .env / client.ts / config.toml
        ↓
migrations + frontend writes
        ↓
Adv-bakes (zsukaixinoqmggpxxonn)
```

What I would do next after you confirm the reconnect is complete
- re-check the three config files
- identify which migrations Adv-bakes is missing
- then prepare the exact migration/application plan so all tables land in the correct database
