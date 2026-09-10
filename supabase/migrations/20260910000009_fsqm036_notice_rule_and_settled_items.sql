-- FSQM-036, before issue: fix the Part 1 notice rule, and record the three open items as settled.
--
-- THE PART 1 RULE WAS UNKEEPABLE. It read "Before a collection, the customer or the carrier shall be
-- told the product's storage requirement ... and the condition the vehicle must be in". Read as
-- written that is EVERY collection: a customer collecting weekly would have to be notified weekly,
-- and the owner has decided not to track acknowledgement at all, so there would have been neither a
-- practical way to comply nor any evidence of compliance. It is now given before a customer's first
-- collection and again when the carrier or the requirement changes, with the sent notice retained.
--
-- AND 11.6.5 DOES NOT REQUIRE THE NOTICE AT ALL. 11.6.5.1 asks for practices "designed to maintain
-- appropriate storage conditions and product integrity" and for food to be loaded, transported and
-- unloaded "under conditions suitable to prevent cross-contamination". Nothing in 11.6.5 says a
-- carrier must be told anything. The notice is the site's own control and is now labelled as one -
-- it is kept because it makes the Part 4 check workable rather than confrontational, not because a
-- clause demands it. Claiming clause backing it does not have would be the same error in the other
-- direction as over-reading 11.6.5.3 into a seal requirement.
--
-- THE THREE OPEN ITEMS ARE ANSWERED, by the owner on 2026-09-10:
--   1. Vehicle security - settled by 20260910000007: a lock, not a seal.
--   2. Wrapping and the adverse-weather rule - CURRENT PRACTICE. Part 5 records what already happens.
--   3. The collecting vehicle is NOT checked today. Part 4 is therefore a new requirement on the
--      floor from the effective date, and the revision history says so rather than implying the
--      check had always happened. The gap assessment already scored 11.6.5.2 as not met; a program
--      that read as though it were met would contradict the finding it exists to close.
--
-- Production staff were briefed before issue. The document is still DRAFT after this migration -
-- issuing it is 20260910000010.

begin;

create temporary table _m36 on commit drop as
select id, content, md5(content::text) as old_hash
  from public.sop_documents
 where sop_number = 'FSQM-036';

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-036')       as s36,
    (select status from public.sop_documents where sop_number = 'FRM-801')        as s801,
    (select jsonb_array_length(content->'procedure') from _m36)                   as lines,
    (select count(*) from _m36 m, jsonb_array_elements_text(m.content->'procedure') l(line)
      where l.line like '%Before a collection, the customer or the carrier shall be told%') as old_rule,
    (select count(*) from _m36 m, jsonb_array_elements_text(m.content->'procedure') l(line)
      where l.line like '%Telling them in advance is the difference%')            as anchor,
    (select count(*) from _m36 m
      where m.content->>'records' like '%There are no refrigerated transport records%') as rec_anchor,
    (select position('OPEN BEFORE ISSUE' in (select content->>'revision_history' from _m36)))  as p_open,
    (select position('AMENDED 2026-09-10, BEFORE ISSUE' in (select content->>'revision_history' from _m36))) as p_amend,
    (select count(*) from _m36 m
      where m.content->>'revision_history' like '%the vehicle question is open.%')  as stale_seal
  into r;

  if r.s36 is distinct from 'draft' or r.s801 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-036=%, FRM-801=%.', r.s36, r.s801;
  end if;
  if r.lines <> 40 then
    raise exception 'FSQM-036 procedure is % lines, expected 40 (is 000007 applied?).', r.lines;
  end if;
  if r.old_rule <> 1 or r.anchor <> 1 then
    raise exception 'Part 1 anchors not found (rule=%, prose=%).', r.old_rule, r.anchor;
  end if;
  if r.rec_anchor <> 1 then
    raise exception 'Records anchor not found.';
  end if;
  if r.stale_seal <> 1 then
    raise exception 'The stale "vehicle question is open" sentence is not present.';
  end if;
  -- The block being replaced must lie between these two markers, in this order.
  if r.p_open = 0 or r.p_amend = 0 or r.p_amend <= r.p_open then
    raise exception 'Revision-history markers are wrong (open=%, amend=%).', r.p_open, r.p_amend;
  end if;
end $$;

-- 1. Part 1: the notice rule, located by its own text rather than by index.
update public.sop_documents d
   set content = jsonb_set(d.content,
         array['procedure', (
           (select ord - 1 from jsonb_array_elements_text(d.content->'procedure') with ordinality e(line, ord)
             where e.line like '%Before a collection, the customer or the carrier shall be told%')
         )::text],
         to_jsonb($t$• Before a customer's first collection, and again whenever the carrier changes or these requirements change, the customer or the carrier shall be told the product's storage requirement, which is ambient, and the condition the vehicle must be in to be loaded. The notice sent shall be retained.$t$::text))
 where d.sop_number = 'FSQM-036';

-- 2. Part 1: say whose control this is, and that no acknowledgement is tracked.
update public.sop_documents d
   set content = jsonb_insert(d.content,
         array['procedure', (
           (select ord - 1 from jsonb_array_elements_text(d.content->'procedure') with ordinality e(line, ord)
             where e.line like '%Telling them in advance is the difference%')
         )::text],
         to_jsonb($t$> This notice is the site's own control and is not required by 11.6.5, which asks for practices that maintain the product's storage conditions and prevent cross-contamination and says nothing about notifying a carrier. It is kept because it is what makes the check in Part 4 workable: a driver who has been told what is expected is not being ambushed at the dock, and the person who would otherwise have that argument is whoever is on the floor. No acknowledgement is required and none is tracked. The sent notice is the record.$t$::text),
         true)
 where d.sop_number = 'FSQM-036';

-- 3. Records: the sent notice is the only evidence the telling happened.
update public.sop_documents d
   set content = jsonb_set(d.content, '{records}',
         to_jsonb(replace(d.content->>'records',
           $t$There are no refrigerated transport records$t$,
           $t$Carrier and customer notice — the sent copy of the notice given under Part 1, retained as correspondence. No acknowledgement is required or recorded.
There are no refrigerated transport records$t$)))
 where d.sop_number = 'FSQM-036';

-- 4. Revision history: the seal question is answered, so stop saying it is open.
update public.sop_documents d
   set content = jsonb_set(d.content, '{revision_history}',
         to_jsonb(replace(d.content->>'revision_history',
           $t$The two are stated separately and the vehicle question is open.$t$,
           $t$The two are stated separately, and the vehicle question is answered in Part 6 by a lock rather than a seal.$t$)))
 where d.sop_number = 'FSQM-036';

-- 5. Revision history: replace the "OPEN BEFORE ISSUE" block with what was settled.
--    Boundaries are located by marker text; neither index nor length is assumed.
update public.sop_documents d
   set content = jsonb_set(d.content, '{revision_history}',
         to_jsonb(
           left(d.content->>'revision_history',
                position('OPEN BEFORE ISSUE' in d.content->>'revision_history') - 1)
        || $t$SETTLED BEFORE ISSUE — the three open items, answered by the owner on 2026-09-10:

1. VEHICLE SECURITY IS ANSWERED BY A LOCK, NOT A SEAL. See the amendment recorded below. Part 6 states a control the site can operate on every load, so 11.6.5.3 is met on issue rather than stated as a requirement the site does not meet.

2. WRAPPING AND THE ADVERSE-WEATHER RULE ARE CURRENT PRACTICE. Part 5 records what the site already does and introduces nothing new to the floor. Whether a physical fix is worth making, such as a canopy over the crossing, remains a judgement for the site and is not a condition of this program.

3. THE COLLECTING VEHICLE IS NOT CHECKED TODAY. Part 4 is therefore a new requirement on the floor from the effective date rather than a description of existing practice, and this is recorded rather than glossed. The gap assessment already scored 11.6.5.2 as not met, and a program written as though the check had always happened would contradict the finding it exists to close. The production staff who will perform it were briefed before issue. The customers and carriers whose vehicles it may turn away are told by the notice Admin sends under Part 1, and the site has accepted that the first collections after the effective date may be checked before that notice has reached everyone.

THE PART 1 NOTICE IS THE SITE'S OWN CONTROL, NOT A CLAUSE REQUIREMENT. Nothing in 11.6.5 requires a carrier to be told anything; 11.6.5.1 asks for practices designed to maintain storage conditions and prevent cross-contamination. The notice is kept because it makes the Part 4 check workable. It was first written to be given before every collection, which for a customer collecting weekly is a rule nobody would keep and — with no acknowledgement tracked — one that could not be evidenced either. It is now given before a customer's first collection and again when the carrier or the requirement changes, and the sent copy is retained. Not tracking acceptance is the owner's decision of 2026-09-10.

$t$
        || substr(d.content->>'revision_history',
                  position('AMENDED 2026-09-10, BEFORE ISSUE' in d.content->>'revision_history'))))
 where d.sop_number = 'FSQM-036';

-- CRLF has reached this table before, from raw multi-line dollar-quoted strings on a
-- core.autocrlf=true checkout. Strip any that arrived with this migration.
update public.sop_documents
   set content = replace(content::text, chr(13), '')::jsonb
 where sop_number = 'FSQM-036'
   and position(chr(13) in content::text) > 0;

do $$
declare r record;
begin
  select
    (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number='FSQM-036') as lines,
    (select count(*) from public.sop_documents d, jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number='FSQM-036' and l.line like '%Before a collection, the customer%')       as old_rule,
    (select count(*) from public.sop_documents d, jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number='FSQM-036' and l.line like $q$%Before a customer's first collection%$q$)  as new_rule,
    (select count(*) from public.sop_documents d, jsonb_array_elements_text(d.content->'procedure') l(line)
      where d.sop_number='FSQM-036' and l.line like '%is not required by 11.6.5%')                as new_prose,
    (select count(*) from public.sop_documents
      where sop_number='FSQM-036' and content->>'records' like '%Carrier and customer notice%')   as rec,
    (select count(*) from public.sop_documents
      where sop_number='FSQM-036' and content->>'revision_history' like '%OPEN BEFORE ISSUE%')     as still_open,
    (select count(*) from public.sop_documents
      where sop_number='FSQM-036' and content->>'revision_history' like '%SETTLED BEFORE ISSUE%')  as settled,
    (select count(*) from public.sop_documents
      where sop_number='FSQM-036' and content->>'revision_history' like '%vehicle question is open%') as stale_seal,
    (select count(*) from public.sop_documents
      where sop_number='FSQM-036' and content->>'revision_history' like '%AMENDED 2026-09-10, BEFORE ISSUE%') as kept,
    (select count(*) from public.sop_documents d join _m36 m on m.id = d.id
      where md5(d.content::text) = m.old_hash)                                                     as unchanged,
    (select count(*) from public.sop_documents
      where sop_number='FSQM-036' and position(chr(13) in content::text) > 0)                       as crs,
    (select status from public.sop_documents where sop_number='FSQM-036')                          as st
  into r;

  if r.lines <> 41 then
    raise exception 'FSQM-036 procedure is % lines, expected 41.', r.lines;
  end if;
  if r.old_rule <> 0 or r.new_rule <> 1 then
    raise exception 'Part 1 rule not replaced (old=%, new=%).', r.old_rule, r.new_rule;
  end if;
  if r.new_prose <> 1 then
    raise exception 'The "site''s own control" prose is % lines, expected 1.', r.new_prose;
  end if;
  if r.rec <> 1 then
    raise exception 'The notice is not in Records.';
  end if;
  if r.still_open <> 0 or r.settled <> 1 or r.stale_seal <> 0 then
    raise exception 'Revision history wrong (open=%, settled=%, stale=%).',
      r.still_open, r.settled, r.stale_seal;
  end if;
  -- The two later amendment entries must survive the boundary replacement.
  if r.kept <> 1 then
    raise exception 'The AMENDED entries were lost.';
  end if;
  if r.unchanged <> 0 then
    raise exception 'FSQM-036 was not changed at all.';
  end if;
  if r.crs <> 0 then
    raise exception 'CR characters are present in FSQM-036.';
  end if;
  -- This migration amends only. Issuing is 20260910000010.
  if r.st is distinct from 'draft' then
    raise exception 'FSQM-036 should still be draft; found %.', r.st;
  end if;
end $$;

commit;
