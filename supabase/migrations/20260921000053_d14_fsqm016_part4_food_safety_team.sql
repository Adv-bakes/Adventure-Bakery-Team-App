-- D-14 task 14.1: FSQM-016 Part 4 - the food safety team.
--
-- Owner, 2026-09-21: the team is Gabriela and Diana, and neither holds a HACCP certificate yet.
-- Written as POSITIONS, not names (documents name positions, records name people - FRM-005 and
-- FSQM-004 hold who is who): SQF Practitioner (Diana, primary per FRM-005) leads; Senior Site
-- Manager (Gabriela, substitute) brings product/formulation and approves. Engineering knowledge is
-- not on the team and is sourced from the equipment manufacturers, which 2.4.3.2 permits.
--
-- The missing HACCP training is stated in the Part itself, as a prose NOT YET HELD line - 2.1.1.5
-- (D-02) is still open, and a Part implying a qualified team would be the one thing an auditor
-- checks first.
--
-- FSQM-016 is a draft, so this is a plain content edit: no revision bump, no history snapshot.
-- Only procedure[14] (the Part 4 placeholder) is replaced; guarded on the md5 of the whole
-- procedure so an edit made in the app since is not overwritten. Attachments are untouched.

begin;

do $guard$
declare st text; h text;
begin
  select status, md5((content->'procedure')::text) into st, h from public.sop_documents where sop_number = 'FSQM-016';
  if st is distinct from 'draft' then raise exception 'FSQM-016 is % - expected draft.', st; end if;
  if h <> '00491b9100b8501f3ab8c5eb939baa97' then
    raise exception 'FSQM-016 procedure changed since this migration was written (md5 %).', h;
  end if;
end $guard$;

update public.sop_documents
   set content = content || jsonb_build_object(
         'procedure',        $q$["Scope", "> The plan starts at the receipt of ingredients and packaging and ends when finished product is collected by the customer's carrier. Every input and output in between - raw materials, packaging, service inputs, the two overnight delays, waste and rework - is shown on the flow diagram in Attachment A (SQF 2.4.3.3).", "Product description", "• Product: rum cake, in several flavours, made for Bahamas Rum Cake Factory. A shelf-stable baked product, stored and distributed at ambient temperature.", "• Composition: cake mix (containing wheat flour, sugar and nonfat dry milk), liquid whole eggs, soybean oil, water and flavour emulsion; after baking, dipped in a syrup of water, sugar and rum.", "• Allergens: wheat, milk, egg and soy, as declared on each flavour's approved label.", "• Packaging: vacuum-sealed pouch in a baking cup, in an individual product box; boxes packed in coded master cases, palletized and stretch wrapped.", "• Shelf life: 12 months, printed on the pack as a Best By month and year.", "• Water activity and pH: not yet measured.", "> Each flavour's finished product specification is its entry on FRM-704, which this description refers to (SQF 2.4.3.4). The product is called shelf stable because of reduced water activity, but that figure has not been measured, and the syrup added after baking returns water and sugar to the product. The measured water activity of the finished, sealed product is to be recorded here before the hazard analysis in Part 7 is written, because it decides whether pathogen growth in the finished product is a significant hazard.", "Intended use", "• Ready to eat; no further cooking by the consumer.", "• General public. The product contains rum. The June 2026 plan cautioned against its use by immunocompromised individuals, infants and pregnant women without physician guidance; the food safety team is to confirm that caution and the vulnerable groups it names (SQF 2.4.3.5).", "Food safety team", "• SQF Practitioner - leads the team. Brings the production process, the equipment and the CCP monitoring as they are performed on the floor.", "• Senior Site Manager - substitute SQF Practitioner. Brings the product, its formulation, raw materials and packaging, and approves this plan.", "• Engineering knowledge is not held on the team. It is taken from the equipment manufacturers' manuals and their service technicians, and the source is named wherever this plan relies on it (SQF 2.4.3.2).", "• Who holds each position is recorded on FRM-005 and in FSQM-004, not here, so that this plan does not have to be reissued when a person changes.", "• The team meets as each remaining Part of this plan is written, and afterwards at least annually for the full review and whenever a change requires one (Part 9). Its decisions are recorded by revising this plan, and the annual review is also recorded on FRM-001.", "> HACCP TRAINING - NOT YET HELD. No member of the team holds a HACCP training certificate. SQF 2.1.1.5 requires the SQF Practitioner to have completed HACCP training, and an auditor checks for it here first. The SQF Practitioner and the Senior Site Manager are each to complete a HACCP course; each certificate is filed on FRM-952 and this Part revised to say so. Until then the team meets 2.4.3.2 in its membership but cannot yet show the competence it asks for.", "Process flow diagram", "• The flow diagram is Attachment A. It shows every step from receipt to dispatch across the three days, every raw material, packaging item and service input, the two scheduled overnight delays, and every output including waste and the one rework loop.", "• The food safety team confirms it on the floor, on each day of the rotation, and records that by dating and signing the confirmation block on the diagram. That signed block is the confirmation SQF 2.4.3.6 requires.", "• The diagram is re-confirmed whenever the process, equipment or rotation changes, and at the annual review of this plan.", "> FSQM-039 Facility Layout and Product Flow shows where equipment stands and where product goes on the floor. It is not this flow diagram and is not offered as one.", "Hazard significance methodology", "> NOT YET WRITTEN - workbook task 14.4. How the likelihood and severity of a hazard decide whether it is significant, written before the hazard analysis and applied the same way to every step (SQF 2.4.3.8).", "Hazard analysis and control measures", "> NOT YET WRITTEN - workbook tasks 14.5 and 14.6. Every biological, chemical and physical hazard reasonably expected at each step on Attachment A, its significance under Part 6, and the control measure for each significant hazard (SQF 2.4.3.7 to 2.4.3.9). Until this Part is written, the hazard analysis in the June 2026 plan remains the one in force.", "Critical control points", "• CCP 1 - Baking: oven at least 350°F for at least 27 minutes, recorded on FRM-507 CCP 1 Baking Monitoring Record. The June 2026 plan also sets an internal temperature of at least 180°F at the end of the bake; the product is not probed today, and FRM-507 records that.", "• CCP 2 - Vacuum sealing: every pouch sealed intact with no leak, channel, wrinkle or partial seal, checked with the pull test, recorded on FRM-606 CCP 2 Vacuum Sealing Monitoring Record. The vacuum level and seal width for the site's machine are not yet confirmed.", "• A failed limit stops the step. The affected product is held on FRM-702 and dispositioned under FSQM-018, and the cause is corrected under FSQM-009 on FRM-007 (SQF 2.4.3.13).", "> The CCPs are carried forward from the June 2026 plan so that they are monitored and recorded while this plan is rebuilt. They are re-determined from the hazard analysis in Part 7 and their critical limits validated under workbook tasks 14.7 to 14.9 (SQF 2.4.3.10 and 2.4.3.11); this Part is revised then.", "Verification and review", "• The CCP records are reviewed and signed weekly under FSQM-017 (SQF 2.4.3.15 and 2.4.3.16).", "• The food safety team reviews this plan in full at least annually, and whenever the product, ingredients, process, equipment or packaging changes in a way that could affect food safety (SQF 2.4.3.14 and 2.3.1.3)."]$q$::jsonb,
         'revision_history', $q$New - 2026-09-21 - DRAFT, under D-14. Created so the rebuilt plan has a controlled home while it is written, and so the flow diagram (task 14.2) can be attached to it as Attachment A.

WHAT IS WRITTEN: scope, product description, intended use, the flow diagram Part, the CCPs as they are monitored today, and verification.

WHAT IS NOT: Parts 4, 6 and 7 are marked NOT YET WRITTEN and name the workbook task that writes each. A plan that read as complete before its hazard analysis existed would be the defect the gap assessment found, repeated.

The number FSQM-016 was reserved for this plan in the remediation workbook on 2026-09-04, after FSQM-013 went to the Module 11 exemption analysis.

New (draft) - 2026-09-21 - Part 4 written (workbook task 14.1). The team is two positions, SQF Practitioner and Senior Site Manager, with engineering advice taken from equipment manufacturers. Positions are named, not people. Neither member holds a HACCP certificate yet, and Part 4 says so rather than implying a qualified team.$q$::text)
 where sop_number = 'FSQM-016';

do $verify$
declare c jsonb; p jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-016';
  p := c->'procedure';
  if jsonb_array_length(p) <> 37 then raise exception 'procedure is % lines, expected 37.', jsonb_array_length(p); end if;
  if (select count(*) from jsonb_array_elements_text(p) l where l like '%NOT YET WRITTEN%') <> 2 then
    raise exception 'expected 2 NOT YET WRITTEN Parts left (6 and 7).';
  end if;
  if p::text like '%workbook task 14.1%' or p::text not like '%HACCP TRAINING - NOT YET HELD%' then
    raise exception 'Part 4 not replaced, or the training gap not stated.';
  end if;
  if jsonb_array_length(c->'attachments') <> 2 then
    raise exception 'Attachment A (2 files) is no longer attached.';
  end if;
  raise notice 'FSQM-016 Part 4 written: % procedure lines, Parts 6 and 7 still to write.', jsonb_array_length(p);
end $verify$;

commit;
