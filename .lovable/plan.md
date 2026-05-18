## Problem

Uploading a PSS from the client folder failed with **"Bucket not found"**.

`ClientDetail.handleDocUpload` writes to the storage bucket **`product-spec-sheets`**, but only three buckets exist in the project: `document-templates`, `batch-sheets`, `prf-uploads`. The PSS bucket was never created (project memory references it, but it's missing from the database).

## Fix

Create the missing private storage bucket and its access policies — one migration, no code changes.

### Migration

1. `insert into storage.buckets (id, name, public) values ('product-spec-sheets', 'product-spec-sheets', false)` (idempotent via `on conflict do nothing`).
2. Storage RLS policies on `storage.objects` for `bucket_id = 'product-spec-sheets'`:
   - **Staff / admin**: full read, insert, update, delete (uses `is_staff_or_admin(auth.uid())`).
   - **Clients**: read / insert / delete their own files only, where the first path segment equals their `auth.uid()` — matches the upload path pattern `${userId}/...` already used by `handleDocUpload`.

### Out of scope

- No changes to upload code, no changes to the batch-sheet flow.
- Existing PSS rows in `client_documents` (if any) keep working.

After the migration the user can re-upload the PSS and the "Create batch sheet" action will appear next to it.
