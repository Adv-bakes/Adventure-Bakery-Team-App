-- FRM-012 recall workspace + lot trace (owner, 2026-10-02).
--
-- A recall touches eight forms; the owner wants the records pulled, not hunted for. The Team Portal now
-- traces a supplier lot or one of our lots across FRM-520, 301, 801, 703, 701, 702 and the contact list
-- FRM-011 (src/lib/lotTrace.ts), on Compliance > Traceability and in a workspace above each FRM-012 record
-- (settings.recallWorkspace: mode banner, the 4-hour and 24-hour clocks, FSQM-023's steps ticked from the
-- record). This gives FRM-012 the fields that needs:
--   - what it starts from: trigger, material, material_lot, material_supplier;
--   - hold_ref, decision, decided_at (steps 1 and 3; the 24-hour clock runs from decided_at);
--   - trace_back gains finished_lot + source, trace_forward gains product + source;
--   - a per-lot `reconciliation` grid replaces qty_packed / qty_collected / qty_on_site / qty_retained /
--     qty_unaccounted - a material-lot recall involves several lots, and five scalars held one.
-- FRM-012 is DRAFT with no entries, so no answer is orphaned. FSQM-023 (draft) line 6 says the portal pulls
-- the trace. Guarded on the md5 of both (attachments excluded), on draft status and on zero entries.

begin;

do $guard$
declare h text; st text; n int;
begin
  select md5((d.content - 'attachments')::text), d.status,
         (select count(*) from public.sop_document_responses r where r.document_id = d.id)
    into h, st, n from public.sop_documents d where d.sop_number = 'FRM-012';
  if st is distinct from 'draft' or n <> 0 or h <> 'a8564e1ad2a38df6ad4bd990cb04320c' then
    raise exception 'FRM-012 is %, has % entries, or changed since review (md5 %).', st, n, h;
  end if;
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FSQM-023';
  if st is distinct from 'draft' or h <> '8565d80ca388a2985da53aef23440d45' then
    raise exception 'FSQM-023 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', $q${"sections": [{"id": "event", "title": "1. The event", "fields": [{"id": "how_this_works", "text": "One record per mock recall test, withdrawal or recall (FSQM-023). Say what it starts from - an ingredient or packaging lot, or one of our lots - then use 'Trace the lots from the records' in the workspace above: it pulls the Production Lot Records, receipts, dispatches, retention samples and contacts, and puts the trace into this record. Check it against the records; count what is still on site yourself.", "type": "info", "label": "How to use this"}, {"id": "record_type", "type": "select", "label": "Type", "width": "third", "options": ["Mock recall test", "Withdrawal", "Recall"], "required": true, "showInList": true}, {"id": "started", "type": "datetime", "label": "Started", "width": "third", "required": true, "showInList": true}, {"id": "trigger", "type": "select", "label": "Starts from", "width": "third", "required": true, "options": ["An ingredient or packaging lot", "One of our lots", "Something else (complaint, labelling, regulator)"]}, {"id": "material", "type": "text", "label": "Ingredient or packaging material", "width": "third", "help": "If it starts from a supplier's lot"}, {"id": "material_lot", "type": "text", "label": "Its supplier lot", "width": "third"}, {"id": "material_supplier", "type": "text", "label": "Supplier", "width": "third"}, {"id": "product", "type": "text", "label": "Product", "width": "half", "required": true, "showInList": true}, {"id": "lot_codes", "help": "Our lot code(s) affected. Filled by the trace.", "type": "text", "label": "Lot code(s)", "width": "half", "required": true, "showInList": true}, {"id": "brand_owner", "type": "text", "label": "Customer / brand owner", "width": "full"}, {"id": "reason", "type": "textarea", "label": "Reason, or test scenario", "required": true}, {"id": "hold_ref", "type": "text", "label": "Product and materials still on site", "width": "half", "help": "The FRM-702 hold tag number(s), or 'Nothing on site'. In a mock recall, where they are - nothing is tagged."}, {"id": "decision", "type": "select", "label": "Decision with the brand owner", "width": "third", "options": ["Withdrawal", "Recall", "No action needed"], "help": "Actual event only"}, {"id": "decided_at", "type": "datetime", "label": "Decided at", "width": "third", "help": "The 24-hour notice runs from here"}]}, {"id": "back", "title": "2. One step back - what went in", "fields": [{"id": "trace_back", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add supplier lot"}, "type": "grid", "label": "Supplier lots in each finished lot (from FRM-520), and their receipt (FRM-301)", "columns": [{"id": "finished_lot", "label": "Our lot", "type": "text", "scanFact": "none", "width": 0.9}, {"id": "ingredient", "type": "text", "label": "Ingredient / material", "width": 2, "required": true, "scanFact": "none"}, {"id": "supplier", "type": "text", "label": "Supplier", "width": 1.5, "scanFact": "none"}, {"id": "supplier_lot", "type": "text", "label": "Supplier lot", "width": 1.5, "required": true, "scanFact": "none"}, {"id": "received", "type": "date", "label": "Received (FRM-301)", "width": 1.2}, {"id": "found", "type": "select", "label": "Receipt record", "width": 1, "options": ["Found", "Not found"], "required": true}, {"id": "source", "label": "Records", "type": "text", "scanFact": "none", "width": 2}], "required": true, "rowDialog": true}]}, {"id": "forward", "title": "3. One step forward - where it went, and the reconciliation", "fields": [{"id": "trace_forward", "help": "For a material-lot test, one line per finished lot and customer. If nothing has left the site, say so in Still on site.", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add customer"}, "type": "grid", "label": "Customers who collected the lot (from FRM-801)", "columns": [{"id": "finished_lot", "type": "text", "label": "Finished lot", "width": 1, "scanFact": "none"}, {"id": "product", "label": "Product", "type": "text", "scanFact": "none", "width": 1.5}, {"id": "customer", "type": "text", "label": "Customer", "width": 2, "required": true, "scanFact": "none"}, {"id": "quantity", "type": "text", "label": "Quantity", "width": 1, "required": true, "scanFact": "none"}, {"id": "collected", "type": "date", "label": "Collected on", "width": 1.2}, {"id": "source", "label": "Records", "type": "text", "scanFact": "none", "width": 1.5}]}, {"id": "reconciliation", "type": "grid", "label": "Reconciliation - one line per lot", "required": true, "rowDialog": true, "help": "Packed = collected + still on site + retained + disposed. The trace fills what the records hold; count what is on site yourself. Write 0 under 'Unaccounted for' when it balances.", "columns": [{"id": "finished_lot", "label": "Our lot", "type": "text", "scanFact": "none", "required": true, "width": 0.9}, {"id": "product", "label": "Product", "type": "text", "scanFact": "none", "width": 1.5}, {"id": "packed", "label": "Packed", "type": "text", "scanFact": "none", "required": true, "width": 1}, {"id": "collected", "label": "Collected by customers", "type": "text", "scanFact": "none", "width": 1.2}, {"id": "on_site", "label": "Still on site", "type": "text", "scanFact": "none", "width": 1}, {"id": "retained", "label": "Retained (FRM-703)", "type": "text", "scanFact": "none", "width": 1}, {"id": "disposed", "label": "Disposed of", "type": "text", "scanFact": "none", "width": 1}, {"id": "unaccounted", "label": "Unaccounted for", "type": "text", "scanFact": "none", "required": true, "width": 1}, {"id": "source", "label": "Records", "type": "text", "scanFact": "none", "width": 2}], "rows": {"mode": "dynamic", "min": 1, "addLabel": "Add lot"}}]}, {"id": "result", "title": "4. Time and result", "fields": [{"id": "completed", "type": "datetime", "label": "Trace completed", "width": "third", "required": true}, {"id": "within_target", "type": "select", "label": "Within 4 hours", "width": "third", "options": ["Yes", "No - CAPA raised"], "required": true}, {"id": "contacts_checked", "type": "select", "label": "Contact list (FRM-011)", "width": "third", "options": ["Checked - current", "Checked - updated", "Not checked - actual event"], "required": true}, {"id": "gaps", "help": "Anything that could not be traced, was slow to find, or was missing from a record. Write None if there were none.", "type": "textarea", "label": "Gaps found"}, {"id": "capa_no", "type": "text", "label": "FRM-007 no.", "width": "third"}]}, {"id": "actual", "title": "5. Actual withdrawal or recall only", "fields": [{"id": "notifications", "rows": {"min": 1, "mode": "dynamic", "addLabel": "Add notification"}, "type": "grid", "label": "Who was told", "columns": [{"id": "who", "type": "text", "label": "Who", "width": 2, "scanFact": "none"}, {"id": "when", "type": "date", "label": "Date", "width": 1}, {"id": "time", "type": "time", "label": "Time", "width": 0.8}, {"id": "how", "type": "select", "label": "How", "width": 1, "options": ["Phone", "Email", "Letter", "In person", "Online report"]}, {"id": "by", "type": "text", "label": "By", "width": 1.2, "scanFact": "none"}]}, {"id": "recovered", "help": "Quantities returned or held at customers, the FRM-702 hold, and the disposition under FSQM-018", "type": "textarea", "label": "Product recovered and what was done with it"}, {"id": "root_cause", "type": "textarea", "label": "Root cause"}], "description": "Leave blank for a mock recall."}, {"id": "sign", "title": "6. Sign-off", "fields": [{"id": "completed_by", "role": "filler", "type": "signature", "label": "Carried out by", "required": true, "statement": "The trace and the quantities above were taken from the site's records."}, {"id": "closed_by", "role": "verifier", "type": "signature", "label": "Closed by Senior Site Management", "required": true, "statement": "I have reviewed this record and the actions raised from it."}]}], "settings": {"attachmentsEnabled": true, "allowMultipleDrafts": true, "requireVerification": true, "instanceTitleTemplate": "{record_type} - {lot_codes}", "recallWorkspace": true}, "schemaVersion": 1}$q$::jsonb)
 where sop_number = 'FRM-012' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{procedure,5}', to_jsonb($q$• Trace: the SQF Practitioner traces the affected lots under FSQM-021 - FRM-520 for the supplier lots in each finished lot, FRM-301 for their receipt, FRM-801 for every customer who collected the lot, how much and when. This is the essential traceability information, and the target is to have it within 4 hours (SQF 2.6.3.1 ii). The Traceability page of the Team Portal, and the FRM-012 record itself, pull these records together from a supplier lot or from one of our lot codes and list what the records do not show; the SQF Practitioner checks the result against the records.$q$::text))
                 || jsonb_build_object('revision_history', $q$New - 2026-10-01 - DRAFT under D-21, for the Minor findings against 2.6.3.1 and 2.6.3.2. The site had no withdrawal or recall procedure and had never run a mock recall.

OWNER'S ANSWERS (2026-10-01): the site co-packs under customers' brands, so the brand owner leads the recall and the site supplies the trace; the mock recall target is 4 hours; no certification body has been chosen yet.

THE MOCK RECALL IS ALSO D-20's TRACE TEST: FSQM-021 says the annual trace test is part of this test, recorded on FRM-012.

AT ISSUE: activate the 'traceability_test' row on the verification schedule (FSQM-017 Part 6) against FRM-012, yearly; issue FSQM-021 and FRM-520 first or with it.

TO CONFIRM BEFORE ISSUE: (1) the customer agreements do make the brand owner responsible for consumer notices; (2) the certification body, once contracted, added to FRM-011; (3) legal counsel and a food safety consultant named on FRM-011; (4) the first mock recall run and recorded.

RECALL WORKSPACE 2026-10-02 (owner): the trace is pulled from the records by the Team Portal - the Traceability page, and the workspace above each FRM-012 record with the 4-hour and 24-hour clocks and these steps ticked from the record. FRM-012 gained what it starts from, the hold reference, the decision, and a per-lot reconciliation table in place of the five quantity fields.$q$::text)
 where sop_number = 'FSQM-023' and status = 'draft';

do $verify$
declare fs jsonb;
begin
  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-012';
  if (fs->'settings'->>'recallWorkspace') is distinct from 'true' then
    raise exception 'FRM-012 recallWorkspace was not set.';
  end if;
  if (select string_agg(f->>'id', ',' order by so, fo)
        from jsonb_array_elements(fs->'sections') with ordinality s(s, so), jsonb_array_elements(s->'fields') with ordinality f(f, fo))
     <> 'how_this_works,record_type,started,trigger,material,material_lot,material_supplier,product,lot_codes,brand_owner,reason,hold_ref,decision,decided_at,trace_back,trace_forward,reconciliation,completed,within_target,contacts_checked,gaps,capa_no,notifications,recovered,root_cause,completed_by,closed_by' then
    raise exception 'FRM-012 fields are not as expected.';
  end if;
  if (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'FSQM-023') <> 33
     or (select content->'procedure'->>5 from public.sop_documents where sop_number = 'FSQM-023') not like '%Traceability page of the Team Portal%' then
    raise exception 'FSQM-023 line 6 was not updated.';
  end if;
end $verify$;

commit;
