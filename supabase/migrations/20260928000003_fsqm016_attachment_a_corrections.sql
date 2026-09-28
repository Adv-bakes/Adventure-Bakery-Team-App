-- D-14: FSQM-016 - Attachment A corrected: the pan release becomes a step, and cooling now precedes
-- depanning.
--
-- Owner, 2026-09-28, reading the flow against the process:
--   (1) "The pans get sprayed with soy bean oil prior to the batter being deposited into the molds. This
--       can be done either before or after or in parallel with the mixing." The drawing had it only as an
--       unnamed input to the depositing step.
--   (2) "Step 8 says to depan before cooling. In reality, the cooling occurs before the depanning."
--   (3) Gabriela: the cool is NOT necessarily overnight - cooling before depanning is what is required,
--       and some batches are depanned later on Day 1, some on Day 2.
--   (4) The syrup is not made every run: making it is conditional on none being in stock, and prepared
--       syrup is held ambient in a sealed container. It has NO hold limit and NO label today, which the
--       drawing now carries as a gap for the hazard analysis (Part 7).
--
-- Attachment A is regenerated OUTSIDE this migration (scratchpad/flow_d14.py -> the .drawio master and
-- the PDF in C:\AdventureBakes). Files cannot be attached by migration, so the owner re-uploads both to
-- FSQM-016's Reference Documents. The drawing now has 20 steps: step 5 sprays the molds, step 6 deposits
-- into them, Day 1 ends on the cooling racks with a delay that runs until the product is cool enough to
-- depan, step 9 depans, step 10 makes syrup only when none is in stock, and CCP 2 vacuum sealing moves
-- from step 11 to step 13 (the scope box's rework sentence was corrected with it).
--
-- Here: the product composition line names the pan release, and the revision history records both
-- corrections. Allergens are unchanged - soy was already declared, and the owner confirmed the finished
-- product label declares it. Both materials are already on FRM-207.
--
-- Draft content edit, guarded on the md5 of the content EXCLUDING attachments, since the owner may be
-- re-uploading the diagram around this.

begin;

do $guard$
declare h text; st text; l text;
begin
  select md5((content - 'attachments')::text), status, content->'procedure'->>4
    into h, st, l from public.sop_documents where sop_number = 'FSQM-016';
  if st is distinct from 'draft' or h <> '5985338fc6ca45680483fd92f2e76508' then
    raise exception 'FSQM-016 is % or changed since this migration was written (md5 %).', st, h;
  end if;
  if l not like '%Composition:%' then raise exception 'procedure[4] is not the composition line: %', l; end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(content, '{procedure,4}', to_jsonb($t$• Composition: cake mix (containing wheat flour, sugar and nonfat dry milk), liquid whole eggs, soybean oil, water and flavour emulsion; the molds are sprayed with a pan release of soybean oil and soy lecithin before depositing; after baking, dipped in a syrup of water, sugar and rum.$t$::text))
                 || jsonb_build_object('revision_history', (content->>'revision_history') || $t$

New (draft) - 2026-09-28 - ATTACHMENT A CORRECTED IN FOUR PLACES, found while the owner and the Senior Site Manager read the flow against the process.

1. THE PAN RELEASE IS ITS OWN STEP. The molds are sprayed with Chef's Quality Pan Spray (soybean oil and soy lecithin) before the batter is deposited; the drawing had shown it only as an unnamed input to depositing. It is now step 5, 'Spray molds with pan release - done before, after or alongside mixing', which is how it is performed, and step 6 deposits into sprayed molds. The composition above names it.

2. COOLING COMES BEFORE DEPANNING. The drawing had the product depanned as it left the oven. In fact the pans go straight onto the cooling racks and the product is turned out once it is cool. Day 1 now ends at 'Remove from oven, place the pans on the cooling racks', and Day 2 opens with step 9, 'Depan - turn the cooled product out of the pans'.

3. THE COOL IS NOT NECESSARILY OVERNIGHT. Gabriela, 2026-09-28: what is required is cooling before depanning, and some batches are depanned later on Day 1 and some on Day 2. The delay now reads 'cool in the pans, covered, at room temperature on the racks, until cool enough to depan', with a note that depanning follows later on Day 1 or on Day 2. Writing it as a fixed overnight delay would have stated a control the site does not work to.

4. MAKING THE SYRUP IS A CONDITIONAL STEP. Syrup is not made every run: step 10 runs only when no prepared syrup is in stock. Syrup kept for a later run is held ambient in a sealed container, and the dip step takes prepared syrup from stock as an input.

OPEN, AND ON THE DRAWING AS A GAP: stored syrup has NO HOLD LIMIT and NO LABEL today. How long it may be held, and what the container says, are decided in the hazard analysis (Part 7). A held food component with neither a limit nor a date is both a food safety question and a traceability one - a dipped batch cannot be tied to the syrup it was dipped in.

The diagram is now 20 steps. CCP 1 baking stays step 7; CCP 2 vacuum sealing moves from step 11 to step 13, and the scope box's rework sentence moved with it.

ALLERGEN: the spray's label declares CONTAINS: SOY, from the soy lecithin. Soy was already declared as an allergen of this product, and the owner confirmed on 2026-09-28 that the finished product label declares it, so nothing about the declaration changes. The pan spray and the bulk soybean oil are separate FRM-207 entries and are separate materials.

THIS IS WHAT CONFIRMING A FLOW DIAGRAM IS FOR (SQF 2.4.3.6): two things the drawing showed differently from how the floor works. The confirmation block on Attachment A is signed against this version, not the one before it.$t$)
 where sop_number = 'FSQM-016';

do $verify$
declare l text; c jsonb;
begin
  select content into c from public.sop_documents where sop_number = 'FSQM-016';
  l := c->'procedure'->>4;
  if l not like '%pan release of soybean oil and soy lecithin%' then
    raise exception 'composition line not updated: %', l;
  end if;
  if jsonb_array_length(c->'procedure') <> 53 then
    raise exception 'FSQM-016 procedure length changed.';
  end if;
  if (c->>'revision_history') not like '%ATTACHMENT A CORRECTED IN FOUR PLACES%'
     or (c->>'revision_history') not like '%NO HOLD LIMIT and NO LABEL%' then
    raise exception 'revision history did not record the corrections.';
  end if;
end $verify$;

commit;
