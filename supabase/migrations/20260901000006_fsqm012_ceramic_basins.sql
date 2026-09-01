-- FSQM-012 - the coat rack is installed and the handwash basins are ceramic.
-- Three open items become two. The last physical item and the last fixture question are closed.
--
-- Answered by the site 2026-09-01: the protective clothing rack has been installed at the
-- production entrance, and the handwash basins are ceramic.
--
-- CERAMIC SATISFIES 11.3.2.3. The clause asks for "stainless steel or similar non-corrosive
-- material". Vitreous china is impervious, non-corrosive and easily cleaned, which is the property
-- the clause is actually after - stainless steel is an example, not the only permitted material.
-- No exemption is needed and none is claimed.
--
-- BUT CERAMIC IS BRITTLE, AND ONE OF THESE BASINS IS INSIDE THE FOOD HANDLING AREA. The station at
-- the production entrance sits where product is handled. A chipped or cracked ceramic basin over a
-- handwashing point is a foreign-material route, and the site already runs the program that
-- controls exactly this: SOP-11.7.3 (Glass & Brittle Plastic Control) with the FRM-907 register.
-- Part 3 now states the rule - ceramic fixtures inside food handling areas are controlled as
-- brittle items - and open item 2 is the one-line action of adding this basin to FRM-907.
--
-- The rule is written in the body; the basin's presence ON the register is not asserted, because it
-- is not there yet. Stating it as done would be the FSQM-022 dangling-reference mistake wearing a
-- different hat: a document that describes a control nobody has implemented is worse than one that
-- names the gap.
--
-- THE RACK NEEDED NO WORDING CHANGE. 20260901000002 already placed it at the production entrance
-- beside the handwash station and foot bath, which is where 11.3.3.7 wants it and where it has now
-- been installed. The body was written as the arrangement the program requires; the site built to
-- it, so the sentence is simply true now. Only the OPEN list and the confirmations move.
--
-- ONE ITEM REMAINS AFTER THIS: the foot baths - confirm the daily change interval and check the
-- 1:160 dilution against the actual product label - plus the FRM-907 line above. Everything else
-- the site was asked for has been answered or built.
--
-- Body grows 90 -> 91 lines, still 10 Parts.
--
-- GUARDED AGAINST A STALE WRITE: asserts draft, 90 lines, and the three-item OPEN list this
-- migration replaces. SOP-11.3 still untouched.

begin;

do $$
declare
  st    text;
  lines int;
  v5    boolean;
begin
  select status,
         jsonb_array_length(content->'procedure'),
         (content->>'revision_history') like '%OPEN BEFORE ACTIVATION — three items.%'
    into st, lines, v5
    from public.sop_documents where sop_number = 'FSQM-012';

  if st is null then
    raise exception 'FSQM-012 does not exist - run the earlier 2026090100000x migrations first.';
  end if;
  if st <> 'draft' then
    raise exception 'FSQM-012 is % - this migration edits a draft, not an issued document.', st;
  end if;
  if lines <> 90 or not v5 then
    raise exception 'FSQM-012 is not the version this migration was written against (% procedure lines, three-item OPEN list present=%). Apply the earlier migrations, or re-derive this one if the row has been edited.', lines, v5;
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
    "• **Foot bath maintenance.** The solution is made up fresh at the start of each production day, and sooner whenever it is visibly soiled or a test strip reads below target. The baths are stripped and thoroughly cleaned **monthly**, and sooner if required. The change interval matters as much as the dilution: the soil a bath lifts off the floor is exactly what spends the quat, so a bath left standing is weaker than its label says however carefully it was mixed.",
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
  "form_references": "FRM-905 — Visitor Sign-In Log\nFRM-906 — Visitor GMP Acknowledgement\nFRM-903 — Daily Sanitation, Pre-Operation & Release Record\nFRM-901 — Master Sanitation Schedule (amenity cleaning is scheduled here)\nFRM-907 / FRM-908 — Glass & Brittle Plastic Register / Glass Breakage Incident Report\nFRM-952 / FRM-953 — Training Competency Verification Record / Training Sign-In Sheet\nREP-951 — Training Matrix\nSOP-11.2.12 — GMP / Pre-Operation Inspection\nSOP-11.7.3 — Glass & Brittle Plastic Control\nSOP-204 — Allergen Cleaning Procedure\nSOP-2.9 — Training & Recordkeeping\nFSQM-022 — Food Safety Monitoring Program",
  "records": "Visitor sign-in and GMP acknowledgement — FRM-905 and FRM-906, retained a minimum of 12 months.\nDaily pre-operation and amenity check — FRM-903, retained per the record retention policy.\nPeriodic GMP and food safety inspections and their corrective actions — per FSQM-022, retained per the record retention policy.\nRisk assessments for permitted jewellery exceptions — held by the SQF Practitioner with this program, for as long as the exception stands plus one audit cycle.\nIllness, injury and bodily-fluid incident dispositions — held by QA, retained per the record retention policy.\nTraining assignment, completion and competency — Team Portal, FRM-952, FRM-953 and REP-951, retained per SOP-2.9.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — Module 11.3 (Personnel Hygiene, 11.3.1.1 to 11.3.5.10) and Module 11.4 (Personnel Processing Practices, 11.4.1.1 to 11.4.1.4).\nSQF Food Safety Code: Food Manufacturing, Edition 9 — System Elements 2.4.2.1 (GMPs applied or exempted by written risk analysis), 2.4.2.2 (GMPs documented and implemented), 2.5.4.3 (planned site and equipment inspections with corrective action and records), and 2.9.2.1 iii and iv (personal hygiene and Good Manufacturing Practices training).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice, in particular §117.10 (Personnel) and §117.20 (Plant and grounds).",
  "revision_history": "New — 2026-09-01 — Initial issue. Written to close SQF 2.4.2.2, which requires the site's applicable Good Manufacturing Practices to be documented. Covers Module 11.3 and 11.4 in full — thirty-five clauses, of which SOP-11.3 addressed about nine.\n\nSUPERSEDES SOP-11.3 Personnel Hygiene & Visitor Policy. Its dress code, jewellery list, visitor requirements, twelve-month retention and corrective-action clause are carried forward here, extended rather than rewritten. SOP-11.3 remains the active controlled document until this program is approved and issued; it is archived in the same transaction that activates this one, so the site is never without an active personnel hygiene document.\n\nSITE ARRANGEMENTS CONFIRMED 2026-09-01 by Richard Mercer. The facility facts in this program are the site's own answers, not assumptions: three handwashing stations (one in each lavatory, one immediately inside the production access point, which is the floor's only entrance from non-production space) with hot and cold potable water, waste bins, soap from a hands-free dispenser and towels that can be taken without touching the housing; handwash signage in the break room, at its exit, in both toilet rooms and at the production entrance, in English and Spanish; no designated high-risk area; protective clothing laundered by employees at home with detergent and hung to dry; footwear controlled by two sanitizing foot baths, at the production entrance and at the walkthrough to the inventory and packaging area, dosed with Sani-512 at 1:160, made up in separate clearly labelled containers from the 1:512 food-contact solution, and thoroughly cleaned monthly; ceramic handwash basins, and the protective clothing rack installed at the production entrance; changing done in the toilet rooms, personal items in break room lockers; the employee lavatory reached through a vented airlock; sanitary drainage separate and compliant; the break room separate from food zones, lit, ventilated, with a refrigerator, a microwave and a table seating all employees at one sitting, and with disposable utensils so nothing is washed up there; no fixed illness exclusion interval — supervisor clearance is the control; product tasting carried out in the office adjacent to production, never on the floor.\n\nOPEN BEFORE ACTIVATION — two items. The protective clothing rack is installed and the handwash basins are confirmed as ceramic, which closes the last physical item and the last fixture question.\n1. CONFIRM — the foot baths, on two points. (a) THE DAILY CHANGE. This program states the solution is made up fresh at the start of each production day and sooner when visibly soiled or below strip target, with a thorough clean monthly. The monthly clean is the site's own answer; the daily change is written here because a concentration without a change interval is not a control — the soil a bath lifts off the floor is what spends the quat, so a bath left standing is weaker than its label says however carefully it was mixed. Confirm the daily interval or set a different one, then put both it and the monthly clean on FRM-901 with a test strip check. (b) THE 1:160 FIGURE AGAINST THE PRODUCT LABEL. The 1:512 food-contact dilution was checked against the Sani-512 label on 2026-08-25; this foot-bath ratio has not been. A sanitizer used at a dilution its label does not carry is a label-use problem before it is an SQF problem, so confirm 1:160 appears on the label for this use — and while doing it, add the label and SDS to the Chemical Safety Data Sheets collection, which still holds only a generated summary.\n2. ACTION — add the ceramic basin at the production entrance to FRM-907, the Glass and Brittle Plastic Register. Ceramic is brittle and that basin sits inside the food handling area, so it belongs on the register SOP-11.7.3 already runs. This is one line on a form that exists, not a new control — but a brittle fixture over a handwashing point that nobody is inspecting is the kind of omission an auditor finds by looking up.\n\nCARRIED INTO THE MODULE 11 EXEMPTION ANALYSIS (task 13.6). Two arrangements meet what a clause protects without being the fixture it names. 2.4.2.1 allows exactly that, in exchange for a written justification, and these are the two that need one:\ni. NO UTENSIL SINK in the break room (11.3.5.9 iii). Nothing is washed up there — utensils are disposable and personal items go home to be washed — so the fixture has no work to do. The justification is that there are no utensils to wash, not that a handwash basin substitutes for a sink.\nii. THE PAPER TOWEL DISPENSER has no no-touch mechanism (11.3.2.3 iii), though a towel is taken without contacting the housing. What the clause protects — clean hands not recontaminated on the way to being dried — is met, but the clause names a dispenser type, so the argument is worth making once in writing rather than at the audit."
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
           where s not like '• %')                                                    as parts,
         (content->'procedure')::text like '%The basins are ceramic%'                 as ceramic,
         (content->'procedure')::text like '%controlled as a brittle item%'           as brittle,
         (content->'procedure')::text like '%FRM-907%'                                as register,
         (content->>'revision_history') like '%two items%'                            as open_two,
         (content->>'revision_history') like '%add the ceramic basin at the production entrance to FRM-907%' as action2,
         -- replaced wording must be gone
         (content->>'revision_history') like '%three items%'                          as v5_wording,
         -- earlier migrations must not have regressed
         (content->'procedure')::text like '%beside the handwashing station and the foot bath%' as racks,
         (content->'procedure')::text like '%separate, clearly labelled containers%'  as labelled,
         (content->'procedure')::text like '%utensils provided are disposable%'       as disposable,
         (content->'procedure')::text like '%Sani-512 at 1:160%'                      as foot_strength,
         (content->'procedure')::text like '%Form-0010%'                              as dangling
    into r
    from public.sop_documents where sop_number = 'FSQM-012';

  if r.lines <> 91 or r.parts <> 10 then
    raise exception 'FSQM-012 body wrong shape: % lines, % Parts (expected 91 / 10)', r.lines, r.parts;
  end if;
  if not (r.ceramic and r.brittle and r.register) then
    raise exception 'FSQM-012 ceramic wording did not land: ceramic=%, brittle rule=%, FRM-907=%',
      r.ceramic, r.brittle, r.register;
  end if;
  if r.v5_wording or not (r.open_two and r.action2) then
    raise exception 'FSQM-012 open list wrong: three-item wording still present=%, two items=%, FRM-907 action=%',
      r.v5_wording, r.open_two, r.action2;
  end if;
  if not (r.racks and r.labelled and r.disposable and r.foot_strength) or r.dangling then
    raise exception 'FSQM-012 regressed an earlier migration: racks=%, labelled=%, disposable=%, 1:160=%, Form-0010=%',
      r.racks, r.labelled, r.disposable, r.foot_strength, r.dangling;
  end if;

  select status into sop113 from public.sop_documents where sop_number = 'SOP-11.3';
  if sop113 is distinct from 'active' then
    raise exception 'SOP-11.3 is % - it must stay active until FSQM-012 is issued.',
      coalesce(sop113, 'missing');
  end if;
end $$;

commit;
