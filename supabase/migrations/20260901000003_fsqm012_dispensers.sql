-- FSQM-012 - the handwash station dispensers, as they actually are. Closes open item 4.
--
-- 20260901000002 left open item 4 asking whether 11.3.2.3 was met at the handwash stations: liquid
-- soap in a FIXED dispenser, paper towels in a HANDS-FREE cleanable dispenser, and non-corrosive
-- construction. The site answered on 2026-09-01: the soap dispenser IS hands-free, and while the
-- towel dispenser has no no-touch mechanism, a towel can be taken without touching the housing or
-- anything else.
--
-- SOAP EXCEEDS THE CLAUSE. 11.3.2.3 (ii) asks only for a fixed dispenser. A hands-free one is more
-- than that, and the document should say so rather than leave a "shall provide" hanging over
-- something the site already has and has done better than required.
--
-- THE TOWEL DISPENSER IS THE INTERESTING ONE, AND IT IS NOT WAVED THROUGH. 11.3.2.3 (iii) says
-- "hands-free cleanable dispenser". What that requirement protects is clean hands on the way to
-- being dried - hands washed and then pressed against a housing that dirty hands last touched are
-- no longer clean. Taking the towel without contact meets that objective. But the clause names a
-- dispenser TYPE, not an outcome, and an auditor reading it strictly can call out a housing with no
-- no-touch mechanism. So the body states the arrangement plainly, and the OPEN list routes the
-- argument to the 13.6 exemption analysis - which is exactly what 2.4.2.1 means by "evidence of the
-- effectiveness of alternative control measures". Made once, in writing, rather than at the audit.
--
-- Writing this into the body as compliance-by-assertion would have been the easy version and the
-- wrong one: the site would find out an auditor disagreed at the moment it was most expensive.
--
-- CONSTRUCTION MATERIAL IS STILL UNANSWERED, so open item 4 survives - narrowed from four unknowns
-- to one, plus the 13.6 note. The stations' water, soap, towels and waste bins are now all
-- confirmed and recorded in revision_history.
--
-- No change to the body's shape: 85 procedure lines, 10 Parts, one bullet rewritten.
--
-- GUARDED AGAINST A STALE WRITE, the same way 20260901000002 was: asserts the row is still draft,
-- still 85 lines, and still carries the "shall also provide" wording this migration replaces. A
-- drawer edit since raises instead of being silently discarded.
--
-- SOP-11.3 is still not touched.

begin;

do $$
declare
  st    text;
  lines int;
  v2    boolean;
begin
  select status,
         jsonb_array_length(content->'procedure'),
         (content->'procedure')::text like '%Each station shall also provide%'
    into st, lines, v2
    from public.sop_documents where sop_number = 'FSQM-012';

  if st is null then
    raise exception 'FSQM-012 does not exist - run 20260901000001 and 20260901000002 first.';
  end if;
  if st <> 'draft' then
    raise exception 'FSQM-012 is % - this migration edits a draft, not an issued document.', st;
  end if;
  if lines <> 85 or not v2 then
    raise exception 'FSQM-012 is not the version this migration was written against (% procedure lines, "shall also provide" wording present=%). It has been edited since 20260901000002; re-derive before applying.', lines, v2;
  end if;
end $$;

update public.sop_documents
   set content = $json$
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
    "• **Handwashing stations — three are provided:** one in each of the two lavatories, and one immediately inside the personnel access point into the production area from the office, break room and reception. Each is supplied with hot and cold running potable water, a paper towel dispenser, and a bin for used paper towels.",
    "• **Soap is supplied from a hands-free dispenser** — more than the fixed dispenser 11.3.2.3 (ii) asks for. **Paper towels are presented so that a towel can be taken without touching the dispenser housing or anything else.** What 11.3.2.3 (iii) is protecting is clean hands on the way to being dried: hands washed and then pressed against a housing that dirty hands last touched are no longer clean. Taking the towel without contact meets that, and no member of staff need touch the dispenser to dry their hands.",
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
    "• The **break room** is separate from all food contact and handling zones, is lit, and is ventilated by the site's heating and cooling system. It holds the personal-item lockers and is kept clean and free from waste materials and pests.",
    "• The break room shall also be equipped with a **sink served with hot and cold potable water for washing utensils**, and with **refrigeration and heating** so staff can store or heat their own food and prepare non-alcoholic beverages (11.3.5.9 iii and iv). **Staff food is not stored in the production walk-in refrigerator** — personal food held among ingredients is a contamination and allergen route, so the break room carries its own refrigeration rather than borrowing the walk-in. The handwash basin in the adjacent lavatory is a handwash basin, not the utensil sink this clause asks for.",
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
  "form_references": "FRM-905 — Visitor Sign-In Log\nFRM-906 — Visitor GMP Acknowledgement\nFRM-903 — Daily Sanitation, Pre-Operation & Release Record\nFRM-901 — Master Sanitation Schedule (amenity cleaning is scheduled here)\nFRM-907 / FRM-908 — Glass & Brittle Plastic Register / Glass Breakage Incident Report\nFRM-952 / FRM-953 — Training Competency Verification Record / Training Sign-In Sheet\nREP-951 — Training Matrix\nSOP-11.2.12 — GMP / Pre-Operation Inspection\nSOP-11.7.3 — Glass & Brittle Plastic Control\nSOP-204 — Allergen Cleaning Procedure\nSOP-2.9 — Training & Recordkeeping\nFSQM-022 — Food Safety Monitoring Program",
  "records": "Visitor sign-in and GMP acknowledgement — FRM-905 and FRM-906, retained a minimum of 12 months.\nDaily pre-operation and amenity check — FRM-903, retained per the record retention policy.\nPeriodic GMP and food safety inspections and their corrective actions — per FSQM-022, retained per the record retention policy.\nRisk assessments for permitted jewellery exceptions — held by the SQF Practitioner with this program, for as long as the exception stands plus one audit cycle.\nIllness, injury and bodily-fluid incident dispositions — held by QA, retained per the record retention policy.\nTraining assignment, completion and competency — Team Portal, FRM-952, FRM-953 and REP-951, retained per SOP-2.9.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — Module 11.3 (Personnel Hygiene, 11.3.1.1 to 11.3.5.10) and Module 11.4 (Personnel Processing Practices, 11.4.1.1 to 11.4.1.4).\nSQF Food Safety Code: Food Manufacturing, Edition 9 — System Elements 2.4.2.1 (GMPs applied or exempted by written risk analysis), 2.4.2.2 (GMPs documented and implemented), 2.5.4.3 (planned site and equipment inspections with corrective action and records), and 2.9.2.1 iii and iv (personal hygiene and Good Manufacturing Practices training).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice, in particular §117.10 (Personnel) and §117.20 (Plant and grounds).",
  "revision_history": "New — 2026-09-01 — Initial issue. Written to close SQF 2.4.2.2, which requires the site's applicable Good Manufacturing Practices to be documented. Covers Module 11.3 and 11.4 in full — thirty-five clauses, of which SOP-11.3 addressed about nine.\n\nSUPERSEDES SOP-11.3 Personnel Hygiene & Visitor Policy. Its dress code, jewellery list, visitor requirements, twelve-month retention and corrective-action clause are carried forward here, extended rather than rewritten. SOP-11.3 remains the active controlled document until this program is approved and issued; it is archived in the same transaction that activates this one, so the site is never without an active personnel hygiene document.\n\nSITE ARRANGEMENTS CONFIRMED 2026-09-01 by Richard Mercer. The facility facts in this program are the site's own answers, not assumptions: three handwashing stations (one in each lavatory, one immediately inside the production access point) with hot and cold potable water, towel dispensers and waste bins, soap from a hands-free dispenser and towels that can be taken without touching the housing; handwash signage in the break room, at its exit, in both toilet rooms and at the production entrance, in English and Spanish; no designated high-risk area; protective clothing laundered by employees at home with detergent and hung to dry; footwear controlled by two sanitizing foot baths, at the production entrance and at the walkthrough to the inventory and packaging area; changing done in the toilet rooms, personal items in break room lockers; the employee lavatory reached through a vented airlock; sanitary drainage separate and compliant; the break room separate from food zones, lit and ventilated; no fixed illness exclusion interval — supervisor clearance is the control; product tasting carried out in the office adjacent to production, never on the floor.\n\nOPEN BEFORE ACTIVATION — seven items remain, and the first three are actions rather than questions. Where the site chooses not to provide something, that is an input to the Module 11 exemption analysis required by 2.4.2.1, not a silent omission.\n1. ACTION — protective clothing racks. These do not exist yet. 11.3.3.7 wants them at or adjacent to the personnel access doorway AND the handwashing facilities, so the right place is the production entrance beside the existing handwash station and foot bath, not by the walk-in fridge: the garment comes off, the foot bath is crossed and the hands are washed at one point. A simple coat rack satisfies the clause.\n2. ACTION — break room refrigeration. 11.3.5.9 (iv) asks the break room itself to be equipped with refrigeration so staff can store their own food. The production walk-in does not substitute: staff food held among ingredients is a contamination and allergen route, and an auditor reading 11.3.5.4's separation principle will treat it as one. A small domestic refrigerator in the break room closes it.\n3. DECISION — break room sink. 11.3.5.9 (iii) asks for a sink served with hot and cold potable water for washing utensils. The break room has none; the adjacent lavatory has a handwash basin, which is a different fixture for a different purpose. Either install a small sink or carry this into the exemption analysis with a justification for how utensils are washed instead.\n4. CONFIRM — handwash station construction. Water, soap, towels and waste bins are confirmed. What is left of 11.3.2.3 is the fixture itself: stainless steel or a similar non-corrosive material, and dispensers that can be cleaned. Also worth settling for 13.6: the towel dispenser has no no-touch MECHANISM, and an auditor reading 'hands-free dispenser' strictly could call that out even though a towel is taken without contact. The exemption analysis is where that argument is made once, in writing, rather than at the audit.\n5. CONFIRM — handwash coverage in production. 11.3.2.2 asks for a station adjacent to every personnel access point AND at accessible locations throughout food handling and processing areas as required. One station serves the whole production area. Confirm that is adequate for the floor's size and layout, or add one.\n6. CONFIRM — the foot baths' sanitizer and change frequency. A foot bath with no stated strength and no change interval is a tray of water, not a control. Name the sanitizer (Sani-512 is the house product), its dilution, and how often the baths are changed — then it belongs on FRM-901 as a scheduled task.\n7. CONFIRM — break room tables and seating adequate for the maximum number of staff at one sitting (11.3.5.9 ii)."
}
$json$::jsonb
 where sop_number = 'FSQM-012'
   and status = 'draft';

do $$
declare
  r      record;
  sop113 text;
begin
  select jsonb_array_length(content->'procedure') as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s not like '• %')                                                as parts,
         (content->'procedure')::text like '%Soap is supplied from a hands-free dispenser%' as soap,
         (content->'procedure')::text like '%without touching the dispenser housing%'       as towels,
         (content->>'revision_history') like '%soap from a hands-free dispenser%'           as confirmed,
         (content->>'revision_history') like '%handwash station construction%'              as item4,
         (content->>'revision_history') like '%seven items remain%'                         as open_seven,
         -- the wording this migration replaces must be gone
         (content->'procedure')::text like '%Each station shall also provide%'              as v2_wording,
         -- and nothing earlier may have regressed
         (content->'procedure')::text like '%sanitizing foot baths%'                        as foot_baths,
         (content->'procedure')::text like '%not stored in the production walk-in%'         as walkin_rule,
         (content->'procedure')::text like '%Form-0010%'                                    as dangling
    into r
    from public.sop_documents where sop_number = 'FSQM-012';

  if r.lines <> 85 or r.parts <> 10 then
    raise exception 'FSQM-012 body wrong shape: % lines, % Parts (expected 85 / 10)', r.lines, r.parts;
  end if;
  if not (r.soap and r.towels) then
    raise exception 'FSQM-012 dispenser wording did not land: soap=%, towels=%', r.soap, r.towels;
  end if;
  if r.v2_wording then
    raise exception 'FSQM-012 still carries the "shall also provide" dispenser wording.';
  end if;
  if not (r.confirmed and r.item4 and r.open_seven) then
    raise exception 'FSQM-012 revision history wrong: confirmed=%, item 4 narrowed=%, seven items=%',
      r.confirmed, r.item4, r.open_seven;
  end if;
  if not (r.foot_baths and r.walkin_rule) or r.dangling then
    raise exception 'FSQM-012 regressed an earlier migration: foot baths=%, walk-in rule=%, Form-0010=%',
      r.foot_baths, r.walkin_rule, r.dangling;
  end if;

  select status into sop113 from public.sop_documents where sop_number = 'SOP-11.3';
  if sop113 is distinct from 'active' then
    raise exception 'SOP-11.3 is % - it must stay active until FSQM-012 is issued.',
      coalesce(sop113, 'missing');
  end if;
end $$;

commit;
