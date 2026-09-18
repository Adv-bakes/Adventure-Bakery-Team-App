-- FSQM-015: the rotation is three days, not two.
--
-- FSQM-039 was redrawn for a three-day rotation today (20260918000001/2): Day 1 bake, Day 2 dunk
-- and seal, Day 3 package, label, lot code and bulk packaging. FSQM-015 was written against the
-- two-day drawing and says so in three places. Those three are corrected:
--   scope          "in both configurations of the two-day rotation"
--   procedure[5]   "on both days of the rotation"
--   procedure[17]  "sampled differently on the two days of the rotation"
--
-- DELIBERATELY UNCHANGED: every statement tied to Day 1 or Day 2 by name - the dunk bay holding
-- raw batter on Day 1 and post-bake product on Day 2, Listeria sampled in the dunk bay on Day 2,
-- the Day 2 combination that makes the organism worth monitoring. The dunk still happens on Day 2,
-- so all of them remain true. Day 3 handles only sealed product and adds no exposure the programme
-- does not already cover; the sampling design is untouched.
--
-- Still draft, still Rev New - an edit to an unissued draft. The revision_history head line
-- records the date.

begin;

do $guard$
declare c jsonb;
begin
  select content into c from public.sop_documents
   where sop_number = 'FSQM-015' and status = 'draft' and revision = 'New';
  if c is null then raise exception 'FSQM-015 is not the unissued draft.'; end if;
  if jsonb_array_length(c->'procedure') <> 60 then
    raise exception 'FSQM-015 procedure is % lines, expected 60.', jsonb_array_length(c->'procedure');
  end if;
  if c->>'scope' not like '%in both configurations of the two-day rotation%'
     or c->'procedure'->>5 not like '%on both days of the rotation%'
     or c->'procedure'->>17 not like '%sampled differently on the two days of the rotation%'
     or c->>'revision_history' not like 'Rev New — written 2026-09-17. DRAFT.%' then
    raise exception 'FSQM-015 no longer carries the exact strings this edit replaces.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(
         content || jsonb_build_object(
           'scope', replace(content->>'scope',
             'in both configurations of the two-day rotation',
             'in all three configurations of the three-day rotation'),
           'revision_history', replace(content->>'revision_history',
             'Rev New — written 2026-09-17. DRAFT.',
             'Rev New — written 2026-09-17; rotation corrected to three days 2026-09-18, following FSQM-039. DRAFT.')),
         '{procedure,5}', to_jsonb(replace(content->'procedure'->>5,
           'on both days of the rotation', 'on all three days of the rotation'))),
         '{procedure,17}', to_jsonb(replace(content->'procedure'->>17,
           'sampled differently on the two days of the rotation',
           'sampled differently from one day of the rotation to the next')))
 where sop_number = 'FSQM-015';

do $verify$
declare c jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-015';
  if jsonb_array_length(c->'procedure') <> 60 then
    raise exception 'procedure length changed.';
  end if;
  if c::text like '%two-day%' or c::text like '%both days%' or c::text like '%two days%'
     or c::text like '%both configurations%' then
    raise exception 'FSQM-015 still describes a two-day rotation.';
  end if;
  if c->>'scope' not like '%three-day rotation%'
     or c->'procedure'->>5 not like '%all three days of the rotation%'
     or c->'procedure'->>17 not like '%from one day of the rotation to the next%'
     or c->>'revision_history' not like '%corrected to three days 2026-09-18%' then
    raise exception 'a correction did not land.';
  end if;
  -- the Day 2 statements are still true and must survive
  if c->'procedure'->>20 not like '%dunk bay on Day 2%'
     or c->'procedure'->>18 not like '%post-bake product on Day 2%' then
    raise exception 'a Day 2 statement was disturbed.';
  end if;
  raise notice 'FSQM-015: rotation wording now three days; sampling design unchanged.';
end $verify$;

commit;
