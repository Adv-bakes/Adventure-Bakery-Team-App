-- FRM-005 SQF Practitioner Designation Record: the two names are picked from the team directory,
-- and "Position held" is filled with the FSQM-004 positions the person holds.
--
-- Owner's request, 2026-10-17. Primary and Substitute SQF Practitioner get `teamPick` with
-- `titleFrom: "positions"`: entering a listed name fills that person's "Position held", if it is
-- empty, with every position they hold on the Team Directory (position_holders), comma-separated.
-- A person may hold several positions, so the help line says to list them all.
--
-- The question asked does not change, so the revision stays "New" and the approval and effective
-- date are not touched. The history trigger still snapshots the row. Safe to run twice.

do $$
declare
  f jsonb;
  pick constant text := '{"titleField": "%s", "titleFrom": "positions"}';
  help constant text := 'Every FSQM-004 position this person holds, separated by commas. Filled from the Team Directory when a listed name is chosen.';
begin
  select content->'form_schema'->'sections'->0->'fields' into f
    from public.sop_documents where sop_number = 'FRM-005' and status = 'active';
  if f is null or f->3->>'id' <> 'primary_name' or f->4->>'id' <> 'primary_position'
     or f->5->>'id' <> 'substitute_name' or f->6->>'id' <> 'substitute_position' then
    raise exception 'FRM-005 fields are not where this migration expects them.';
  end if;

  if f->3->'teamPick' = format(pick, 'primary_position')::jsonb
     and f->5->'teamPick' = format(pick, 'substitute_position')::jsonb
     and f->4->>'help' = help and f->6->>'help' = help then
    raise notice 'FRM-005: already set, left alone';
    return;
  end if;
  if f->3 ? 'teamPick' or f->5 ? 'teamPick' then raise exception 'FRM-005 already has a different pick-list.'; end if;

  update public.sop_documents
     set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                     '{form_schema,sections,0,fields,3,teamPick}', format(pick, 'primary_position')::jsonb),
                     '{form_schema,sections,0,fields,5,teamPick}', format(pick, 'substitute_position')::jsonb),
                     '{form_schema,sections,0,fields,4,help}', to_jsonb(help)),
                     '{form_schema,sections,0,fields,6,help}', to_jsonb(help))
   where sop_number = 'FRM-005' and status = 'active';
end $$;
