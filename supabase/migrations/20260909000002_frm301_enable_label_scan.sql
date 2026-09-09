-- FRM-301 Incoming Material Receiving & Inspection Log: turn on the package-label scan.
--
-- WHAT THIS GIVES THE RECEIVER. A camera button on every row of the Receiving Log. The
-- receiver photographs the bag, case or pallet label and `extract-package-label` reads the
-- printed identity into that row - Supplier Name, Material Description and Lot/Batch Number.
-- That is the whole of the request; no new code was needed, because the scan already exists
-- and this grid's column labels already resolve to the right facts through inferScanFact:
--   Supplier Name        -> brand        (/supplier|vendor|manufactur|brand|maker/)
--   Material Description -> product_name (/ingredient|material|product|description/)
--   Lot/Batch Number     -> lot_code     (/\b(lot|batch)\b/)
-- So only three keys are written, and two of them are safety rails rather than wiring.
--
-- RAIL 1 - scanNotesColumnId. Facts the model reads that no column claims (best-by date,
-- vendor item code, net weight, pack size) are APPENDED to the notes column rather than
-- dropped. It would be inferred as comments_hold_status anyway; pinning it means a later
-- column rename cannot silently send those facts nowhere.
--
-- RAIL 2 - scanFact "none" on approved_supplier_coa_log_coc. That column's label contains
-- "Supplier", so it MATCHES the brand pattern. It is a pass_fail column, and a brand name is
-- not a Pass. It is harmless today only because applyLabelScan gives a fact to the first
-- column that claims it and supplier_name (index 2) comes before it (index 10) - which means
-- the protection is column ORDER, and column order is exactly what an admin reorders. Pinning
-- "none" opts it out permanently, which is what the "none" value exists for.
--
-- scanKeepPhoto is deliberately NOT set, so it stays off: the scanned values land in cells the
-- receiver reads back before saving, and the upload is removed once the model has read it.
-- Worth revisiting for this form specifically - a receiving lot code is the case where the
-- photo itself is the evidence - but that is a storage decision, not part of this change.
--
-- NOTHING ELSE IS TOUCHED. No column is added, renamed, retyped or reordered, no question
-- changes, and no recorded value changes meaning. The after-guard proves it by hashing the
-- whole content with exactly these three keys removed and comparing it to the hash taken
-- before the update. The revision is deliberately NOT bumped: this adds an input aid to the
-- form, it does not change what the form asks or what it records. Bumping it is the SQF
-- Practitioner's call, not this migration's.
--
-- The sop_document_history trigger snapshots the prior row by itself, because form_schema is
-- one of the fields it watches on a published document. That is the audit trail for this edit.

begin;

do $$
declare
  r record;
begin
  select status,
         (content #>> '{form_schema,sections,0,fields,0,id}')            as grid_id,
         (content #>> '{form_schema,sections,0,fields,0,type}')          as grid_type,
         jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols,
         (content #> '{form_schema,sections,0,fields,0}' ? 'scanLabel')  as already_on,
         (content #>> '{form_schema,sections,0,fields,0,columns,2,id}')  as c2,
         (content #>> '{form_schema,sections,0,fields,0,columns,3,id}')  as c3,
         (content #>> '{form_schema,sections,0,fields,0,columns,4,id}')  as c4,
         (content #>> '{form_schema,sections,0,fields,0,columns,10,id}') as c10,
         (content #>> '{form_schema,sections,0,fields,0,columns,12,id}') as c12
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.status is distinct from 'active' then
    raise exception 'FRM-301 is % , expected active.', r.status;
  end if;
  if r.grid_id is distinct from 'receiving_log' or r.grid_type is distinct from 'grid' then
    raise exception 'sections[0].fields[0] is %/% , expected receiving_log/grid.', r.grid_id, r.grid_type;
  end if;
  if r.cols <> 13 then
    raise exception 'Receiving Log has % columns, expected 13.', r.cols;
  end if;
  if r.already_on then
    raise exception 'FRM-301 already carries scanLabel; this migration has run, or someone set it.';
  end if;
  -- Index-addressed writes are only safe while the indices still mean what they meant when
  -- this was written. If a column was inserted or reordered, refuse rather than write the
  -- opt-out onto the wrong column.
  if r.c2  is distinct from 'supplier_name'
  or r.c3  is distinct from 'material_description'
  or r.c4  is distinct from 'lot_batch_number'
  or r.c10 is distinct from 'approved_supplier_coa_log_coc'
  or r.c12 is distinct from 'comments_hold_status' then
    raise exception 'Column order has changed (2=%, 3=%, 4=%, 10=%, 12=%). Re-read before applying.',
      r.c2, r.c3, r.c4, r.c10, r.c12;
  end if;
end $$;

create temporary table frm301_before on commit drop as
select md5(content::text) as h
  from public.sop_documents where sop_number = 'FRM-301';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(content,
                       '{form_schema,sections,0,fields,0,scanLabel}', 'true'::jsonb, true),
                     '{form_schema,sections,0,fields,0,scanNotesColumnId}',
                     to_jsonb('comments_hold_status'::text), true),
                   '{form_schema,sections,0,fields,0,columns,10,scanFact}',
                   to_jsonb('none'::text), true)
 where sop_number = 'FRM-301' and status = 'active';

do $$
declare
  r record;
  drift int;
begin
  select (content #> '{form_schema,sections,0,fields,0,scanLabel}')            as scan_on,
         (content #>> '{form_schema,sections,0,fields,0,scanNotesColumnId}')   as notes_col,
         (content #>> '{form_schema,sections,0,fields,0,columns,10,scanFact}') as opted_out,
         (content #> '{form_schema,sections,0,fields,0}' ? 'scanKeepPhoto')    as keeps_photo,
         jsonb_array_length(content #> '{form_schema,sections,0,fields,0,columns}') as cols
    into r
    from public.sop_documents where sop_number = 'FRM-301';

  if r.scan_on is distinct from 'true'::jsonb then
    raise exception 'scanLabel did not land (found %).', r.scan_on;
  end if;
  if r.notes_col is distinct from 'comments_hold_status' then
    raise exception 'scanNotesColumnId is % , expected comments_hold_status.', r.notes_col;
  end if;
  if r.opted_out is distinct from 'none' then
    raise exception 'The Approved Supplier column was not opted out (found %).', r.opted_out;
  end if;
  if r.keeps_photo then
    raise exception 'scanKeepPhoto was set; this migration must not turn photo retention on.';
  end if;
  if r.cols <> 13 then
    raise exception 'Column count changed to %.', r.cols;
  end if;

  -- Everything except the three keys written above must be byte-identical.
  select count(*) into drift
    from public.sop_documents d, frm301_before b
   where d.sop_number = 'FRM-301'
     and md5((d.content
              #- '{form_schema,sections,0,fields,0,scanLabel}'
              #- '{form_schema,sections,0,fields,0,scanNotesColumnId}'
              #- '{form_schema,sections,0,fields,0,columns,10,scanFact}')::text) is distinct from b.h;
  if drift <> 0 then
    raise exception 'FRM-301 changed outside the three scan keys. Rolled back.';
  end if;
end $$;

commit;
