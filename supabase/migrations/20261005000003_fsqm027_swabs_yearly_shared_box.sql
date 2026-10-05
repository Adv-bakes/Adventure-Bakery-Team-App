-- FSQM-027 + FRM-916 (drafts): verification swabs once a year, and no production gate (owner, 2026-10-05).
--
-- Every cake is packed in the same box, which lists pecans and states that the facility processes nuts.
-- A person with a nut allergy is therefore unlikely to eat any flavor. SQF 2.8.1.5 sets verification
-- "based on risk assessment", so on that basis:
--   - the verification swab is once a year per machine, not every three months;
--   - the rule that no nut-free cake follows a nut cake until three swabbed cleans pass is removed.
-- The changeover clean and the one-time validation stay: a label statement is not a substitute for the
-- clean, and the finding against 2.8.1.5 is that nothing proves the clean removes the allergen.
-- A new procedure line states the reason and its limit - product packed WITHOUT that wording gets the
-- stricter rule - so the easing cannot drift. FSQM-027 goes from 46 to 47 lines.
-- FRM-916 (no entries): its instructions and one Reason option follow the new interval.
-- Guarded on both md5s as last pushed (attachments excluded).

begin;

do $guard$
declare h text;
begin
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FSQM-027' and status = 'draft';
  if h is distinct from '6b997f51b07260bcb2d00bec674b75eb' then raise exception 'FSQM-027 is not the draft that was reviewed (md5 %).', h; end if;
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FRM-916' and status = 'draft';
  if h is distinct from 'd4aeb1ce19745f447dbd7b7bfd133dcd' then raise exception 'FRM-916 is not the draft that was reviewed (md5 %).', h; end if;
  if exists (select 1 from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id where d.sop_number = 'FRM-916') then
    raise exception 'FRM-916 has entries; changing a Reason option needs a look first.';
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(
         jsonb_set(d.content, '{procedure}', (
           select jsonb_agg(x.e order by z.lo, x.k)
             from jsonb_array_elements(d.content->'procedure') with ordinality z(l, lo)
            cross join lateral (
              select 1 as k, case when z.l = to_jsonb($t$• Validation: for each machine, the first three changeover cleans after a nut cake are swabbed after cleaning and before the next use. All three must show nothing detected. Until they do, a cake without nuts is not made on that machine after a nut cake.$t$::text) then to_jsonb($t$• Validation: for each machine, the first three changeover cleans after a nut cake are swabbed after cleaning and before the next use. All three must show nothing detected.$t$::text)
                                  when z.l = to_jsonb($t$• Verification: every changeover clean is inspected under good light and recorded on the machine's cleaning log. In addition, one changeover clean on each machine is swabbed at least every three months.$t$::text) then to_jsonb($t$• Verification: every changeover clean is inspected under good light and recorded on the machine's cleaning log. In addition, one changeover clean on each machine is swabbed at least once a year.$t$::text)
                                  else z.l end as e
              union all
              select 2, to_jsonb($t$• Why once a year: every cake made here is packed in a box that lists pecans and states that the facility processes nuts, so a person with a nut allergy is unlikely to eat any of them. A product packed without that wording is different. Before it is first made, this program is revised: the clean before it is swabbed at least every three months, and it does not follow a nut cake on a machine until that machine's validation has passed.$t$::text) where z.l = to_jsonb($t$• Verification: every changeover clean is inspected under good light and recorded on the machine's cleaning log. In addition, one changeover clean on each machine is swabbed at least every three months.$t$::text)) x)),
         '{revision_history}', to_jsonb(replace(replace(d.content->>'revision_history', $t$NEW REQUIREMENT, NOT YET DONE: swabbing with an allergen test kit (validation, then every three months). The three-month interval is the site's choice and can be changed.$t$, $t$NEW REQUIREMENT, NOT YET DONE: swabbing with an allergen test kit (validation, then once a year).$t$), $t$add a three-monthly 'allergen cleaning verification' row$t$, $t$add a yearly 'allergen cleaning verification' row$t$) || $t$

OWNER'S DECISION (2026-10-05): every cake is packed in the same box, which lists pecans and carries the facility statement. On that basis the verification swab is once a year, not every three months, and the first draft's rule that no nut-free cake follows a nut cake until validation has passed is removed. The changeover clean itself stays: a label statement does not replace it (FDA guidance; SQF 2.8.1.4 and 2.8.1.6), and SQF 2.8.1.5 sets verification by risk assessment. The easing applies only to product packed with that wording.$t$))
 where d.sop_number = 'FSQM-027' and d.status = 'draft';

update public.sop_documents d
   set content = replace(replace(d.content::text, $t$Validation is the first three changeover cleans on each machine; after that, one changeover clean on each machine at least every three months.$t$, $t$Validation is the first three changeover cleans on each machine; after that, one changeover clean on each machine at least once a year.$t$), $t$"Three-monthly verification"$t$, $t$"Yearly verification"$t$)::jsonb
 where d.sop_number = 'FRM-916' and d.status = 'draft';

do $verify$
declare c jsonb; p text;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-027';
  p := (c->'procedure')::text;
  if jsonb_array_length(c->'procedure') <> 47
     or p like '%every three months."%' or p like '%Until they do%'
     or p not like '%swabbed at least once a year.%' or p not like '%Why once a year:%'
     or c->>'revision_history' like '%three-monthly%' or c->>'revision_history' like '%then every three months%'
     or c->>'revision_history' not like '%packed in the same box%' then
    raise exception 'FSQM-027 swab lines were not rewritten as intended.';
  end if;
  -- the reason line sits directly after the verification line
  if (select lo2 - lo1 from
        (select min(lo) as lo1 from jsonb_array_elements_text(c->'procedure') with ordinality t(l, lo) where l like '%Verification: every changeover clean%') a,
        (select min(lo) as lo2 from jsonb_array_elements_text(c->'procedure') with ordinality t(l, lo) where l like '%Why once a year:%') b) <> 1 then
    raise exception 'FSQM-027 reason line is in the wrong place.';
  end if;
  select content into c from public.sop_documents where sop_number = 'FRM-916';
  if c::text like '%hree-monthly%' or c::text like '%every three months%' or c::text not like '%"Yearly verification"%'
     or (select count(*) from jsonb_array_elements(c->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f) <> 14 then
    raise exception 'FRM-916 was not updated as intended.';
  end if;
end $verify$;

commit;
