-- D-32 Compressed Air and Gases - the scope question answered, and the one use it turned up.
--
-- THE CONSULTANT RECORDED 11.5.5.1 AND 11.5.5.2 NON-COMPLIANT ON "UNKNOWN". Not on a finding: the
-- gap assessment simply could not tell whether the site uses compressed air at all. The plan
-- reserved FSQM-034 for a compressed air program in case the answer turned out to be yes.
--
-- THE ANSWER WAS ALREADY ON RECORD, AND IT WAS OVERSTATED. FSQM-013 has carried 11.5.5 as category
-- B - not engaged - since 2026-09-01, on the determination that compressed air runs pneumatic
-- equipment only. That is true of the pneumatic equipment. It is not true of the whole site:
-- SOP-605's per-shift clean of the S350X flow wrapper blows film scraps off the feeding, mid-seal
-- and end-seal mechanisms with compressed air, and the SAME SOP states that the film is in direct
-- contact with the baked product. Air pointed at the film path is air pointed at a food-contact
-- surface, which is the case 11.5.5.1 exists for.
--
-- WHAT THE SITE DECIDED (2026-09-16): keep the air, take the film out. The air is what reaches
-- scraps down inside the seal mechanisms and a brush does not, so removing it would have made the
-- clean worse. Separating it in time costs nothing: film out, table cleared, air, wipe and
-- sanitize, film in.
--
-- SO THIS MIGRATION SPLITS 11.5.5 BETWEEN THE TWO CATEGORIES IT ACTUALLY FALLS INTO.
--   SOP-605   -> v2. The per-shift clean step now requires the film unloaded and the table cleared
--                before compressed air, and the film path and seal jaws wiped and sanitized before
--                the next film. 11.5.5.1 added to sqf_reference and to the governing reference.
--   FSQM-013  -> v2. The category B entry narrows to pneumatic actuation and points at the new
--                entry; a FIFTH category C entry carries the cleaning use, with what the clause
--                protects, what is done instead, why that is equivalent, and how it is evidenced.
--   FSQM-017  -> v5. Part 6's "Compressed air quality analysis - awaiting D-32" line is removed.
--   verification_schedule.air_analysis -> RETIRED, not deleted. An activity that stops applying is
--                retired; the row keeps its history, and the schedule page and the notification job
--                both already treat retired as raising nothing.
--
-- NO FSQM-034 IS WRITTEN, AND THAT IS THE DELIVERABLE RATHER THAN A SHORTCUT. 2.4.2.1 puts a
-- determination of scope in the exemption analysis, and the control itself is a step in the SOP
-- that performs the work. A separate program would restate both and hand an auditor a second
-- account of one practice. D-08's FSMS index maps 11.5.5 to FSQM-013 and SOP-605.
--
-- WHAT WOULD RE-OPEN THIS: compressed air put into contact with product or a food-contact surface -
-- a new machine, a blow-off drying step, or the flow wrapper cleaned with film loaded. Then
-- 11.5.5.2 engages, the schedule activity comes back, and filtration and annual testing are owed.
--
-- Guarded on the exact pre-state of all three documents. Not idempotent by design: a second run
-- fails loudly rather than revising v2 into v2.

begin;

-- ------------------------------------------------------------------ guards
do $guard$
declare
  r record;
begin
  select (select status   from public.sop_documents where sop_number = 'SOP-605')  as s605,
         (select revision from public.sop_documents where sop_number = 'SOP-605')  as r605,
         (select status   from public.sop_documents where sop_number = 'FSQM-013') as s013,
         (select revision from public.sop_documents where sop_number = 'FSQM-013') as r013,
         (select status   from public.sop_documents where sop_number = 'FSQM-017') as s017,
         (select revision from public.sop_documents where sop_number = 'FSQM-017') as r017
    into r;

  if r.s605 is null or r.s013 is null or r.s017 is null then
    raise exception 'Expected SOP-605, FSQM-013 and FSQM-017 to exist (got %, %, %).',
      r.s605, r.s013, r.s017;
  end if;
  if (r.s605, r.r605) is distinct from ('active', 'New')
     or (r.s013, r.r013) is distinct from ('active', 'New')
     or (r.s017, r.r017) is distinct from ('active', 'v4') then
    raise exception 'Pre-state wrong: SOP-605 %/%; FSQM-013 %/%; FSQM-017 %/%. Re-derive first.',
      r.s605, r.r605, r.s013, r.r013, r.s017, r.r017;
  end if;

  -- the exact lines this migration rewrites, addressed by index
  if (select content->'procedure'->>5 from public.sop_documents where sop_number = 'SOP-605')
     not like '%blow film scraps off the feeding, mid-seal, and end-seal mechanisms with compressed air%' then
    raise exception 'SOP-605 procedure[5] is not the per-shift clean step this migration rewrites.';
  end if;
  if (select content->'procedure'->>17 from public.sop_documents where sop_number = 'FSQM-013')
     not like '%only to operate pneumatic equipment%' then
    raise exception 'FSQM-013 procedure[17] is not the 11.5.5 category B entry.';
  end if;
  if (select content->'procedure'->>25 from public.sop_documents where sop_number = 'FSQM-013')
     not like '%11.4.1.1 (v)%hose racks%' then
    raise exception 'FSQM-013 procedure[25] is not the last category C entry; the insert point moved.';
  end if;
  if (select jsonb_array_length(content->'procedure')
        from public.sop_documents where sop_number = 'FSQM-013') <> 33 then
    raise exception 'FSQM-013 body is not 33 lines; re-derive the insert point.';
  end if;
  if (select content->'procedure'->>57 from public.sop_documents where sop_number = 'FSQM-017')
     not like '%Compressed air quality analysis%' then
    raise exception 'FSQM-017 procedure[57] is not the compressed air schedule line.';
  end if;
  if (select jsonb_array_length(content->'procedure')
        from public.sop_documents where sop_number = 'FSQM-017') <> 74 then
    raise exception 'FSQM-017 body is not 74 lines; re-derive the line index.';
  end if;
  if not exists (select 1 from public.verification_schedule
                  where activity_key = 'air_analysis' and status = 'planned') then
    raise exception 'verification_schedule.air_analysis is not planned; re-derive.';
  end if;
end $guard$;

-- ------------------------------------------------------------------ 1. SOP-605 v2
update public.sop_documents
   set content = jsonb_set(
         jsonb_set(
           jsonb_set(content, '{procedure,5}', to_jsonb($s605step$Stop and per-shift clean: normal stop is the red stop button (parks the knife level); emergency is the mushroom E-stop (press reset to restart). Per shift, with the power OFF: wipe the table and surfaces with a clean damp cloth; brush film off the end-seal knife. **Compressed air only with the film out** — unload the film and clear the table of product first, then blow film scraps off the feeding, mid-seal, and end-seal mechanisms; afterwards wipe the film path and the seal jaws with a clean damp cloth and sanitize them before the next film is loaded. **Never use compressed air with film loaded or product present:** the film touches the baked product directly, so air blown across a loaded path puts whatever the air carries onto a food-contact surface. (Lubrication and electrical are Maintenance — see the manual's monthly/biannual list.)$s605step$::text)),
           '{governing_reference}',
           to_jsonb((content->>'governing_reference') || E'\n' || $s605gov$SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.5.5.1 (compressed air contacting food or food-contact surfaces). The film-out sequence in the per-shift clean is the alternative control recorded for that clause in FSQM-013.$s605gov$::text)),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || E'\n\n' || $s605rev$v2 — 2026-09-16 — Compressed air restricted to a machine with no film loaded, under D-32.

The per-shift clean called for blowing film scraps off the feeding, mid-seal and end-seal mechanisms with compressed air. This SOP also states, correctly, that the film is in direct contact with the baked product — so the surfaces that air was pointed at are food-contact surfaces, and SQF 11.5.5.1 applies to compressed air that reaches them. The step now requires the film to be unloaded and the table cleared of product before the air is used, and the film path and seal jaws to be wiped and sanitized before the next film is loaded.

The air is not taken away from the operator. Film scraps sit down inside the seal mechanisms where a brush does not reach; what changes is the order — film out, air, wipe and sanitize, film in. FSQM-013 records this as a category C alternative control for 11.5.5.1, in place of filtering the supply and testing it annually.$s605rev$::text)),
       revision       = 'v2',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM',
       sqf_reference  = '2.3.2.6, 11.5.5.1, 11.7.3.1'
 where sop_number = 'SOP-605';

-- ------------------------------------------------------------------ 2. FSQM-013 v2
-- jsonb_insert at {procedure,26} places the new category C entry immediately after the hose entry
-- at 25 and immediately before the "PENDING CHANGES" heading that was at 26.
update public.sop_documents
   set content = jsonb_set(
         jsonb_insert(
           jsonb_set(content, '{procedure,17}', to_jsonb($f013b$• **11.5.5.1 and 11.5.5.2 — Air and Other Gases.** Both clauses are scoped to air or gases *that contact food or food contact surfaces*. The site's compressed air **operates pneumatic equipment**, and in that use no food and no food-contact surface comes into contact with it. **One use is carried separately and is not exempted here:** the per-shift clean of the flow wrapper points compressed air at the film path, and that is classified as a category C alternative control in Part 4 rather than as an exemption — so the determination above covers pneumatic actuation only. Note what this also does **not** exempt: **11.4.1.1 (v), the requirement to store wash-down and compressed air hoses after use, is a processing practice and is not scoped to food contact, so it survives this determination entirely.** It is addressed on its own terms in Part 4.$f013b$::text)),
           '{procedure,26}', to_jsonb($f013c$• **11.5.5.1 — Compressed air blown across the flow wrapper's film path during cleaning.** The per-shift clean of the S350X flow wrapper clears film scraps from the feeding, mid-seal and end-seal mechanisms with compressed air, and the film those mechanisms carry is **in direct contact with the baked product** — so the surfaces the air is pointed at are food-contact surfaces, and 11.5.5.1 reads on its face. The literal measure would be filtering that supply and testing it at least annually under 11.5.5.2. **What the site does instead is separate the air from the product in time:** SOP-605 requires the film to be unloaded and the table cleared of product before compressed air is used, and the film path and seal jaws to be wiped and sanitized before the next film is loaded. No food and no loaded food-contact film is ever present while the air is running, and anything the air deposits is removed before the surface next carries film — which is the outcome 11.5.5.1 protects. Recorded as an alternative control rather than an exemption: a seal jaw is a food-contact surface whether or not film is in it at that moment, and category B would require the clause to have no subject when it plainly has one. **Evidence of effectiveness:** the sequence is a numbered step in SOP-605, the surfaces it leaves behind are checked at the pre-operation inspection on FRM-903 before the next run, and the practice itself is observable at the monthly inspection under 11.4.1 on FRM-913. **This entry fails the moment compressed air is used on a loaded machine** — that is a finding and a corrective action, not a variation of this control.$f013c$::text)),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || E'\n\n' || $f013rev$v2 — 2026-09-16 — The compressed air determination narrowed, and a fifth category C entry added, under D-32.

THE 11.5.5 DETERMINATION WAS TRUE OF THE PNEUMATIC EQUIPMENT AND NOT OF EVERYTHING. SOP-605's per-shift clean of the flow wrapper blows compressed air across the feeding, mid-seal and end-seal mechanisms, and that machine's film is in direct contact with the baked product. Read literally, air is being pointed at a food-contact surface, which is the case 11.5.5.1 exists for — so the category B entry, written when the only use in view was pneumatic actuation, claimed more than the site could support. The determination made on 2026-09-01 stands for the pneumatic equipment, and the entry now says so in those terms.

THE CLEANING USE IS CARRIED AS AN ALTERNATIVE CONTROL, NOT AS AN EXEMPTION. SOP-605 goes to v2 in the same change: the film comes out and the table is cleared before compressed air is used, and the film path and seal jaws are wiped and sanitized before the next film is loaded. That separates the air from the product in time rather than filtering and testing it. Category C is the honest classification — a seal jaw is a food-contact surface whether or not film is in it at that moment, so the clause has a subject and is not merely unengaged.

WHAT THIS CLOSES. 11.5.5.1 and 11.5.5.2 were recorded Non-Compliant at the gap assessment only because the site's use of compressed air was unknown to the assessor. It is now stated, and split between the two categories it actually falls into. No separate compressed air program is written: 2.4.2.1 puts a determination of scope in this analysis, and the control itself is a step in the SOP that performs the work. The annual compressed air quality analysis carried on the verification schedule is retired with this revision, and FSQM-017 goes to v5 to drop the line.$f013rev$::text)),
       revision       = 'v2',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM'
 where sop_number = 'FSQM-013';

-- ------------------------------------------------------------------ 3. FSQM-017 v5
update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{procedure}', (content->'procedure') - 57),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || E'\n\n' || $f017rev$v5 — 2026-09-16 — The annual compressed air quality analysis retired from the schedule, under D-32.

Part 6 carried "Compressed air quality analysis — Annually — NOT YET IMPLEMENTED — awaiting D-32 Compressed Air and Gases". D-32 is answered. The site's compressed air operates pneumatic equipment, where it contacts no food and no food-contact surface, and its one other use — clearing film scraps from the flow wrapper — is now performed only with the film unloaded and the table cleared, under SOP-605 v2, and is carried in FSQM-013 as a category C alternative control. 11.5.5.2's testing obligation is scoped to air that contacts food or food-contact surfaces; with that use controlled there is no air in scope to test, and an annual analysis would be a record of nothing.

The activity is RETIRED on the schedule rather than deleted, which is how this program treats an activity that stops applying, and the line is removed from this Part. The obligation returns the moment compressed air is put into contact with product or a food-contact surface — a new machine, a blow-off drying step, or the flow wrapper being cleaned with film loaded. That is a change the annual review in Part 7 is meant to catch, and it re-opens the activity rather than waiting for the review after it.$f017rev$::text)),
       revision       = 'v5',
       effective_date = date '2026-09-16',
       approved_by    = 'GJM'
 where sop_number = 'FSQM-017';

-- ------------------------------------------------------------------ 4. retire the activity
update public.verification_schedule
   set status              = 'retired',
       pending_deliverable = null,
       owning_program      = 'FSQM-013',
       description         = $vsd$Retired 2026-09-16 under D-32. Compressed air operates pneumatic equipment only, and the one cleaning use - clearing film scraps from the S350X flow wrapper - is performed with the film unloaded and the table cleared (SOP-605 v2), carried in FSQM-013 as a category C alternative control for 11.5.5.1. No air in scope contacts food or food-contact surfaces, so there is nothing for an annual analysis to test. Re-open this activity if compressed air is ever put into contact with product or a food-contact surface.$vsd$,
       updated_at          = now()
 where activity_key = 'air_analysis';

-- ------------------------------------------------------------------ verify
do $verify$
declare
  r record;
begin
  select (select revision from public.sop_documents where sop_number = 'SOP-605')  as r605,
         (select revision from public.sop_documents where sop_number = 'FSQM-013') as r013,
         (select revision from public.sop_documents where sop_number = 'FSQM-017') as r017,
         (select jsonb_array_length(content->'procedure')
            from public.sop_documents where sop_number = 'FSQM-013')               as l013,
         (select jsonb_array_length(content->'procedure')
            from public.sop_documents where sop_number = 'FSQM-017')               as l017,
         (select status from public.verification_schedule where activity_key = 'air_analysis') as vs
    into r;

  if (r.r605, r.r013, r.r017) is distinct from ('v2', 'v2', 'v5') then
    raise exception 'Revisions wrong after update: SOP-605 %, FSQM-013 %, FSQM-017 %.',
      r.r605, r.r013, r.r017;
  end if;
  if r.l013 <> 34 then raise exception 'FSQM-013 should be 34 lines, is %.', r.l013; end if;
  if r.l017 <> 73 then raise exception 'FSQM-017 should be 73 lines, is %.', r.l017; end if;
  if r.vs <> 'retired' then raise exception 'air_analysis is % rather than retired.', r.vs; end if;

  -- the air must be off the loaded machine, in the SOP and in the analysis
  if (select content->'procedure'->>5 from public.sop_documents where sop_number = 'SOP-605')
     not like '%Never use compressed air with film loaded or product present%' then
    raise exception 'SOP-605 does not carry the film-out restriction.';
  end if;
  if (select content->'procedure'->>26 from public.sop_documents where sop_number = 'FSQM-013')
     not like '%Compressed air blown across the flow wrapper%' then
    raise exception 'The fifth category C entry did not land at index 26.';
  end if;
  if (select content->'procedure'->>26 from public.sop_documents where sop_number = 'FSQM-013')
     not like '%Evidence of effectiveness:%' then
    raise exception 'The category C entry carries no evidence-of-effectiveness statement, which is what 2.4.2.1 asks of one.';
  end if;
  if (select content->'procedure'->>17 from public.sop_documents where sop_number = 'FSQM-013')
     like '%only to operate pneumatic equipment%' then
    raise exception 'FSQM-013 still carries the overstated category B wording.';
  end if;
  if (select content->'procedure'->>27 from public.sop_documents where sop_number = 'FSQM-013')
     not like 'PENDING CHANGES%' then
    raise exception 'The insert landed in the wrong place; the PENDING CHANGES heading moved.';
  end if;
  -- 11.4.1.1 (v) hose storage must survive, as the document itself insists
  if not exists (select 1 from public.sop_documents
                  where sop_number = 'FSQM-013'
                    and (content->'procedure')::text like '%11.4.1.1 (v)%hose racks%') then
    raise exception 'The hose-storage entry was lost.';
  end if;
  if (select (content->'procedure')::text from public.sop_documents where sop_number = 'FSQM-017')
     like '%Compressed air quality analysis%' then
    raise exception 'FSQM-017 still lists the compressed air analysis on the schedule.';
  end if;

  raise notice 'D-32: SOP-605 v2, FSQM-013 v2 (% lines), FSQM-017 v5 (% lines), air_analysis retired.',
    r.l013, r.l017;
end $verify$;

commit;
