-- D-31: FSQM-033 (still DRAFT) - a fourth handwash point with hot water, and the alerts app named.
--
-- Two additions from the owner, 2026-10-01:
--
--   [8]  the hand sink in the unit 425 toilet room is a fourth handwash point and has hot water from the
--        same heater. The hot water line listed three stations.
--   [29] "signed up to the City of Sanford's alerts" becomes the thing itself: the city's Sanford
--        Connects app, which the city states sends boil-water notices (sanfordfl.gov/sanfordconnects).
--        A claim an auditor can check by looking at a phone.
--
-- THE ALERT ONLY WORKS IF IT REACHES SOMEBODY AT THE SITE. At 2026-10-01 the app is on one phone, and
-- not one that is at the site on production days; the SQF Practitioner is to install it. The program
-- says where it is installed, and the revision history carries it as a fourth item to confirm before
-- issue, so the draft does not claim a control that is not yet in place.
--
-- Still a draft: status and revision untouched. Guarded on the md5 of the content as it stands in
-- production after 20261001000010.

begin;

do $guard$
declare h text; st text;
begin
  select md5(content::text), status into h, st from public.sop_documents where sop_number = 'FSQM-033';
  if st is distinct from 'draft' or h <> '6e53c47f34f6efa084bab2aeb6f1538d' then
    raise exception 'FSQM-033 is % or changed since this migration was written (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(content,
         '{procedure,8}',  to_jsonb($l8$• One water heater, outside the building, supplies hot water to the three handwash stations, the hand sink in the unit 425 toilet room, the 3-compartment sink and the wash basin in the dry room. Every one of them also has cold water (SQF 11.5.1.3).$l8$::text)),
         '{procedure,29}', to_jsonb($l29$• The site receives the City of Sanford's alerts through the city's Sanford Connects app, which sends boil-water notices. It is installed, with notifications switched on, on the SQF Practitioner's phone, so the site learns of a notice when it is issued; any other member of staff may install it too (SQF 11.5.1.2).$l29$::text)),
         '{revision_history}', to_jsonb(
            replace(replace(content->>'revision_history',
                    'TO CONFIRM BEFORE ISSUE:', $note$2026-10-01 - A FOURTH HANDWASH POINT, AND THE ALERTS NAMED. The hand sink in the unit 425 toilet room has hot water from the same heater and is added to 'Hot and cold water'. The city's alerts are named: the Sanford Connects app, which the city states sends boil-water notices to everyone who installs it. Naming it lets anybody check the claim by looking at a phone.

$note$ || 'TO CONFIRM BEFORE ISSUE:'),
                    $t0$the fire line's tag shows its last test more than twelve months ago.$t0$, $t1$the fire line's tag shows its last test more than twelve months ago; (4) Sanford Connects installed on the SQF Practitioner's phone with notifications on - at 2026-10-01 it is installed on one phone only, and not one that is at the site on production days.$t1$)))
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
  if p->>8 not like '%the hand sink in the unit 425 toilet room%' or p->>8 not like '%three handwash stations%'
     or p->>8 not like '%11.5.1.3%' then
    raise exception 'FSQM-033 hot water line is not as intended: %', p->>8;
  end if;
  if p->>29 not like '%Sanford Connects%' or p->>29 not like '%SQF Practitioner''s phone%' or p->>29 not like '%11.5.1.2%' then
    raise exception 'FSQM-033 alerts line is not as intended: %', p->>29;
  end if;
  if (select count(*) from regexp_matches(rh, 'TO CONFIRM BEFORE ISSUE:', 'g')) <> 1
     or rh not like '%A FOURTH HANDWASH POINT, AND THE ALERTS NAMED%'
     or rh not like '%(4) Sanford Connects installed on the SQF Practitioner''s phone%' then
    raise exception 'FSQM-033 revision history not updated as intended.';
  end if;
  if (p::text || rh) like '%' || chr(13) || '%' then raise exception 'FSQM-033 contains a carriage return.'; end if;
  if (p::text || rh) ~* 'Gabriela|Diana|Mercer|Richard|GJM' then raise exception 'FSQM-033 names a person.'; end if;
  if p->>6 not like '%the toilet room in unit 425, with its hand sink%' or p->>16 not like '%may be done by a competent person%'
     or p->>30 not like '%production stops%' then
    raise exception 'FSQM-033 changed outside the two intended lines.';
  end if;
end $verify$;

commit;
