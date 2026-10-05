-- FSQM-027 + FRM-916 (drafts): three tree nuts, and products packed for another customer (owner, 2026-10-05).
--
-- Owner's answers: besides pecans the site handles walnuts and almonds, and those are in products packed
-- in another customer's packaging, not in the rum cake box.
--   - The program names the three nuts; any other tree nut needs a revision first.
--   - The yearly verification swab (20261005000003) rests on the rum cake box, which lists pecans and
--     states that the facility processes nuts. That draft said "every cake made here" is in that box,
--     which is not so. The rule is now stated by the product made AFTER the nut: yearly where its pack
--     has that wording (the rum cakes), three-monthly and after validation where it has not (the other
--     customer's products, unless their packaging carries such a statement).
--   - "Every cake contains wheat, milk, egg and soy" is now said of the rum cakes only; another
--     customer's product is checked against its own label.
-- Seven procedure lines reworded (still 47 lines); revision history; FRM-916's instructions and one
-- Reason option ("Routine verification", since two intervals now exist). FRM-916 has no entries.
-- Guarded on both md5s as pushed in 20261005000003 (attachments excluded). No customer is named.

begin;

do $guard$
declare h text;
begin
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FSQM-027' and status = 'draft';
  if h is distinct from '427108993fe9adcb9799a55896733bc0' then raise exception 'FSQM-027 is not the draft that was reviewed (md5 %).', h; end if;
  select md5((content - 'attachments')::text) into h from public.sop_documents where sop_number = 'FRM-916' and status = 'draft';
  if h is distinct from 'a667643e5afe3f40d964dc78c1811faf' then raise exception 'FRM-916 is not the draft that was reviewed (md5 %).', h; end if;
  if exists (select 1 from public.sop_document_responses r join public.sop_documents d on d.id = r.document_id where d.sop_number = 'FRM-916') then
    raise exception 'FRM-916 has entries; changing a Reason option needs a look first.';
  end if;
  if (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'procedure') l
       where d.sop_number = 'FSQM-027' and l in (to_jsonb($t$• On this site: wheat, milk, egg, soy and tree nuts. Not on this site, and not brought in without this program being revised first: peanuts, sesame, fish and crustacean shellfish.$t$::text), to_jsonb($t$◦ Wheat, milk, egg and soy are in the cake base, the egg, the oil and the pan release spray. Every cake made here contains all four and declares all four, so they cannot make one cake unsafe for a person who can eat another. The risk is the label, not cross-contact.$t$::text), to_jsonb($t$◦ Tree nuts are in some cakes and not in others. Pecans are the main one. This is the allergen that can cross from one product to another, on the mixer, the depositor, the pans, the racks, the dipping and packing tables, utensils, hands and clothing. It is the risk this program is built around.$t$::text), to_jsonb($t$◦ Each tree nut is its own allergen on a label. A cake with one nut made after a cake with a different nut is a changeover, the same as a cake with no nuts.$t$::text), to_jsonb($t$• Cakes without nuts are made first. Cakes with nuts are made last in the day, and the full clean follows them.$t$::text), to_jsonb($t$• A changeover clean is done before any product that does not declare an allergen the product before it contained. On this site that means: after a nut cake and before a cake without that nut (SQF 2.8.1.6).$t$::text), to_jsonb($t$• Why once a year: every cake made here is packed in a box that lists pecans and states that the facility processes nuts, so a person with a nut allergy is unlikely to eat any of them. A product packed without that wording is different. Before it is first made, this program is revised: the clean before it is swabbed at least every three months, and it does not follow a nut cake on a machine until that machine's validation has passed.$t$::text))) <> 7 then
    raise exception 'FSQM-027 does not hold the 7 lines this migration rewords.';
  end if;
end $guard$;

update public.sop_documents d
   set content = jsonb_set(
         jsonb_set(d.content, '{procedure}', (
           select jsonb_agg(case
                                 when l = to_jsonb($t$• On this site: wheat, milk, egg, soy and tree nuts. Not on this site, and not brought in without this program being revised first: peanuts, sesame, fish and crustacean shellfish.$t$::text) then to_jsonb($t$• On this site: wheat, milk, egg, soy and three tree nuts - pecans, walnuts and almonds. Not on this site, and not brought in without this program being revised first: any other tree nut, peanuts, sesame, fish and crustacean shellfish.$t$::text)
                                 when l = to_jsonb($t$◦ Wheat, milk, egg and soy are in the cake base, the egg, the oil and the pan release spray. Every cake made here contains all four and declares all four, so they cannot make one cake unsafe for a person who can eat another. The risk is the label, not cross-contact.$t$::text) then to_jsonb($t$◦ Wheat, milk, egg and soy are in the cake base, the egg, the oil and the pan release spray. Every rum cake contains all four and declares all four, so between rum cakes they cannot make one cake unsafe for a person who can eat another. The risk there is the label, not cross-contact. A product packed for another customer is checked against its own label: if it does not declare one of the four, that allergen is a changeover for it, the same as a nut.$t$::text)
                                 when l = to_jsonb($t$◦ Tree nuts are in some cakes and not in others. Pecans are the main one. This is the allergen that can cross from one product to another, on the mixer, the depositor, the pans, the racks, the dipping and packing tables, utensils, hands and clothing. It is the risk this program is built around.$t$::text) then to_jsonb($t$◦ Tree nuts are in some products and not in others: pecans in some rum cakes, walnuts and almonds in products packed for another customer. This is the allergen that can cross from one product to another, on the mixer, the depositor, the pans, the racks, the dipping and packing tables, utensils, hands and clothing. It is the risk this program is built around.$t$::text)
                                 when l = to_jsonb($t$◦ Each tree nut is its own allergen on a label. A cake with one nut made after a cake with a different nut is a changeover, the same as a cake with no nuts.$t$::text) then to_jsonb($t$◦ Each tree nut is its own allergen on a label. A product with one nut made after a product with a different nut is a changeover, the same as a product with no nuts.$t$::text)
                                 when l = to_jsonb($t$• Cakes without nuts are made first. Cakes with nuts are made last in the day, and the full clean follows them.$t$::text) then to_jsonb($t$• Products without nuts are made first. Products with nuts are made last in the day, and the full clean follows them.$t$::text)
                                 when l = to_jsonb($t$• A changeover clean is done before any product that does not declare an allergen the product before it contained. On this site that means: after a nut cake and before a cake without that nut (SQF 2.8.1.6).$t$::text) then to_jsonb($t$• A changeover clean is done before any product that does not declare an allergen the product before it contained. On this site that means: after a product with a nut and before a product without that nut (SQF 2.8.1.6).$t$::text)
                                 when l = to_jsonb($t$• Why once a year: every cake made here is packed in a box that lists pecans and states that the facility processes nuts, so a person with a nut allergy is unlikely to eat any of them. A product packed without that wording is different. Before it is first made, this program is revised: the clean before it is swabbed at least every three months, and it does not follow a nut cake on a machine until that machine's validation has passed.$t$::text) then to_jsonb($t$• How often to swab depends on the product made after the nut. Once a year is enough where its pack lists pecans or states that the facility processes nuts, because a person with a nut allergy is unlikely to eat it: this is the rum cakes, which all share one box with that wording. Where its pack has no such wording, the clean before it is swabbed at least every three months, and it does not follow a nut product on a machine until that machine's validation has passed: this is the products packed for another customer, unless their packaging carries such a statement.$t$::text)
                                 else l end order by lo)
             from jsonb_array_elements(d.content->'procedure') with ordinality z(l, lo))),
         '{revision_history}', to_jsonb(replace(replace(d.content->>'revision_history', $t$(1) which tree nuts besides pecans, and in which products;$t$, $t$(1) for each product packed for another customer: which of wheat, milk, egg and soy it contains and declares, and whether its packaging carries a tree nut statement;$t$), $t$add a yearly 'allergen cleaning verification' row$t$, $t$add a three-monthly 'allergen cleaning verification' row (the shorter of the two intervals)$t$) || $t$

OWNER'S ANSWERS (2026-10-05): the only tree nuts on site besides pecans are walnuts and almonds, and they are in products packed in another customer's packaging, not in the rum cake box. The program now names the three nuts. The yearly swab, which rests on the rum cake box's wording, is limited to the rum cakes; a product whose pack has no such wording keeps the three-monthly swab and waits for the machine's validation. The earlier draft said every cake made here contains wheat, milk, egg and soy; that is stated of the rum cakes only until the other customer's products are checked.$t$))
 where d.sop_number = 'FSQM-027' and d.status = 'draft';

update public.sop_documents d
   set content = (replace(replace(d.content::text, $t$after that, one changeover clean on each machine at least once a year.$t$, $t$after that, as often as FSQM-027 sets for the product made next: once a year, or every three months.$t$), $t$"Yearly verification"$t$, $t$"Routine verification"$t$))::jsonb
 where d.sop_number = 'FRM-916' and d.status = 'draft';

do $verify$
declare c jsonb; p text;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-027';
  p := (c->'procedure')::text;
  if jsonb_array_length(c->'procedure') <> 47
     or (select count(*) from public.sop_documents d, jsonb_array_elements(d.content->'procedure') l
          where d.sop_number = 'FSQM-027' and l in (to_jsonb($t$• On this site: wheat, milk, egg, soy and three tree nuts - pecans, walnuts and almonds. Not on this site, and not brought in without this program being revised first: any other tree nut, peanuts, sesame, fish and crustacean shellfish.$t$::text), to_jsonb($t$◦ Wheat, milk, egg and soy are in the cake base, the egg, the oil and the pan release spray. Every rum cake contains all four and declares all four, so between rum cakes they cannot make one cake unsafe for a person who can eat another. The risk there is the label, not cross-contact. A product packed for another customer is checked against its own label: if it does not declare one of the four, that allergen is a changeover for it, the same as a nut.$t$::text), to_jsonb($t$◦ Tree nuts are in some products and not in others: pecans in some rum cakes, walnuts and almonds in products packed for another customer. This is the allergen that can cross from one product to another, on the mixer, the depositor, the pans, the racks, the dipping and packing tables, utensils, hands and clothing. It is the risk this program is built around.$t$::text), to_jsonb($t$◦ Each tree nut is its own allergen on a label. A product with one nut made after a product with a different nut is a changeover, the same as a product with no nuts.$t$::text), to_jsonb($t$• Products without nuts are made first. Products with nuts are made last in the day, and the full clean follows them.$t$::text), to_jsonb($t$• A changeover clean is done before any product that does not declare an allergen the product before it contained. On this site that means: after a product with a nut and before a product without that nut (SQF 2.8.1.6).$t$::text), to_jsonb($t$• How often to swab depends on the product made after the nut. Once a year is enough where its pack lists pecans or states that the facility processes nuts, because a person with a nut allergy is unlikely to eat it: this is the rum cakes, which all share one box with that wording. Where its pack has no such wording, the clean before it is swabbed at least every three months, and it does not follow a nut product on a machine until that machine's validation has passed: this is the products packed for another customer, unless their packaging carries such a statement.$t$::text))) <> 7
     or p like '%Every cake made here%' or p like '%every cake made here%' or p like '%Pecans are the main one%'
     or c->>'revision_history' like '%which tree nuts besides pecans%' or c->>'revision_history' like '%add a yearly%'
     or c->>'revision_history' not like '%another customer''s packaging%' then
    raise exception 'FSQM-027 was not reworded as intended.';
  end if;
  if c::text ~* 'Diana|Gabriela|Christina|GJM|Mercer|Pillsbury|Amazon|Sysco|Bahamas' then
    raise exception 'FSQM-027 names a person, a supplier or a customer.';
  end if;
  select content into c from public.sop_documents where sop_number = 'FRM-916';
  if c::text like '%"Yearly verification"%' or c::text not like '%"Routine verification"%' or c::text not like '%once a year, or every three months%'
     or (select count(*) from jsonb_array_elements(c->'form_schema'->'sections') s, jsonb_array_elements(s->'fields') f) <> 14 then
    raise exception 'FRM-916 was not updated as intended.';
  end if;
end $verify$;

commit;
