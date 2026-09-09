-- FSQM-020: withdraw the assertion that the site is GFCO certified. It is not.
--
-- WHAT IS WRONG. Part 5's explanatory prose reads "a gluten result for certified Gluten Free
-- product being the likely first, SINCE THE SITE IS GFCO CERTIFIED". The Managing Partner
-- confirmed on 2026-09-09 that Adventure Bakery holds no current GFCO certification and has
-- never made a product carrying a Gluten Free claim. An active controlled document states this
-- as fact, and an auditor who reads it will ask to see the certificate.
--
-- WHAT IS NOT WRONG, AND IS DELIBERATELY LEFT ALONE. The release check at procedure[9] reads
-- "its allergen statement and ANY Gluten Free claim are correct for what was actually run".
-- That is conditional: where no product carries the claim the check simply does not bite, and it
-- is already correct if one ever does. A conditional control for a claim the site does not make
-- is good hygiene, not a defect. Only the FACTUAL assertion is withdrawn.
--
-- THE REVISION HISTORY IS APPENDED TO, NOT REWRITTEN. The Rev New narrative repeats the same
-- claim, and the temptation is to edit it out. That would be the wrong repair: the history is
-- the record of what the site believed and when, and silently correcting it leaves no trace that
-- an issued document once asserted something untrue. A reader is better served by "Rev New said
-- this, Rev v2 withdraws it and says why" than by a history that never admits the error.
--
-- REVISION BUMPED TO v2, effective 2026-09-09, under GJM's existing approval of this document.
-- The bump is not ceremony: sop_document_history only snapshots on a watched field, and for an
-- FSQM the body is not one - revision is. Without the bump this correction would leave no
-- snapshot at all.

begin;

do $$
declare r record;
begin
  select status, revision, approved_by,
         (content #>> '{procedure,16}') like '%since the site is GFCO certified%'  as claim_in_body,
         (content #>> '{procedure,9}')  like '%any Gluten Free claim are correct%' as conditional_check,
         (content->>'revision_history') like '%since the site is GFCO certified%'  as claim_in_history,
         jsonb_array_length(content->'procedure')                                  as lines
    into r
    from public.sop_documents where sop_number = 'FSQM-020';

  if r.status is distinct from 'active' then
    raise exception 'FSQM-020 is % , expected active.', r.status;
  end if;
  if r.revision is distinct from 'New' then
    raise exception 'FSQM-020 is revision % , expected New. It has been revised since this was written.', r.revision;
  end if;
  if r.approved_by is distinct from 'GJM' then
    raise exception 'FSQM-020 is approved by % ; this migration carries GJM''s approval forward.', r.approved_by;
  end if;
  if not (r.claim_in_body and r.claim_in_history) then
    raise exception 'The GFCO assertion is not where this migration expects it (body=%, history=%).',
      r.claim_in_body, r.claim_in_history;
  end if;
  if not r.conditional_check then
    raise exception 'The conditional release check is not at procedure[9]; re-read before editing.';
  end if;
end $$;

create temporary table fsqm020_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as rest_h,
       (select jsonb_agg(p.line order by p.ord)
          from jsonb_array_elements_text(content->'procedure') with ordinality p(line, ord)
         where p.ord - 1 <> 16)                                  as other_lines,
       (content->>'revision_history')                            as history
  from public.sop_documents where sop_number = 'FSQM-020';

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{procedure,16}', to_jsonb($p16$> If finished-product testing is ever introduced, this procedure shall be revised before that product ships, so that the hold-pending-result step exists before it is needed rather than after.$p16$::text)),
         '{revision_history}',
         to_jsonb((content->>'revision_history') || $rev$

Rev v2 — 2026-09-09, approved GJM. WITHDRAWS AN ASSERTION THAT WAS NEVER TRUE. Part 5 of Rev New explained that if finished-product testing were ever introduced, a gluten result would be the likely first "since the site is GFCO certified". The Managing Partner confirmed on 2026-09-09 that Adventure Bakery holds no current GFCO certification and has never produced a product carrying a Gluten Free claim. Part 5 now states the rule without the example: if finished-product testing is ever introduced, this procedure is revised before that product ships. Nothing else in the procedure changes, and the release check at Part 4 is deliberately untouched — it reads "any Gluten Free claim", which is conditional and stays correct whether or not the site ever makes one.

The Rev New wording above is left standing rather than edited out. This history is the record of what the site believed and when, and an issued document that once asserted something untrue is better shown being corrected than quietly amended. The same false assumption reached FSQM-018, which is corrected by 20260909000008; its likeliest source is the Compass Blending hardcopies these documents were scanned from, where the import rebrands the company name but cannot know the content belongs to another business.$rev$)::jsonb),
       revision = 'v2',
       effective_date = date '2026-09-09'
 where sop_number = 'FSQM-020' and status = 'active' and revision = 'New';

do $$
declare
  r record;
  drift int;
begin
  select revision, status, approved_by, effective_date,
         (content #>> '{procedure,16}') like '%GFCO%'                            as body_gfco,
         (content #>> '{procedure,16}') like '%revised before that product ships%' as body_rule,
         (content #>> '{procedure,9}')  like '%any Gluten Free claim are correct%' as check_kept,
         (content->>'revision_history') like '%Rev v2 — 2026-09-09, approved GJM%' as v2_entry,
         (content->>'revision_history') like '%WITHDRAWS AN ASSERTION THAT WAS NEVER TRUE%' as withdrawal,
         jsonb_array_length(content->'procedure')                                 as lines
    into r
    from public.sop_documents where sop_number = 'FSQM-020';

  if r.body_gfco then
    raise exception 'Part 5 still asserts GFCO certification.';
  end if;
  if not (r.body_rule and r.check_kept) then
    raise exception 'Edit went wrong: rule kept=%, conditional check kept=%.', r.body_rule, r.check_kept;
  end if;
  if not (r.v2_entry and r.withdrawal) then
    raise exception 'The v2 revision entry did not land (entry=%, withdrawal=%).', r.v2_entry, r.withdrawal;
  end if;
  if r.revision is distinct from 'v2' or r.effective_date is distinct from date '2026-09-09'
     or r.status is distinct from 'active' or r.approved_by is distinct from 'GJM' then
    raise exception 'Metadata wrong: %/%/%/%.', r.revision, r.effective_date, r.status, r.approved_by;
  end if;

  -- Every other procedure line, and every other part of content, byte-identical. The history
  -- is excluded because it is appended to on purpose; the guards above check what it gained.
  select count(*) into drift
    from public.sop_documents d, fsqm020_before b
   where d.sop_number = 'FSQM-020'
     and (md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.rest_h
       or (select jsonb_agg(p.line order by p.ord)
             from jsonb_array_elements_text(d.content->'procedure') with ordinality p(line, ord)
            where p.ord - 1 <> 16) is distinct from b.other_lines
       or position(b.history in (d.content->>'revision_history')) <> 1);
  if drift <> 0 then
    raise exception 'FSQM-020 changed beyond Part 5 and an appended history entry. Rolled back.';
  end if;
end $$;

commit;
