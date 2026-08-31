-- INT-14, first half: report the document-control gaps. Nothing here enforces anything.
--
-- Two things this app permits that 2.2.2.1 does not:
--
--   1. A controlled document can be set active with no approver recorded.
--   2. A published document's content can change with no revision bump, so the revision on the
--      sheet stops describing what the sheet says.
--
-- REPORTING BEFORE GUARDING IS DELIBERATE, and it is the lesson from stale_training_report() in
-- 20260827000008. That function reported ten "violations"; three turned out to be scope errors
-- rather than assignment errors, including HACCP training for the SQF practitioner. Had it acted
-- instead of reported, it would have silently removed a Code requirement. A guard that fires before
-- anyone has seen the shape of the problem is a guess with an exception thrown at the end of it.
--
-- Guarding also has a real cost that reporting does not: no editor in the app offers to bump a
-- revision. SopBodyEditor, FormSchemaBuilder, QuizEditor and SlideContentEditor all save content
-- without touching `revision`, which lives in a separate metadata form with its own Save button.
-- Turn a revision guard on today and every one of those buttons starts failing with an error the
-- user cannot act on from where they are standing. That is a UX change, not a trigger, and it is
-- the reason the second half of INT-14 is not in this migration.
--
-- WHAT THE SECOND FINDING CAN AND CANNOT SEE. The history trigger watches revision, sop_number,
-- title, effective_date, approved_by, status and content->'form_schema' - and nothing else inside
-- content. So drift is detectable for FILLABLE FORMS and invisible for SOP bodies, slides,
-- narration and quiz content. That blind spot is stated in the finding text rather than left for a
-- reader to discover, and closing it means widening the trigger, which belongs with the guard.
--
-- The rule used for finding 2: a document is drifting if its content changed AFTER the moment its
-- current revision was established. The snapshot that carries 'revision' in changed_fields marks
-- that moment; any later content-only snapshot is a change the revision does not describe. A
-- document whose revision has never changed is measured from the beginning of its history.

begin;

create or replace function public.document_control_report()
returns table (
  document_id uuid,
  sop_number text,
  title text,
  doc_type text,
  revision text,
  finding text,
  detail text,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  -- 1. in force, nobody signed it
  select d.id, d.sop_number, d.title, d.type, d.revision,
         'no approver recorded'::text,
         ('active since ' || coalesce(d.effective_date::text, 'an unrecorded date')
          || ' with the approver field empty')::text,
         null::timestamptz
    from public.sop_documents d
   where d.status = 'active'
     -- internal documents are engineering documentation, not controlled documents (20260831000007)
     and d.type <> 'internal'
     -- an ES row is a content variant of its English sibling, not a separately approved document
     and d.title not like '%(ES)%'
     and coalesce(nullif(trim(d.approved_by), ''), null) is null

  union all

  -- 2. content moved after the revision was set, so the revision no longer describes the document
  select d.id, d.sop_number, d.title, d.type, d.revision,
         'content changed without a revision bump'::text,
         (x.n::text || ' change(s) to the fillable form schema since revision '
          || coalesce(d.revision, '(none)') || ' was set'
          || case when x.rev_set_at is null then ' (revision has never changed)' else '' end
          || '. Only content->form_schema is tracked, so SOP bodies, slides and quizzes could be '
          || 'drifting unseen.')::text,
         x.last_change
    from public.sop_documents d
    join (
      select h.document_id,
             count(*) as n,
             max(h.snapshotted_at) as last_change,
             max(r.at) as rev_set_at
        from public.sop_document_history h
        left join (
          select document_id, max(snapshotted_at) as at
            from public.sop_document_history
           where 'revision' = any(changed_fields)
           group by document_id
        ) r on r.document_id = h.document_id
       where 'form_schema' = any(h.changed_fields)
         and not ('revision' = any(h.changed_fields))
         and (r.at is null or h.snapshotted_at > r.at)
       group by h.document_id
    ) x on x.document_id = d.id
   where d.status = 'active'
     and d.type <> 'internal'
     and d.title not like '%(ES)%'

   order by 6, 2 nulls last;
$fn$;

grant execute on function public.document_control_report() to authenticated;

do $$
declare
  bad text;
  n_total int;
  n_approver int;
  n_drift int;
begin
  select count(*) into n_total from public.document_control_report();
  select count(*) into n_approver from public.document_control_report()
   where finding = 'no approver recorded';
  select count(*) into n_drift from public.document_control_report()
   where finding = 'content changed without a revision bump';

  select string_agg(x, '; ') into bad from (
    select 'document_control_report is missing' as x where not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'document_control_report')
    union all
    -- a report REPORTS. If this ever grows a write, the whole argument for shipping it before the
    -- guard collapses.
    select 'document_control_report must not modify anything' where (
      select pg_get_functiondef(p.oid) ~* '\m(update|delete|insert|alter|drop)\M'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'document_control_report')
    union all
    -- the one document deliberately left unapproved must appear, or the report is not looking
    select 'the HACCP plan is not being reported as unapproved' where not exists (
      select 1 from public.document_control_report()
       where title like '%HACCP PLAN%' and finding = 'no approver recorded')
    union all
    -- and the seven internal guides must NOT appear: they are not controlled documents
    select 'an internal document is being reported: ' || coalesce(sop_number, title)
      from public.document_control_report() r
     where exists (select 1 from public.sop_documents d
                    where d.id = r.document_id and d.type = 'internal')
  ) t;

  if bad is not null then
    raise exception 'the document control report did not install cleanly: %', bad;
  end if;

  raise notice 'document_control_report(): % finding(s) - % without an approver, % with content '
               'that moved after its revision was set', n_total, n_approver, n_drift;
end $$;

commit;
