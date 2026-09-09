-- FSQM-018: remove the certified Gluten Free steps. The site has no such product.
--
-- WHAT IS BEING REMOVED, AND WHY IT IS REMOVAL RATHER THAN REWORDING. Three places describe a
-- product category and a certification Adventure Bakery does not have. The Managing Partner
-- confirmed on 2026-09-09 that no product carrying a Gluten Free claim has ever been made and
-- that no current GFCO certification is held.
--
--   procedure[4]  a bullet routing positive gluten results (>10 ppm) into the hold steps
--   procedure[5]  "The SQF Practitioner shall notify GFCO, using the contact details in the
--                  current GFCO certification agreement" — an agreement that does not exist
--   procedure[24] a rework sentence about segregated certified Gluten Free product
--
-- The site's own precedent settles the treatment. FSQM-020 was issued with its bulk-product Part
-- REMOVED rather than reworded, on the reasoning that "a Part describing something that never
-- happens is worse than no Part at all — it is the first thing an auditor tests and the first
-- thing the floor learns to ignore". This is the same case, and worse: procedure[5] does not
-- merely describe something that never happens, it instructs the SQF Practitioner to consult a
-- document that was never held. An auditor reading it will ask for the certification agreement.
--
-- THE SAME STANDARD THIS DOCUMENT ALREADY APPLIED TO ITSELF. At issue, a GFCO notification
-- address reconstructed from a damaged scan was removed rather than adopted, because "an active
-- controlled document must not assert a fact nobody has verified". That was the right call about
-- the address. The certification behind it went unexamined, and is the larger version of the
-- same error.
--
-- NOTHING IS ORPHANED. [4] and [5] are bullets under the general hold rule at [3], which stands
-- on its own: any employee finding non-conforming material notifies the SQF Practitioner and the
-- material goes on Hold. [4] said gluten results follow "the steps set out below" — those steps
-- are the general ones at [6] onward and are untouched. On [24] only the second sentence goes;
-- "All finished product rework shall be performed on a 'like into like' basis" is a real rule
-- with nothing to do with gluten, and it stays.
--
-- LINES ARE MATCHED BY TEXT, NOT BY INDEX. Removing two elements shifts every index after them,
-- so an index-addressed edit would have to reason about its own side effects. Selecting by
-- content is order-independent and is the lesson from 20260909000002/000004.
--
-- REVISION BUMPED TO v2, effective 2026-09-09, under GJM's existing approval — and for the same
-- mechanical reason as FSQM-020: sop_document_history snapshots on a watched field, and for an
-- FSQM the body is not one.

begin;

do $$
declare r record;
begin
  select status, revision, approved_by,
         jsonb_array_length(content->'procedure') as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%For certified Gluten Free products, and for ingredients used%')  as n_route,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%shall notify GFCO, using the contact details%')                  as n_notify,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%All finished product rework shall be performed on a %')          as n_rework,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%immediately notify the SQF Practitioner in order to place questionable material on Hold%') as n_general_hold
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r.status is distinct from 'active' or r.revision is distinct from 'New' then
    raise exception 'FSQM-018 is %/% , expected active/New.', r.status, r.revision;
  end if;
  if r.approved_by is distinct from 'GJM' then
    raise exception 'FSQM-018 is approved by % ; this migration carries GJM''s approval forward.', r.approved_by;
  end if;
  if r.lines <> 32 then
    raise exception 'FSQM-018 procedure is % lines, expected 32.', r.lines;
  end if;
  if r.n_route <> 1 or r.n_notify <> 1 or r.n_rework <> 1 then
    raise exception 'Target lines are not uniquely identifiable (route=%, notify=%, rework=%).',
      r.n_route, r.n_notify, r.n_rework;
  end if;
  -- The general hold rule must exist, because removing the gluten bullet relies on it.
  if r.n_general_hold < 1 then
    raise exception 'The general hold step is missing; the gluten bullets cannot be removed safely.';
  end if;
end $$;

create temporary table fsqm018_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as rest_h,
       (content->>'revision_history')                          as history,
       (select jsonb_agg(
                 case when p.line like '%All finished product rework shall be performed on a %'
                      then to_jsonb('• All finished product rework shall be performed on a "like into like" basis.'::text)
                      else to_jsonb(p.line) end
                 order by p.ord)
          from jsonb_array_elements_text(content->'procedure') with ordinality p(line, ord)
         where p.line not like '%For certified Gluten Free products, and for ingredients used%'
           and p.line not like '%shall notify GFCO, using the contact details%')  as expected
  from public.sop_documents where sop_number = 'FSQM-018';

update public.sop_documents d
   set content = jsonb_set(
         jsonb_set(d.content, '{procedure}', (
           select jsonb_agg(
                    case when p.line like '%All finished product rework shall be performed on a %'
                         then to_jsonb('• All finished product rework shall be performed on a "like into like" basis.'::text)
                         else to_jsonb(p.line) end
                    order by p.ord)
             from jsonb_array_elements_text(d.content->'procedure') with ordinality p(line, ord)
            where p.line not like '%For certified Gluten Free products, and for ingredients used%'
              and p.line not like '%shall notify GFCO, using the contact details%')),
         '{revision_history}',
         to_jsonb((d.content->>'revision_history') || $rev$

Rev v2 — 2026-09-09, approved GJM. REMOVES THREE STEPS FOR A PRODUCT THE SITE HAS NEVER MADE. Rev New carried a bullet routing positive gluten results (>10 ppm) into the hold steps, an instruction to notify GFCO using the contact details in "the current GFCO certification agreement", and a rework sentence about segregated certified Gluten Free product. The Managing Partner confirmed on 2026-09-09 that Adventure Bakery has never produced a product carrying a Gluten Free claim and holds no current GFCO certification. There is no certification agreement to consult and no certified product to segregate.

They are removed rather than reworded, on the reasoning this site already used when FSQM-020 was issued with its bulk-product Part removed: a step describing something that never happens is worse than no step at all, because it is the first thing an auditor tests and the first thing the floor learns to ignore. This one is worse still — it directs the SQF Practitioner to a document that was never held.

Nothing is orphaned. Both removed bullets sat under the general hold rule, which is unchanged: any employee finding non-conforming material notifies the SQF Practitioner and the material goes on Hold. Only the second sentence of the rework step is gone; "All finished product rework shall be performed on a like into like basis" is a real rule and stays.

This is the same standard Rev New applied to the damaged GFCO notification address, which was removed rather than reconstructed because "an active controlled document must not assert a fact nobody has verified". That was right about the address. The certification behind it went unexamined, and this corrects it. The likeliest source is the Compass Blending hardcopy this document was scanned from — the import rebrands the company name across every parsed string, but cannot know the content belongs to a different business. FSQM-020 carried the same assumption and is corrected by 20260909000007.$rev$)::jsonb),
       revision = 'v2',
       effective_date = date '2026-09-09'
 where d.sop_number = 'FSQM-018' and d.status = 'active' and d.revision = 'New';

do $$
declare
  r record;
  drift int;
begin
  select revision, status, approved_by, effective_date,
         jsonb_array_length(content->'procedure')                        as lines,
         (content->'procedure')::text like '%GFCO%'                      as any_gfco,
         (content->'procedure')::text like '%Gluten Free%'               as any_gf,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s = '• All finished product rework shall be performed on a "like into like" basis.') as rework_kept,
         (content->>'revision_history') like '%Rev v2 — 2026-09-09, approved GJM%' as v2_entry
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r.lines <> 30 then
    raise exception 'Procedure is % lines, expected 30 (32 less the two removed).', r.lines;
  end if;
  if r.any_gfco or r.any_gf then
    raise exception 'The procedure still mentions GFCO (%) or Gluten Free (%).', r.any_gfco, r.any_gf;
  end if;
  if r.rework_kept <> 1 then
    raise exception 'The like-into-like rework rule was not preserved intact (found %).', r.rework_kept;
  end if;
  if not r.v2_entry then
    raise exception 'The v2 revision entry did not land.';
  end if;
  if r.revision is distinct from 'v2' or r.effective_date is distinct from date '2026-09-09'
     or r.status is distinct from 'active' or r.approved_by is distinct from 'GJM' then
    raise exception 'Metadata wrong: %/%/%/%.', r.revision, r.effective_date, r.status, r.approved_by;
  end if;

  -- The procedure must equal exactly what the before-snapshot predicted, and nothing outside
  -- the procedure and the appended history may move.
  select count(*) into drift
    from public.sop_documents d, fsqm018_before b
   where d.sop_number = 'FSQM-018'
     and (md5((d.content - 'procedure' - 'revision_history')::text) is distinct from b.rest_h
       or (d.content->'procedure') is distinct from b.expected
       or position(b.history in (d.content->>'revision_history')) <> 1);
  if drift <> 0 then
    raise exception 'FSQM-018 changed beyond the three edits and an appended history entry. Rolled back.';
  end if;
end $$;

commit;
