-- D-03: issue FSQM-006 Food Safety Culture Plan. Approved GJM, effective 2026-10-05, revision New (first issue).
--
-- One Minor finding: 2.1.1.2.
--
-- Settled before issue (owner and SQF Practitioner, 2026-10-05):
--   - COMPLAINT TARGETS, by the class FRM-002 already gives every complaint: no more than one Critical
--     (food safety risk) complaint a year; no more than one Non-Critical (quality concern) complaint a
--     month. Three documents each carried a figure and two of them disagreed, so all three change here:
--       FSQM-006  the measure line states both targets (it pointed at "the target set on FRM-001");
--       FSQM-003  New -> v2, objective 5 ("fewer than two per year") reworded;
--       FRM-001   v4 -> v5, the complaints row's Target line. A fixed row label only - the grid keys
--                 answers by row position, so existing entries are unaffected.
--   - The three steps for a missed rule are confirmed as drafted.
--   - Notices were posted and read on the live site.
--
-- FSQM-005 New -> v2: Part 2 item (ii) said no culture measures were set; it now points at FSQM-006.
--
-- Guarded on the md5 of each document's content as it stands in production (read 2026-10-05).

begin;

do $guard$
declare h text; st text; rev text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-006';
  if st is distinct from 'draft' or h <> '786449882a5799e601490b8c17e77833' then raise exception 'FSQM-006 is % or changed since review (md5 %).', st, h; end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-005' and status = 'active';
  if rev is distinct from 'New' or h <> '5852c4fc5237ce2147138ee6ec463a05' then raise exception 'FSQM-005 is %/% or changed (md5 %).', st, rev, h; end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';
  if rev is distinct from 'New' or h <> 'e482b161a4e1e47548d3563476bce70b' then raise exception 'FSQM-003 is %/% or changed (md5 %).', st, rev, h; end if;
  select md5(content::text), status, revision into h, st, rev from public.sop_documents where sop_number = 'FRM-001' and status = 'active';
  if rev is distinct from 'v4' or h <> '0be2b879b3578a02f1a3729714e48653' then raise exception 'FRM-001 is %/% or changed (md5 %).', st, rev, h; end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(content,
                   '{procedure,5}', to_jsonb($t$◦ customer complaints, from REP-003 - no more than one Critical (food safety risk) complaint a year, and no more than one Non-Critical (quality concern) complaint a month;$t$::text)),
                   '{revision_history}', to_jsonb($t$New - 2026-10-05 - DRAFT under D-03, for the Minor finding against 2.1.1.2. The policy (FSQM-002) and the objectives (FSQM-003) existed; what was missing was how the objectives are measured and told to staff, how staff are held to the rules, and the written right to raise and act on a problem.

NO NEW FORM. Every measure is read from a record the site already keeps. Telling the team is done through notices in the Team Portal, built for this plan: a post that each team member acknowledges, with the list of who read it kept against the post. Until now staff were told by word of mouth when an issue arose.

WHAT STAFF COULD ALREADY DO: stop work and hold product. This plan writes that down and adds that nobody is penalized for it.

ISSUED 2026-10-05. The three items the draft listed to confirm are settled. (1) COMPLAINT TARGETS. Two targets, by the class already given to every complaint on FRM-002: no more than one Critical (food safety risk) complaint a year, and no more than one Non-Critical (quality concern) complaint a month - a typing error on a label is the example of the second. FSQM-003 and FRM-001, which each carried a different single figure, are revised in the same change to say this. (2) THE THREE STEPS for a missed rule are confirmed by Senior Site Management as written. (3) NOTICES were posted and read in the Team Portal before issue. A team member needs a Team Portal login to read a notice, which they already need for their training.

FSQM-005 Part 2 item (ii) is revised in the same change: the culture row of the management review is now answered from the measures in this plan. The first notice, with the objectives, is posted at issue.$t$::text)),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-10-05'
 where sop_number = 'FSQM-006' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(jsonb_set(content,
                   '{procedure,7}', to_jsonb($t$• **(ii) Food safety culture performance.** FRM-001 Section I, answered from the measures in **FSQM-006 Food Safety Culture Plan**: the results against the food safety objectives, who read the notices posted to the team, and the food safety problems staff raised during the year.$t$::text)),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $t$

v2 — 2026-10-05 — Part 2 item (ii) revised under D-03. FSQM-006 Food Safety Culture Plan is issued, so the culture row of the annual review is no longer answered with "no measures are in force": it is answered from that plan's measures. Nothing else changes.$t$)),
       revision = 'v2', effective_date = date '2026-10-05', approved_by = 'GJM'
 where sop_number = 'FSQM-005' and status = 'active' and revision = 'New';

update public.sop_documents
   set content = jsonb_set(content, '{statement}',
                   to_jsonb(replace(content->>'statement', $t$5. Reduce customer complaints related to quality to fewer than two per year.$t$, $t$5. Keep customer complaints low: no more than one complaint a year that raises a food safety concern, and no more than one quality complaint a month.$t$))),
       revision = 'v2', effective_date = date '2026-10-05', approved_by = 'GJM'
 where sop_number = 'FSQM-003' and status = 'active' and revision = 'New';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema,sections,3,fields,1,rows,labels,2}', to_jsonb($t$Customer Feedback and Complaints
Analyze trends from FRM-002 and REP-003.
Target: ≤ 1 Critical (food safety) complaint per year; ≤ 1 Non-Critical (quality) complaint per month$t$::text)),
       revision = 'v5', effective_date = date '2026-10-05', approved_by = 'GJM'
 where sop_number = 'FRM-001' and status = 'active' and revision = 'v4';

do $verify$
declare n int; p jsonb; txt text;
begin
  select count(*) into n from public.sop_documents
   where (sop_number, status, revision, approved_by, effective_date) in (
     ('FSQM-006', 'active', 'New', 'GJM', date '2026-10-05'), ('FSQM-005', 'active', 'v2', 'GJM', date '2026-10-05'),
     ('FSQM-003', 'active', 'v2', 'GJM', date '2026-10-05'), ('FRM-001', 'active', 'v5', 'GJM', date '2026-10-05'));
  if n <> 4 then raise exception 'not all four documents were stamped (% of 4).', n; end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'FSQM-006';
  if jsonb_array_length(p) <> 29 then raise exception 'FSQM-006 procedure length changed.'; end if;
  if p->>5 not like '%one Critical (food safety risk) complaint a year%one Non-Critical (quality concern) complaint a month%' then
    raise exception 'FSQM-006 complaint measure not updated: %', p->>5;
  end if;
  if txt like '%TO CONFIRM BEFORE ISSUE%' or txt like '%AT ISSUE:%' or txt not like '%ISSUED 2026-10-05%' then
    raise exception 'FSQM-006 still carries the draft''s open items, or has no issue stamp.';
  end if;
  if txt ~* 'Diana|Gabriela|Christina|GJM|Mercer|Richard' then raise exception 'FSQM-006 names a person.'; end if;

  select content->'procedure', content::text into p, txt from public.sop_documents where sop_number = 'FSQM-005' and status = 'active';
  if p->>7 not like '%FSQM-006 Food Safety Culture Plan%' or p::text like '%No formal measures are set%' then
    raise exception 'FSQM-005 item (ii) not updated: %', p->>7;
  end if;
  if txt not like '%v2 % 2026-10-05 % Part 2 item (ii) revised under D-03%' then raise exception 'FSQM-005 has no v2 history line.'; end if;

  select content->>'statement' into txt from public.sop_documents where sop_number = 'FSQM-003' and status = 'active';
  if txt like '%fewer than two per year%' or txt not like '%no more than one quality complaint a month.%' then
    raise exception 'FSQM-003 objective 5 not updated.';
  end if;

  select content::text into txt from public.sop_documents where sop_number = 'FRM-001' and status = 'active';
  if txt not like '%1 Critical (food safety) complaint per year%' or txt like '%Target: ≤ 1 quality complaint per month%' then
    raise exception 'FRM-001 complaints target not updated.';
  end if;
  if (select jsonb_array_length(content->'form_schema'->'sections'->3->'fields'->1->'rows'->'labels')
        from public.sop_documents where sop_number = 'FRM-001' and status = 'active') <> 9 then
    raise exception 'FRM-001 review inputs row count changed.';
  end if;
  if exists (select 1 from public.sop_documents where sop_number in ('FSQM-006', 'FSQM-005', 'FSQM-003', 'FRM-001')
              and status = 'active' and content::text like '%' || chr(13) || '%' and sop_number <> 'FSQM-003') then
    raise exception 'a carriage return was written.';
  end if;
end $verify$;

commit;
