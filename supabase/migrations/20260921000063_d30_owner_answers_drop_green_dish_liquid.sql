-- D-30: owner's answers on the FSQM-032 / FRM-402 drafts (2026-09-21).
--
-- 1. "No pesticides are kept on site." FSQM-032 already says so; its revision history note asking for
--    confirmation is replaced by the confirmation.
-- 2. "The green dishwashing liquid is no longer used." Its row (index 3) is removed from FRM-402's
--    register - labels, defaultValues and guidance together, so they stay parallel. Six rows remain.
--
-- Draft content edits only. Guarded on the md5 of each document as seeded by 20260921000062.

begin;

do $guard$
declare h text; st text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-032';
  if st is distinct from 'draft' or h <> '6253da958731a8ef18568c7be8cfad8c' then raise exception 'FSQM-032 is % or changed since seeding (md5 %).', st, h; end if;
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FRM-402';
  if st is distinct from 'draft' or h <> '44855b5827ca64560b9d0fda9d9be094' then raise exception 'FRM-402 is % or changed since seeding (md5 %).', st, h; end if;
end $guard$;

update public.sop_documents
   set content = content || jsonb_build_object('revision_history', $t$New - 2026-09-21 - DRAFT under D-30, for the nine Non-Compliant findings against 11.2.5.2, 11.2.5.3 and 11.6.4.

WHAT THE SITE DOES NOW (owner, 2026-09-21): chemicals are kept separately but not locked, and a locker is planned; Production staff mix and handle them; there are no gloves, eye protection, eyewash or spill kit yet, and they are to be bought; empty containers are rinsed and put in the trash or recycling.

The program writes the locker, the PPE, the eyewash and the spill kit in as requirements and says plainly that they are not yet in place, so that the record shows the gap rather than hiding it.

NO PESTICIDES ON SITE (owner, 2026-09-21): confirmed. The pest control contractor brings and removes them.

GREEN DISHWASHING LIQUID (owner, 2026-09-21): no longer used, so it is not on the register. Any stock left on site is disposed of under Part 8.$t$::text)
 where sop_number = 'FSQM-032';

-- the register grid is sections[1].fields[2]
update public.sop_documents
   set content = content
     #- '{form_schema,sections,1,fields,2,rows,labels,3}'
     #- '{form_schema,sections,1,fields,2,rows,defaultValues,3}'
     #- '{form_schema,sections,1,fields,2,rows,guidance,3}'
 where sop_number = 'FRM-402'
   and content->'form_schema'->'sections'->1->'fields'->2->>'id' = 'chemicals'
   and content->'form_schema'->'sections'->1->'fields'->2->'rows'->'labels'->>3 = 'Green dishwashing liquid';

do $verify$
declare r jsonb;
begin
  select content->'form_schema'->'sections'->1->'fields'->2->'rows' into r from public.sop_documents where sop_number = 'FRM-402';
  if jsonb_array_length(r->'labels') <> 6 or jsonb_array_length(r->'defaultValues') <> 6 or jsonb_array_length(r->'guidance') <> 6 then
    raise exception 'FRM-402 register not six parallel rows.';
  end if;
  if (r->'labels')::text like '%Green dishwashing%' or r->'labels'->>3 <> 'Mr. Clean Professional Degreaser Floor Cleaner'
     or r->'defaultValues'->3->>'used_for' <> 'Floors' then
    raise exception 'FRM-402 green dish liquid row not removed cleanly.';
  end if;
  if (select content->>'revision_history' from public.sop_documents where sop_number = 'FSQM-032') like '%Confirm before issue%' then
    raise exception 'FSQM-032 still asks for confirmation.';
  end if;
end $verify$;

commit;
