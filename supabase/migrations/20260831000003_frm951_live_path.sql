-- Point FRM-951's printed record at the live report, and restore the revision history.
--
-- 20260831000002 removed the stale PDF/DOCX and left the purpose text describing where the
-- report lives IN WORDS ("viewed at Team Portal > HR > Training Compliance"). A reader
-- holding a printout still has to go and find it by hand.
--
-- content.live_path is a general field, not an FRM-951 special case: any document whose real
-- home is a live view can carry one, and generateSopPdf() renders it as a clickable
-- "Current version:" line. It is stored as a PATH rather than a full URL deliberately - the
-- PDF is generated client-side, so the browser supplies the origin and the same record links
-- to localhost in development and to the real host in production, with nothing to keep in
-- sync and no environment baked into the database.
--
-- No &download=1 here, unlike the links stamped into the report exports themselves. Someone
-- arriving from a printed register entry wants to SEE the current matrix, not be handed a
-- file.
--
-- WHY THIS ALSO REWRITES revision_history, AND WHY THE FIRST VERSION OF THIS MIGRATION FAILED.
--
-- The first attempt asserted that the revision_history written by 20260831000002 was still
-- present, and it was not. Between the two pushes, someone removed FRM-951's attachments in
-- the SOPs Library drawer. That save is a full replace built from React state loaded when the
-- page opened - SopsLibrary's `{ ...selected.content, attachments }` - so a drawer left open
-- across a migration writes the PRE-migration content back. attachments:[] was the intended
-- change and survived; revision_history, which existed only in the database and never in that
-- open tab, was overwritten out of existence.
--
-- The lesson is about the assertion, not the user. A migration may assert what IT does and
-- what must be true regardless. It may NOT assert that a field an earlier migration set has
-- survived, when the application legitimately lets a person edit that field in between - that
-- turns ordinary use of the app into a failed deployment. So this migration WRITES the state
-- it needs instead of demanding it still be there, and is safe to re-run.

begin;

update public.sop_documents
   set content = coalesce(content, '{}'::jsonb)
                 || jsonb_build_object('live_path', '/team/hr/traceability?view=requirements')
                 -- rewritten rather than asserted: see the note above
                 || jsonb_build_object(
                      'revision_history',
                      'New — 2026-06-27 — Initial issue as a paper training matrix, maintained by hand.'
                      || chr(10) ||
                      'v2 — 2026-08-31 — Reclassified from a form to a generated report. The matrix is '
                      || 'now produced live by the Team App from each module''s required departments and '
                      || 'from the training assignment records; the hand-maintained PDF and DOCX were '
                      || 'withdrawn because a snapshot of a live report is stale the moment it is taken.')
 where sop_number = 'FRM-951'
   and status = 'active'
   and type = 'report';

do $$
declare
  bad text;
  r record;
begin
  select * into r from public.sop_documents
   where sop_number = 'FRM-951' and status = 'active';

  -- Only what THIS migration guarantees, plus the identity of the row it had to find.
  select string_agg(x, '; ') into bad from (
    select 'FRM-951 is missing, not active, or no longer type=report' as x
     where r.id is null or r.type is distinct from 'report'
    union all
    select 'live_path is ' || coalesce(r.content->>'live_path', 'null')
     where coalesce(r.content->>'live_path', '') <> '/team/hr/traceability?view=requirements'
    union all
    -- a relative path is the whole point; an absolute URL would bake in an environment
    select 'live_path must start with / and carry no scheme'
     where coalesce(r.content->>'live_path', '') !~ '^/'
    union all
    select 'revision_history was not written'
     where coalesce(r.content->>'revision_history', '') not like '%2026-08-31%'
  ) t;

  if bad is not null then
    raise exception 'FRM-951 live_path did not apply cleanly: %', bad;
  end if;

  -- Reported, never enforced: these are 20260831000002's business, and a person editing them
  -- through the app is allowed. Worth seeing in the push output, not worth failing a deploy.
  if r.revision is distinct from 'v2' then
    raise warning 'FRM-951 revision is %, expected v2 from 20260831000002', coalesce(r.revision,'null');
  end if;
  if coalesce(r.content->>'purpose','') not like '%generated report%' then
    raise warning 'FRM-951 purpose text is missing or has been rewritten';
  end if;
  if jsonb_array_length(coalesce(r.content->'attachments','[]'::jsonb)) <> 0 then
    raise warning 'FRM-951 has % attachment(s) again - a stale snapshot may have been re-added',
      jsonb_array_length(r.content->'attachments');
  end if;
  if r.approved_by is null then
    raise warning 'FRM-951 has no approved_by - set it in the SOPs Library once the report definition is approved';
  end if;

  raise notice 'FRM-951 now links to %', r.content->>'live_path';
end $$;

commit;
