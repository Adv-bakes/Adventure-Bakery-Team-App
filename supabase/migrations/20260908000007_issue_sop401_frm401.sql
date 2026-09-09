-- Issue SOP-401 Temperature-Controlled Storage and FRM-401 Temperature Monitoring
-- Review. Active, approved GJM, effective 2026-09-08. Closes D-34 (SQF 11.6.2).
--
-- BOTH IN ONE TRANSACTION, and that is the point. SOP-401's records and Part 6 require
-- the monthly verification to be recorded on FRM-401. Activating the procedure while its
-- record was still draft would put an active controlled document in the position this
-- wave exists to close — an active procedure requiring a record that is not available.
-- Either both issue or neither does. (Same reasoning as 20260904000005 for FSQM-020/FRM-701.)
--
-- WHAT ISSUING ADOPTS. The six OPEN BEFORE ISSUE floor items were completed on 2026-09-08
-- and folded into the body by 20260908000006 (sensor at the warmest point; app/portal readout,
-- no local display; drains to drain/outside; units sound + packaged product only; ±2 °F
-- confirmed by field comparison; burger line discontinued June 2026, freezer stays in service).
-- Issuing adopts those as the site's position; the revision history records each below under
-- SETTLED AT ISSUE. The logging-gap cause is known (an expired ingest access token) and the
-- no-data alert now catches a recurrence.
--
-- REVISION STAYS AT New on both — first issue, not a revision, so nothing is superseded and
-- nothing archived (same as FSQM-009/018/020). Only status, approved_by, effective_date and
-- SOP-401's revision_history are written; the DO block hashes the rest of both rows so the
-- procedure, the form schema and every other section are provably untouched by the issue. The
-- procedure was amended by 20260908000006, which must run first.

begin;

do $$
declare r record;
begin
  select
    (select status   from public.sop_documents where sop_number = 'SOP-401') as s401,
    (select status   from public.sop_documents where sop_number = 'FRM-401') as f401,
    (select revision from public.sop_documents where sop_number = 'SOP-401') as v401,
    (select revision from public.sop_documents where sop_number = 'FRM-401') as vf401,
    (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'SOP-401') as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s
      where d.sop_number = 'FRM-401') as sections,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'SOP-401') as open_head,
    -- the amendment (20260908000006) must have landed first
    (select (content #>> '{procedure,2}')  like '%warmest point, next to the door%'
       from public.sop_documents where sop_number = 'SOP-401') as amend_p2,
    (select (content #>> '{procedure,6}')  like '%YoLink app%'
       from public.sop_documents where sop_number = 'SOP-401') as amend_p6,
    (select (content #>> '{procedure,3}')  like '%discontinued in June 2026%'
       from public.sop_documents where sop_number = 'SOP-401') as amend_p3,
    (select (content #>> '{procedure,50}') like '%packaged product only%'
       from public.sop_documents where sop_number = 'SOP-401') as amend_p50,
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-702','FRM-913','FSQM-018','FSQM-009')
        and status = 'active') as refs_live
  into r;

  if r.s401 is distinct from 'draft' or r.f401 is distinct from 'draft' then
    raise exception 'Expected both draft; found SOP-401=%, FRM-401=%.', r.s401, r.f401;
  end if;
  if r.v401 <> 'New' or r.vf401 <> 'New' then
    raise exception 'Expected both at revision New; found %, %.', r.v401, r.vf401;
  end if;
  if r.lines <> 53 or r.sections <> 7 then
    raise exception 'Bodies are not what 20260908000006 left: % lines, % sections.', r.lines, r.sections;
  end if;
  if not r.open_head then
    raise exception 'SOP-401 does not carry the OPEN BEFORE ISSUE heading this migration rewrites.';
  end if;
  if not (r.amend_p2 and r.amend_p3 and r.amend_p6 and r.amend_p50) then
    raise exception 'The 20260908000006 body amendment has not been applied: p2=%, p3=%, p6=%, p50=%.',
      r.amend_p2, r.amend_p3, r.amend_p6, r.amend_p50;
  end if;
  if r.refs_live <> 4 then
    raise exception 'Only % of the 4 documents SOP-401 references are active.', r.refs_live;
  end if;
end $$;

create temporary table issue401_before on commit drop as
select 'SOP-401'::text as sop_number, md5((content - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'SOP-401'
union all
select 'FRM-401', md5(content::text)
  from public.sop_documents where sop_number = 'FRM-401';

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(
           regexp_replace(
             replace(content->>'revision_history',
               'DRAFT. Not approved, not in force.',
               'ISSUED 2026-09-08, approved GJM. Status active, revision New — a first issue, not a revision, so nothing is superseded and nothing archived. FRM-401 Temperature Monitoring Review is activated in the same transaction, because this procedure requires the monthly verification to be recorded on it and an active procedure requiring a draft record is the finding this wave exists to close.'),
             'OPEN BEFORE ISSUE[\s\S]*$',
             $settled$SETTLED AT ISSUE — the six floor items this procedure carried were completed on 2026-09-08 and are recorded in the body:

1. The refrigerator sensor was moved to the unit's warmest point, next to the door, where 11.6.2.3 requires the monitoring equipment to sit (Part 1).

2. The sensors carry no local display, so the reading is taken from the YoLink app and the Team App's Temperature Monitoring page without entering the unit — the "easily readable and accessible" requirement of 11.6.2.3, satisfied by the app and portal rather than a gauge at the unit (Part 1).

3. The defrost and condensate drains of both units were traced and discharge to the site drain or to the outside of the facility, not onto the floor or onto stored product (11.6.2.4); photographs are retained (Part 8).

4. Both units were walked and found sound, cleanable and of adequate capacity for the site's expected volume, and both hold packaged product only, with no exposed product (11.6.2.1, 11.6.2.2); photographs are retained (Part 8).

5. The probe thermometer was compared against the sensors and reads within 2 °F, so Part 6's ±2 °F tolerance stands. This was a field comparison; the devices' stated-accuracy specifications were not obtained, and would matter only if a device's own rated accuracy were ±2 °F or worse, which the field agreement gives no reason to suspect.

6. The vegan burger line the freezer held was discontinued in June 2026, so the freezer holds no product at present; it stays in service while it is running, and is placed out of service only when switched off (Part 1, Part 7). That date is also owed to the D-35 scope determination and to four shelf-life records that still read "Frozen, 18 months".

The one-time cause of the three logging gaps in the first ten weeks is known — an expired access token on the ingest daemon — and the no-data alert (Part 4) now catches a recurrence, so it is not a floor action.$settled$
           )
         )::jsonb),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-09-08'
 where sop_number = 'SOP-401' and status = 'draft' and revision = 'New';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-08'
 where sop_number = 'FRM-401' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  bad int;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('SOP-401','FRM-401') and status = 'active'
        and approved_by = 'GJM' and effective_date = date '2026-09-08'
        and revision = 'New') as issued,
    (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'SOP-401') as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s
      where d.sop_number = 'FRM-401') as sections,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'SOP-401') as stale_head,
    (select (content->>'revision_history') like '%ISSUED 2026-09-08, approved GJM%'
       from public.sop_documents where sop_number = 'SOP-401') as issue_note,
    (select (content->>'revision_history') like '%SETTLED AT ISSUE%'
       from public.sop_documents where sop_number = 'SOP-401') as settled
  into r;

  select count(*) into bad
    from public.sop_documents d
    join issue401_before b on b.sop_number = d.sop_number
   where (d.sop_number = 'SOP-401' and md5((d.content - 'revision_history')::text) is distinct from b.h)
      or (d.sop_number = 'FRM-401' and md5(d.content::text) is distinct from b.h);

  if r.issued <> 2 then
    raise exception 'Only % of the two documents issued as active/GJM/2026-09-08/New.', r.issued;
  end if;
  if r.lines <> 53 or r.sections <> 7 then
    raise exception 'A body changed during issue: % lines, % sections.', r.lines, r.sections;
  end if;
  if r.stale_head then
    raise exception 'SOP-401 is active but still says OPEN BEFORE ISSUE.';
  end if;
  if not (r.issue_note and r.settled) then
    raise exception 'Revision history wrong: issued=%, settled=%.', r.issue_note, r.settled;
  end if;
  if bad <> 0 then
    raise exception '% of the two rows changed outside the allowed columns. Rolled back.', bad;
  end if;
end $$;

commit;
