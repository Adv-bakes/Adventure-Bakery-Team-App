-- FRM-701 v2 -> v3: the release record starts from the lot code and looks the rest up.
-- Approved GJM, effective 2026-10-06.
--
-- The owner's request (2026-10-06): the person releasing a lot should not retype what the site's
-- records already hold. With this revision:
--   - LOT / BATCH CODE comes first, because it is what is printed on the pack. Its list is every lot
--     on the Production Lot Record (FRM-520) that has no release record yet, each with its product.
--   - PRODUCT follows from the lot. Where one code was baked as two products the list shows both.
--   - Batch reference and date produced come from the lot's FRM-520; customer, label reference and
--     version, net weight on the label, empty packaging weight and unit come from the product's last
--     release (or its specification, FRM-704, for a first release).
--   - For the release checks the records can speak to, the NOTE is filled with what they show.
--
-- WHAT IT DOES NOT DO, by the owner's decision the same day: it never answers a check and never
-- enters a pack weight. FSQM-020 has the SQF Practitioner confirm each check; the form shows the
-- evidence and the person chooses the result. The check instructions now say so.
--
-- This replaces a migration written earlier the same day and never pushed, which put the rum cake
-- box's weights in as fixed defaults. Taking them from the product's own last release is right for
-- every product, including ones packed differently.
--
-- The schema change is small: two fields swap places (ids unchanged), two help lines, one sentence
-- added to the check instructions, and settings.releaseAssist. The behaviour is in the app
-- (src/lib/releaseAssist.ts). ONE UPDATE, so the history gets one snapshot of v2.
-- Guarded on the md5 of the form's content as it stands in production (read 2026-10-06).

begin;

do $guard$
declare h text; rev text;
begin
  select md5(content::text), revision into h, rev from public.sop_documents where sop_number = 'FRM-701' and status = 'active';
  if rev is distinct from 'v2' or h <> '4a8f14638c8366057ba8d42c82209bb4' then raise exception 'FRM-701 is % or changed (md5 %).', rev, h; end if;
  if (select content->'form_schema'->'sections'->0->'fields'->1->>'id' from public.sop_documents where sop_number = 'FRM-701' and status = 'active') <> 'product_name' then
    raise exception 'FRM-701 section 1 is not in the order this migration expects.';
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                   '{form_schema,sections,0,fields,1}', $j${"id": "lot_code", "help": "Exactly as coded on the pack. Choose it from the list, or type it.", "type": "text", "label": "Lot / batch code", "width": "half", "required": true, "showInList": true}$j$::jsonb),
                   '{form_schema,sections,0,fields,2}', $j${"id": "product_name", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true, "help": "Comes with the lot. Choose or type it if the lot is not on the list."}$j$::jsonb),
                   '{form_schema,sections,1,fields,0,text}', to_jsonb($t$Every row must be answered. N/A is a legitimate answer where a check genuinely does not apply to this product — say why in the note. A single Fail means the batch is not released.

A note that arrives already filled in is what the site's records show for this lot. It is evidence, not the answer: read it, check what it says, then choose the result yourself.$t$::text)),
                   '{form_schema,settings,releaseAssist}', 'true'::jsonb),
       revision = 'v3', effective_date = date '2026-10-06', approved_by = 'GJM'
 where sop_number = 'FRM-701' and status = 'active' and revision = 'v2';

do $verify$
declare fs jsonb; ids text; n int;
begin
  if not exists (select 1 from public.sop_documents where sop_number = 'FRM-701' and status = 'active'
                  and revision = 'v3' and approved_by = 'GJM' and effective_date = date '2026-10-06') then
    raise exception 'FRM-701 was not stamped v3.';
  end if;
  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-701' and status = 'active';
  select string_agg(x->>'id', ',' order by o) into ids from jsonb_array_elements(fs->'sections'->0->'fields') with ordinality q(x, o);
  if ids is distinct from 'release_info,lot_code,product_name,batch_sheet_ref,date_produced,line_or_area,quantity_released,customer' then
    raise exception 'FRM-701 section 1 fields are %', ids;
  end if;
  if (fs->'settings'->>'releaseAssist') is distinct from 'true' or (fs->'settings'->>'deletable') is distinct from 'false' then
    raise exception 'FRM-701 settings are not as intended.';
  end if;
  if fs->'sections'->1->'fields'->0->>'text' not like '%It is evidence, not the answer%' then raise exception 'the check instructions were not updated.'; end if;
  select count(*) into n from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f;
  if n <> 26 then raise exception 'FRM-701 field count changed (%).', n; end if;
  if exists (select 1 from jsonb_array_elements(fs->'sections') s, jsonb_array_elements(s->'fields') f where f ? 'defaultValue') then
    raise exception 'no field of FRM-701 carries a fixed default; values come from the records.';
  end if;
  if jsonb_array_length(fs->'sections'->1->'fields'->1->'rows'->'labels') <> 9 then raise exception 'the release checks grid changed.'; end if;
  if (select count(*) from public.sop_document_history h join public.sop_documents d on d.id = h.document_id
       where d.sop_number = 'FRM-701' and h.revision = 'v2') <> 1 then
    raise exception 'expected exactly one history snapshot of FRM-701 at v2.';
  end if;
end $verify$;

commit;
