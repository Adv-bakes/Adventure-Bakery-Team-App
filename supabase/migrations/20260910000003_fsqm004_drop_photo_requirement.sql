-- FSQM-004 Part 4: drop the photograph from single-person operation. The monthly review stands.
--
-- WHY. 20260910000002 permitted single-person operation and attached three things to it: the entry
-- records that it applied, a photograph of the cleaned product-contact surfaces is retained, and
-- Senior Site Management reviews those entries monthly. The owner has decided against the
-- photograph. It is dropped rather than argued.
--
-- WHAT REMAINS IS STILL A CONTROL, and that is the reason this is a clean decision rather than a
-- weakening. The load was always carried by the monthly review, because that is the part performed
-- by someone OTHER than the person who ran the line; the photograph was corroboration for it. The
-- recording requirement also stays, and it is what produces the number that matters - how often the
-- site runs single-handed - which is what decides whether the arrangement remains acceptable.
--
-- WHAT IT COSTS, STATED PLAINLY. The monthly review now reads a record rather than a record and an
-- image, so it verifies that the inspection was declared rather than what the line looked like. That
-- is a real reduction and it is recorded here so nobody has to rediscover it. SQF 11.2.5.7 asks only
-- that a pre-operational inspection be conducted by qualified personnel, so nothing in the Code is
-- unmet either way.
--
-- A SEPARATE MIGRATION RATHER THAN AN EDIT TO ...000002. That file has not been applied yet, but it
-- is committed on a branch the owner pulls from and pushes, so editing it risks the exact failure
-- this workstream hit twice: he pushes the version he already has, and the correction never runs.
-- The migrations therefore show the sequence honestly. The DOCUMENT does not need to: 000002's own
-- amendment note is edited here so the issued text does not describe a requirement it never had.
--
-- FSQM-004 is still DRAFT. No revision to bump. Only two procedure lines and the revision history
-- change, and the guards assert everything else is byte-identical.

begin;

do $$
declare r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%a photograph of the cleaned product-contact surfaces shall be retained%') as photo_bullet,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Recording that single-person operation applied, retaining a photograph%')  as photo_prose,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%review the single-person operation records at least monthly%')             as review_rule,
         (content->>'revision_history') like '%a photograph of the cleaned product-contact surfaces is retained%' as photo_history
    into r from public.sop_documents where sop_number = 'FSQM-004';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-004 is %/% , expected draft/New.', r.status, r.revision;
  end if;
  if r.lines <> 32 then
    raise exception 'FSQM-004 procedure is % lines, expected 32. Apply 20260910000002 first.', r.lines;
  end if;
  if r.photo_bullet <> 1 or r.photo_prose <> 1 or not r.photo_history then
    raise exception 'The photograph requirement is not where this expects it (bullet=%, prose=%, history=%).',
      r.photo_bullet, r.photo_prose, r.photo_history;
  end if;
  -- Removing the corroboration is only acceptable because the review survives it.
  if r.review_rule <> 1 then
    raise exception 'The monthly review rule is missing; dropping the photograph would leave nothing.';
  end if;
end $$;

create temporary table fsqm004_photo_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as rest_h,
       (content->>'revision_history')                          as history,
       (select jsonb_agg(
                 to_jsonb(
                   replace(
                     replace(x.line,
                       ', and a photograph of the cleaned product-contact surfaces shall be retained with the entry.',
                       '.'),
                     'Recording that single-person operation applied, retaining a photograph, and having Senior Site Management review those entries monthly is what makes this',
                     'Recording that single-person operation applied, and having Senior Site Management review those entries monthly, is what makes this')
                 ) order by x.ord)
          from jsonb_array_elements_text(content->'procedure') with ordinality x(line, ord)) as expected
  from public.sop_documents where sop_number = 'FSQM-004';

update public.sop_documents d
   set content = jsonb_set(d.content, '{procedure}', (
         select jsonb_agg(
                  to_jsonb(
                    replace(
                      replace(x.line,
                        ', and a photograph of the cleaned product-contact surfaces shall be retained with the entry.',
                        '.'),
                      'Recording that single-person operation applied, retaining a photograph, and having Senior Site Management review those entries monthly is what makes this',
                      'Recording that single-person operation applied, and having Senior Site Management review those entries monthly, is what makes this')
                  ) order by x.ord)
           from jsonb_array_elements_text(d.content->'procedure') with ordinality x(line, ord)))
 where d.sop_number = 'FSQM-004' and d.status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(
           replace(content->>'revision_history',
             'the entry records that it applied, a photograph of the cleaned product-contact surfaces is retained, and Senior Site Management reviews those entries monthly.',
             'the entry records that it applied, and Senior Site Management reviews those entries monthly.')
           || $rev$

A PHOTOGRAPH WAS PROPOSED WITH THAT AMENDMENT AND WAS NOT ADOPTED. The first draft of the provision also required a photograph of the cleaned product-contact surfaces to be retained with a single-person entry, as corroboration for the monthly review. The owner decided against it on 2026-09-10 and it is recorded here rather than dropped silently, because the reduction is real: the monthly review now confirms that the inspection was declared rather than what the line looked like.

What remains is still a control. The weight was always on the monthly review, which is performed by someone other than the person who ran the line, and on the recording requirement, which produces the count of single-person runs — the number that decides whether the arrangement stays acceptable. SQF 11.2.5.7 requires only that a pre-operational inspection be conducted by qualified personnel, so nothing in the Code is unmet either way.$rev$)::jsonb)
 where sop_number = 'FSQM-004' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb(replace(content->>'revision_history', chr(13), '')))
 where sop_number = 'FSQM-004' and position(chr(13) in content->>'revision_history') > 0;

do $$
declare
  r record;
  drift int;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                       as lines,
         (content->'procedure')::text like '%photograph%'                               as any_photo,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s = '• Single-person operation shall be recorded as such on the release record.') as recorded_rule,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%review the single-person operation records at least monthly%') as review_rule,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Where only one qualified person is on site, that person may perform%') as permitted,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                          as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                          as prose,
         (content->>'revision_history') like '%A PHOTOGRAPH WAS PROPOSED WITH THAT AMENDMENT AND WAS NOT ADOPTED%' as noted,
         (content->>'revision_history') like '%a photograph of the cleaned product-contact surfaces is retained,%' as stale_history
    into r from public.sop_documents where sop_number = 'FSQM-004';

  if r.lines <> 32 or r.bullets <> 19 or r.prose <> 8 then
    raise exception 'Shape moved: % lines, % bullets, % prose.', r.lines, r.bullets, r.prose;
  end if;
  if r.any_photo then
    raise exception 'The procedure still requires a photograph.';
  end if;
  if r.recorded_rule <> 1 then
    raise exception 'The recording rule did not land in its shortened form.';
  end if;
  -- The two things the decision leans on must both survive.
  if r.review_rule <> 1 or r.permitted <> 1 then
    raise exception 'Single-person provision damaged: review=%, permitted=%.', r.review_rule, r.permitted;
  end if;
  if not r.noted or r.stale_history then
    raise exception 'Revision history wrong: decision noted=%, stale photo text=%.', r.noted, r.stale_history;
  end if;
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-004 metadata moved (%/%).', r.status, r.revision;
  end if;

  -- The procedure must equal exactly what the before-snapshot predicted, so every other line is
  -- provably untouched, and nothing outside the procedure and the revision history may move.
  select count(*) into drift
    from public.sop_documents d, fsqm004_photo_before b
   where d.sop_number = 'FSQM-004'
     and (md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.rest_h
       or (d.content->'procedure') is distinct from b.expected
       or length(d.content->>'revision_history') <= length(b.history));
  if drift <> 0 then
    raise exception 'FSQM-004 changed beyond the photograph removal. Rolled back.';
  end if;
end $$;

commit;
