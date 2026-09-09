-- Fold SOP-401's six OPEN BEFORE ISSUE floor items into the body. Still DRAFT —
-- this migration only amends the procedure; the sibling 20260908000007 issues.
--
-- All six were completed on the floor on 2026-09-08 and confirmed by the owner:
--   (1) refrigerator sensor moved to the unit's warmest point, next to the door;
--   (2) the sensors have no local display — the reading is taken from the YoLink
--       app and the Team App without entering the unit;
--   (3) both units' defrost/condensate drains discharge to the site drain or the
--       outside of the facility, not onto floor or product (photographed);
--   (4) both units walked: sound, cleanable, adequate capacity, PACKAGED product
--       only (photographed);
--   (5) the probe reads within 2 °F of the sensors, so Part 6's ±2 °F stands;
--   (6) the vegan burger line was discontinued June 2026 and the freezer stays in
--       service while running.
-- Item (5) is folded into the revision history at issue (the ±2 °F rule already
-- reads correctly in Part 6). Items 1,2,6 land in Part 1; items 3,4 in Part 8.
--
-- Four procedure lines are replaced IN PLACE (indices 2, 3, 6, 50), so the line
-- count stays 53 and 20260908000007's hash guard still sees a coherent body.

begin;

do $$
declare r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure') as lines,
         ((content->>'revision_history') like '%OPEN BEFORE ISSUE%') as open_head
    into r
    from public.sop_documents where sop_number = 'SOP-401';
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'SOP-401 is not draft/New (found %/%).', r.status, r.revision;
  end if;
  if r.lines <> 53 then
    raise exception 'SOP-401 procedure is % lines, expected 53.', r.lines;
  end if;
  if not r.open_head then
    raise exception 'SOP-401 does not carry the OPEN BEFORE ISSUE heading.';
  end if;
end $$;

update public.sop_documents
set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
    content,
    '{procedure,2}', to_jsonb($p2$• Walk-In Refrigerator (sensor d88b4c010010b5da) — holds butter, liquid eggs and other refrigerated ingredients. In service. Its sensor is placed at the unit's warmest point, next to the door, which is where SQF 11.6.2.3 requires the monitoring equipment to sit.$p2$::text)),
    '{procedure,3}', to_jsonb($p3$• Walk-In Freezer (sensor d88b4c010010b513) — in service. The vegan burger line it held was discontinued in June 2026, so it currently holds no product; it nonetheless remains switched on and monitored against its limit, because a running unit that cannot hold temperature is worth knowing about. It is placed out of service only when it is switched off — see Part 7 before any food is placed in it.$p3$::text)),
    '{procedure,6}', to_jsonb($p6$> A temperature reading for each in-service unit shall be readable without entering the unit, so that a unit can be checked without opening the door. The sensors carry no local display: the reading is taken from the YoLink app and from the Team App's Temperature Monitoring page, both of which show each unit's current temperature without the door being opened.$p6$::text)),
    '{procedure,50}', to_jsonb($p50$• These were confirmed at issue of this procedure, on 2026-09-08: both units were found sound, cleanable, and of adequate capacity for the site's maximum expected volume; both hold packaged product only, with no exposed product; and the defrost and condensate water of each unit drains to the site drain or to the outside of the facility, not onto the floor or onto stored product. Photographs of both units and of their drain lines are retained. They are re-inspected monthly on FRM-913 under its 11.6.2 Cold Storage line, which is where facility condition is already recorded.$p50$::text))
where sop_number = 'SOP-401' and status = 'draft';

do $$
declare r record;
begin
  select
    (content #>> '{procedure,2}')  like '%warmest point, next to the door%'                       as p2,
    ((content #>> '{procedure,3}') like '%— in service.%' and (content #>> '{procedure,3}') like '%discontinued in June 2026%') as p3,
    (content #>> '{procedure,6}')  like '%YoLink app%'                                             as p6,
    ((content #>> '{procedure,50}') like '%packaged product only%' and (content #>> '{procedure,50}') like '%site drain or to the outside%') as p50,
    jsonb_array_length(content->'procedure') as lines,
    status
    into r
    from public.sop_documents where sop_number = 'SOP-401';
  if not (r.p2 and r.p3 and r.p6 and r.p50) then
    raise exception 'Amendment did not apply cleanly: p2=%, p3=%, p6=%, p50=%.', r.p2, r.p3, r.p6, r.p50;
  end if;
  if r.lines <> 53 then
    raise exception 'Procedure line count changed to % (expected 53).', r.lines;
  end if;
  if r.status is distinct from 'draft' then
    raise exception 'SOP-401 status changed during amendment (found %).', r.status;
  end if;
end $$;

commit;
