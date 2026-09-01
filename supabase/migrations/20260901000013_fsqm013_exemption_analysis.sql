-- D-13 task 13.6: FSQM-013 Module 11 Applicability & Exemption Analysis, and the FSQM-012 edits
-- that point at it. One transaction.
--
-- 2.4.2.1 permits exempting a Module 11 Good Manufacturing Practice only "according to a written
-- risk analysis outlining the justification for exemption or evidence of the effectiveness of
-- alternative control measures". FSQM-012 was issued saying no exemption is claimed until such an
-- analysis exists. This is that analysis, and FSQM-012 now names it.
--
-- THE THREE-WAY CLASSIFICATION IS THE SUBSTANCE OF THIS DOCUMENT, not presentation. Lumping every
-- departure together as "exempt" would overstate what the site claims:
--
--   B  NOT ENGAGED       - the clause is conditional in its own wording ("if required", "in
--                          high-risk areas", "where such systems are used") and the condition is
--                          not met. NOT an exemption: nothing is set aside, the clause has no
--                          subject. Calling it one invites an auditor to ask which risk assessment
--                          supports the exemption, when the honest answer is that none is needed.
--   C  ALTERNATIVE       - the clause applies on its face and something else achieves the outcome
--      CONTROL             it protects. This is what 2.4.2.1 actually exists for, and it carries
--                          the burden: what the clause protects, what the site does instead, why
--                          that is equivalent, and how it is verified.
--   D  UNDETERMINED      - classification depends on a site fact nobody has stated. Listed openly
--                          rather than defaulted to "applies", because an undetermined clause is
--                          not a passed clause.
--
-- Everything not listed is category A - it applies and the site meets it. Silence is not exemption.
--
-- WHAT THE ANALYSIS TURNED UP. Four category B entries (11.3.2.4, 11.3.5.3, 11.7.1.1-.5, 11.3.5.5),
-- all resting on two site facts the owner confirmed: no designated high-risk area, and no process
-- needing showers. Two category C entries, both carried over from FSQM-012: the break room utensil
-- sink and the paper towel dispenser.
--
-- AND SIX UNDETERMINED, OF WHICH ONE MATTERS MORE THAN THE REST. 11.7.4.1 is NOT conditional - it
-- requires the responsibility, methods and frequency for using screens, sieves, filters "or other
-- technologies" to remove or detect foreign matter to be documented and implemented. No sieve,
-- sifter, screen, filter, magnet or metal detector appears on FRM-004 or in any procedure. That is
-- either a piece of equipment missing from the register, or a category C entry needing a real
-- justification for what controls foreign matter instead. Note the asymmetry the document records:
-- 11.7.4.2/.3/.4 ARE conditional and fall to B if the answer is "none", but 11.7.4.5 - the response
-- to a foreign matter contamination - applies either way.
--
-- The other five are ordinary scope questions: ice in processing (11.5.4), thawing (11.7.2),
-- whether compressed air contacts food or food-contact surfaces (11.5.5 - the site HAS compressed
-- air, FSQM-012 Part 8 racks the hoses), online inspection (11.1.4.1), water treatment (11.5.2).
--
-- FRM-913 FEEDS THIS DOCUMENT BY DESIGN. Every N/A row on the monthly inspection requires a written
-- reason, and those rows are reviewed against this analysis after each inspection. The form was
-- built in 20260901000012 to collect exactly this input rather than leave somebody reconstructing
-- it later.
--
-- FSQM-012 changes in three places only: the Part 1 bullet now names FSQM-013 as where a
-- determination is recorded; form_references gains FSQM-013; and the revision history's
-- "CARRIED INTO THE MODULE 11 EXEMPTION ANALYSIS" note becomes a statement that they HAVE been
-- carried, with the document that holds them. Its procedure stays at 92 lines - the assertion
-- checks that, because this migration has no business changing the program's content.
--
-- Both stay draft; they issue together under INT-7.
--
-- Guarded: FSQM-013 must not already exist, and FSQM-012 must be the 92-line draft carrying the
-- pre-13.6 wording this migration replaces.

begin;

do $$
declare
  st    text;
  lines int;
  old   boolean;
begin
  if exists (select 1 from public.sop_documents where sop_number = 'FSQM-013') then
    raise exception 'FSQM-013 already exists.';
  end if;

  select status, jsonb_array_length(content->'procedure'),
         content->>'revision_history' like '%CARRIED INTO THE MODULE 11 EXEMPTION ANALYSIS%'
    into st, lines, old
    from public.sop_documents where sop_number = 'FSQM-012';

  if st is null then
    raise exception 'FSQM-012 does not exist - run the earlier D-13 migrations first.';
  end if;
  if st <> 'draft' then
    raise exception 'FSQM-012 is % - this migration edits a draft.', st;
  end if;
  if lines <> 92 or not old then
    raise exception 'FSQM-012 is not the version this migration was derived from (% procedure lines, pre-13.6 carry-forward note present=%). Re-derive before applying.', lines, old;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-013',
  'Module 11 Applicability & Exemption Analysis',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '2.4.2.1, 2.4.2.2, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8',
  true,
  $j013$
{
  "purpose": "To record, as SQF 2.4.2.1 requires, which Good Manufacturing Practices in Module 11 of the SQF Food Safety Code: Food Manufacturing apply at this site, which are not engaged because the clause's own condition is not met, and which are met by an alternative control — with the justification or the evidence of effectiveness in each case.",
  "scope": "Covers all 175 clauses across the 34 subsections of Module 11.\n\nCompanion to FSQM-012, the Good Manufacturing Practices Program, which states what the site does. This document states what the site does not do, and why that is defensible.\n\nVerified through the monthly inspection recorded on FRM-913, whose N/A rows and their written reasons are the input to this analysis.",
  "definitions": "Applies (A) — the requirement is in scope and the site meets it. Not recorded here; the evidence is the completed inspection.\n\nNot engaged (B) — the clause is conditional in its own wording and the condition is not met. Not an exemption: nothing is set aside, the clause has no subject.\n\nAlternative control (C) — the clause applies on its face and something other than the literal measure achieves the outcome it protects. This is what 2.4.2.1 means by evidence of the effectiveness of alternative control measures.\n\nUndetermined (D) — classification depends on a fact about the site that has not yet been stated. An undetermined clause is not a passed clause.",
  "responsibility": "SQF Practitioner — owns this analysis, approves every classification before it takes effect, and reviews the N/A rows from each monthly inspection against it.\nQuality Team — records N/A rows on FRM-913 with a written reason, which is what keeps this document current.\nManagement team — approves this analysis at issue and at each annual review.",
  "procedure": [
    "HOW A MODULE 11 REQUIREMENT IS CLASSIFIED (SQF 2.4.2.1)",
    "• 2.4.2.1 requires that every applicable Module 11 Good Manufacturing Practice is **applied, or exempted according to a written risk analysis** giving the justification for the exemption or evidence that an alternative control keeps food safety uncompromised. This document is that analysis. Module 11 is 175 clauses across 34 subsections; the default is that a clause applies, and only a departure needs an entry here.",
    "• **A — Applies.** The site meets the requirement. No entry in this document. This is almost all of Module 11, and the evidence is the completed inspection on **FRM-913**.",
    "• **B — Not engaged.** The clause is conditional in its own wording — *if required*, *where required*, *in high-risk areas*, *where such systems are used* — and the condition is not met here. **This is not an exemption**, and calling it one would overstate what the site is claiming: nothing is being set aside, the clause simply has no subject. It is still written down, with the fact that makes the condition false, because an auditor will ask and a determination nobody recorded is indistinguishable from one nobody made.",
    "• **C — Alternative control.** The clause applies on its face, the site does not do the literal thing it names, and something else achieves the outcome the clause protects. **This is the case 2.4.2.1 actually exists for**, and it carries the heaviest burden: the entry must say what the clause is protecting, what the site does instead, and why that is equivalent — not merely that it is convenient.",
    "• **D — Undetermined.** A classification that depends on a fact about the site nobody has yet stated. Listed openly rather than defaulted to A. An undetermined clause is not a passed clause, and the honest place to resolve it is the first inspection.",
    "HOW THIS ANALYSIS IS MAINTAINED",
    "• Every classification is approved by the **SQF Practitioner** before it takes effect. An undocumented exemption is a non-conformance against 2.4.2.1 regardless of how reasonable it is.",
    "• **FRM-913 feeds this document.** Every row a person marks N/A on the monthly inspection requires a written reason on the form; those rows and reasons are reviewed against this analysis after each inspection, and anything not already classified here is added.",
    "• Reviewed **annually**, and immediately whenever the process, product range, equipment or facility changes — because most of the entries below are true only while a fact about the site stays true. A category B entry becomes category A the moment the site starts doing the thing.",
    "CATEGORY B — NOT ENGAGED (the clause's own condition is not met)",
    "• **11.3.2.4 — Additional facilities in high-risk areas** (hands-free taps; hand sanitizers). The site operates **no designated high-risk processing area**, confirmed 2026-09-01. The clause is scoped to high-risk areas and has no subject here. Should such an area be established, these facilities are provided before that processing begins — as FSQM-012 Part 3 already states.",
    "• **11.3.5.3 — High-risk change areas.** Same fact, same reasoning. FSQM-012 Part 7 carries the same commitment.",
    "• **11.7.1.1 to 11.7.1.5 — High-Risk Processes** (controlled conditions, annual ambient air testing, dedicated staff, change into clean clothing on entry, product transfer points). The site processes no high-risk food. Five clauses, one fact.",
    "• **11.3.5.5 — Showers.** The clause reads *where required, a sufficient number of showers shall be provided*. Nothing in the processes performed here — mixing, depositing, baking, packing — requires a shower on entry or exit. Not provided, and not required.",
    "CATEGORY C — ALTERNATIVE CONTROL (the clause applies; something else meets it)",
    "• **11.3.2.3 (iii) — Paper towels in a hands-free, cleanable dispenser.** What the clause protects is clean hands on the way to being dried: hands washed and then pressed against a housing that dirty hands last touched are no longer clean. **The site's dispenser has no no-touch mechanism**, but a towel is taken without contacting the housing or anything else, so no member of staff need touch the dispenser to dry their hands — the outcome the clause is after is achieved. Soap exceeds its own requirement: 11.3.2.3 (ii) asks only for a fixed dispenser, and the site's is hands-free. **Evidence of effectiveness:** the drying step is verified at each monthly inspection under 11.3.2, and any dispenser that cannot be used without contact is replaced.",
    "• **11.3.5.9 (iii) — A sink in the break room serviced with hot and cold potable water for washing utensils.** The break room has none. **Nothing is washed up in it:** the utensils provided are disposable, and any re-usable personal item a member of staff brings is taken home to be washed rather than washed on site. The requirement has no object here — this is not a handwash basin standing in for a utensil sink, it is that there are no utensils to wash. Used personal items are kept in the owner's locker or bag until they leave, not left out in the room. **Evidence of effectiveness:** the break room's condition is inspected under 11.3.5 monthly, and the determination fails the moment re-usable utensils are introduced.",
    "CATEGORY D — UNDETERMINED (a site fact is needed before these can be classified)",
    "• **11.7.4.1 — Screens, sieves, filters or other foreign-matter technologies.** This clause is **not conditional**: it requires the responsibility, methods and frequency for using such technologies to be documented and implemented. No sieve, sifter, screen, filter, magnet or metal detector appears on the equipment register (FRM-004) or in any procedure. Either the site uses one that is not registered — in which case it belongs on FRM-004 and in an SOP — or it uses none, in which case this is a **category C entry** and needs a written justification explaining what controls foreign matter instead. **This is the most consequential open line in this document** and the one an auditor is most likely to open. Note that 11.7.4.2, .3 and .4 *are* conditional (*where detection and/or removal systems are used*) and fall to category B if the answer is none; and **11.7.4.5 applies regardless** — the response to any foreign-matter contamination, which is a control the site must have either way.",
    "• **11.5.4.1 to 11.5.4.3 — Ice Supply.** Scoped to ice *provided for use during processing operations, as a processing aid, or an ingredient*. Confirm whether ice is used in any of those ways. Ice merely consumed by staff is not in scope.",
    "• **11.7.2.1 to 11.7.2.3 — Thawing of Food.** Confirm whether anything is thawed as part of the process. The frozen product the site once made has been discontinued, which suggests not, but a discontinued product is not a documented determination.",
    "• **11.5.5.1 and 11.5.5.2 — Air and Other Gases.** The site **does** use compressed air; FSQM-012 Part 8 requires the hoses to be racked after use. These clauses are scoped to air or gases *that contact food or food contact surfaces*. Confirm whether the compressed air is ever used on product, on a food-contact surface, or to blow out equipment — if so they apply in full, and the air needs to be clean and monitored.",
    "• **11.1.4.1 — Inspection / Quality Control Area.** Reads *if online inspection is required*. Confirm whether any online product inspection is performed on the line.",
    "• **11.5.2.1 to 11.5.2.3 — Water Treatment.** Reads *if required*. Confirm whether the site treats its water or uses municipal potable supply as delivered. If untreated, these fall to category B and 11.5.3 Water Quality carries the testing obligation instead.",
    "WHAT THIS DOCUMENT DOES NOT CLAIM",
    "• Every Module 11 clause not listed above is **category A — it applies, and the site meets it**. Silence here is not an exemption. If a clause turns out not to be met, that is a finding on FRM-913 and a corrective action, not a retrospective entry in this analysis.",
    "• This analysis records determinations of scope. It does not lower any requirement, and it does not substitute for the inspection that verifies the requirements which do apply."
  ],
  "form_references": "FRM-913 — GMP / Food Safety Inspection Record (its N/A rows feed this analysis)\nFRM-004 — Equipment Register (what the site actually operates)\nFSQM-012 — Good Manufacturing Practices Program (what the site does)\nFSQM-022 — Food Safety Monitoring Program (how the inspection is run)",
  "records": "This analysis, with the approval of each classification, retained for the life of the determination plus one audit cycle.\nThe N/A rows and their reasons on completed FRM-913 records, retained per the record retention policy.\nAnnual review of this analysis, minuted with the management review.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.4.2.1 (Module 11 GMPs applied or exempted according to a written risk analysis outlining the justification for exemption or evidence of the effectiveness of alternative control measures) and 2.4.2.2 (GMPs documented and implemented).\nSQF Food Safety Code: Food Manufacturing, Edition 9 — Module 11 in full.\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.",
  "revision_history": "New — 2026-09-01 — Initial issue, under D-13 task 13.6.\n\nWritten because 2.4.2.1 permits exempting a Module 11 requirement only on a documented risk analysis, and FSQM-012 was issued stating that no exemption is claimed until such an analysis exists. This is that analysis, and FSQM-012 now references it.\n\nTHE THREE-WAY CLASSIFICATION IS THE POINT. Lumping every departure together as an exemption would overstate what the site claims. A clause scoped to high-risk areas at a site with no high-risk area is not being set aside — it has no subject — and saying otherwise invites an auditor to ask what risk assessment supports the exemption, when the honest answer is that none is needed. Separating that from a genuine alternative control keeps the burden of justification where 2.4.2.1 puts it.\n\nSIX CLAUSES OR GROUPS ARE UNDETERMINED and listed as such rather than defaulted to applies. The most consequential is 11.7.4.1, which is NOT conditional and requires foreign-matter removal or detection technology to be documented and implemented: no sieve, screen, filter, magnet or metal detector appears on FRM-004 or in any procedure. That is either an unregistered piece of equipment or a category C entry needing a real justification, and it is the line most likely to be opened at audit.\n\nOPEN BEFORE ACTIVATION — the six category D items need a site answer: foreign-matter technology (11.7.4.1); whether ice is used in processing (11.5.4); whether anything is thawed (11.7.2); whether compressed air contacts food or food-contact surfaces (11.5.5); whether online inspection is performed (11.1.4.1); and whether water is treated (11.5.2). Each is a fact somebody at the site knows. Until they are answered this analysis is honest but incomplete, which is the correct state for it to be in — the alternative is guessing and calling it a determination.\n\nStatus stays draft. Issues with the other FSQM documents under INT-7."
}
$j013$::jsonb
);

update public.sop_documents
   set content = $j012$
{
  "scope": "Applies to all persons entering food handling, processing or storage areas at the Adventure Bakery facility — employees, temporary staff, contractors, maintenance personnel, auditors, visitors and management.\n\nThis program is the umbrella document for SQF Food Safety Code: Food Manufacturing, Edition 9, Module 11.3 (Personnel Hygiene) and Module 11.4 (Personnel Processing Practices). The remaining Module 11 GMPs are implemented through documents that already exist and are referenced here rather than restated:\n\nPre-operational inspection and release — SOP-11.2.12, recorded on FRM-903.\nEquipment and utensil cleaning — SOP-901 to SOP-906 (SSOPs).\nSanitation schedule and verification — FRM-901, FRM-902, FRM-903.\nGlass and brittle plastic — SOP-11.7.3, FRM-907, FRM-908.\nAllergen changeover — SOP-204.\nSite food safety inspections — FSQM-022.\nTraining and records — SOP-2.9, FRM-952, FRM-953, REP-951.\n\nNot covered here: premises and equipment construction (11.2), water, ice and air (11.5), storage and transport (11.6), and separation of functions (11.7) other than glass control.",
  "purpose": "To document the Good Manufacturing Practices applied at Adventure Bakery, LLC — personnel health and hygiene, handwashing, clothing and personal effects, visitors and contractors, staff amenities, and processing practices — and to state how each is implemented, verified and trained, so that food safety is controlled and assured across the scope of certification.",
  "records": "Visitor sign-in and GMP acknowledgement — FRM-905 and FRM-906, retained a minimum of 12 months.\nDaily pre-operation and amenity check — FRM-903, retained per the record retention policy.\nPeriodic GMP and food safety inspections and their corrective actions — per FSQM-022, retained per the record retention policy.\nRisk assessments for permitted jewellery exceptions — held by the SQF Practitioner with this program, for as long as the exception stands plus one audit cycle.\nIllness, injury and bodily-fluid incident dispositions — held by QA, retained per the record retention policy.\nTraining assignment, completion and competency — Team Portal, FRM-952, FRM-953 and REP-951, retained per SOP-2.9.",
  "procedure": [
    "SCOPE AND APPLICATION OF GOOD MANUFACTURING PRACTICES (SQF 2.4.2.1, 2.4.2.2)",
    "• The Good Manufacturing Practices set out in Module 11 of the SQF Food Safety Code: Food Manufacturing apply in full to the scope of certification — the manufacture, baking, packing and storage of baked products at this facility.",
    "• **No exemption from any Module 11 requirement is claimed by this program.** Where the site determines that a requirement does not apply, or that an alternative control achieves the same outcome, that determination is recorded in **FSQM-013** (Module 11 Applicability & Exemption Analysis) as a written risk analysis stating the justification or the evidence of effectiveness, approved by the SQF Practitioner, **before** it takes effect. An undocumented exemption is a non-conformance against 2.4.2.1.",
    "• The GMPs in Module 11.3 and 11.4 are stated in Parts 2 to 8 below. The remaining Module 11 GMPs are implemented through the documents listed in the Scope: SOP-11.2.12 and FRM-903 (pre-operational inspection), SOP-901 to SOP-906 (equipment and utensil cleaning), FRM-901 and FRM-902 (sanitation schedule and verification), SOP-11.7.3 with FRM-907 and FRM-908 (glass and brittle plastic), SOP-204 (allergen changeover), FSQM-022 (site food safety inspections), and SOP-2.9 (training and records).",
    "HEALTH, ILLNESS AND INJURY (SQF 11.3.1.1, 11.3.1.2, 11.3.1.3)",
    "• Personnel known to be carriers of an infectious disease that presents a health risk to others shall not engage in processing or packing food, and shall not enter storage areas where food is exposed.",
    "• Staff shall report to their supervisor, **before starting work**, any of: vomiting, diarrhoea, jaundice, fever with sore throat, discharge from the eyes, ears or nose, or an infected wound, boil or sore. A person reporting any of these shall not enter a food handling or processing area.",
    "• A person excluded under this Part returns to food handling work only when free of symptoms and cleared by their supervisor.",
    "• **Exposed cuts, sores or lesions** — personnel with these shall not handle exposed product, primary (food-contact) packaging, or food-contact surfaces. Minor cuts or abrasions on exposed skin shall be covered with a **coloured, metal-detectable bandage** or an equivalent waterproof, coloured dressing; where the injury is on the hand, a glove shall be worn over the dressing. A lost dressing is treated as a foreign-material incident and reported immediately.",
    "• Staff shall not cough, sneeze or spit over product, ingredients, packaging or food-contact surfaces, and shall wash their hands afterwards.",
    "• **Spillage of bodily fluid** — the area is cleared, and a trained staff member ensures every affected area is cleaned and sanitized and that all affected materials and product are quarantined or disposed of. The incident and its disposition are recorded.",
    "HANDWASHING (SQF 11.3.2.1 to 11.3.2.6)",
    "• **Hands shall be clean.** All staff, contractors and visitors shall wash their hands: (i) on entering a food handling or processing area; (ii) after each visit to a toilet; (iii) after using a handkerchief or tissue; (iv) after smoking, eating or drinking; and (v) after handling wash-down hoses, cleaning materials, dropped product or contaminated material.",
    "• Hands shall also be washed after handling waste, after touching the face, hair or clothing, and after handling a mobile phone.",
    "• **Method** — wet hands with potable water, apply liquid soap, lather and scrub all surfaces including between the fingers and under the nails for at least twenty seconds, rinse, and dry with a single-use paper towel.",
    "• **Gloves do not replace handwashing.** Hands are washed before gloves are put on and at every trigger listed above; gloves are changed, not washed, at those points.",
    "• **Handwashing stations — three are provided:** one in each of the two lavatories, and one immediately inside the personnel access point into the production area from the office, break room and reception. Each is supplied with hot and cold running potable water, a paper towel dispenser, and a bin for used paper towels.",
    "• **Soap is supplied from a hands-free dispenser** — more than the fixed dispenser 11.3.2.3 (ii) asks for. **Paper towels are presented so that a towel can be taken without touching the dispenser housing or anything else.** What 11.3.2.3 (iii) is protecting is clean hands on the way to being dried: hands washed and then pressed against a housing that dirty hands last touched are no longer clean. Taking the towel without contact meets that, and no member of staff need touch the dispenser to dry their hands.",
    "• **The basins are ceramic** — impervious, non-corrosive and easily cleaned, which is what 11.3.2.3 means by \"stainless steel or similar non-corrosive material\". Ceramic is also **brittle**, so a ceramic fixture inside a food handling area is controlled as a brittle item: listed on **FRM-907** (Glass & Brittle Plastic Register) and inspected for chips and cracks with the rest of that register under **SOP-11.7.3**. A chipped basin over a hand-washing point is a foreign-material route, not just a maintenance job.",
    "• **One station serves the production floor**, immediately inside its personnel access point, which is the floor's only entrance from non-production space. 11.3.2.2 asks for further stations throughout food handling and processing areas *as required*; at this floor's size and layout one is sufficient, and that judgement is revisited if the layout changes or the floor grows.",
    "• Handwashing stations are for handwashing only. They shall not be used to wash equipment, utensils or cloths.",
    "• **Signage** instructing people to wash their hands before entering food processing areas is displayed in a prominent position in the break room, at the break room exit, in both toilet rooms and at the entrance to production, **in English and Spanish** — the languages understood by site personnel, consistent with FSQM-002.",
    "• The site operates **no designated high-risk processing area**. Where such an area is established, hands-free taps and hand sanitizers shall be provided at its handwashing stations (11.3.2.4).",
    "CLOTHING, HAIR AND PROTECTIVE WEAR (SQF 11.3.3.1 to 11.3.3.7)",
    "• **Basis of this policy — the risk analysis required by 11.3.3.1.** The hazards the clothing and hair policy controls are: hair and beard hair falling into open product; fibres, buttons, drawstrings and other loose components detaching from garments; soil, dust and organic matter carried in from outside the facility on clothing and footwear; microbiological transfer from street clothing and from garments stored against product or packaging; and allergen carry-over on protective clothing worn across a changeover. The controls chosen against those hazards are: full hair and beard containment in every area where product is exposed; site-designated outer garments that are smooth, cleanable and free of external components that can detach; footwear controlled at the point of entry so external soil does not reach the floor; separation of street clothing from clean protective clothing and from all food and packaging; and removal or change of protective clothing at changeovers and whenever it becomes a contamination risk. This analysis is reviewed whenever the process, the product range or the facility layout changes.",
    "• Wear clean, designated outer garments, and arrive at the facility in clean clothing free of soilage or foul odour. Change lab coats if they become soiled.",
    "• Wear hairnets so both ears are covered and all hair is contained; wear a beard net covering all facial hair while in production and storage areas.",
    "• Clothing, including shoes, shall be clean at the start of each shift and maintained in a serviceable condition. Excessively soiled uniforms shall be changed or replaced as soon as they present a contamination risk — not at the end of the shift.",
    "• Wear pants that fully cover the torso and ankles; wear a belt if pants sag.",
    "• **Footwear is controlled by sanitizing foot baths, and every person passes through them.** There are two: one at the entrance to the production area from the office, break room and reception, and one at the walkthrough between the production area and the inventory and packaging area. External soilage — dirt, faecal matter, decomposing material or other foreign matter — shall not be carried into production or storage areas.",
    "• **Foot bath strength — Noble Sani-512 at 1:160**, which is 4.0 fluid ounces of product per 5 gallons of water, or 0.8 fl oz per gallon. **This is deliberately stronger than the 1:512 food-contact dilution** used on equipment and utensils in the SSOPs. A foot bath carries heavy organic soil off the floor, and that soil consumes quat: made up at the weaker food-contact ratio the solution deactivates and leaves footwear unsanitized. **The two strengths are for two different jobs — never make a foot bath at the food-contact dilution, and never sanitize a food-contact surface at the foot-bath dilution.** The foot-bath dilution is not a no-rinse food-contact strength.",
    "• **The two dilutions are made up into separate, clearly labelled containers**, so the foot-bath solution and the food-contact solution are never drawn from the same vessel. That labelling is the control which keeps two strengths of one product from reaching the wrong job — the solutions look identical, and only the label distinguishes them.",
    "• **Foot bath maintenance — the check is scheduled, the change is conditional.** Each bath is checked **at the start of every production day**: looked at, and read with a quat test strip. The solution is **changed when the strip reads below target, when the bath is visibly soiled, or when it has been diluted** by water carried in on footwear or by washdown. It is not replaced on a fixed schedule — a bath still at strength and still clean is doing its job, and dumping it regardless spends chemical without adding control. The baths are stripped and thoroughly cleaned **monthly**, and sooner if required.",
    "• The daily check is what makes the conditional change a control rather than a guess. The soil a bath lifts off the floor is exactly what spends the quat, so an unchecked bath is weaker than its label says however carefully it was mixed — and nobody can tell by looking at it. **The strip must be able to read this solution:** at 1:160 the bath is roughly three times the strength of the 1:512 food-contact solution, so the 0-400 ppm strips used on food-contact surfaces will saturate and read \"high\" whatever the true value. A high-range quat strip is required for the baths. The daily check is recorded on **FRM-903**; the monthly strip-down is scheduled on **FRM-901**.",
    "• **Disposable gloves and aprons shall be changed after each break, on every re-entry to the processing area, and whenever damaged.** They are not washed and re-used.",
    "• Non-disposable aprons and gloves shall be cleaned and sanitized as required. When not in use they are stored on the racks provided in the processing area, or in designated sealed containers in personnel lockers. They shall **never** be placed or stored on packaging, ingredients, product or equipment.",
    "• Protective clothing shall be made from material that poses no food safety threat and is easily cleaned. It shall be cleaned after use, or at a frequency that controls contamination, and stored clean and serviceable so that it cannot pick up microbiological or allergen contamination between uses.",
    "• **Laundering — aprons and other protective clothing are laundered by employees at home**, with laundry detergent, and hung to dry. Home laundering is permitted, and these conditions apply to it: the garment is laundered after each use, or sooner if it becomes soiled; washed separately from heavily soiled household laundry; dried and kept in a clean, dry place; carried to and from the site in a clean, covered bag; and presented clean at the start of each shift. A garment that cannot be returned to a clean, serviceable condition is replaced rather than worn.",
    "• Racks are provided for the temporary storage of protective clothing when staff leave the processing area, at the **personnel access doorway into production, beside the handwashing station and the foot bath** — so the garment comes off, the foot bath is crossed and the hands are washed at one point rather than three (11.3.3.7).",
    "• Protective clothing is removed before entering toilet rooms, the break room, or any outside area, and is not worn outside the facility.",
    "JEWELLERY AND PERSONAL EFFECTS (SQF 11.3.3.8)",
    "• Do not wear jewellery, cosmetic items, or other objects that might fall into food, equipment or containers — including visible or exposed piercings, watches, earrings, necklaces, bracelets, fingernail polish or hardener, false fingernails and false eyelashes. **Only plain wedding bands with no stones are allowed.**",
    "• **Medical alert items** may be permitted on a case-by-case basis with the permission of Quality and Production supervision. **Items accepted for religious or cultural reasons** follow the same route.",
    "• Every permitted exception shall be covered so it cannot be lost into product, shall meet regulatory and customer requirements, and shall be supported by a **written risk assessment** recorded and retained by the SQF Practitioner with this program. Permitted exceptions are checked at GMP inspection, which is the ongoing risk management 11.3.3.8 requires — a one-time approval is not sufficient.",
    "• Store clothes, mobile phones, personal belongings and other non-food items in lockers or offices only. Personal items are not taken into food handling, processing or storage areas.",
    "VISITORS AND CONTRACTORS (SQF 11.3.4.1 to 11.3.4.4)",
    "• Every visitor — including contractors, maintenance personnel, auditors, suppliers, customers, guests and **management staff** — shall comply with this Part.",
    "• **Sign in on FRM-905** (Visitor Sign-In Log) before entering any food handling, processing or storage area.",
    "• **Read and acknowledge the site's food safety and hygiene rules on FRM-906** (Visitor GMP Acknowledgement) before entry. A visitor who has completed the FRM-906 briefing satisfies the training requirement of 11.3.4.1; **any visitor who has not shall be escorted at all times** by an authorized employee.",
    "• **Remove jewellery and loose objects** in accordance with Part 5. This applies to management staff equally.",
    "• Wear suitable clothing and footwear and the protective wear issued at entry — hairnet, beard cover where applicable, lab coat, and shoe covers or dedicated footwear.",
    "• **Enter and exit through the proper staff entrance points only**, and comply with the handwashing requirements of Part 3 and the processing practices of Part 8.",
    "• Remain within approved areas, and not touch ingredients, packaging, product or equipment unless authorized by the SQF Practitioner.",
    "• **Visitors showing visible signs of illness shall not be permitted to enter** any area where food is handled or processed. The rules of Part 2 apply to visitors as they do to staff.",
    "• **Contractors** additionally: agree the work area and its segregation with the SQF Practitioner or Supervisor before starting; account for all tools, parts and materials before and after the work; and where the work introduces glass or brittle plastic, comply with SOP-11.7.3 and record it on FRM-907.",
    "• Completed visitor records are retained by QA for a minimum of **twelve months**.",
    "STAFF AMENITIES AND WELFARE (SQF 11.3.5.1 to 11.3.5.10)",
    "• Staff amenities — toilet rooms, the break room and changing areas — have documented cleaning procedures, are scheduled on **FRM-901** (Master Sanitation Schedule), and their sanitary condition is confirmed on **FRM-903** at pre-operation. They are lit and ventilated appropriately and are available to every person engaged in handling and processing product.",
    "• **Changing** — staff and visitors change into and out of protective clothing in the toilet rooms, which are of sufficient size for the purpose and are kept clean (11.3.5.2).",
    "• **Street clothing and personal items** are stored in the lockers provided in the break room, which is separate from all food-contact zones and from food and packaging storage (11.3.5.4).",
    "• The site processes no high-risk foods and operates no designated high-risk area, so a high-risk change area (11.3.5.3) is not provided. Showers (11.3.5.5) are not required by the processes performed here. Should either condition change, the provision shall be made before that processing begins.",
    "• **Toilet rooms** are accessible to staff, separate from processing and food handling operations, sufficient in number for the maximum number of staff on site, constructed so they can be easily cleaned and maintained, and kept clean and tidy. **The employee lavatory is reached through a vented airlock** rather than opening onto the processing area (11.3.5.6 ii). Provision is made for storing protective clothing and outer garments while the facilities are in use. **Cleaning tools and equipment used in toilet rooms shall never be used to clean processing areas** and are stored separately and identified for that use only.",
    "• **Handwashing basins** are provided immediately inside or outside the toilet room, to the specification in Part 3.",
    "• **Sanitary drainage** is not connected to any other drain within the premises and discharges to the sewerage system in accordance with regulations.",
    "• The **break room** is separate from all food contact and handling zones, is lit, and is ventilated by the site's heating and cooling system. It has **a refrigerator**, **a microwave for heating food**, and **a table with seating for all employees at one sitting** (11.3.5.9 i, ii, iv). It holds the personal-item lockers and is kept clean and free from waste materials and pests.",
    "• The break room has **no utensil sink** (11.3.5.9 iii), and nothing is washed up in it: **the utensils provided are disposable**, and any re-usable personal item a member of staff brings is taken home to be washed rather than washed on site. The handwash basin in the adjacent lavatory is therefore not standing in for a utensil sink — there are no utensils to wash. Used personal items are kept in the owner's locker or bag until they leave, not left out in the room. This is an alternative arrangement rather than the fixture the clause names, so it is recorded in the Module 11 exemption analysis with this justification, as 2.4.2.1 requires.",
    "• **Staff food is not stored in the production walk-in refrigerator.** Personal food held among ingredients is a contamination and allergen route, which is why the break room carries its own refrigeration rather than borrowing the walk-in.",
    "• Where an outside eating area is provided it is kept clean and free from waste materials and maintained so it does not attract pests or introduce contamination to the site.",
    "PROCESSING PRACTICES (SQF 11.4.1.1 to 11.4.1.4)",
    "• **Entry to processing areas is through the personnel access doors only.**",
    "• **All doors are kept closed.** Doors are not left open for extended periods during waste removal or when receiving product, ingredients or packaging.",
    "• Packaging, product and ingredients are kept in appropriate containers as required and **off the floor**.",
    "• **Waste** is contained in the bins identified for the purpose and removed from the processing area regularly; it is not left to accumulate.",
    "• **Wash-down and compressed air hoses** are stored on the hose racks after use and are not left on the floor.",
    "• Staff shall **not eat or taste any product being processed** in a food handling or contact zone, except under the sensory evaluation controls below.",
    "• **False fingernails, false eyelashes, eyelash extensions, long nails and fingernail polish are not permitted** when handling exposed food.",
    "• **Hair restraints and beard covers** are worn wherever product is exposed.",
    "• **Smoking, chewing, eating and spitting are not permitted** in any area where product is produced, stored or otherwise exposed.",
    "• **Drinking water** is permitted only under conditions that prevent contamination. Containers shall be clear and covered, and kept in designated areas away from raw materials, packaging, tools and equipment storage.",
    "• **Personnel flow** is managed so the potential for contamination is minimized: staff move from cleaner to less clean areas rather than back, do not move between an allergen-handling task and exposed non-allergen product without changing protective clothing and washing hands, and do not take traffic through an exposed-product area as a shortcut between other parts of the facility.",
    "• **Sensory evaluation — product tasting is carried out in the office adjacent to the production area**, which is outside the food handling and contact zones. No tasting of in-process product takes place on the floor (11.4.1.2 i). Product is carried to the office on clean utensils by authorized personnel, and nothing tasted is returned to the process.",
    "• Should it ever become necessary to evaluate within a food handling or contact zone, the site shall ensure that food safety is not compromised; that the evaluation is conducted by authorized personnel only; that a high standard of personal hygiene is practised by those conducting it; that it is carried out in an area equipped for the purpose; and that equipment used for it is sanitized, maintained and stored separately from processing equipment (11.4.1.4).",
    "VERIFICATION (SQF 2.5.4.3)",
    "• **Daily** — the pre-operation inspection under **SOP-11.2.12**, recorded on **FRM-903**, confirms that food-contact surfaces, utensils, production areas and staff amenities are sanitary and that GMP requirements are met before production begins.",
    "• **Periodic** — planned inspections of the site and equipment verify that this program and facility and equipment maintenance comply with the SQF Food Safety Code: Food Manufacturing. Scope, frequency and responsibility are set in **FSQM-022** (Food Safety Monitoring Program).",
    "• Findings are recorded. The site shall take corrections or corrective and preventive action, and shall **maintain records of inspections and of any corrective action taken**.",
    "• Non-compliance with this program by a member of staff or a visitor results in immediate removal from production areas. Repeat violations are documented and handled as a corrective action.",
    "TRAINING (SQF 2.9.2.1 iii and iv, 2.4.2.2)",
    "• Every employee who handles food or food-contact surfaces completes **TRN-002 Personal Hygiene & GMPs**, **TRN-002A Personnel Hygiene & Visitor Policy** and **TRN-002B Good Manufacturing Practices**, available in English and Spanish and assigned in the language the employee is trained in.",
    "• Training is delivered at induction, **before the employee works unsupervised in a food handling area**, and refreshed at the frequency set in **SOP-2.9**.",
    "• Competency is verified on **FRM-952**; attendance on **FRM-953**. Assignment, completion and outstanding training are held in the Team Portal and reported on **REP-951** (Training Matrix).",
    "• Visitors are briefed through **FRM-906**, which is the visitor training required by 11.3.4.1."
  ],
  "definitions": "Food handling / contact zone — any area where product, ingredients, primary packaging or food-contact surfaces are exposed. Includes the production floor, the depositing and packing areas, and open ingredient storage.\n\nProtective clothing — outer garments, hairnets, beard covers, aprons, gloves and dedicated footwear or shoe covers worn to protect product, as distinct from personal clothing.\n\nVisitor — any person entering a food handling, processing or storage area who is not an employee of the site, including contractors, maintenance personnel, auditors, suppliers, customers and guests.\n\nEscorted — accompanied at all times by an authorized employee who is responsible for the visitor's compliance with this program.",
  "responsibility": "SQF Practitioner / QA — owns this program, enforces it, approves exceptions, holds the risk assessments for permitted jewellery, and verifies compliance through GMP inspection.\nSupervisors — ensure staff on their shift comply, act on non-compliance immediately, and receive illness and injury reports.\nAll staff — comply with this program, and report illness, injury and any breach they observe.\nReception / designated staff — ensure every visitor completes FRM-905 and FRM-906 before entry and is escorted or trained.\nMaintenance — maintain handwashing stations, amenities and the facility provisions this program depends on, and correct deficiencies raised by GMP inspection.",
  "form_references": "FRM-905 — Visitor Sign-In Log\nFRM-906 — Visitor GMP Acknowledgement\nFRM-903 — Daily Sanitation, Pre-Operation & Release Record\nFRM-901 — Master Sanitation Schedule (amenity cleaning is scheduled here)\nFRM-907 / FRM-908 — Glass & Brittle Plastic Register / Glass Breakage Incident Report\nFRM-952 / FRM-953 — Training Competency Verification Record / Training Sign-In Sheet\nREP-951 — Training Matrix\nSOP-11.2.12 — GMP / Pre-Operation Inspection\nSOP-11.7.3 — Glass & Brittle Plastic Control\nSOP-204 — Allergen Cleaning Procedure\nSOP-2.9 — Training & Recordkeeping\nFSQM-013 — Module 11 Applicability & Exemption Analysis (what this program does not claim)\nFSQM-022 — Food Safety Monitoring Program",
  "revision_history": "New — 2026-09-01 — Initial issue. Written to close SQF 2.4.2.2, which requires the site's applicable Good Manufacturing Practices to be documented. Covers Module 11.3 and 11.4 in full — thirty-five clauses, of which SOP-11.3 addressed about nine.\n\nSUPERSEDES SOP-11.3 Personnel Hygiene & Visitor Policy. Its dress code, jewellery list, visitor requirements, twelve-month retention and corrective-action clause are carried forward here, extended rather than rewritten. SOP-11.3 remains the active controlled document until this program is approved and issued; it is archived in the same transaction that activates this one, so the site is never without an active personnel hygiene document.\n\nSITE ARRANGEMENTS CONFIRMED 2026-09-01 by Richard Mercer. The facility facts in this program are the site's own answers, not assumptions: three handwashing stations (one in each lavatory, one immediately inside the production access point, which is the floor's only entrance from non-production space) with hot and cold potable water, waste bins, soap from a hands-free dispenser and towels that can be taken without touching the housing; handwash signage in the break room, at its exit, in both toilet rooms and at the production entrance, in English and Spanish; no designated high-risk area; protective clothing laundered by employees at home with detergent and hung to dry; footwear controlled by two sanitizing foot baths, at the production entrance and at the walkthrough to the inventory and packaging area, dosed with Sani-512 at 1:160, made up in separate clearly labelled containers from the 1:512 food-contact solution, and thoroughly cleaned monthly, with the solution changed on condition rather than on a fixed interval; ceramic handwash basins, and the protective clothing rack installed at the production entrance; changing done in the toilet rooms, personal items in break room lockers; the employee lavatory reached through a vented airlock; sanitary drainage separate and compliant; the break room separate from food zones, lit, ventilated, with a refrigerator, a microwave and a table seating all employees at one sitting, and with disposable utensils so nothing is washed up there; no fixed illness exclusion interval — supervisor clearance is the control; product tasting carried out in the office adjacent to production, never on the floor.\n\nOPEN BEFORE ACTIVATION — two items. The forms now carry every check this program states: the daily foot bath check is a grid in section 3 of FRM-903, the monthly strip-down is on the FRM-901 schedule and in its task picker, and the ceramic basin at the production entrance is on the FRM-907 register (FRM-901 rev B, FRM-903 rev v6, FRM-907 rev v2, all effective 2026-09-01). What is left is one confirmation and one purchase.\n1. CONFIRM — the 1:160 figure against the product label. The 1:512 food-contact dilution was checked against the Sani-512 label on 2026-08-25; this foot-bath ratio has not been. A sanitizer used at a dilution its label does not carry is a label-use problem before it is an SQF problem, so confirm 1:160 appears on the label for this use — and while doing it, add the label and SDS to the Chemical Safety Data Sheets collection, which still holds only a generated summary.\n2. ACTION — high-range quat test strips for the foot baths. At 1:160 the bath runs at roughly three times the food-contact strength, which is off the top of the 0-400 ppm strips used on equipment: those will simply read high and tell the checker nothing. FRM-903's foot bath grid now carries that warning on its own label, so the person holding the strip sees it — but the strip still has to exist. Keep it with the baths, separate from the food-contact strips, for the same reason the two dilutions are made up in separately labelled containers.\n\nCARRIED INTO FSQM-013 (Module 11 Applicability & Exemption Analysis), issued 2026-09-01 under task 13.6. Two arrangements meet what a clause protects without being the fixture it names, and both now carry their written justification there: the absent break room utensil sink (11.3.5.9 iii), where nothing is washed up because utensils are disposable and personal items go home; and the paper towel dispenser (11.3.2.3 iii), which has no no-touch mechanism though a towel is taken without contacting the housing. FSQM-013 also records the high-risk clauses this program states are not engaged, and lists six Module 11 questions still needing a site answer.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — Module 11.3 (Personnel Hygiene, 11.3.1.1 to 11.3.5.10) and Module 11.4 (Personnel Processing Practices, 11.4.1.1 to 11.4.1.4).\nSQF Food Safety Code: Food Manufacturing, Edition 9 — System Elements 2.4.2.1 (GMPs applied or exempted by written risk analysis), 2.4.2.2 (GMPs documented and implemented), 2.5.4.3 (planned site and equipment inspections with corrective action and records), and 2.9.2.1 iii and iv (personal hygiene and Good Manufacturing Practices training).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice, in particular §117.10 (Personnel) and §117.20 (Plant and grounds)."
}
$j012$::jsonb
 where sop_number = 'FSQM-012'
   and status = 'draft';

do $$
declare
  n record;
  o record;
begin
  select status, type, revision,
         jsonb_array_length(content->'procedure')                        as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s not like '• %')                              as steps,
         (select count(*) from unnest(array['purpose','scope','definitions','responsibility',
                                            'procedure','form_references','records',
                                            'governing_reference','revision_history']) k
           where content ? k and length(content->>k) > 0)                as filled,
         (content->'procedure')::text like '%CATEGORY B%'                as cat_b,
         (content->'procedure')::text like '%CATEGORY C%'                as cat_c,
         (content->'procedure')::text like '%CATEGORY D%'                as cat_d,
         (content->'procedure')::text like '%11.7.4.1%'                  as foreign_matter,
         (content->'procedure')::text like '%Silence here is not an exemption%' as silence
    into n
    from public.sop_documents where sop_number = 'FSQM-013';

  select status, jsonb_array_length(content->'procedure')                as lines,
         content::text like '%FSQM-013%'                                 as names_013,
         content->>'revision_history' like '%CARRIED INTO THE MODULE 11 EXEMPTION ANALYSIS%' as stale_note,
         content->>'form_references' like '%FSQM-013%'                   as in_refs,
         (content->'procedure')::text like '%recorded in **FSQM-013**%'  as in_part1,
         -- the program's own content must be untouched by this migration
         (content->'procedure')::text like '%sanitizing foot baths%'     as foot_baths,
         (content->'procedure')::text like '%The basins are ceramic%'    as ceramic
    into o
    from public.sop_documents where sop_number = 'FSQM-012';

  if n.status is null then
    raise exception 'FSQM-013 was not created.';
  end if;
  if n.status <> 'draft' or n.type <> 'fsqm' or n.revision <> 'New' then
    raise exception 'FSQM-013 created wrong: status=%, type=%, revision=%.', n.status, n.type, n.revision;
  end if;
  if n.lines <> 28 or n.steps <> 6 then
    raise exception 'FSQM-013 body wrong shape: % lines, % steps (expected 28 / 6).',
      n.lines, n.steps;
  end if;
  if n.filled <> 9 then
    raise exception 'FSQM-013 has % of 9 body sections filled.', n.filled;
  end if;
  if not (n.cat_b and n.cat_c and n.cat_d and n.foreign_matter and n.silence) then
    raise exception 'FSQM-013 content incomplete: B=%, C=%, D=%, 11.7.4.1=%, silence clause=%.',
      n.cat_b, n.cat_c, n.cat_d, n.foreign_matter, n.silence;
  end if;

  if o.lines <> 92 then
    raise exception 'FSQM-012 procedure changed length to % - this migration must not alter the program.', o.lines;
  end if;
  if not (o.names_013 and o.in_refs and o.in_part1) or o.stale_note then
    raise exception 'FSQM-012 not repointed: names FSQM-013=%, in form refs=%, in Part 1=%, stale carry-forward note still present=%.',
      o.names_013, o.in_refs, o.in_part1, o.stale_note;
  end if;
  if not (o.foot_baths and o.ceramic) then
    raise exception 'FSQM-012 regressed earlier content: foot baths=%, ceramic=%.', o.foot_baths, o.ceramic;
  end if;
end $$;

commit;
