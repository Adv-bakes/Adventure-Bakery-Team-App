-- FSQM-004 Part 4: single-person operation is permitted, and the Code never said otherwise.
--
-- WHAT WAS WRONG. Part 4 was seeded with three separation rules written as absolutes, the first of
-- them "the pre-operational release shall be signed by someone other than the person who performed
-- the sanitation". The owner raised a run from the week of 2026-09-01: a simple pancake mix, one
-- person on site, who performed every task herself. Under the rule as written that ordinary run was
-- a departure from this manual - on a document that had been in the database for a day.
--
-- THE CODE DOES NOT REQUIRE THE SEPARATION. 11.2.5.7 is explicit about who may conduct a
-- pre-operational inspection: "Pre-operational inspections shall be conducted by QUALIFIED
-- personnel." Qualified, not independent, and not two of them. The single place either edition asks
-- for independence is 2.5.4.2, internal audits, and even there it is hedged - "WHERE PRACTICAL,
-- staff conducting internal audits shall be independent of the function being audited". That
-- qualification is the Code acknowledging sites of this size. The separation in Part 4 was this
-- site's own control, invented while drafting, and stating it as an absolute was the error.
--
-- FRM-903 ALREADY HAD THIS RIGHT, which is worth recording because it is the evidence the rule was
-- wrong rather than the practice. On the release section the qualified inspector signature is
-- REQUIRED and the Production Supervisor signature is an OPTIONAL verifier line. The form has always
-- permitted a single competent person to complete and release a pre-operational inspection. Only the
-- manual forbade it.
--
-- A RULE THE SITE CANNOT ALWAYS FOLLOW IS WORSE THAN A WEAKER RULE IT CAN, because the first thing
-- that happens to it is that it is ignored, and the second is that everything next to it is trusted
-- a little less. So the separation is kept where it can be had and conditioned where it cannot,
-- rather than deleted: it is a real control on any day two qualified people are present.
--
-- WHAT SINGLE-PERSON OPERATION COSTS. It is permitted, not unremarked. The entry records that it
-- applied, a photograph of the cleaned product-contact surfaces is retained with it, and Senior Site
-- Management reviews those entries monthly - a review by a different person, which is the part that
-- makes it a control rather than a permission. Recording the condition also means the site can see
-- how often it happens, which is the number that decides whether it stays acceptable.
--
-- FSQM-004 is still DRAFT, so there is no revision to bump. The Part is replaced by boundary rather
-- than by index, and the guards assert every other line is byte-identical.

begin;

do $$
declare r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                        as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s = 'One person may hold several positions. Work and the verification of that work shall not be performed by the same person.') as head,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like 'Where the structure recorded here and the work actually performed diverge%') as next_head,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Where only one qualified person is on site%')                  as already_done
    into r from public.sop_documents where sop_number = 'FSQM-004';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-004 is %/% , expected draft/New.', r.status, r.revision;
  end if;
  if r.already_done <> 0 then
    raise exception 'Part 4 already carries the single-person provision; this migration has run.';
  end if;
  if r.head <> 1 or r.next_head <> 1 then
    raise exception 'Part 4 / Part 5 boundaries are not uniquely identifiable (head=%, next=%).',
      r.head, r.next_head;
  end if;
  if r.lines <> 27 then
    raise exception 'FSQM-004 procedure is % lines, expected 27.', r.lines;
  end if;
end $$;

create temporary table fsqm004_p4_before on commit drop as
with bounds as (
  select content as c, content->'procedure' as p,
         (select x.ord from jsonb_array_elements_text(content->'procedure') with ordinality x(line, ord)
           where x.line = 'One person may hold several positions. Work and the verification of that work shall not be performed by the same person.') as s_ord,
         (select x.ord from jsonb_array_elements_text(content->'procedure') with ordinality x(line, ord)
           where x.line like 'Where the structure recorded here and the work actually performed diverge%') as e_ord
    from public.sop_documents where sop_number = 'FSQM-004'
)
select s_ord, e_ord,
       md5((c - 'procedure' - 'revision_history')::text)  as rest_h,
       (c->>'revision_history')                           as history,
       (select jsonb_agg(to_jsonb(x.line) order by x.ord)
          from jsonb_array_elements_text(p) with ordinality x(line, ord)
         where x.ord < s_ord)                             as head,
       (select jsonb_agg(to_jsonb(x.line) order by x.ord)
          from jsonb_array_elements_text(p) with ordinality x(line, ord)
         where x.ord >= e_ord)                            as tail
  from bounds;

do $$
declare b record;
begin
  select * into b from fsqm004_p4_before;
  if b.e_ord - b.s_ord <> 6 then
    raise exception 'Part 4 is % lines, expected 6.', b.e_ord - b.s_ord;
  end if;

  update public.sop_documents
     set content = jsonb_set(content, '{procedure}', b.head || $part4$[
"One person may hold several positions. Where a second qualified person is on site, work and the verification of that work shall not be performed by the same person.",
"> Holding several positions is ordinary at a site of this size and is not a finding. What is a finding is a procedure that describes a hand-off between two positions the same person holds, presented as though it were a check: a quorum of one is not a control, and writing it as one invites an auditor to test a separation of duties that does not exist.",
"• Where a second qualified person is on site, the pre-operational release shall be signed by someone other than the person who performed the sanitation.",
"• An operator shall be trained and signed off by someone other than themselves. Where the Production Supervisor is the operator to be signed off, Senior Site Management signs. This rule is not conditional: training is arranged, not improvised on a shift, so a second person is always available for it.",
"• Where a second qualified person is on site, equipment shall be released back to production by someone other than the person who performed the maintenance on it.",
"• Where only one qualified person is on site, that person may perform the work and its verification. The pre-operational inspection shall still be conducted by a qualified person, which is what the Code requires of it.",
"• Single-person operation shall be recorded as such on the release record, and a photograph of the cleaned product-contact surfaces shall be retained with the entry.",
"• Senior Site Management shall review the single-person operation records at least monthly.",
"> The separation above is this site's own control, not a requirement of the Code. SQF 11.2.5.7 says pre-operational inspections shall be conducted by qualified personnel — qualified, not independent, and not two of them. The only place either edition asks for independence is 2.5.4.2, on internal audits, and even there it is hedged as where practical, which is the Code acknowledging sites of this size.",
"> It is kept, because on any day two qualified people are present it is a real check and costs nothing. It is conditioned, because a site of three people will regularly run with one, and a rule the site cannot always follow is worse than a weaker rule it can: the first thing that happens to it is that it is ignored, and the second is that everything written next to it is trusted a little less.",
"> Permitted is not the same as unremarked. Recording that single-person operation applied, retaining a photograph, and having Senior Site Management review those entries monthly is what makes this a control rather than a licence — the monthly review in particular, because it is performed by someone other than the person who ran the line. It also produces the number that matters: how often the site operates this way, which is what decides whether it should stay acceptable."
]$part4$::jsonb || b.tail)
   where sop_number = 'FSQM-004' and status = 'draft';
end $$;

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}',
         to_jsonb((content->>'revision_history') || $rev$

AMENDED 2026-09-10, BEFORE ISSUE — PART 4 PERMITTED NOTHING THAT ACTUALLY HAPPENS. The Part was drafted with its three separation rules as absolutes. The owner raised a real run: a simple pancake mix with one person on site, who performed every task herself. Under the rule as written that ordinary run was a departure from this manual, on a document one day old.

The Code does not require the separation. 11.2.5.7 states that pre-operational inspections shall be conducted by QUALIFIED personnel — qualified, not independent, and not two of them. The only independence requirement in either edition is 2.5.4.2 for internal audits, hedged as "where practical". The separation was this site's own control, invented in drafting, and stating it as an absolute was the error.

FRM-903 had it right already, which is the evidence that the rule was wrong rather than the practice: on its release section the qualified inspector signature is required and the Production Supervisor signature is an optional verifier line. The form has always allowed one competent person to complete and release a pre-operational inspection. Only this manual forbade it.

The separation is kept where it can be had and conditioned where it cannot, rather than deleted — on any day two qualified people are present it is a real check. Single-person operation is permitted but not unremarked: the entry records that it applied, a photograph of the cleaned product-contact surfaces is retained, and Senior Site Management reviews those entries monthly. That review is performed by someone other than whoever ran the line, which is what keeps it a control; and the count of such entries is the number that decides whether the arrangement stays acceptable.

The training sign-off rule is deliberately NOT conditioned. Training is arranged rather than improvised on a shift, so a second person is always available for it.$rev$)::jsonb)
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
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s = 'One person may hold several positions. Work and the verification of that work shall not be performed by the same person.') as absolute_head,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Where only one qualified person is on site, that person may perform the work and its verification%') as permitted,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Single-person operation shall be recorded as such%')          as recorded,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%review the single-person operation records at least monthly%') as reviewed,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%qualified personnel — qualified, not independent%')            as code_basis,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%This rule is not conditional%')                                as training_absolute,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '• %')                                                           as bullets,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> %')                                                           as prose,
         (content->>'revision_history') like '%PART 4 PERMITTED NOTHING THAT ACTUALLY HAPPENS%' as amended,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                       as open_kept
    into r from public.sop_documents where sop_number = 'FSQM-004';

  if r.lines <> 32 then
    raise exception 'Procedure is % lines, expected 32 (27 less 6 plus 11).', r.lines;
  end if;
  if r.absolute_head <> 0 then
    raise exception 'The absolute separation statement survived; a lone operator is still forbidden.';
  end if;
  if r.permitted <> 1 or r.recorded <> 1 or r.reviewed <> 1 then
    raise exception 'Single-person provision incomplete: permitted=%, recorded=%, reviewed=%.',
      r.permitted, r.recorded, r.reviewed;
  end if;
  -- Without the clause basis this reads as the site relaxing a rule to suit itself.
  if r.code_basis <> 1 then
    raise exception 'The 11.2.5.7 basis for permitting it is missing.';
  end if;
  if r.training_absolute <> 1 then
    raise exception 'The training sign-off rule lost its not-conditional statement.';
  end if;
  -- 16 bullets and 6 prose before; Part 4 gave up 3 bullets and 2 prose and gained 6 and 4.
  if r.bullets <> 19 or r.prose <> 8 then
    raise exception 'Line forms wrong: % bullets, % prose (expected 19 / 8).', r.bullets, r.prose;
  end if;
  if not (r.amended and r.open_kept) then
    raise exception 'Revision history wrong: amendment=%, open items kept=%.', r.amended, r.open_kept;
  end if;
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-004 metadata moved (%/%).', r.status, r.revision;
  end if;

  select count(*) into drift
    from public.sop_documents d, fsqm004_p4_before b
   where d.sop_number = 'FSQM-004'
     and (md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.rest_h
       or (select jsonb_agg(x.line order by x.ord)
             from jsonb_array_elements(d.content->'procedure') with ordinality x(line, ord)
            where x.ord < b.s_ord) is distinct from b.head
       or (select jsonb_agg(x.line order by x.ord)
             from jsonb_array_elements(d.content->'procedure') with ordinality x(line, ord)
            where x.ord >= b.s_ord + 11) is distinct from b.tail
       or length(d.content->>'revision_history') <= length(b.history));
  if drift <> 0 then
    raise exception 'FSQM-004 changed beyond Part 4 and its revision history. Rolled back.';
  end if;
end $$;

commit;
