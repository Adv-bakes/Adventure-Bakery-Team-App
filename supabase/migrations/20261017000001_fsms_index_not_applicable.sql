-- FSMS Index: clauses the site does not engage are declared Not Applicable by the document that
-- says why (owner, 2026-10-17).
--
-- The index showed 2.4.4.3 and 2.4.4.4 (on-site laboratory) and 11.6.5.5 to .7 (refrigerated
-- transport) as "Nothing cites it", although FSQM-014 and FSQM-036 each state, in their own text,
-- that those clauses are Not Applicable and why. The clauses stay OUT of sqf_reference on purpose
-- (FSQM-036's issue migration enforces it): sqf_reference is what a document claims to control.
-- The declaration goes in content.not_applicable instead, which the index reads.
--
-- No wording of either document changes, so neither gets a new revision. content.not_applicable
-- is not a watched field, so no history snapshot is taken.
--
-- Safe to run twice: a document already holding exactly this declaration is left alone. A document
-- whose text no longer rules the clauses out stops the migration.

do $$
declare
  d record;
  n int;
  na14 constant jsonb := $j$[
    {"clause": "2.4.4.3", "reason": "The site has no on-site laboratory."},
    {"clause": "2.4.4.4", "reason": "The site has no on-site laboratory, so holds no laboratory waste."}
  ]$j$;
  na36 constant jsonb := $j$[
    {"clause": "11.6.5.5", "reason": "Every finished product ships ambient; nothing is carried under temperature control."},
    {"clause": "11.6.5.6", "reason": "Every finished product ships ambient; nothing is carried under temperature control."},
    {"clause": "11.6.5.7", "reason": "Every finished product ships ambient; nothing is carried under temperature control."}
  ]$j$;
begin
  -- FSQM-014 Sampling, Inspection and Analysis
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-014' and status = 'active';
  if n <> 1 then raise exception 'FSQM-014: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'FSQM-014' and status = 'active';
  if d.content::text not like '%2.4.4.3 and 2.4.4.4 concern an on-site laboratory%' then
    raise exception 'FSQM-014 no longer states that 2.4.4.3 and 2.4.4.4 do not apply';
  end if;
  if d.sqf_reference like '%2.4.4.3%' or d.sqf_reference like '%2.4.4.4%' then
    raise exception 'FSQM-014 cites the clauses it rules out: %', d.sqf_reference;
  end if;
  if d.content->'not_applicable' = na14 then
    raise notice 'FSQM-014: already declared, left alone';
  elsif d.content ? 'not_applicable' then
    raise exception 'FSQM-014 already has a different not_applicable: %', d.content->'not_applicable';
  else
    update public.sop_documents set content = content || jsonb_build_object('not_applicable', na14) where id = d.id;
  end if;

  -- FSQM-036 Loading, Transport and Unloading
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-036' and status = 'active';
  if n <> 1 then raise exception 'FSQM-036: expected one active document, found %', n; end if;
  select * into d from public.sop_documents where sop_number = 'FSQM-036' and status = 'active';
  if d.content::text not like '%recorded Not Applicable%' or d.content::text not like '%11.6.5.5%' then
    raise exception 'FSQM-036 no longer states that 11.6.5.5 to .7 do not apply';
  end if;
  if d.sqf_reference like '%11.6.5.5%' or d.sqf_reference like '%11.6.5.6%' or d.sqf_reference like '%11.6.5.7%' then
    raise exception 'FSQM-036 cites the clauses it rules out: %', d.sqf_reference;
  end if;
  if d.content->'not_applicable' = na36 then
    raise notice 'FSQM-036: already declared, left alone';
  elsif d.content ? 'not_applicable' then
    raise exception 'FSQM-036 already has a different not_applicable: %', d.content->'not_applicable';
  else
    update public.sop_documents set content = content || jsonb_build_object('not_applicable', na36) where id = d.id;
  end if;
end $$;
