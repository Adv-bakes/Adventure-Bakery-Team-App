-- FSQM-012 - Good Manufacturing Practices Program. D-13 task 13.1.
--
-- SQF 2.4.2.2 requires the site's applicable Good Manufacturing Practices to be DOCUMENTED and
-- implemented. There is no such document. The number FSQM-012 was reserved in a code comment in
-- 20260821000001_frm903_sqf_reference.sql and never written.
--
-- SCOPE IS THIRTY-FIVE CLAUSES, NOT A HYGIENE PAGE. The remediation plan's note on this row says
-- this is "the umbrella document Module 11 sections 11.3 and 11.4 are audited against" - 11.3.1.1
-- through 11.4.1.4. SOP-11.3 (active) addressed about nine of them: dress code, jewellery, illness
-- and the visitor policy. Unaddressed until now: the five explicit handwash triggers of 11.3.2.1,
-- handwash station provision and signage, the clothing and hair RISK ANALYSIS 11.3.3.1 requires,
-- laundering and protective-clothing storage, glove and apron change rules, change rooms, lockers,
-- toilet rooms, sanitary drainage, break rooms, personnel flow, and sensory evaluation.
--
-- THIS ABSORBS SOP-11.3 RATHER THAN SITTING ON TOP OF IT. An umbrella program plus a floor
-- procedure both stating hygiene rules is two documents that can drift - the failure that left
-- FRM-903's printed blank two revisions behind the app. The ripple was measured before choosing
-- this: NOTHING cites SOP-11.3 by number, in any of the 79 sop_documents rows or anywhere in the
-- repository. Its dress code, jewellery list, visitor requirements, twelve-month retention and
-- corrective-action clause are carried forward here verbatim where the wording was already right.
--
-- *** THIS MIGRATION DOES NOT TOUCH SOP-11.3. ***
-- SOP-11.3 is ACTIVE; FSQM-012 arrives as a DRAFT. Archiving SOP-11.3 now would leave the site with
-- no active personnel hygiene document at all - a worse position than today. Superseding it is a
-- separate migration that flips FSQM-012 to active and archives SOP-11.3 IN ONE TRANSACTION, run at
-- approval time alongside INT-7. The assertion below proves this migration left SOP-11.3 alone.
--
-- IT CLAIMS NO EXEMPTIONS. 2.4.2.1 permits exempting a Module 11 requirement only with a written
-- risk analysis. Rather than assert exemptions it cannot support, Part 1 states that every
-- applicable GMP applies and that an exemption requires a documented, approved risk analysis before
-- it takes effect. Task 13.6 produces that analysis; until it exists, nothing is exempted.
--
-- IT CREATES NO DANGLING REFERENCES. FSQM-022 promises a "Form-0010 Food Safety Inspection" that
-- was never built - that broken reference is the finding behind task 13.4, and repeating the
-- mistake here would be worse than the gap. Every form and procedure named in this document was
-- checked against the live register on 2026-09-01 and exists: FRM-901, FRM-903, FRM-905, FRM-906,
-- FRM-907, FRM-908, FRM-952, FRM-953, REP-951, SOP-2.9, SOP-204, SOP-11.2.12, SOP-11.7.3, FSQM-022.
--
-- 11.3.3.1 IS ANSWERED IN THE BODY, NOT DELEGATED. That clause asks the site to UNDERTAKE a risk
-- analysis behind its clothing and hair policy. Pointing at a document that does not exist would be
-- the FSQM-022 mistake again, so the first bullet of Part 4 IS the analysis: the hazards named, and
-- the control chosen against each.
--
-- FACILITY FACTS GO IN revision_history, NOT AS PLACEHOLDERS IN THE BODY. Twelve statements about
-- the building - how many handwash stations, where the signage is, how uniforms are laundered, what
-- the toilet room access arrangement is - can only be confirmed by the site. Each is written in the
-- body as the arrangement the program requires, with an OPEN BEFORE ACTIVATION list in
-- revision_history. This follows 20260825000005_sop906_mold_hand_wash_ssop.sql: a "TO CONFIRM" note
-- inside an active controlled document is worse than a question somebody owes an answer to. Where
-- the site does not provide something, that is an input to task 13.6, not a silent omission.
--
-- Task 13.2 (visitor and contractor rules) is delivered here as Part 6, as the plan specifies.
--
-- procedure[] is 81 lines: 10 numbered Parts, each followed by its sub-bullets. A line starting
-- with a bullet marker renders as a sub-bullet under the Part above it in both the Document tab
-- (SopBodyEditor) and the PDF (sopPdf) - both route through groupProcedureSteps().
--
-- sqf_reference is at SUBSECTION granularity (11.3.1 ... 11.4.1), one token per Part, not all
-- thirty-eight clause numbers. SqfReference.resolveToken() falls back from a section number to its
-- first mapped sub-clause, so each chip still hover-cards real clause text and links into the code
-- PDF at the right page - while thirty-eight chips would blow out the SQF Ref column in the library
-- list. The exhaustive clause list lives where it is actually read: each Part heading names its own
-- range, and governing_reference states the full spans.
--
-- Inserted as status='draft'. Idempotent: guarded on sop_number.

begin;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
select
  'FSQM-012',
  'Good Manufacturing Practices Program',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '2.4.2.1, 2.4.2.2, 2.5.4.3, 11.3.1, 11.3.2, 11.3.3, 11.3.4, 11.3.5, 11.4.1',
  true,
  $json$
{
  "purpose": "To document the Good Manufacturing Practices applied at Adventure Bakery, LLC — personnel health and hygiene, handwashing, clothing and personal effects, visitors and contractors, staff amenities, and processing practices — and to state how each is implemented, verified and trained, so that food safety is controlled and assured across the scope of certification.",
  "scope": "Applies to all persons entering food handling, processing or storage areas at the Adventure Bakery facility — employees, temporary staff, contractors, maintenance personnel, auditors, visitors and management.\n\nThis program is the umbrella document for SQF Food Safety Code: Food Manufacturing, Edition 9, Module 11.3 (Personnel Hygiene) and Module 11.4 (Personnel Processing Practices). The remaining Module 11 GMPs are implemented through documents that already exist and are referenced here rather than restated:\n\nPre-operational inspection and release — SOP-11.2.12, recorded on FRM-903.\nEquipment and utensil cleaning — SOP-901 to SOP-906 (SSOPs).\nSanitation schedule and verification — FRM-901, FRM-902, FRM-903.\nGlass and brittle plastic — SOP-11.7.3, FRM-907, FRM-908.\nAllergen changeover — SOP-204.\nSite food safety inspections — FSQM-022.\nTraining and records — SOP-2.9, FRM-952, FRM-953, REP-951.\n\nNot covered here: premises and equipment construction (11.2), water, ice and air (11.5), storage and transport (11.6), and separation of functions (11.7) other than glass control.",
  "definitions": "Food handling / contact zone — any area where product, ingredients, primary packaging or food-contact surfaces are exposed. Includes the production floor, the depositing and packing areas, and open ingredient storage.\n\nProtective clothing — outer garments, hairnets, beard covers, aprons, gloves and dedicated footwear or shoe covers worn to protect product, as distinct from personal clothing.\n\nVisitor — any person entering a food handling, processing or storage area who is not an employee of the site, including contractors, maintenance personnel, auditors, suppliers, customers and guests.\n\nEscorted — accompanied at all times by an authorized employee who is responsible for the visitor's compliance with this program.",
  "responsibility": "SQF Practitioner / QA — owns this program, enforces it, approves exceptions, holds the risk assessments for permitted jewellery, and verifies compliance through GMP inspection.\nSupervisors — ensure staff on their shift comply, act on non-compliance immediately, and receive illness and injury reports.\nAll staff — comply with this program, and report illness, injury and any breach they observe.\nReception / designated staff — ensure every visitor completes FRM-905 and FRM-906 before entry and is escorted or trained.\nMaintenance — maintain handwashing stations, amenities and the facility provisions this program depends on, and correct deficiencies raised by GMP inspection.",
  "procedure": [
    "SCOPE AND APPLICATION OF GOOD MANUFACTURING PRACTICES (SQF 2.4.2.1, 2.4.2.2)",
    "• The Good Manufacturing Practices set out in Module 11 of the SQF Food Safety Code: Food Manufacturing apply in full to the scope of certification — the manufacture, baking, packing and storage of baked products at this facility.",
    "• **No exemption from any Module 11 requirement is claimed by this program.** Where the site determines that a requirement does not apply, or that an alternative control achieves the same outcome, that determination shall be recorded as a written risk analysis stating the justification or the evidence of effectiveness, approved by the SQF Practitioner, **before** it takes effect. An undocumented exemption is a non-conformance against 2.4.2.1.",
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
    "• **Handwashing stations** are provided adjacent to all personnel access points and at accessible locations within food handling and processing areas. Each station is constructed of stainless steel or a similar non-corrosive material and is supplied with potable water at an appropriate temperature, liquid soap in a fixed dispenser, paper towels in a hands-free cleanable dispenser, and a container for used paper towels.",
    "• Handwashing stations are for handwashing only. They shall not be used to wash equipment, utensils or cloths.",
    "• **Signage** instructing people to wash their hands before entering food processing areas is displayed in a prominent position in the break room, at the break room exit, in the toilet rooms and at the entrances to production, **in English and Spanish** — the languages understood by site personnel, consistent with FSQM-002.",
    "• The site does not currently operate a designated high-risk processing area. Where such an area is established, hands-free taps and hand sanitizers shall be provided at its handwashing stations (11.3.2.4).",
    "CLOTHING, HAIR AND PROTECTIVE WEAR (SQF 11.3.3.1 to 11.3.3.7)",
    "• **Basis of this policy — the risk analysis required by 11.3.3.1.** The hazards the clothing and hair policy controls are: hair and beard hair falling into open product; fibres, buttons, drawstrings and other loose components detaching from garments; soil, dust and organic matter carried in from outside the facility on clothing and footwear; microbiological transfer from street clothing and from garments stored against product or packaging; and allergen carry-over on protective clothing worn across a changeover. The controls chosen against those hazards are: full hair and beard containment in every area where product is exposed; site-designated outer garments that are smooth, cleanable and free of external components that can detach; footwear controlled at the point of entry so external soil does not reach the floor; separation of street clothing from clean protective clothing and from all food and packaging; and removal or change of protective clothing at changeovers and whenever it becomes a contamination risk. This analysis is reviewed whenever the process, the product range or the facility layout changes.",
    "• Wear clean, designated outer garments, and arrive at the facility in clean clothing free of soilage or foul odour. Change lab coats if they become soiled.",
    "• Wear hairnets so both ears are covered and all hair is contained; wear a beard net covering all facial hair while in production and storage areas.",
    "• Clothing, including shoes, shall be clean at the start of each shift and maintained in a serviceable condition. Excessively soiled uniforms shall be changed or replaced as soon as they present a contamination risk — not at the end of the shift.",
    "• Wear pants that fully cover the torso and ankles; wear a belt if pants sag.",
    "• Control footwear so that external soilage — dirt, faecal matter, decomposing material or other foreign matter — does not enter production or storage areas, by changing into dedicated production-floor footwear, using shoe covers, or passing through a sanitizing foot bath at entry.",
    "• **Disposable gloves and aprons shall be changed after each break, on every re-entry to the processing area, and whenever damaged.** They are not washed and re-used.",
    "• Non-disposable aprons and gloves shall be cleaned and sanitized as required. When not in use they are stored on the racks provided in the processing area, or in designated sealed containers in personnel lockers. They shall **never** be placed or stored on packaging, ingredients, product or equipment.",
    "• Protective clothing shall be made from material that poses no food safety threat and is easily cleaned. It shall be cleaned after use, or at a frequency that controls contamination, and stored clean and serviceable so that it cannot pick up microbiological or allergen contamination between uses.",
    "• Racks are provided for the temporary storage of protective clothing when staff leave the processing area, located at or adjacent to the personnel access doorways and handwashing facilities.",
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
    "• **Changing** — provision is made for staff and visitors to change into and out of protective clothing, and the changing area is kept clean.",
    "• **Street clothing and personal items** are stored separately from clean uniforms, food-contact zones, food, and packaging storage areas.",
    "• The site does not process high-risk foods and does not operate a designated high-risk area, so a high-risk change area (11.3.5.3) is not provided. Showers (11.3.5.5) are not required by the processes performed at this site. Should either condition change, the provision shall be made before that processing begins.",
    "• **Toilet rooms** are accessible to staff, separate from processing and food handling operations, sufficient in number for the maximum number of staff on site, constructed so they can be easily cleaned and maintained, and kept clean and tidy. Provision is made for storing protective clothing and outer garments while the facilities are in use. **Cleaning tools and equipment used in toilet rooms shall never be used to clean processing areas** and are stored separately and identified for that use only.",
    "• **Handwashing basins** are provided immediately inside or outside the toilet room, to the specification in Part 3.",
    "• **Sanitary drainage** is not connected to any other drain within the premises and discharges to the sewerage system in accordance with regulations.",
    "• The **break room** is separate from food contact and handling zones, ventilated and well lit, with adequate tables and seating for the maximum number of staff at one sitting, a sink served with hot and cold potable water for washing utensils, and refrigeration and heating so staff can store or heat food and prepare non-alcoholic beverages. It is kept clean and free from waste materials and pests.",
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
    "• **Sensory evaluation** is not conducted in food handling or contact zones. Where it becomes necessary to do so, the site shall ensure that food safety is not compromised; that the evaluation is conducted by authorized personnel only; that a high standard of personal hygiene is practised by those conducting it; that it is carried out in an area equipped for the purpose; and that equipment used for it is sanitized, maintained and stored separately from processing equipment.",
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
  "form_references": "FRM-905 — Visitor Sign-In Log\nFRM-906 — Visitor GMP Acknowledgement\nFRM-903 — Daily Sanitation, Pre-Operation & Release Record\nFRM-901 — Master Sanitation Schedule (amenity cleaning is scheduled here)\nFRM-907 / FRM-908 — Glass & Brittle Plastic Register / Glass Breakage Incident Report\nFRM-952 / FRM-953 — Training Competency Verification Record / Training Sign-In Sheet\nREP-951 — Training Matrix\nSOP-11.2.12 — GMP / Pre-Operation Inspection\nSOP-11.7.3 — Glass & Brittle Plastic Control\nSOP-204 — Allergen Cleaning Procedure\nSOP-2.9 — Training & Recordkeeping\nFSQM-022 — Food Safety Monitoring Program",
  "records": "Visitor sign-in and GMP acknowledgement — FRM-905 and FRM-906, retained a minimum of 12 months.\nDaily pre-operation and amenity check — FRM-903, retained per the record retention policy.\nPeriodic GMP and food safety inspections and their corrective actions — per FSQM-022, retained per the record retention policy.\nRisk assessments for permitted jewellery exceptions — held by the SQF Practitioner with this program, for as long as the exception stands plus one audit cycle.\nIllness, injury and bodily-fluid incident dispositions — held by QA, retained per the record retention policy.\nTraining assignment, completion and competency — Team Portal, FRM-952, FRM-953 and REP-951, retained per SOP-2.9.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — Module 11.3 (Personnel Hygiene, 11.3.1.1 to 11.3.5.10) and Module 11.4 (Personnel Processing Practices, 11.4.1.1 to 11.4.1.4).\nSQF Food Safety Code: Food Manufacturing, Edition 9 — System Elements 2.4.2.1 (GMPs applied or exempted by written risk analysis), 2.4.2.2 (GMPs documented and implemented), 2.5.4.3 (planned site and equipment inspections with corrective action and records), and 2.9.2.1 iii and iv (personal hygiene and Good Manufacturing Practices training).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice, in particular §117.10 (Personnel) and §117.20 (Plant and grounds).",
  "revision_history": "New — 2026-09-01 — Initial issue. Written to close SQF 2.4.2.2, which requires the site's applicable Good Manufacturing Practices to be documented. Covers Module 11.3 and 11.4 in full — thirty-five clauses, of which SOP-11.3 addressed about nine.\n\nSUPERSEDES SOP-11.3 Personnel Hygiene & Visitor Policy. Its dress code, jewellery list, visitor requirements, twelve-month retention and corrective-action clause are carried forward here, extended rather than rewritten. SOP-11.3 remains the active controlled document until this program is approved and issued; it is archived in the same transaction that activates this one, so the site is never without an active personnel hygiene document.\n\nOPEN BEFORE ACTIVATION — statements of fact about the facility that only the site can confirm. Each is written in the body as the arrangement this program requires; confirm it is what the facility actually provides, or correct it. Where the facility does not provide it, that is an input to the Module 11 exemption analysis required by 2.4.2.1, not a silent omission.\n1. Handwashing stations — how many, where, and whether each has potable water at an appropriate temperature, liquid soap in a fixed dispenser, paper towels in a hands-free cleanable dispenser, and a bin for used towels. 11.3.2.2 asks for one adjacent to every personnel access point.\n2. Handwash signage — confirm it exists in the break room, at the break room exit, in the toilet rooms and at the production entrances, in English and Spanish. This is the same question FSQM-002 raises about where the food safety policy is displayed; answer both together.\n3. High-risk area — this program states the site operates none, which makes 11.3.2.4 (hands-free taps, hand sanitizers) and 11.3.5.3 (high-risk change area) inapplicable. Confirm.\n4. Laundering — are lab coats and other protective clothing laundered on site, commercially, or by employees at home? 11.3.3.2 requires clothing to be maintained, stored, laundered and worn so it presents no contamination risk; home laundering is permitted but the program should say so and say what is required of it.\n5. Racks for protective clothing — 11.3.3.7 requires racks at or adjacent to the personnel access doorways and handwashing facilities. Confirm these exist.\n6. Footwear control — SOP-11.3 offered dedicated footwear, shoe covers or a sanitizing foot bath as alternatives. Which does the site actually use? A document listing three options describes none of them.\n7. Changing arrangements and lockers — where staff change, and where street clothing and personal items are stored separately from clean uniforms, food and packaging.\n8. Toilet rooms — 11.3.5.6 (ii) asks that they be accessed from the processing area via an airlock vented to the exterior or through an adjoining room. Confirm the actual arrangement; if neither applies it belongs in the exemption analysis with its justification.\n9. Sanitary drainage — confirm it is not connected to any other drain on the premises and discharges to sewer or septic per regulation.\n10. Break room — confirm it is separate from food zones and has the sink with hot and cold potable water, refrigeration and heating that 11.3.5.9 requires.\n11. Illness exclusion period — this program requires exclusion until symptom-free and cleared by a supervisor. If the site wants a fixed interval (commonly 24 or 48 hours symptom-free), set it here.\n12. Sensory evaluation — this program states it is not conducted in food handling or contact zones. Confirm no tasting of in-process product happens on the floor today."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where sop_number = 'FSQM-012'
);

do $$
declare
  r        record;
  sop113   text;
  missing  text;
begin
  select status, type, revision,
         jsonb_array_length(content->'procedure') as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s not like '• %')                                   as parts,
         (content->>'scope' like '%Module 11.3 (Personnel Hygiene)%') as has_scope,
         (content->>'revision_history' like '%OPEN BEFORE ACTIVATION%') as has_open_list,
         (content->'procedure')::text like '%risk analysis required by 11.3.3.1%' as has_risk_analysis,
         (content->'procedure')::text like '%Form-0010%'              as has_dangling_ref
    into r
    from public.sop_documents where sop_number = 'FSQM-012';

  if r is null then
    raise exception 'FSQM-012 was not created.';
  end if;

  -- Every body section the Document tab and the PDF render must be present and non-empty.
  select string_agg(k, ', ') into missing
    from unnest(array['purpose','scope','definitions','responsibility','procedure',
                      'form_references','records','governing_reference','revision_history']) k
   where not exists (
     select 1 from public.sop_documents d
      where d.sop_number = 'FSQM-012'
        and d.content ? k
        and length(d.content->>k) > 0
   );
  if missing is not null then
    raise exception 'FSQM-012 is missing body sections: %', missing;
  end if;

  if r.status is distinct from 'draft' or r.type is distinct from 'fsqm'
     or r.revision is distinct from 'New' then
    raise exception 'FSQM-012 created wrong: status=%, type=%, revision=%',
      r.status, r.type, r.revision;
  end if;

  if r.lines <> 81 or r.parts <> 10 then
    raise exception 'FSQM-012 body wrong shape: % procedure lines, % numbered Parts (expected 81 / 10)',
      r.lines, r.parts;
  end if;

  if not r.has_scope or not r.has_open_list or not r.has_risk_analysis then
    raise exception 'FSQM-012 content wrong: scope=%, open list=%, 11.3.3.1 risk analysis=%',
      r.has_scope, r.has_open_list, r.has_risk_analysis;
  end if;

  -- The FSQM-022 mistake, guarded against rather than described.
  if r.has_dangling_ref then
    raise exception 'FSQM-012 references Form-0010, which does not exist.';
  end if;

  -- This migration must NOT have touched SOP-11.3. It is superseded only when FSQM-012 is
  -- activated, in one transaction, so the site is never left without an active hygiene document.
  select status into sop113 from public.sop_documents where sop_number = 'SOP-11.3';
  if sop113 is distinct from 'active' then
    raise exception 'SOP-11.3 is % - it must stay active until FSQM-012 is issued.',
      coalesce(sop113, 'missing');
  end if;
end $$;

commit;
