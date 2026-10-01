-- D-31: FSQM-033 (still DRAFT) lists the water outlets instead of calling for a schematic.
--
-- The draft (20260929000003, amended by ...04) said "the water schematic attached to this program shows ...".
-- No schematic exists, and the Code does not ask for one: 11.5.1.1 requires that the source of potable
-- water, any on-site storage and "reticulation within the facility" are IDENTIFIED. For one city supply
-- with no storage, no treatment and a short pipe run, a written list of outlets identifies it. The SQF
-- Practitioner questioned the drawing; she was right.
--
-- Four lines of the procedure change, and the revision history's open items:
--   [6]  the schematic line becomes the list of outlets - including the utility tap beside the roll-up
--        door used for mop buckets, which the draft had missed (owner, 2026-10-01).
--   [12] TWO backflow preventers, not one: units 415 and 425 each have their own meter and device
--        (owner's photograph, 2026-10-01).
--   [13] "the device at the meter" -> "the devices at the meters", to agree with [12].
--   [16] after plumbing work "the schematic is updated" -> the list of outlets is updated.
--   TO CONFIRM BEFORE ISSUE drops the schematic and asks for both units' test reports.
--
-- Still a draft: status, revision and everything else are untouched. Guarded on the md5 of the content
-- as it stands in production (read 2026-10-01).

begin;

do $guard$
declare h text; st text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-033';
  if st is distinct from 'draft' or h <> '7d6056a8c1e5531299317f672361afb1' then
    raise exception 'FSQM-033 is % or changed since this migration was written (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
         '{procedure,6}',  to_jsonb($l6$• Water enters each of units 415 and 425 through its own meter and backflow preventer and runs to: the three handwash stations; the 3-compartment sink on the production floor, which is also the sample tap; the wash basin in the dry room; the pot and pan washer; the utility tap just inside the production room door beside the roll-up door, used to fill and empty mop buckets; the hose taps; the toilet rooms; and the one water heater, outside the building. Nothing else is connected to the supply: the oven's steam system is not plumbed in, the kettle's jacket is sealed, and there is no ice machine. This list is how the site identifies where its water runs, and it is updated whenever the plumbing changes (SQF 11.5.1.1).$l6$::text)),
         '{procedure,12}', to_jsonb($l12$• Each of units 415 and 425 has its own water meter with its own backflow preventer beside it, which protects that unit's drinking-water supply. Both are owned by the landlord. The City of Sanford requires each to be tested every year by a certified tester. Each year the SQF Practitioner gets a copy of the latest test report for both from the landlord, or from the city if the landlord does not have them, and attaches them to FRM-915 (SQF 11.5.1.4).$l12$::text)),
         '{procedure,13}', to_jsonb($l13$• Inside the unit, the backflow devices are the vacuum breaker built into the pot and pan washer's water fill and the vacuum breakers on the hose taps (below); the devices at the meters protect the city, not the taps inside the units. Every sink and basin tap discharges above the rim of its sink, which leaves an air gap, so water in the sink cannot be drawn back into the tap (SQF 11.5.1.4, 11.5.1.5 iii).$l13$::text)),
         '{procedure,16}', to_jsonb($l16$• Work on the supply pipes is done by a licensed plumber. Afterwards every affected tap is run before use, and the list of outlets in this program is updated (SQF 11.5.1.4).$l16$::text)),
         '{revision_history}', to_jsonb(
            left(content->>'revision_history', position('TO CONFIRM BEFORE ISSUE:' in content->>'revision_history') - 1)
            || $rh$2026-10-01 - THE SCHEMATIC IS REPLACED BY A LIST OF OUTLETS. The draft called for a water schematic to be drawn and attached. The Code does not ask for a drawing: 11.5.1.1 requires that the source, any storage and the reticulation within the facility are identified, and for a supply this simple a written list does that. The list is in 'The supply' and names every outlet, including the utility tap beside the roll-up door used for mop buckets, which the draft had missed. A drawing can still be added later by marking the outlets on the FSQM-039 layout; nothing depends on it.

CORRECTED THE SAME DAY: the units' drinking water is protected by TWO backflow preventers, not one - units 415 and 425 each have their own meter and their own device beside it (owner's photograph, which shows four such assemblies in a row, one per unit of the building). The fire line's test tag reads Freedom Fire Protection, Inc. of Central Florida, annual backflow certification, last punched 20 August 2025.

TO CONFIRM BEFORE ISSUE: (1) the hose-bib vacuum breakers fitted, including on the utility tap beside the roll-up door if it takes a hose; (2) the laboratory, to choose and list on FRM-206; (3) a copy of the latest test report for each of the two backflow preventers at the meters, and for the fire line's, from the landlord - the fire line's tag shows its last test more than twelve months ago.$rh$))
 where sop_number = 'FSQM-033' and status = 'draft';

do $verify$
declare d record; p jsonb; rh text;
begin
  select status, revision, content->'procedure' as p, content->>'revision_history' as rh into d
    from public.sop_documents where sop_number = 'FSQM-033';
  p := d.p; rh := d.rh;
  if d.status <> 'draft' or d.revision <> 'New' then
    raise exception 'FSQM-033 status or revision changed: % / %.', d.status, d.revision;
  end if;
  if jsonb_array_length(p) <> 36 then
    raise exception 'FSQM-033 procedure is % lines, expected 36.', jsonb_array_length(p);
  end if;
  if p::text ilike '%schematic%' then
    raise exception 'FSQM-033 procedure still mentions a schematic.';
  end if;
  if p->>6 not like '%roll-up door%' or p->>6 not like '%three handwash stations%' or p->>6 not like '%11.5.1.1%' then
    raise exception 'FSQM-033 outlet list is not as intended: %', p->>6;
  end if;
  if p->>12 not like '%Each of units 415 and 425 has its own water meter%' or p->>13 not like '%devices at the meters%' then
    raise exception 'FSQM-033 backflow lines are not as intended.';
  end if;
  if (select count(*) from regexp_matches(rh, 'TO CONFIRM BEFORE ISSUE:', 'g')) <> 1
     or rh like '%the water schematic, to draw and attach%' or rh not like '%THE SCHEMATIC IS REPLACED BY A LIST OF OUTLETS%' then
    raise exception 'FSQM-033 revision history not updated as intended.';
  end if;
  if (p::text || rh) like '%' || chr(13) || '%' then raise exception 'FSQM-033 contains a carriage return.'; end if;
  if (p::text || rh) ~* 'Gabriela|Diana|Mercer|GJM' then raise exception 'FSQM-033 names a person.'; end if;
  -- the lines that were not meant to change
  if p->>0 <> 'The supply' or p->>18 not like '%double check detector assembly%' or p->>23 not like '%3-compartment sink faucet%' then
    raise exception 'FSQM-033 changed outside the four intended lines.';
  end if;
end $verify$;

commit;
