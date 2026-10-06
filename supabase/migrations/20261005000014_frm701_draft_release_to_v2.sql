-- FRM-701: move the one draft release record (lot 6270) from form revision "New" to "v2".
--
-- 20261005000013 added the net weight check to FRM-701 and took it to v2. It changed the schema in
-- eight separate UPDATEs, so the document history holds eight snapshots of FRM-701 labelled revision
-- "New" with one timestamp, of which only the first is the form as issued. An entry started on an
-- older revision is shown with the history snapshot for that revision, so the one draft started on
-- "New" could be shown with any of the eight.
--
-- The history is left exactly as it is. Instead the draft is moved onto v2, so it is shown with the
-- current form and the old snapshots are never read for it. That is also the true state of the
-- record: the lot has not been released, and when it is, the net weight check applies to it.
--
-- Only the revision the entry is pinned to changes. Its answers are not touched (checked below), and
-- a submitted entry is never moved - there are none, and the guard refuses if one appears.
-- The lesson for later migrations: change an issued form's schema in ONE UPDATE.

begin;

do $move$
declare doc uuid; before_hash text; after_hash text; n int;
begin
  select id into doc from public.sop_documents where sop_number = 'FRM-701' and status = 'active' and revision = 'v2';
  if doc is null then raise exception 'FRM-701 is not active at v2.'; end if;

  if exists (select 1 from public.sop_document_responses
              where document_id = doc and form_revision = 'New' and status <> 'draft') then
    raise exception 'a submitted FRM-701 entry is pinned to revision New; it must not be moved.';
  end if;

  select count(*) into n from public.sop_document_responses where document_id = doc and form_revision = 'New';
  if n = 0 then return; end if;  -- already moved: a clean no-op
  if n <> 1 then raise exception 'expected one draft FRM-701 entry on revision New, found %.', n; end if;

  select md5(data::text) into before_hash from public.sop_document_responses
   where id = 'e99d426e-ff4a-492d-86f1-e998b699a8b0' and document_id = doc and status = 'draft' and form_revision = 'New';
  if before_hash is null then raise exception 'the draft on revision New is not the lot 6270 record this was written for.'; end if;

  update public.sop_document_responses
     set form_revision = 'v2'
   where id = 'e99d426e-ff4a-492d-86f1-e998b699a8b0' and document_id = doc and status = 'draft' and form_revision = 'New';

  select md5(data::text) into after_hash from public.sop_document_responses where id = 'e99d426e-ff4a-492d-86f1-e998b699a8b0';
  if after_hash is distinct from before_hash then raise exception 'the draft''s answers changed; nothing should have touched them.'; end if;
end $move$;

do $verify$
declare doc uuid;
begin
  select id into doc from public.sop_documents where sop_number = 'FRM-701' and status = 'active';
  if exists (select 1 from public.sop_document_responses where document_id = doc and form_revision is distinct from 'v2') then
    raise exception 'an FRM-701 entry is still pinned to a revision other than v2.';
  end if;
  if (select status || ' ' || form_revision from public.sop_document_responses
       where id = 'e99d426e-ff4a-492d-86f1-e998b699a8b0') is distinct from 'draft v2' then
    raise exception 'the lot 6270 record is not a draft on v2.';
  end if;
end $verify$;

commit;
