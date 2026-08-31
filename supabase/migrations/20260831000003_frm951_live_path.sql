-- Point FRM-951's printed record at the live report.
--
-- 20260831000002 removed the stale PDF/DOCX and left the purpose text describing where the
-- report lives IN WORDS ("viewed at Team Portal > HR > Training Compliance"). A reader
-- holding a printout still has to go and find it by hand.
--
-- It also had a side effect worth naming: giving the row a `purpose` made hasSopBody() true,
-- which is the ONLY condition the SOPs Library drawer gates its Download PDF button on - not
-- type='sop', despite what the notes said. So FRM-951 gained a record PDF that nothing was
-- printing before, and that PDF is the one an auditor is most likely to be holding.
--
-- content.live_path is a general field, not an FRM-951 special case: any document whose real
-- home is a live view can carry one, and generateSopPdf() renders it as a clickable
-- "Current version:" line. It is stored as a PATH rather than a full URL deliberately - the
-- PDF is generated client-side, so the browser supplies the origin and the same record links
-- to localhost in development and to the real host in production, with nothing to keep in
-- sync and no environment baked into the database.
--
-- No &download=1 here, unlike the links stamped into the report exports themselves. Someone
-- arriving from a printed register entry wants to SEE the current matrix; firing a file
-- download at them is the wrong greeting.

begin;

update public.sop_documents
   set content = coalesce(content, '{}'::jsonb)
                 || jsonb_build_object('live_path', '/team/hr/traceability?view=requirements')
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
    -- everything 20260831000002 established must survive this jsonb merge
    select 'revision is ' || coalesce(r.revision, 'null') || ', expected v2'
     where r.revision is distinct from 'v2'
    union all
    select 'the purpose text was lost'
     where coalesce(r.content->>'purpose', '') not like '%generated report%'
    union all
    select 'revision_history was lost'
     where coalesce(r.content->>'revision_history', '') not like '%2026-08-31%'
    union all
    select 'the stale snapshot came back'
     where jsonb_array_length(coalesce(r.content->'attachments', '[]'::jsonb)) <> 0
  ) t;

  if bad is not null then
    raise exception 'FRM-951 live_path did not apply cleanly: %', bad;
  end if;

  raise notice 'FRM-951 now links to %', r.content->>'live_path';
end $$;

commit;
