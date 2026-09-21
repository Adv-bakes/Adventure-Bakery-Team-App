-- SOP-401 v2 + FRM-401 v2 - check the probe thermometer at the ice point before it is used as the
-- reference for the monthly sensor accuracy check.
--
-- WHY. SOP-401 Part 6 compares each unit's YoLink sensor against the probe thermometer and passes it
-- within ±2 °F - "the probe thermometer is the reference". Nothing checked the reference. A probe and
-- a sensor that drift the same way agree with each other and pass together, which is the one failure
-- the comparison exists to catch. SQF 11.2.3 asks for measuring equipment to be checked against a
-- known standard; ice water is one, and needs nothing the site does not already have.
--
-- ±1 °F, NOT ±2 °F, for the probe, because it is the reference: a probe allowed 2 °F of drift could
-- pass a sensor that is 4 °F out. Most food probes are rated ±1-2 °F and can be re-zeroed.
--
-- NOT A CALIBRATION PROGRAM. That is D-28 and is still `planned` on the verification schedule; Part 6
-- already says this check moves into it when it is written. This closes the gap in the one check
-- that is being performed today.
--
-- WHAT CHANGES
--   SOP-401  two procedure lines inserted before the probe-against-sensor bullet (a bullet saying
--            how, a prose line saying the tolerance and what happens on a fail); the records line
--            names the ice-point check; v2 prepended to the revision history. Nothing else moves.
--   FRM-401  five fields added to the "Device accuracy check" section ahead of the comparison grid,
--            and that section's instruction rewritten to put the ice-point check first. Every
--            existing field id survives, so existing entries still map.
-- RENUMBERED from 20260921000004, which collided with the D-09 SOP-11.1.17 migration. The first push ran
-- this file's body and committed it (its own begin/commit closed before the CLI's history insert),
-- then failed on the duplicate version - so on this push both documents are already at v2 and the
-- idempotent branches below skip; the verify block still runs, and the CLI records the version.
-- Lines are found by their TEXT, never by index. Re-running against a database that already holds
-- v2 is a no-op. Revised to v2, GJM, 2026-09-21; the history trigger snapshots New.

begin;

do $mig$
declare
  sop record;
  frm record;
  cmp_line constant text := $c$• Compare the probe thermometer against each in-service unit's sensor, both reading the same location at the same time, and record both values.$c$;
  new_bullet constant text := $b$• Check the probe thermometer at the ice point first. Fill a cup with crushed ice, top it up with cold water, stir, and leave it for a minute. Hold the probe in the centre of the cup, clear of the sides and bottom, until the reading settles, and record it on FRM-401 with the probe used.$b$;
  new_prose constant text := $p$> The probe should read 32 °F, and within 1 °F either way is a pass. If it reads further out, adjust it to 32 °F if it can be adjusted and check it again. A probe that cannot be brought within 1 °F is taken out of use and replaced, and the comparison below waits until a probe has passed. The probe is held to a tighter tolerance than the sensors because it is the reference: a probe allowed to drift 2 °F could pass a sensor that is 4 °F out.$p$;
  old_records constant text := 'the probe-against-sensor accuracy check';
  new_records constant text := 'the ice-point check of the probe thermometer and the probe-against-sensor accuracy check';
  rev_note constant text := replace($r$v2 — 2026-09-21 — Ice-point check of the probe thermometer.

Part 6 compared each sensor against the probe thermometer and treated the probe as the reference, but nothing checked the probe. A probe and a sensor that had drifted the same way would agree, and pass together. The probe is now checked in ice water each month before it is used for that comparison: it must read 32 °F within 1 °F, or be adjusted and re-checked, or replaced. The result and the probe used are recorded on FRM-401 v2. This is the only calibration of the temperature equipment until the site writes a single calibration program covering all its measuring devices, when it moves there.

$r$, chr(13), '');
  i int;
  new_fields constant jsonb := $nf$[
    {"id": "probe_used", "type": "text", "label": "Probe thermometer used", "width": "half", "help": "Make and model, or the label on it, so the check can be traced to the device."},
    {"id": "ice_point_date", "type": "date", "label": "Ice-point check date", "width": "half", "required": true},
    {"id": "ice_point_reading", "type": "text", "label": "Probe reading in ice water (°F)", "width": "half", "required": true},
    {"id": "ice_point_pass", "type": "pass_fail", "label": "Within 1 °F of 32 °F", "width": "half", "required": true},
    {"id": "ice_point_action", "type": "text", "label": "If it failed: adjusted and re-checked, or replaced", "width": "full"}
  ]$nf$::jsonb;
  new_intro constant text := replace($t$First check the probe thermometer in ice water: crushed ice topped up with cold water, stirred and left for a minute, the probe held in the centre clear of the sides and bottom. It should read 32 °F, and within 1 °F is a pass. If it does not, adjust it and check again, or replace it. Do not use a probe that has not passed for the comparison below (SOP-401 Part 6).

Then read the probe and the unit's sensor in the same place at the same time. The probe is the reference. Within ±2 °F is a pass; a larger difference means the sensor is suspect — record it, and arrange replacement or re-check before next month.$t$, chr(13), '');
  sch jsonb;
  old_ids text[];
  new_ids text[];
begin
  select status, revision, content into sop from public.sop_documents where sop_number = 'SOP-401';
  select status, revision, content into frm from public.sop_documents where sop_number = 'FRM-401';

  -- ---------------- SOP-401 ----------------
  if sop.revision = 'v2' and (sop.content->'procedure') @> to_jsonb(array[new_bullet]) then
    raise notice 'SOP-401 already at v2 with the ice-point check; skipped.';
  else
    if (sop.status, sop.revision) is distinct from ('active', 'New') then
      raise exception 'SOP-401 is %/% - expected active/New.', sop.status, sop.revision;
    end if;
    select (ord - 1)::int into i
      from jsonb_array_elements_text(sop.content->'procedure') with ordinality e(v, ord)
     where v = cmp_line;
    if i is null then
      raise exception 'SOP-401 no longer carries the probe-against-sensor line this revision inserts before.';
    end if;
    if (sop.content->>'records') not like '%' || old_records || '%' then
      raise exception 'SOP-401 records no longer name the probe-against-sensor accuracy check.';
    end if;

    update public.sop_documents
       set content = jsonb_set(jsonb_set(
                       jsonb_insert(jsonb_insert(content,
                         array['procedure', i::text], to_jsonb(new_prose)),
                         array['procedure', i::text], to_jsonb(new_bullet)),
                       '{records}', to_jsonb(replace(content->>'records', old_records, new_records))),
                       '{revision_history}', to_jsonb(rev_note || coalesce(content->>'revision_history', ''))),
           revision       = 'v2',
           effective_date = date '2026-09-21',
           approved_by    = 'GJM'
     where sop_number = 'SOP-401';
  end if;

  -- ---------------- FRM-401 ----------------
  sch := frm.content->'form_schema';
  if frm.revision = 'v2' and exists (
       select 1 from jsonb_array_elements(sch->'sections') s, jsonb_array_elements(s->'fields') f
        where f->>'id' = 'ice_point_reading') then
    raise notice 'FRM-401 already at v2 with the ice-point fields; skipped.';
  else
    if (frm.status, frm.revision) is distinct from ('active', 'New') then
      raise exception 'FRM-401 is %/% - expected active/New.', frm.status, frm.revision;
    end if;
    select array_agg(f->>'id' order by f->>'id') into old_ids
      from jsonb_array_elements(sch->'sections') s, jsonb_array_elements(s->'fields') f;
    if old_ids && array['probe_used','ice_point_date','ice_point_reading','ice_point_pass','ice_point_action'] then
      raise exception 'FRM-401 already has an ice-point field id but is not v2.';
    end if;
    if not exists (
         select 1 from jsonb_array_elements(sch->'sections') s, jsonb_array_elements(s->'fields') f
          where s->>'id' = 'accuracy' and f->>'id' = 'accuracy_grid') then
      raise exception 'FRM-401 has no accuracy_grid in an accuracy section.';
    end if;

    -- rebuild only the accuracy section: intro rewritten, new fields placed before the grid
    select jsonb_set(sch, '{sections}', jsonb_agg(
             case when s->>'id' <> 'accuracy' then s
                  else jsonb_set(s, '{fields}', (
                    select jsonb_agg(x order by o, k, n)
                      from (
                        select case when f->>'id' = 'accuracy_intro'
                                    then jsonb_set(f, '{text}', to_jsonb(new_intro)) else f end as x,
                               fo as o, 1 as k, 0::bigint as n
                          from jsonb_array_elements(s->'fields') with ordinality ff(f, fo)
                        union all
                        select nf, (select fo from jsonb_array_elements(s->'fields') with ordinality g(f, fo)
                                     where f->>'id' = 'accuracy_grid'), 0, nk
                          from jsonb_array_elements(new_fields) with ordinality n(nf, nk)
                      ) z))
             end order by so))
      into sch
      from jsonb_array_elements(frm.content->'form_schema'->'sections') with ordinality ss(s, so);

    update public.sop_documents
       set content        = jsonb_set(content, '{form_schema}', sch),
           revision       = 'v2',
           effective_date = date '2026-09-21',
           approved_by    = 'GJM'
     where sop_number = 'FRM-401';

    select array_agg(f->>'id' order by f->>'id') into new_ids
      from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
     where d.sop_number = 'FRM-401';
    if not new_ids @> old_ids then
      raise exception 'an existing FRM-401 field id was lost.';
    end if;
    if cardinality(new_ids) <> cardinality(old_ids) + 5 then
      raise exception 'FRM-401 has % fields, expected %.', cardinality(new_ids), cardinality(old_ids) + 5;
    end if;
  end if;
end $mig$;

-- Verify the end state, whichever branch ran.
do $verify$
declare r record; acc text[];
begin
  select s.revision as srev, f.revision as frev,
         s.content->'procedure' as p, s.content->>'records' as rec, s.content->>'revision_history' as hist
    into r
    from public.sop_documents s, public.sop_documents f
   where s.sop_number = 'SOP-401' and f.sop_number = 'FRM-401';
  if r.srev <> 'v2' or r.frev <> 'v2' then
    raise exception 'not both at v2: SOP-401 %, FRM-401 %.', r.srev, r.frev;
  end if;
  -- the ice-point lines sit immediately before the comparison, in order
  if not exists (
       select 1 from jsonb_array_elements_text(r.p) with ordinality a(v, o)
        join jsonb_array_elements_text(r.p) with ordinality b(v, o) on b.o = a.o + 1
        join jsonb_array_elements_text(r.p) with ordinality c(v, o) on c.o = a.o + 2
       where a.v like '• Check the probe thermometer at the ice point first.%'
         and b.v like '> The probe should read 32 °F%'
         and c.v like '• Compare the probe thermometer against each in-service unit''s sensor%') then
    raise exception 'SOP-401 ice-point lines are not directly before the comparison.';
  end if;
  if (select count(*) from jsonb_array_elements_text(r.p) v where v like '%ice point first%') <> 1 then
    raise exception 'SOP-401 carries the ice-point line more than once.';
  end if;
  if r.rec not like '%ice-point check of the probe thermometer%' or r.hist not like 'v2 — 2026-09-21%' then
    raise exception 'SOP-401 records or revision history not updated.';
  end if;
  if position(chr(13) in r.p::text || r.hist) > 0 then
    raise exception 'a carriage return reached SOP-401.';
  end if;

  select array_agg(f->>'id' order by fo) into acc
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') s,
         jsonb_array_elements(s->'fields') with ordinality ff(f, fo)
   where d.sop_number = 'FRM-401' and s->>'id' = 'accuracy';
  if acc is distinct from array['accuracy_intro','probe_used','ice_point_date','ice_point_reading',
                                 'ice_point_pass','ice_point_action','accuracy_grid'] then
    raise exception 'FRM-401 accuracy section is %.', acc;
  end if;
  raise notice 'SOP-401 v2 + FRM-401 v2: probe checked at the ice point before the sensor comparison.';
end $verify$;

commit;
