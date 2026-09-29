-- D-31: FSQM-033 draft - the pot and pan washer has a vacuum breaker on its water fill (owner, 2026-09-29).
--
-- The draft (20260929000003, pushed and immutable) said the hose-tap vacuum breakers were the only backflow
-- devices inside the unit. The owner confirmed the pot washer's fill has a built-in vacuum breaker, so procedure
-- line 14 now names both, and the revision history's TO CONFIRM (1) drops the pot washer question. The hose
-- vacuum breakers are on order and are fitted on 2026-10-01. Still DRAFT; revision stays New.
-- Guarded on the md5 of the content as pushed (attachments excluded) and on the exact old texts.

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FSQM-033';
  if st is distinct from 'draft' or h <> '40037247709cdc203f11c660fd1ed0c9' then
    raise exception 'FSQM-033 is % or changed since the draft was pushed (md5 %).', st, h;
  end if;
  if (select content->'procedure'->>13 from public.sop_documents where sop_number = 'FSQM-033') <> $t$• Inside the unit, the only backflow devices are the vacuum breakers on the hose taps (below); the device at the meter protects the city, not the taps inside the unit. Every sink and basin tap discharges above the rim of its sink, which leaves an air gap, so water in the sink cannot be drawn back into the tap (SQF 11.5.1.4, 11.5.1.5 iii).$t$ then
    raise exception 'FSQM-033 procedure line 14 is not the text this migration replaces.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{procedure,13}', to_jsonb($t$• Inside the unit, the backflow devices are the vacuum breaker built into the pot and pan washer's water fill and the vacuum breakers on the hose taps (below); the device at the meter protects the city, not the taps inside the unit. Every sink and basin tap discharges above the rim of its sink, which leaves an air gap, so water in the sink cannot be drawn back into the tap (SQF 11.5.1.4, 11.5.1.5 iii).$t$::text)),
         '{revision_history}',
         to_jsonb(replace(replace(content->>'revision_history',
           $t$there was none on any equipment or hose inside the unit, and the owner will fit hose-bib vacuum breakers on every tap a hose is used on;$t$, $t$inside the unit, the pot and pan washer's water fill has a built-in vacuum breaker and nothing else was protected; hose-bib vacuum breakers (ASSE 1011) were ordered on 2026-09-29 for every tap a hose is used on, to be fitted on 2026-10-01;$t$),
           $t$(1) the hose-bib vacuum breakers fitted, and whether the pot and pan washer's water fill has a built-in air gap or vacuum breaker (its data plate or manual);$t$, $t$(1) the hose-bib vacuum breakers fitted;$t$)))
 where sop_number = 'FSQM-033' and status = 'draft';

do $verify$
declare c jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-033';
  if c->'procedure'->>13 not like '%pot and pan washer''s water fill%' or jsonb_array_length(c->'procedure') <> 36 then
    raise exception 'FSQM-033 procedure line 14 was not updated.';
  end if;
  if c->>'revision_history' like '%pot and pan washer''s water fill has a built-in air gap or vacuum breaker (its data plate%'
     or c->>'revision_history' not like '%to be fitted on 2026-10-01%' then
    raise exception 'FSQM-033 revision history was not updated.';
  end if;
end $verify$;

commit;
