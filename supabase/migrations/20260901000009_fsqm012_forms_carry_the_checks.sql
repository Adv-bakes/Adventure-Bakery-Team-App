-- FSQM-012 - the forms now carry the checks, so the open list stops asking for them.
--
-- 20260901000008 added the daily foot bath grid to FRM-903, the monthly strip-down to FRM-901, and
-- the ceramic basin to FRM-907. This closes the matching open item and leaves two: confirming the
-- 1:160 dilution against the product label, and buying a high-range quat strip.
--
-- IT IS GUARDED ON THE FORMS ACTUALLY HAVING CHANGED, not merely on the previous migration having
-- run. The assertion below checks FRM-903 is at v6 with a footbath_check field, FRM-901 at B with
-- ten schedule rows, and FRM-907 at v2 mentioning Ceramic. If 20260901000008 were rolled back, or
-- somebody removed the grid in the drawer, FSQM-012 would otherwise go on claiming a record that
-- does not exist - which is the FSQM-022 failure this whole document has been careful to avoid, and
-- it would be worse coming from the document that names it.
--
-- The body needs no change: it already said the daily check is recorded on FRM-903 and the monthly
-- strip-down scheduled on FRM-901, and that ceramic fixtures are listed on FRM-907. Those sentences
-- were written as the arrangement the program requires; they are now simply true. Only the OPEN
-- list moves.
--
-- Body unchanged at 92 lines / 10 Parts.
--
-- GUARDED AGAINST A STALE WRITE: asserts draft, 92 lines, and the three-item OPEN list this
-- migration replaces. SOP-11.3 still untouched.

begin;

do $$
declare
  st    text;
  lines int;
  v7    boolean;
  f901  text;
  f903  text;
  f907  text;
  sched int;
  grid  boolean;
  cer   boolean;
begin
  select status, jsonb_array_length(content->'procedure'),
         (content->>'revision_history') like '%OPEN BEFORE ACTIVATION — three items, all small.%'
    into st, lines, v7
    from public.sop_documents where sop_number = 'FSQM-012';

  if st is null then
    raise exception 'FSQM-012 does not exist - run the earlier 2026090100000x migrations first.';
  end if;
  if st <> 'draft' then
    raise exception 'FSQM-012 is % - this migration edits a draft, not an issued document.', st;
  end if;
  if lines <> 92 or not v7 then
    raise exception 'FSQM-012 is not the version this migration was written against (% procedure lines, three-item OPEN list present=%). Apply the earlier migrations, or re-derive this one if the row has been edited.', lines, v7;
  end if;

  -- The forms must really carry the checks before this document stops asking for them.
  select revision into f901 from public.sop_documents where sop_number = 'FRM-901';
  select revision into f903 from public.sop_documents where sop_number = 'FRM-903';
  select revision into f907 from public.sop_documents where sop_number = 'FRM-907';
  select jsonb_array_length(content->'form_schema'->'sections'->0->'fields'->0->'rows')
    into sched from public.sop_documents where sop_number = 'FRM-901';
  select content::text like '%footbath_check%'
    into grid from public.sop_documents where sop_number = 'FRM-903';
  select content::text like '%Handwash basin — ceramic%'
    into cer from public.sop_documents where sop_number = 'FRM-907';

  if f901 is distinct from 'B' or sched <> 10 then
    raise exception 'FRM-901 does not carry the monthly foot bath strip-down (revision=%, schedule rows=%). Run 20260901000008 first.', f901, sched;
  end if;
  if f903 is distinct from 'v6' or not grid then
    raise exception 'FRM-903 does not carry the daily foot bath check (revision=%, grid present=%). Run 20260901000008 first.', f903, grid;
  end if;
  if f907 is distinct from 'v2' or not cer then
    raise exception 'FRM-907 does not carry the ceramic basin (revision=%, basin present=%). Run 20260901000008 first.', f907, cer;
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
  "form_references": "FRM-905 — Visitor Sign-In Log\nFRM-906 — Visitor GMP Acknowledgement\nFRM-903 — Daily Sanitation, Pre-Operation & Release Record\nFRM-901 — Master Sanitation Schedule (amenity cleaning is scheduled here)\nFRM-907 / FRM-908 — Glass & Brittle Plastic Register / Glass Breakage Incident Report\nFRM-952 / FRM-953 — Training Competency Verification Record / Training Sign-In Sheet\nREP-951 — Training Matrix\nSOP-11.2.12 — GMP / Pre-Operation Inspection\nSOP-11.7.3 — Glass & Brittle Plastic Control\nSOP-204 — Allergen Cleaning Procedure\nSOP-2.9 — Training & Recordkeeping\nFSQM-022 — Food Safety Monitoring Program",
  "records": "Visitor sign-in and GMP acknowledgement — FRM-905 and FRM-906, retained a minimum of 12 months.\nDaily pre-operation and amenity check — FRM-903, retained per the record retention policy.\nPeriodic GMP and food safety inspections and their corrective actions — per FSQM-022, retained per the record retention policy.\nRisk assessments for permitted jewellery exceptions — held by the SQF Practitioner with this program, for as long as the exception stands plus one audit cycle.\nIllness, injury and bodily-fluid incident dispositions — held by QA, retained per the record retention policy.\nTraining assignment, completion and competency — Team Portal, FRM-952, FRM-953 and REP-951, retained per SOP-2.9.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — Module 11.3 (Personnel Hygiene, 11.3.1.1 to 11.3.5.10) and Module 11.4 (Personnel Processing Practices, 11.4.1.1 to 11.4.1.4).\nSQF Food Safety Code: Food Manufacturing, Edition 9 — System Elements 2.4.2.1 (GMPs applied or exempted by written risk analysis), 2.4.2.2 (GMPs documented and implemented), 2.5.4.3 (planned site and equipment inspections with corrective action and records), and 2.9.2.1 iii and iv (personal hygiene and Good Manufacturing Practices training).\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice, in particular §117.10 (Personnel) and §117.20 (Plant and grounds).",
  "revision_history": "New — 2026-09-01 — Initial issue. Written to close SQF 2.4.2.2, which requires the site's applicable Good Manufacturing Practices to be documented. Covers Module 11.3 and 11.4 in full — thirty-five clauses, of which SOP-11.3 addressed about nine.\n\nSUPERSEDES SOP-11.3 Personnel Hygiene & Visitor Policy. Its dress code, jewellery list, visitor requirements, twelve-month retention and corrective-action clause are carried forward here, extended rather than rewritten. SOP-11.3 remains the active controlled document until this program is approved and issued; it is archived in the same transaction that activates this one, so the site is never without an active personnel hygiene document.\n\nSITE ARRANGEMENTS CONFIRMED 2026-09-01 by Richard Mercer. The facility facts in this program are the site's own answers, not assumptions: three handwashing stations (one in each lavatory, one immediately inside the production access point, which is the floor's only entrance from non-production space) with hot and cold potable water, waste bins, soap from a hands-free dispenser and towels that can be taken without touching the housing; handwash signage in the break room, at its exit, in both toilet rooms and at the production entrance, in English and Spanish; no designated high-risk area; protective clothing laundered by employees at home with detergent and hung to dry; footwear controlled by two sanitizing foot baths, at the production entrance and at the walkthrough to the inventory and packaging area, dosed with Sani-512 at 1:160, made up in separate clearly labelled containers from the 1:512 food-contact solution, and thoroughly cleaned monthly, with the solution changed on condition rather than on a fixed interval; ceramic handwash basins, and the protective clothing rack installed at the production entrance; changing done in the toilet rooms, personal items in break room lockers; the employee lavatory reached through a vented airlock; sanitary drainage separate and compliant; the break room separate from food zones, lit, ventilated, with a refrigerator, a microwave and a table seating all employees at one sitting, and with disposable utensils so nothing is washed up there; no fixed illness exclusion interval — supervisor clearance is the control; product tasting carried out in the office adjacent to production, never on the floor.\n\nOPEN BEFORE ACTIVATION — two items. The forms now carry every check this program states: the daily foot bath check is a grid in section 3 of FRM-903, the monthly strip-down is on the FRM-901 schedule and in its task picker, and the ceramic basin at the production entrance is on the FRM-907 register (FRM-901 rev B, FRM-903 rev v6, FRM-907 rev v2, all effective 2026-09-01). What is left is one confirmation and one purchase.\n1. CONFIRM — the 1:160 figure against the product label. The 1:512 food-contact dilution was checked against the Sani-512 label on 2026-08-25; this foot-bath ratio has not been. A sanitizer used at a dilution its label does not carry is a label-use problem before it is an SQF problem, so confirm 1:160 appears on the label for this use — and while doing it, add the label and SDS to the Chemical Safety Data Sheets collection, which still holds only a generated summary.\n2. ACTION — high-range quat test strips for the foot baths. At 1:160 the bath runs at roughly three times the food-contact strength, which is off the top of the 0-400 ppm strips used on equipment: those will simply read high and tell the checker nothing. FRM-903's foot bath grid now carries that warning on its own label, so the person holding the strip sees it — but the strip still has to exist. Keep it with the baths, separate from the food-contact strips, for the same reason the two dilutions are made up in separately labelled containers.\n\nCARRIED INTO THE MODULE 11 EXEMPTION ANALYSIS (task 13.6). Two arrangements meet what a clause protects without being the fixture it names. 2.4.2.1 allows exactly that, in exchange for a written justification, and these are the two that need one:\ni. NO UTENSIL SINK in the break room (11.3.5.9 iii). Nothing is washed up there — utensils are disposable and personal items go home to be washed — so the fixture has no work to do. The justification is that there are no utensils to wash, not that a handwash basin substitutes for a sink.\nii. THE PAPER TOWEL DISPENSER has no no-touch mechanism (11.3.2.3 iii), though a towel is taken without contacting the housing. What the clause protects — clean hands not recontaminated on the way to being dried — is met, but the clause names a dispenser type, so the argument is worth making once in writing rather than at the audit."
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
           where s not like '• %')                                              as parts,
         (content->>'revision_history') like '%OPEN BEFORE ACTIVATION — two items.%' as open_two,
         (content->>'revision_history') like '%FRM-901 rev B, FRM-903 rev v6, FRM-907 rev v2%' as forms_named,
         (content->>'revision_history') like '%three items, all small%'         as stale_open,
         -- body must be untouched by this migration
         (content->'procedure')::text like '%the change is conditional%'        as conditional,
         (content->'procedure')::text like '%high-range quat strip%'            as high_range,
         (content->'procedure')::text like '%The basins are ceramic%'           as ceramic,
         (content->'procedure')::text like '%Form-0010%'                        as dangling
    into r
    from public.sop_documents where sop_number = 'FSQM-012';

  if r.lines <> 92 or r.parts <> 10 then
    raise exception 'FSQM-012 body changed when it should not have: % lines, % Parts (expected 92 / 10)',
      r.lines, r.parts;
  end if;
  if r.stale_open or not (r.open_two and r.forms_named) then
    raise exception 'FSQM-012 open list wrong: three-item wording still present=%, two items=%, form revisions named=%',
      r.stale_open, r.open_two, r.forms_named;
  end if;
  if not (r.conditional and r.high_range and r.ceramic) or r.dangling then
    raise exception 'FSQM-012 body regressed: conditional=%, high-range=%, ceramic=%, Form-0010=%',
      r.conditional, r.high_range, r.ceramic, r.dangling;
  end if;

  select status into sop113 from public.sop_documents where sop_number = 'SOP-11.3';
  if sop113 is distinct from 'active' then
    raise exception 'SOP-11.3 is % - it must stay active until FSQM-012 is issued.',
      coalesce(sop113, 'missing');
  end if;
end $$;

commit;
