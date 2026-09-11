-- D-02 - FSQM-003 names a position instead of a person, and FSQM-004 says where the designation lives.
--
-- FSQM-003 WAS THE EVIDENCE THE CONSULTANT SCORED. Its Responsibility and Authority paragraph read
-- "The Managing Partner (Gabriela Juncos Mercer) has overall responsibility for maintaining and
-- improving the FSQMS". That names a person in a controlled document, which the gap assessment's
-- improvement note on 2.1.1.4 asked to remove, and once the primary SQF Practitioner is designated on
-- FRM-005 it would sit beside that designation saying something different. One sentence is reworded to
-- the position - Senior Site Management, the vocabulary FSQM-004 uses - and one sentence is added saying
-- where the designation is recorded. NOTHING ELSE IN FSQM-003 IS TOUCHED; the guard proves it by
-- rebuilding the expected statement from the old one and requiring an exact match.
--
-- FSQM-004 ALREADY KNEW THIS RECORD WOULD EXIST. Its Records section says the designation and the
-- competency evidence "are recorded separately under 2.1.1.4 and 2.1.1.5" - true, but it could not say
-- where, because neither record had a number. Now it names FRM-005 for the designation and FRM-952 for
-- the certificates, and the Part that explains why the substitute is not yet in force says who makes
-- that designation and where. Its conditional - "until that designation exists and its holder meets
-- 2.1.1.5" - is left exactly as it is, because it stays true until the entry is signed AND the HACCP
-- courses are completed, and neither has happened.
--
-- Both documents are drafts, so neither takes a revision bump and no history snapshot is written.

begin;

create temporary table _d02_before on commit drop as
select sop_number, status, content,
       md5((content - 'records' - 'form_references' - 'procedure' - 'statement')::text) as rest_hash
  from public.sop_documents
 where sop_number in ('FSQM-003', 'FSQM-004');

do $$
declare r record;
begin
  select
    (select status from _d02_before where sop_number = 'FSQM-003')                        as s003,
    (select status from _d02_before where sop_number = 'FSQM-004')                        as s004,
    (select (length(content->>'statement') - length(replace(content->>'statement', $t0$The Managing Partner (Gabriela Juncos Mercer) has overall responsibility$t0$, '')))
            / length($t0$The Managing Partner (Gabriela Juncos Mercer) has overall responsibility$t0$) from _d02_before where sop_number = 'FSQM-003')          as n_a003,
    (select (length(content->>'statement') - length(replace(content->>'statement', $t2$The SQF Practitioner is responsible for implementing$t2$, '')))
            / length($t2$The SQF Practitioner is responsible for implementing$t2$) from _d02_before where sop_number = 'FSQM-003')          as n_c003,
    (select (length(content->>'records') - length(replace(content->>'records', $t4$The designation of the primary and substitute SQF Practitioner, and the evidence of their competency, are recorded separately under 2.1.1.4 and 2.1.1.5.$t4$, '')))
            / length($t4$The designation of the primary and substitute SQF Practitioner, and the evidence of their competency, are recorded separately under 2.1.1.4 and 2.1.1.5.$t4$) from _d02_before where sop_number = 'FSQM-004')      as n_r004,
    (select count(*) from _d02_before b, jsonb_array_elements_text(b.content->'procedure') l(line)
      where b.sop_number = 'FSQM-004' and position($t7$is a designation this document cannot make.$t7$ in l.line) > 0)            as n_p004,
    (select jsonb_array_length(content->'procedure') from _d02_before
      where sop_number = 'FSQM-004')                                                      as lines004,
    (select count(*) from _d02_before where content::text like '%FRM-005%')               as already
  into r;

  if r.s003 is distinct from 'draft' or r.s004 is distinct from 'draft' then
    raise exception 'Expected both drafts; found FSQM-003=%, FSQM-004=%.', r.s003, r.s004;
  end if;
  -- Each anchor exactly once, so every replace below touches exactly the intended place.
  if r.n_a003 <> 1 or r.n_c003 <> 1 then
    raise exception 'FSQM-003 anchors not found exactly once (managing partner=%, practitioner=%).',
      r.n_a003, r.n_c003;
  end if;
  if r.n_r004 <> 1 or r.n_p004 <> 1 then
    raise exception 'FSQM-004 anchors not found exactly once (records=%, procedure=%).', r.n_r004, r.n_p004;
  end if;
  if r.lines004 <> 32 then
    raise exception 'FSQM-004 is % procedure lines, expected 32.', r.lines004;
  end if;
  if r.already <> 0 then
    raise exception 'FRM-005 is already referenced; this has run before.';
  end if;
end $$;

update public.sop_documents d
   set content = jsonb_set(b.content, '{statement}',
         to_jsonb(replace(replace(b.content->>'statement', $t0$The Managing Partner (Gabriela Juncos Mercer) has overall responsibility$t0$, $t1$Senior Site Management has overall responsibility$t1$), $t2$The SQF Practitioner is responsible for implementing$t2$, $t3$The primary and substitute SQF Practitioner are designated by Senior Site Management, and the designation is recorded on FRM-005 SQF Practitioner Designation Record. The SQF Practitioner is responsible for implementing$t3$)))
  from _d02_before b
 where d.sop_number = 'FSQM-003' and b.sop_number = 'FSQM-003';

update public.sop_documents d
   set content = jsonb_set(jsonb_set(jsonb_set(b.content,
         '{records}', to_jsonb(replace(b.content->>'records', $t4$The designation of the primary and substitute SQF Practitioner, and the evidence of their competency, are recorded separately under 2.1.1.4 and 2.1.1.5.$t4$, $t5$The designation of the primary and substitute SQF Practitioner is recorded on FRM-005 SQF Practitioner Designation Record under 2.1.1.4, and the evidence of their competency, including each holder's HACCP training certificate, on FRM-952 Training Competency Verification Record under 2.1.1.5.$t5$))),
         '{form_references}', to_jsonb((b.content->>'form_references') || $t6$; FRM-005 SQF Practitioner Designation Record; FRM-952 Training Competency Verification Record$t6$)),
         '{procedure}', (select jsonb_agg(to_jsonb(replace(l.line, $t7$is a designation this document cannot make.$t7$, $t8$is a designation this document cannot make: senior site management makes it, and it is recorded on FRM-005.$t8$)) order by l.ord)
                           from jsonb_array_elements_text(b.content->'procedure') with ordinality l(line, ord)))
  from _d02_before b
 where d.sop_number = 'FSQM-004' and b.sop_number = 'FSQM-004';

do $$
declare r record;
begin
  select
    -- FSQM-003: exactly the two substitutions and nothing else.
    (select count(*) from public.sop_documents d join _d02_before b using (sop_number)
      where d.sop_number = 'FSQM-003'
        and d.content->>'statement'
            = replace(replace(b.content->>'statement', $t0$The Managing Partner (Gabriela Juncos Mercer) has overall responsibility$t0$, $t1$Senior Site Management has overall responsibility$t1$), $t2$The SQF Practitioner is responsible for implementing$t2$, $t3$The primary and substitute SQF Practitioner are designated by Senior Site Management, and the designation is recorded on FRM-005 SQF Practitioner Designation Record. The SQF Practitioner is responsible for implementing$t3$)) as exact003,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-003' and lower(content->>'statement') ~ '(gabriela|juncos|managing partner)') as names003,
    -- FSQM-004: only records, form_references and one procedure line moved.
    (select count(*) from public.sop_documents d join _d02_before b using (sop_number)
      where d.sop_number = 'FSQM-004'
        and md5((d.content - 'records' - 'form_references' - 'procedure' - 'statement')::text) = b.rest_hash) as rest004,
    (select count(*) from public.sop_documents d join _d02_before b using (sop_number)
      where d.sop_number = 'FSQM-003'
        and md5((d.content - 'records' - 'form_references' - 'procedure' - 'statement')::text) = b.rest_hash) as rest003,
    (select count(*) from
       (select l.ord, l.line from public.sop_documents d,
               jsonb_array_elements_text(d.content->'procedure') with ordinality l(line, ord)
         where d.sop_number = 'FSQM-004') n
       join
       (select l.ord, l.line from _d02_before b,
               jsonb_array_elements_text(b.content->'procedure') with ordinality l(line, ord)
         where b.sop_number = 'FSQM-004') o using (ord)
      where n.line <> o.line)                                                                 as changed_lines,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-004')                                                          as lines004,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-004'
        and content->>'records' like '%FRM-005%' and content->>'records' like '%FRM-952%'
        and content->>'form_references' like '%FRM-005 SQF Practitioner Designation Record%') as refs004,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-004' and lower(content::text) ~ '(diana|gabriela|samboni|juncos|christina)') as names004,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004') and status <> 'draft')                    as not_draft,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004') and position(chr(13) in content::text) > 0) as crs
  into r;

  if r.exact003 <> 1 then
    raise exception 'FSQM-003 statement is not exactly the two intended substitutions.';
  end if;
  if r.names003 <> 0 then
    raise exception 'FSQM-003 still names a person or the Managing Partner.';
  end if;
  if r.rest003 <> 1 or r.rest004 <> 1 then
    raise exception 'Other content keys moved (FSQM-003=%, FSQM-004=%).', r.rest003, r.rest004;
  end if;
  if r.changed_lines <> 1 or r.lines004 <> 32 then
    raise exception 'FSQM-004 procedure: % lines changed, % lines total; expected 1 and 32.',
      r.changed_lines, r.lines004;
  end if;
  if r.refs004 <> 1 then
    raise exception 'FSQM-004 does not name FRM-005 and FRM-952 where it should.';
  end if;
  -- FSQM-004's standing rule: it names positions, never people.
  if r.names004 <> 0 then
    raise exception 'FSQM-004 names a person.';
  end if;
  if r.not_draft <> 0 then
    raise exception 'A draft was issued by accident.';
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present.'; end if;
end $$;

commit;
