-- SOP-401 Temperature-Controlled Storage  v3 -> v4: the walk-in freezer is out of service.
--
-- WHY. The owner switched the walk-in freezer off on 2026-10-12 and placed it out of service in
-- the Team App (Compliance -> Temperature Monitoring -> Limits -> In service), which is the
-- recorded decision SOP-401 Part 7 describes. Part 1 of the procedure stated the opposite: that
-- the unit was in service, switched on and monitored. The procedure itself says the Team App
-- page is the controlled record of unit state, so the change was valid without this revision;
-- this revision keeps the paper and the record saying the same thing.
--
-- WHAT CHANGES. Procedure line 2 (the Part 1 intro) and line 4 (the freezer bullet), and a v4
-- entry at the head of the revision history. Nothing else: no limit, frequency or
-- responsibility changes. Revision v3 -> v4, effective 2026-10-12, approved GJM (every
-- controlled document is approved by GJM).
--
-- GUARDS. Converging: already at v4 with the new text is a clean no-op; at v3 with exactly the
-- text this was written against is updated; anything else raises. The guard reads the specific
-- JSON paths, not substrings of the whole document.
--
-- Companion: 20261012000003 adds temperature_limits.in_service_reason, which the Team App
-- writes when a unit changes state and the FRM-401 fill reads.

do $$
declare
  d record;
  old_intro  text := $t$> The site has three temperature sensors. Two are in storage units that are judged against a limit; the third monitors the production area and is not a storage unit.$t$;
  new_intro  text := $t$> The site has three temperature sensors. Two are in storage units, which are judged against a limit while in service; the third monitors the production area and is not a storage unit.$t$;
  old_bullet text := $t$• Walk-In Freezer (sensor d88b4c010010b513) — in service. The vegan burger line it held was discontinued in June 2026, so it currently holds no product; it nonetheless remains switched on and monitored against its limit, because a running unit that cannot hold temperature is worth knowing about. It is placed out of service only when it is switched off — see Part 7 before any food is placed in it.$t$;
  new_bullet text := $t$• Walk-In Freezer (sensor d88b4c010010b513) — out of service since 2026-10-12, when it was switched off. It had held no product since the vegan burger line was discontinued in June 2026, and was kept running and monitored until then because a running unit that cannot hold temperature is worth knowing about. Its sensor keeps reporting, but its readings are not judged and it raises no alert. See Part 7 before it is switched on again and before any food is placed in it.$t$;
  v4_head    text := $t$v4 — 2026-10-12 — The walk-in freezer is out of service.

The freezer was switched off on 2026-10-12 and placed out of service in the Team App under Part 7, with the reason recorded. Part 1 said the unit was in service and switched on; it now says what the Team App’s state record says. No limit, frequency or responsibility changes.

Two things the Team App now does that this revision relies on: an alert still open when a unit is taken out of service is closed as “Unit placed out of service” rather than left open or reported as back within limits; and the change of state, with its date and reason, is carried onto that month’s FRM-401 by the fill from the temperature logs. The alert that was open on 2026-10-12 is the first closed that way.$t$;
  proc jsonb;
  hist text;
begin
  select id, revision, status, content into d from public.sop_documents where sop_number = 'SOP-401';
  if not found then
    raise exception 'SOP-401: document not found';
  end if;

  proc := d.content -> 'procedure';
  hist := d.content ->> 'revision_history';

  if d.revision = 'v4' and proc ->> 3 = new_bullet and proc ->> 1 = new_intro
     and left(hist, length(v4_head)) = v4_head then
    raise notice 'SOP-401: already at v4, left alone';
    return;
  end if;

  if d.revision <> 'v3' or d.status <> 'active' then
    raise exception 'SOP-401: not in the state this migration was written against (revision %, status %)', d.revision, d.status;
  end if;
  if proc ->> 3 is distinct from old_bullet then
    raise exception 'SOP-401: procedure line 4 (the freezer bullet) is not the v3 text this migration edits';
  end if;
  if proc ->> 1 is distinct from old_intro then
    raise exception 'SOP-401: procedure line 2 (the Part 1 intro) is not the v3 text this migration edits';
  end if;
  if left(hist, 4) <> 'v3 ' || chr(8212) then
    raise exception 'SOP-401: revision history does not start with the v3 entry';
  end if;

  proc := jsonb_set(proc, '{1}', to_jsonb(new_intro));
  proc := jsonb_set(proc, '{3}', to_jsonb(new_bullet));

  update public.sop_documents
     set content = d.content
                   || jsonb_build_object('procedure', proc)
                   || jsonb_build_object('revision_history', v4_head || E'\n\n' || hist),
         revision = 'v4',
         effective_date = '2026-10-12',
         approved_by = 'GJM'
   where id = d.id;

  -- After: the two lines read as intended and every other line is untouched. (jsonb - int
  -- removes an array element, so the higher index goes first.)
  select content -> 'procedure' into proc from public.sop_documents where id = d.id;
  if proc ->> 3 <> new_bullet or proc ->> 1 <> new_intro
     or jsonb_array_length(proc) <> jsonb_array_length(d.content -> 'procedure')
     or (proc - 3 - 1) <> ((d.content -> 'procedure') - 3 - 1) then
    raise exception 'SOP-401: the v4 edit did not land as written';
  end if;
  raise notice 'SOP-401: v3 -> v4, the walk-in freezer is recorded as out of service';
end $$;
