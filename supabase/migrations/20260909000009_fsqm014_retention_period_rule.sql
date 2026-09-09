-- FSQM-014 Part 6: state the retention rule the site will actually follow.
--
-- WHAT WAS THERE. Part 6 was seeded thin, on purpose, because the answer was not known: four
-- bullets that identified a sample, stored it under normal conditions, kept it "for the product's
-- stated shelf life" and logged it. The document carried that as an OPEN BEFORE ISSUE item asking
-- what is actually retained, where, and for how long.
--
-- THE ANSWER, 2026-09-09. Samples have in practice been kept for about a year with no rule
-- enforced, and the owner asked whether that much is needed beyond the product's expiration date.
-- It is not. SQF 2.4.4.5 imposes its rule ONLY where retention samples are required by a customer
-- or a regulation, and neither requires them here; where it does apply it measures retention
-- against the stated shelf life and stops there. No federal rule reaches a bakery on this point
-- either - reserve-sample requirements sit in infant formula and dietary supplements.
--
-- THE PERIOD IS ANCHORED TO THE DATE PRINTED ON THE PACK, and that is the real design decision.
-- 2.4.4.5's wording is "the stated shelf life of the product", which ordinarily means the finished
-- product specification - and this site holds none, which is the same gap Part 5 works around. The
-- date coded onto every pack IS the shelf life the site has in fact stated for that unit. It
-- exists today, and it is legible on the retained sample itself, so the date a sample may be
-- discarded can be read off the sample without opening another document. Part 6 is therefore
-- performable now, does not wait on the specification library (D-09), and will not need to change
-- when that library is built. Thirty days past that date is the site's own margin, and is written
-- as the site's margin rather than dressed as a Code requirement.
--
-- ONE THING IS STATED THAT WAS NOT ASKED: separation from saleable stock. A retained unit is
-- finished product in its own shipping pack sitting in the building. If it is not identified and
-- separated it can be picked and shipped, which turns a quality practice into a traceability
-- defect. The rule is cheap to state and expensive to discover.
--
-- THE UNIT OF RETENTION IS AN INFERENCE AND IS FLAGGED AS ONE. Per-batch was not confirmed by the
-- owner; it is the only unit consistent with the rest of the system, since FRM-701 releases a
-- batch and a sample taken per product or per production day cannot answer a question about a
-- specific lot when two lots ran the same day. The open item is narrowed to that and to naming the
-- storage location, rather than closed.
--
-- THE PACKS ARE CODED TO THE MONTH. A finished pack examined on 2026-09-09 reads "Best By: July
-- 2027" - no day. Thirty days after that is ambiguous by up to a month, so Part 6 says the period
-- runs from the LAST day of the coded month: the reading that keeps the sample longer, which is the
-- right direction to be wrong in. It follows that FRM-703 records the printed date as TEXT, exactly
-- as printed, rather than as a calendar date the filler would have to invent a day for and then
-- record the invention as a printed fact.
--
-- THE BLOCK IS REPLACED BY BOUNDARY, NOT BY INDEX. Part 6 grows from 6 lines to 12, so every index
-- after it moves. The head and the tail are taken by locating the Part 6 heading and the Part 7
-- heading by text, which is the lesson from 20260909000002 and 000004, and the guards assert that
-- neither head nor tail moved by a byte.
--
-- STILL DRAFT. No revision to bump, nothing to re-approve.

begin;

do $$
declare
  r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                          as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like 'Retention samples are not required by any customer%')             as n_head,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like 'Anything that fails an inspection shall not be accepted%')        as n_next,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%kept for the product''s stated shelf life and then discarded%')  as n_thin,
         (content->>'revision_history') like '%2. Retention samples: confirm what is actually retained%'
                                                                                            as open_item,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — three things the site must settle:%'
                                                                                            as heading
    into r
    from public.sop_documents where sop_number = 'FSQM-014';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 is %/% , expected draft/New. An issued document is not amended this way.',
      r.status, r.revision;
  end if;
  if r.lines <> 29 then
    raise exception 'FSQM-014 procedure is % lines, expected 29.', r.lines;
  end if;
  -- Both boundaries must be unique, because the block is located by them.
  if r.n_head <> 1 or r.n_next <> 1 then
    raise exception 'Part 6 / Part 7 headings are not uniquely identifiable (head=%, next=%).',
      r.n_head, r.n_next;
  end if;
  if r.n_thin <> 1 then
    raise exception 'The thin shelf-life bullet this migration replaces is not present (found %).', r.n_thin;
  end if;
  if not (r.open_item and r.heading) then
    raise exception 'The revision history is not the text this migration edits (item=%, heading=%).',
      r.open_item, r.heading;
  end if;
end $$;

-- Everything outside Part 6 and the revision history, captured so the after-guard can prove none
-- of it moved. head and tail are the procedure lines before the Part 6 heading and from the Part 7
-- heading onward.
create temporary table fsqm014_p6_before on commit drop as
with bounds as (
  select content as c,
         content->'procedure' as p,
         (select x.ord from jsonb_array_elements_text(content->'procedure') with ordinality x(line, ord)
           where x.line like 'Retention samples are not required by any customer%')      as s_ord,
         (select x.ord from jsonb_array_elements_text(content->'procedure') with ordinality x(line, ord)
           where x.line like 'Anything that fails an inspection shall not be accepted%') as e_ord
    from public.sop_documents where sop_number = 'FSQM-014'
)
select s_ord, e_ord,
       md5((c - 'procedure' - 'revision_history')::text)  as rest_h,
       (c->>'revision_history')                           as history,
       (select jsonb_agg(to_jsonb(x.line) order by x.ord)
          from jsonb_array_elements_text(p) with ordinality x(line, ord)
         where x.ord < s_ord)                             as head,
       (select jsonb_agg(to_jsonb(x.line) order by x.ord)
          from jsonb_array_elements_text(p) with ordinality x(line, ord)
         where x.ord >= e_ord)                            as tail
  from bounds;

do $$
declare
  b record;
begin
  select * into b from fsqm014_p6_before;

  if b.s_ord is null or b.e_ord is null then
    raise exception 'Part 6 could not be located.';
  end if;
  if b.e_ord - b.s_ord <> 6 then
    raise exception 'Part 6 is % lines, expected 6. It has been edited since this was written.',
      b.e_ord - b.s_ord;
  end if;
  if b.head is null or b.tail is null then
    raise exception 'Part 6 is at the start or the end of the procedure; that is not the document.';
  end if;

  update public.sop_documents
     set content = jsonb_set(content, '{procedure}', b.head || $part6$[
"Retention samples are not required of Adventure Bakery by any customer or by any regulation applying to this site. The site retains them regardless, so the basis on which a sample is taken, the condition it is held in, the period it is kept and the manner of its disposal are stated here.",
"> SQF 2.4.4.5 imposes its rule only where retention samples are required by a customer or by a regulation, and here neither requires them. The practice therefore needs a basis of its own. A sample an auditor finds in the building without one is not a retention sample; it is old product held for no stated reason, and the auditor is entitled to ask which of the two it is.",
"• One sealed unit of finished product shall be retained from each production batch, in the pack and configuration in which that batch shipped.",
"• Each retained sample shall be identified with the product, the batch or lot code, and the date code printed on the pack, so that it can be matched to the batch it speaks for and to that batch's release record on FRM-701.",
"• Retained samples shall be held under the product's normal storage conditions, in a designated location, identified as retention samples and kept separate from saleable stock so that one cannot be picked and shipped.",
"• A retained sample shall be kept until thirty days after the best-by or expiration date printed on its pack, and then discarded. Where a customer agreement requires a longer period for that customer's product, the longer period applies.",
"• Where the pack is coded with a month and year only, the thirty days shall run from the last day of that month.",
"• Each retained sample shall be logged on FRM-703 Retention Sample Log when it is taken, and its disposal recorded there when it leaves the shelf — whether it is discarded at the end of its period or used earlier for a complaint or an investigation.",
"> The period is anchored to the date printed on the pack rather than to a specification, and that is deliberate. SQF 2.4.4.5 measures retention against the stated shelf life of the product, which ordinarily means the finished product specification — and this site holds none, which is the same gap Part 5 works around. The date coded onto every pack is the shelf life the site has in fact stated for that unit. It exists today, and it is legible on the retained sample itself, so the date a sample may be discarded can be read off the sample without opening another document.",
"> The thirty days is this site's own margin and not a requirement of the Code, which measures to the stated shelf life and stops there. It is here because a complaint about a unit eaten near its date arrives after that date, and a sample discarded on the date itself would be gone exactly when it was wanted.",
"> A retained sample at this site cannot be tested. No analysis of any kind is performed or commissioned — see Part 2 — so what a sample can show is what was made, how it was packed, coded and labelled, and how it presents when compared against a complaint. That is worth keeping, and it is also why the period is measured in weeks past the printed date rather than in years: a baked product long past its date no longer shows how it left the site.",
"> The sample and the record are on different clocks and are not to be confused. The sample is discarded thirty days after the printed date. FRM-703, the record that the sample was taken and disposed of, is retained on the same basis as every other record in this program — see the Records section."
]$part6$::jsonb || b.tail)
   where sop_number = 'FSQM-014' and status = 'draft';
end $$;

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(
           replace(
             replace(content->>'revision_history',
               'OPEN BEFORE ISSUE — three things the site must settle:',
               $settled$RETENTION PERIOD — SETTLED 2026-09-09. The practice was to keep samples for about a year, with no rule enforced, and the owner asked whether that much is needed beyond the product's expiration date. It is not. SQF 2.4.4.5 imposes its rule only where retention samples are required by a customer or a regulation, and neither requires them here; where the rule does apply it measures retention against the stated shelf life and stops there. No federal rule reaches a bakery on this point either — reserve-sample requirements sit in infant formula and in dietary supplements, not in baked goods. Part 6 now sets the period at thirty days past the best-by or expiration date printed on the pack, with a customer agreement governing where it requires longer.

ANCHORING THE PERIOD TO THE PRINTED DATE RESOLVES A DEPENDENCY. 2.4.4.5's own wording is "the stated shelf life of the product", which ordinarily means the finished product specification — and the site holds none, which is the same gap Part 5 works around. The date coded onto every pack is the shelf life this site has in fact stated for that unit; it exists today, and it is legible on the retained sample itself. Part 6 is therefore performable now, does not wait on the specification library, and will not need to change when that library is built.

THE PACKS ARE CODED TO THE MONTH, NOT TO THE DAY. A finished pack examined on 2026-09-09 reads "Best By: July 2027" — a month and a year, with no day in it. Thirty days after that is ambiguous by up to a month, so Part 6 states the convention: the period runs from the LAST day of the coded month. That is the reading that keeps the sample longer, which is the right direction to be wrong in on a safety record. It also decides how FRM-703 records the date — as text, exactly as printed, rather than as a calendar date for which the filler would have to invent a day and then record the invention as a printed fact. A record of the pack should say what the pack says.

THE THIRTY DAYS IS THE SITE'S OWN MARGIN and is recorded as such rather than dressed as a requirement. A complaint about a unit eaten near its date arrives after that date, and a sample discarded on the date would be gone exactly when it was wanted. Little is lost by shortening from a year: the sample cannot be tested, since no analysis of any kind is performed (Part 2), so what it can show is what was made, packed, coded and labelled — and a baked product long past its date no longer shows that reliably. BEFORE THIS IS ISSUED, CHECK THE TOLLING AGREEMENTS: a contractual retention term is the likeliest reason a year became the habit, and Part 6 defers to a customer agreement where one requires longer.

Part 6 also now states that retained samples are separated from saleable stock. That was not asked for. A retained unit is finished product in its own shipping pack sitting in the building, and if it is not identified and separated it can be picked and shipped.

OPEN BEFORE ISSUE — three things the site must settle:$settled$),
             $olditem$2. Retention samples: confirm what is actually retained (one unit per batch, per product, or per production day), where it is stored, and for how long, so that Part 6 and FRM-703 describe the real practice rather than a reasonable-sounding one. Part 6 currently sets the shelf life as the retention period, which is the rule 2.4.4.5 applies where retention is required.$olditem$,
             $newitem$2. Retention samples — the PERIOD is settled above; confirm the UNIT and the LOCATION. Part 6 states one sealed unit per production batch, in the pack it shipped in, held in a designated location and separated from saleable stock. Per-batch was chosen rather than confirmed: it is the only unit consistent with the rest of the system, since FRM-701 releases a batch and a sample taken per product or per production day cannot answer a question about a specific lot when two lots ran the same day. Confirm that it matches what the floor actually does, and name the designated storage location, so that Part 6 and FRM-703 describe the real practice rather than a reasonable-sounding one.$newitem$)
         )::jsonb)
 where sop_number = 'FSQM-014' and status = 'draft';

do $$
declare
  r record;
  drift int;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                            as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%thirty days after the best-by or expiration date printed on its pack%') as period_rule,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%One sealed unit of finished product shall be retained from each production batch%') as unit_rule,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%kept separate from saleable stock%')                               as separation_rule,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%coded with a month and year only%')                                as month_rule,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%FRM-703 Retention Sample Log%')                                    as names_log,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%stated shelf life and then discarded%')                            as thin_gone,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                               as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                               as prose,
         (content->>'revision_history') like '%RETENTION PERIOD — SETTLED 2026-09-09%'       as settled,
         (content->>'revision_history') like '%CHECK THE TOLLING AGREEMENTS%'                as contracts_flag,
         (content->>'revision_history') like '%2. Retention samples — the PERIOD is settled above%' as new_item,
         (content->>'revision_history') like '%confirm what is actually retained (one unit per batch%' as old_item,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — three things the site must settle:%' as heading,
         (content->>'revision_history') like '%3. The consultant scored 2.4.4.5 Minor%'      as item3
    into r
    from public.sop_documents where sop_number = 'FSQM-014';

  if r.lines <> 35 then
    raise exception 'Procedure is % lines, expected 35 (29 less 6 plus 12).', r.lines;
  end if;
  if r.period_rule <> 1 or r.unit_rule <> 1 or r.separation_rule <> 1 or r.names_log <> 1 then
    raise exception 'Part 6 did not land: period=%, unit=%, separation=%, log=%.',
      r.period_rule, r.unit_rule, r.separation_rule, r.names_log;
  end if;
  -- The packs are coded to the month. Without this line the thirty days is ambiguous by up to one.
  if r.month_rule <> 1 then
    raise exception 'The month-coded convention is missing from Part 6 (found %).', r.month_rule;
  end if;
  if r.thin_gone <> 0 then
    raise exception 'The thin shelf-life bullet is still present (% copies).', r.thin_gone;
  end if;
  -- Exact, because they are computable: the document held 10 bullets and 10 prose lines over 9
  -- plain steps. Part 6 gave up 4 bullets and 1 prose line and gained 6 bullets and 4 prose.
  if r.bullets <> 12 or r.prose <> 14 then
    raise exception 'Line forms wrong after the edit: % bullets, % prose (expected 12 / 14).',
      r.bullets, r.prose;
  end if;
  if not (r.settled and r.contracts_flag and r.new_item and r.heading and r.item3) then
    raise exception 'Revision history wrong: settled=%, contracts=%, new=%, heading=%, item3=%.',
      r.settled, r.contracts_flag, r.new_item, r.heading, r.item3;
  end if;
  if r.old_item then
    raise exception 'The superseded open item is still present; the replace did not match.';
  end if;
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 status/revision moved during the amendment (%/%).', r.status, r.revision;
  end if;

  -- Nothing outside Part 6 and the revision history may have moved, and the history may only have
  -- been rewritten in the two places checked above - so its length must have grown, not shrunk.
  select count(*) into drift
    from public.sop_documents d, fsqm014_p6_before b
   where d.sop_number = 'FSQM-014'
     and (md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.rest_h
       or (select jsonb_agg(to_jsonb(x.line) order by x.ord)
             from jsonb_array_elements_text(d.content->'procedure') with ordinality x(line, ord)
            where x.ord < b.s_ord) is distinct from b.head
       or (select jsonb_agg(to_jsonb(x.line) order by x.ord)
             from jsonb_array_elements_text(d.content->'procedure') with ordinality x(line, ord)
            where x.ord >= b.s_ord + 12) is distinct from b.tail
       or length(d.content->>'revision_history') <= length(b.history));
  if drift <> 0 then
    raise exception 'FSQM-014 changed beyond Part 6 and its revision history. Rolled back.';
  end if;
end $$;

commit;
