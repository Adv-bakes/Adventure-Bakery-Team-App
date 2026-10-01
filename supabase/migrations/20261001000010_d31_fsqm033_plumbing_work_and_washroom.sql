-- D-31: FSQM-033 (still DRAFT) - who may work on the water pipes, and the toilet room in unit 425.
--
-- Two corrections from the owner's read of the draft, 2026-10-01:
--
--   [16] "Work on the supply pipes is done by a licensed plumber" was not true of the site and is not
--        an SQF requirement - 11.5.1.4 asks that the delivery of water within the premises does not
--        contaminate it, not who holds the wrench. Like-for-like repairs to taps and fittings may be
--        done by a competent person; changes to the pipework, machine connections and anything on a
--        backflow preventer go to a licensed plumber, because those are the jobs that can create a
--        cross-connection. "Supply pipes" becomes "the water pipes inside the units" - it never meant
--        the pipe before the meter. NOT recorded on FRM-509: the owner's decision.
--   [6]  the list of outlets says where the toilet rooms are - unit 415, and one in unit 425 with a
--        hand sink.
--   [20] [26] "supply pipes" -> "water pipes", the same term as [16].
--
-- Still a draft: status and revision untouched. Guarded on the md5 of the content as it stands in
-- production after 20261001000009.

begin;

do $guard$
declare h text; st text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-033';
  if st is distinct from 'draft' or h <> '5522ee5c6771c5f3ea29215c053dc22e' then
    raise exception 'FSQM-033 is % or changed since this migration was written (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
         '{procedure,6}',  to_jsonb($l6$• Water enters each of units 415 and 425 through its own meter and backflow preventer and runs to: the three handwash stations; the 3-compartment sink on the production floor, which is also the sample tap; the wash basin in the dry room; the pot and pan washer; the utility tap just inside the production room door beside the roll-up door, used to fill and empty mop buckets; the hose taps; the toilet rooms in unit 415; the toilet room in unit 425, with its hand sink; and the one water heater, outside the building. Nothing else is connected to the supply: the oven's steam system is not plumbed in, the kettle's jacket is sealed, and there is no ice machine. This list is how the site identifies where its water runs, and it is updated whenever the plumbing changes (SQF 11.5.1.1).$l6$::text)),
         '{procedure,20}', to_jsonb($o20$• No water is stored on site. There is no tank or cistern; the water heater is part of the water pipes, not storage (SQF 11.5.1.6).$o20$::text)),
         '{procedure,26}', to_jsonb($o26$• Once a year is enough because the supply is the city's treated water, the pipe run is short, and nothing is stored or treated on site. An extra sample is taken when production restarts after a boil-water notice or after work on the water pipes (SQF 11.5.3.2).$o26$::text)),
         '{procedure,16}', to_jsonb($l16$• Small repairs to the water pipes and fittings inside the units - replacing a tap, a washer, a hose or a vacuum breaker like for like - may be done by a competent person. Work that adds, moves or reconnects a pipe, connects a machine to the water, or touches a backflow preventer is done by a licensed plumber. Either way, only materials made for drinking water are used, nothing is connected to a non-potable source, every affected tap is run before use, and the list of outlets in this program is updated if it has changed (SQF 11.5.1.4).$l16$::text)),
         '{revision_history}', to_jsonb(replace(content->>'revision_history', 'TO CONFIRM BEFORE ISSUE:', $note$2026-10-01 - WHO MAY WORK ON THE PIPES, AND THE TOILET ROOM IN 425. The draft said all work on 'the supply pipes' is done by a licensed plumber. That was not how the site works and the Code does not require it: 11.5.1.4 asks that the delivery of water within the premises does not contaminate it. Like-for-like repairs to taps and fittings may be done by a competent person; anything that changes the pipework, connects a machine or touches a backflow preventer is a plumber's job, because those are the jobs that can create a cross-connection. 'Supply pipes' is replaced by 'the water pipes inside the units' - it never meant the pipe before the meter, which is the city's and the landlord's. Plumbing repairs are not recorded on FRM-509 (owner's decision). The list of outlets now says where the toilet rooms are: unit 415, and one toilet room with a hand sink in unit 425.

$note$ || 'TO CONFIRM BEFORE ISSUE:')))
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
  if p::text like '%supply pipes%' or p::text like '%FRM-509%' then
    raise exception 'FSQM-033 still says "supply pipes", or cites FRM-509.';
  end if;
  if p->>16 not like '%may be done by a competent person%' or p->>16 not like '%is done by a licensed plumber%'
     or p->>16 not like '%11.5.1.4%' then
    raise exception 'FSQM-033 plumbing line is not as intended: %', p->>16;
  end if;
  if p->>6 not like '%the toilet rooms in unit 415; the toilet room in unit 425, with its hand sink%' or p->>6 not like '%roll-up door%' then
    raise exception 'FSQM-033 outlet list is not as intended: %', p->>6;
  end if;
  if (select count(*) from regexp_matches(rh, 'TO CONFIRM BEFORE ISSUE:', 'g')) <> 1
     or rh not like '%WHO MAY WORK ON THE PIPES, AND THE TOILET ROOM IN 425%'
     or position('WHO MAY WORK ON THE PIPES' in rh) > position('TO CONFIRM BEFORE ISSUE:' in rh) then
    raise exception 'FSQM-033 revision history not updated as intended.';
  end if;
  if (p::text || rh) like '%' || chr(13) || '%' then raise exception 'FSQM-033 contains a carriage return.'; end if;
  if (p::text || rh) ~* 'Gabriela|Diana|Mercer|GJM' then raise exception 'FSQM-033 names a person.'; end if;
  if p->>12 not like '%Each of units 415 and 425 has its own water meter%' or p->>23 not like '%3-compartment sink faucet%' then
    raise exception 'FSQM-033 changed outside the intended lines.';
  end if;
end $verify$;

commit;
