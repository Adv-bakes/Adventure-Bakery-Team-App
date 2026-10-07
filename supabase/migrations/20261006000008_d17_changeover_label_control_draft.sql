-- D-17, what was left open: start-up and changeover (SQF 2.6.1.2) and label accuracy (2.8.1.9).
-- Written into two documents that are still DRAFTS - FSQM-021 Product Identification and
-- Traceability Program and FRM-520 Production Lot Record - so there is no new program and no new
-- form, and nothing here needs approval yet. Both are issued together under D-20.
--
-- What the site does (owner, 2026-10-06): every rum cake goes into the same box, whose ingredient
-- list and allergen statement are printed and the same for every flavor. An ink-jet coder prints
-- the company name, flavor, lot code, best-by date and bar code on the box at packing. So there is
-- no stock of pre-printed labels to issue, clear or count: the label control IS the coder message.
-- The first box was already looked at, unrecorded; the cakes were counted on the rack and again
-- when bulk packed, but the counts were never compared.
--
-- FSQM-021 gains one Part, "Start-up, changeover and the label" (ten lines, before "Tracing"):
-- first-box check and who approves it, clearing the previous product's printed boxes, the count
-- reconciliation, the rule that a formula must match the printed box, and obsolete packaging.
-- One person packs, and the program says so: production staff approve the first box and the SQF
-- Practitioner sees the label again at release (FRM-701). It does not invent a supervisor.
--
-- FRM-520's Packing section gains three fields (rack count, not packed, first box checked by) and
-- two help lines. Field ids already in use are unchanged, so the three existing entries, the lot
-- trace and the release helper are unaffected.
--
-- ONE UPDATE per document. Guarded on the md5 of each as it stands in production (read 2026-10-06).

begin;

do $guard$
declare h1 text; h2 text;
begin
  select md5(content::text) into h1 from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft';
  select md5(content::text) into h2 from public.sop_documents where sop_number = 'FRM-520' and status = 'draft';
  if h1 is distinct from 'a8b7a4830d117b4e6fce546d676a6fb4' then raise exception 'FSQM-021 is not the draft this migration was written against (md5 %).', h1; end if;
  if h2 is distinct from '581e8257022689b968ac945b121571ca' then raise exception 'FRM-520 is not the draft this migration was written against (md5 %).', h2; end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(content,
                   '{procedure}', $j$["Identification at every stage", "• Receipt: every delivery is logged on FRM-301 with the supplier, the material, the supplier lot and the date received. Material that arrives without a readable lot code or label is held on FRM-702 until the supplier identifies it (SQF 2.6.1.1 i, 2.6.2.1 ii).", "• Storage: every ingredient, processing aid and packaging material stays in the bag, box, pail or roll it arrived in, with the supplier's label and lot, until it is used up. A part-used bag is closed and kept in its own bag. Nothing is decanted into another container (SQF 2.6.1.1 i).", "• Production: ingredients are weighed straight from their original containers, so the supplier lot is in front of the person using it. Batter is deposited in the run it is mixed for and is never stored (SQF 2.6.1.1 i).", "• Baked product cooling on racks carries a rack card with the product and its lot code until it is wrapped (SQF 2.6.1.1 i).", "• Finished product: every pack is coded with the lot code and best-by date on the coder (SOP-603, SOP-604) and labelled to its specification on FRM-704 and to US labelling law. The label and code are checked before release on FRM-701 under FSQM-020 (SQF 2.6.1.1 ii).", "• Held, retained and rejected product is identified by its FRM-702 hold tag or FRM-703 retention entry, each carrying the lot code.", "The lot code", "• The lot code is the last digit of the year and the three-digit day of the year on which the product was BAKED, for example 6272. It is the same code written on FRM-507 for that day's oven loads.", "• When wrapping runs into the next day, the coder is set to the bake day's code, not to the day of wrapping. A product baked on day 272 is 6272 whenever it is packed.", "• One lot is one product baked on one day. If the same product is baked on two days, it is two lots.", "The Production Lot Record - the cross reference", "• For each product baked each day, a Production Lot Record is kept on FRM-520 as the product is made - filled in directly in the Team Portal, or written on the printed prep sheet on the floor and entered within one working day (SQF 2.6.2.1 i).", "• The record carries the product, its lot code and the bake date, and a line for every ingredient used with the supplier lot printed on its container. If two lots of the same ingredient are used, both are written down.", "• Processing aids are listed like ingredients - in particular the pan spray, which contains soy - so that every allergen-bearing input can be traced back (SQF 2.8.1.8).", "• If rework is used, it is recorded with its own original lot code, so a lot made with rework traces back through the rework to its supplier lots (SQF 2.6.2.1 iii).", "• At wrapping, the record takes the pack date and the number of units packed. The film or vacuum bag touches the cake and is food-contact packaging: its lot is written when the maker prints one, and when none is printed the date that film was received is written instead, which FRM-301 ties to its supplier. The boxes the sealed cakes go into are outer packaging and are not traced (SQF 2.6.2.1 ii).", "• Whichever way it is filled in, the FRM-520 entry is the record. A photo of a paper prep sheet may be attached to it but is not required; a paper sheet that was used is kept with the batch records under SOP-2.2.3 (SQF 2.6.2.1).", "Start-up, changeover and the label", "> Every rum cake is packed in the same box. The ingredient list and the allergen statement are printed on that box and are the same for every flavor. What changes from one product to the next is what the coder prints on the box at packing: the company name, the flavor, the lot code, the best-by date and the bar code. Putting the right label on a product therefore means loading the right coder message.", "• At the start of packing, and every time the product changes, the person packing loads the coder message for that product and prints one box (SOP-603, SOP-604).", "• That first box is checked against the Production Lot Record before packing carries on: the flavor is the product being packed, the lot code and best-by date are right, and the bar code scans. Production staff trained on the coder are authorized to approve it. The result and the name of the person who checked are written on FRM-520 (SQF 2.6.1.2).", "• The check is made again whenever the coder is restarted or its message is edited during the run.", "• Before the next product is packed, boxes already printed for the one before are taken off the packing table, and so is any packaging that belongs only to that product (SQF 2.6.1.2).", "• No pre-printed label is issued by count, so what is reconciled is the product. The cakes are counted when they go on the baking rack. At the end of packing that count is compared with the units packed plus the units not packed - rejected, damaged, or kept as the retention sample - and all three figures are written on FRM-520. A difference that cannot be explained is settled before the lot is released, and raised on FRM-007 if it cannot be (SQF 2.6.1.2).", "• A product goes into the printed box only if the ingredients and allergens of its formula are the ones printed on it. That is checked on FRM-601 before a new or changed product is first packed, and the change is assessed first under FSQM-007 (SQF 2.8.1.9).", "• When the printed box or a coder message is replaced, the old boxes are counted and destroyed under FSQM-037 and the old message is deleted from the coder. Both are noted on the FRM-601 for the new version (SQF 2.8.1.9).", "• The label and the code are looked at once more, by the SQF Practitioner, when the lot is released on FRM-701.", "Tracing", "• One step back: from a finished lot code, FRM-520 gives every supplier lot used, and FRM-301 gives the supplier and the date each was received (SQF 2.6.2.1 i, ii).", "• One step forward: from a finished lot code, FRM-801 gives every customer who collected it, how much and when (SQF 2.6.2.1 i).", "• From a supplier lot - for example a supplier's recall or allergen notice - the FRM-520 entries that list it give every finished lot it went into, and FRM-801 gives where those lots went (SQF 2.8.1.8).", "Testing the trace", "• At least once a year, the SQF Practitioner picks a finished lot and traces it both ways from the records alone: back to every supplier lot and its receipt on FRM-301, and forward to every customer on FRM-801 (SQF 2.6.2.1 iv).", "• The test passes when every input is traced to a supplier lot and a receipt, and the quantity packed is accounted for - collected by customers, still on site, retained on FRM-703, or disposed of on FRM-702. Any gap is raised as a CAPA on FRM-007 under FSQM-009.", "• The trace test is part of the annual product recall and withdrawal test and is reviewed with it (SQF 2.6.2.1 iv).", "Records", "• FRM-301, FRM-520, FRM-507, FRM-701 and FRM-801 are the trace records. They are kept for at least two years, as SOP-2.2.3 requires (SQF 2.6.2.1)."]$j$::jsonb),
                   '{responsibility}', to_jsonb($t$SQF Practitioner - owns this program; runs the annual trace test; reviews the Production Lot Records.
Production staff - weigh every ingredient from its original container; write the supplier lot of everything used, and the product's lot code, on the Production Lot Record (FRM-520, or the printed prep sheet); set the coder to the bake day's code; check and approve the first box at start-up and at every change of product; count the cakes on the rack and at packing.
Whoever uses a paper prep sheet - enters it on FRM-520 within one working day.
Receiver - records supplier, lot and receipt date on FRM-301.
Whoever releases and loads product - records the lot on FRM-701 and FRM-801.$t$::text)),
                   '{records}', to_jsonb($t$• FRM-520 entries, one per product per bake day, carrying the first-box check and the count reconciliation; any paper prep sheets used, filed with the batch records
• FRM-301 receiving entries
• FRM-507, FRM-701 and FRM-801 entries carrying the lot code
• The annual trace test$t$::text)),
                   '{form_references}', to_jsonb($t$FRM-520 - Production Lot Record
FRM-301 - Incoming Material Receiving & Inspection Log
FRM-507 - CCP 1 Baking Monitoring Record
FRM-701 - Finished Product Release Record
FRM-801 - Dispatch and Vehicle Loading Record
FRM-702 - Non-Conforming Material Hold & Tagging Record
FRM-703 - Retention Sample Log
FRM-704 - Finished Product Specification
FRM-007 - Corrective & Preventive Action (CAPA) Report
FRM-601 - Label Review & Approval Form$t$::text)),
                   '{governing_reference}', to_jsonb($t$SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.6.1.1 (Product Identification), 2.6.2.1 (Product Trace), 2.8.1.8 (allergen traceback), 2.6.1.2 (start-up, changeover and label reconciliation), 2.8.1.9 (label accuracy).

SOP-2.2.3 Document and Record Control Program - the lot code and the retention of batch records.
SOP-603, SOP-604 - the coders.
FSQM-020 Product Release Program and FRM-701 - the label and code check before release.
FSQM-014 Product Sampling, Inspection and Analysis Program - the receiving label scan.
FSQM-018 Non-Conforming Product and Equipment - held product.
FSQM-009 CAPA Program.
FSQM-007 Change Management Program - a new or changed product or label.
FSQM-037 Waste Management Program - destroying obsolete printed packaging.$t$::text)),
                   '{revision_history}', to_jsonb($t$New - 2026-09-29 - DRAFT under D-20, for the three Minor findings against 2.6.1.1, 2.6.2.1 and 2.8.1.8. Written as one program; the workbook's separate SOP-2.6.2 is not needed.

WHAT THE SITE DOES (owner, 2026-09-29): the lot code is the last digit of the year and the day of the year, e.g. 6272, as SOP-2.2.3 already states; it is the BAKE day. Ingredients are weighed out of the bags and containers they arrived in; nothing is decanted. All product goes to business customers and is collected. Supplier lots are recorded at receipt on FRM-301 and the lot and customer at dispatch on FRM-801.

NEW WITH THIS PROGRAM: the Production Lot Record, FRM-520 - filled in directly in the Team Portal or from the printed prep sheet - which is the cross reference between the supplier lots used and our lot code. Before this, nothing recorded which supplier lots went into which lot. Also new: the coder is set to the bake day when wrapping runs into the next day, and the annual trace test.

THE TRACE TEST'S RECORD arrives with the recall and withdrawal program (D-21), as 2.6.2.1 iv ties the two together; the 'traceability test' row on the verification schedule stays planned until then.

TO CONFIRM BEFORE ISSUE: (1) the rack card for baked product cooling on racks - product and lot code; (2) how syrup made ahead is identified while stored - open under D-14; (3) whether the coder is set to the bake day today when wrapping runs over, or whether that is new practice.

RENUMBERED 2026-09-30: the Production Lot Record is FRM-520, not FRM-510, so it is not mistaken for FRM-501 Formula Sheet & Batch Data.

PAPER OPTIONAL 2026-09-30 (owner): the site will not be forced onto paper. FRM-520 can be filled in directly; the printed prep sheet is an option, and a photo of it may be attached but is not required. The required 'Paper sheet - photo attached' question was removed from FRM-520.

CHANGEOVER AND LABEL CONTROL ADDED 2026-10-06 (still a draft), for what D-17 left open: 2.6.1.2 and 2.8.1.9. Written into this program and FRM-520, with no new document and no new form.

WHAT THE SITE DOES (owner, 2026-10-06): every rum cake goes into the same box, with one printed ingredient list and allergen statement for all flavors. An ink-jet coder prints the company name, flavor, lot code, best-by date and bar code on the box just after the cake goes in, so there is no stock of pre-printed labels to issue, clear or count. The first printed box is already looked at, but nothing was written down. The cakes are counted on the baking rack and the packed cakes are bulk packed 48 to a case, but the two counts were never compared. No artwork has changed yet, so there has been no obsolete packaging.

NEW WITH THIS CHANGE: the first-box check is recorded on FRM-520 with who made it; the rack count, the units packed and the units not packed are written on FRM-520 and compared; the rule that a product may only go into the printed box if its formula matches what is printed on it; and what happens to old boxes and coder messages when artwork changes.

ONE PERSON PACKS. The program does not pretend there is a separate supervisor: production staff trained on the coder approve the first box, and the SQF Practitioner sees the label and code again at release on FRM-701.

TO CONFIRM BEFORE ISSUE: (4) that every flavor's formula matches the one ingredient list and allergen statement printed on the box - an FRM-601 review per flavor; (5) how products packed in another customer's packaging are labelled, and whether the same first-box check applies to them.$t$::text)),
       sqf_reference = '2.6.1.1, 2.6.1.2, 2.6.2.1, 2.8.1.8, 2.8.1.9'
 where sop_number = 'FSQM-021' and status = 'draft';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema,sections,2}', $j${"id": "packing", "title": "3. Packing", "fields": [{"id": "pack_date", "help": "If packing ran over two days, the first day - note the second below", "type": "date", "label": "Packed on", "width": "third", "required": true}, {"id": "racked_count", "type": "number", "min": 0, "label": "Counted on the baking rack", "width": "third", "required": true, "help": "The count taken when the cakes went on the rack."}, {"id": "units_packed", "type": "text", "label": "Units packed", "width": "third", "required": true}, {"id": "not_packed", "type": "number", "min": 0, "label": "Not packed", "width": "third", "required": true, "help": "Rejected, damaged or kept as the retention sample. Write 0 if none."}, {"id": "film_lot", "help": "The lot printed on the film roll or bag case. If none is printed, write \"no lot - received\" and the date it was received. Boxes need nothing.", "type": "text", "label": "Film / bag lot", "width": "third", "required": false}, {"id": "code_check", "type": "select", "label": "Code on the pack", "options": ["Matches the lot code above", "Did not match - held on FRM-702"], "required": true, "help": "Look at the first box off the coder at the start, and again after every change of product: the flavor, the lot code, the best-by date, and that the bar code scans (FSQM-021)."}, {"id": "code_checked_by", "type": "text", "label": "First box checked by", "required": true, "maxLength": 120, "help": "The name of the person who checked and approved the first box."}, {"id": "packing_notes", "type": "textarea", "label": "Notes", "help": "If the rack count does not equal units packed plus not packed, say why here."}]}$j$::jsonb),
       sqf_reference = '2.6.1.1, 2.6.1.2, 2.6.2.1, 2.8.1.8'
 where sop_number = 'FRM-520' and status = 'draft';

do $verify$
declare c jsonb; fs jsonb; ids text;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-021' and status = 'draft' and revision = 'New';
  if jsonb_array_length(c->'procedure') <> 38 then raise exception 'FSQM-021 should have 38 procedure lines.'; end if;
  if c->'procedure'->>18 <> 'Start-up, changeover and the label' or c->'procedure'->>28 <> 'Tracing' then
    raise exception 'the new Part is not where it should be.';
  end if;
  if c::text ~* '(Diana|Gabriela|Richard|Mercer|Samboni|Juncos)' then raise exception 'a controlled document names positions, not people.'; end if;
  select content->'form_schema' into fs from public.sop_documents where sop_number = 'FRM-520' and status = 'draft' and revision = 'New';
  select string_agg(x->>'id', ',' order by o) into ids from jsonb_array_elements(fs->'sections'->2->'fields') with ordinality q(x, o);
  if ids is distinct from 'pack_date,racked_count,units_packed,not_packed,film_lot,code_check,code_checked_by,packing_notes' then
    raise exception 'FRM-520 packing fields are %', ids;
  end if;
  if jsonb_array_length(fs->'sections') <> 4 or fs->'settings'->'batchSheet'->>'source' <> 'FRM-501' then
    raise exception 'FRM-520 changed outside its Packing section.';
  end if;
  if fs->'sections'->2->'fields'->5->'options' <> $j$["Matches the lot code above", "Did not match - held on FRM-702"]$j$::jsonb then
    raise exception 'the code check options must not change: existing entries hold them.';
  end if;
end $verify$;

commit;
