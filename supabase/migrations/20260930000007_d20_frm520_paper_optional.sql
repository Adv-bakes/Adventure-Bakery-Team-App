-- D-20: paper is optional for FRM-520 (owner, 2026-09-30).
--
-- The owner: "we will not want to be forced to use a paper sheet." FRM-520 had a REQUIRED select, 'Paper sheet
-- - Photo attached to this entry', and FSQM-021 made the paper sheet plus a photo the method. Now FRM-520 can
-- be filled in directly in the Team Portal (on a tablet on the floor), or from the printed prep sheet within one
-- working day; a photo of a paper sheet may be attached but is not required.
--   FRM-520: the paper_photo field is removed; the instructions and the signature statement no longer mention
--            paper. (The 2 test entries keep a stored paper_photo answer, shown under "Unmapped answers".)
--   FSQM-021: procedure lines 13, 14, 16, 17, 18, responsibility, records and revision history reworded.
-- Both still DRAFT. Guarded on the md5 of both (attachments excluded) and on the exact old texts.

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FSQM-021';
  if st is distinct from 'draft' or h <> 'a9c66dbd570e4a9fb59a5b82502c051a' then
    raise exception 'FSQM-021 is % or changed since review (md5 %).', st, h;
  end if;
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FRM-520';
  if st is distinct from 'draft' or h <> '4b0dfae7010cbf21f15990007358f0cb' then
    raise exception 'FRM-520 is % or changed since review (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents
   set content = content || jsonb_build_object(
         'responsibility', $t$SQF Practitioner - owns this program; runs the annual trace test; reviews the Production Lot Records.
Production staff - weigh every ingredient from its original container; write the supplier lot of everything used, and the product's lot code, on the Production Lot Record (FRM-520, or the printed prep sheet); set the coder to the bake day's code.
Whoever uses a paper prep sheet - enters it on FRM-520 within one working day.
Receiver - records supplier, lot and receipt date on FRM-301.
Whoever releases and loads product - records the lot on FRM-701 and FRM-801.$t$::text,
         'records', $t$• FRM-520 entries, one per product per bake day; any paper prep sheets used, filed with the batch records
• FRM-301 receiving entries
• FRM-507, FRM-701 and FRM-801 entries carrying the lot code
• The annual trace test$t$::text,
         'revision_history', $t$New - 2026-09-29 - DRAFT under D-20, for the three Minor findings against 2.6.1.1, 2.6.2.1 and 2.8.1.8. Written as one program; the workbook's separate SOP-2.6.2 is not needed.

WHAT THE SITE DOES (owner, 2026-09-29): the lot code is the last digit of the year and the day of the year, e.g. 6272, as SOP-2.2.3 already states; it is the BAKE day. Ingredients are weighed out of the bags and containers they arrived in; nothing is decanted. All product goes to business customers and is collected. Supplier lots are recorded at receipt on FRM-301 and the lot and customer at dispatch on FRM-801.

NEW WITH THIS PROGRAM: the Production Lot Record, FRM-520 - filled in directly in the Team Portal or from the printed prep sheet - which is the cross reference between the supplier lots used and our lot code. Before this, nothing recorded which supplier lots went into which lot. Also new: the coder is set to the bake day when wrapping runs into the next day, and the annual trace test.

THE TRACE TEST'S RECORD arrives with the recall and withdrawal program (D-21), as 2.6.2.1 iv ties the two together; the 'traceability test' row on the verification schedule stays planned until then.

TO CONFIRM BEFORE ISSUE: (1) the rack card for baked product cooling on racks - product and lot code; (2) how syrup made ahead is identified while stored - open under D-14; (3) whether the coder is set to the bake day today when wrapping runs over, or whether that is new practice.

RENUMBERED 2026-09-30: the Production Lot Record is FRM-520, not FRM-510, so it is not mistaken for FRM-501 Formula Sheet & Batch Data.

PAPER OPTIONAL 2026-09-30 (owner): the site will not be forced onto paper. FRM-520 can be filled in directly; the printed prep sheet is an option, and a photo of it may be attached but is not required. The required 'Paper sheet - photo attached' question was removed from FRM-520.$t$::text,
         'procedure', (select jsonb_agg(
            case i - 1
              when 12 then to_jsonb($t$• For each product baked each day, a Production Lot Record is kept on FRM-520 as the product is made - filled in directly in the Team Portal, or written on the printed prep sheet on the floor and entered within one working day (SQF 2.6.2.1 i).$t$::text)
              when 13 then to_jsonb($t$• The record carries the product, its lot code and the bake date, and a line for every ingredient used with the supplier lot printed on its container. If two lots of the same ingredient are used, both are written down.$t$::text)
              when 15 then to_jsonb($t$• If rework is used, it is recorded with its own original lot code, so a lot made with rework traces back through the rework to its supplier lots (SQF 2.6.2.1 iii).$t$::text)
              when 16 then to_jsonb($t$• At wrapping, the record takes the pack date and the number of units packed. The film or vacuum bag touches the cake and is food-contact packaging: its lot is written when the maker prints one, and when none is printed the date that film was received is written instead, which FRM-301 ties to its supplier. The boxes the sealed cakes go into are outer packaging and are not traced (SQF 2.6.2.1 ii).$t$::text)
              when 17 then to_jsonb($t$• Whichever way it is filled in, the FRM-520 entry is the record. A photo of a paper prep sheet may be attached to it but is not required; a paper sheet that was used is kept with the batch records under SOP-2.2.3 (SQF 2.6.2.1).$t$::text)
              else p end order by i)
            from jsonb_array_elements(content->'procedure') with ordinality e(p, i)))
 where sop_number = 'FSQM-021' and status = 'draft';

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections}', (
         select jsonb_agg(
                  jsonb_set(s, '{fields}', coalesce((
                    select jsonb_agg(
                             case f->>'id'
                               when 'how_this_works' then f || jsonb_build_object('text', $t$Fill this in as the product is made - on a tablet on the floor, or from the printed prep sheet within one working day. Every ingredient, the pan spray and any rework go in the table with the lot printed on its container. A photo of a paper sheet may be attached below but is not required.$t$::text)
                               when 'recorded_by' then f || jsonb_build_object('label', 'Recorded by', 'statement', $t$The lots and quantities in this entry are the ones used.$t$::text)
                               else f end order by fo)
                      from jsonb_array_elements(s->'fields') with ordinality x(f, fo)
                     where f->>'id' <> 'paper_photo'), '[]'::jsonb))
                  order by so)
           from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so)))
 where d.sop_number = 'FRM-520' and d.status = 'draft';

do $verify$
begin
  if exists (select 1 from public.sop_documents d, jsonb_array_elements(d.content->'form_schema'->'sections') s,
                           jsonb_array_elements(s->'fields') f
              where d.sop_number = 'FRM-520' and (f->>'id' = 'paper_photo' or f::text ilike '%paper sheet from the floor%')) then
    raise exception 'FRM-520 still requires the paper sheet.';
  end if;
  if (select (content - 'revision_history')::text from public.sop_documents where sop_number = 'FSQM-021') ~* 'photo of the paper sheet is attached|each with a photo|a paper Production Lot Record sheet' then
    raise exception 'FSQM-021 still makes the paper sheet the method.';
  end if;
  if (select jsonb_array_length(content->'procedure') from public.sop_documents where sop_number = 'FSQM-021') <> 28 then
    raise exception 'FSQM-021 procedure length changed.';
  end if;
end $verify$;

commit;
