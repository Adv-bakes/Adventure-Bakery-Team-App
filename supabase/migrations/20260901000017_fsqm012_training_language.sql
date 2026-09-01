-- D-13 task 13.8: record the training evidence, and correct what FSQM-012 Part 10 claims.
--
-- THE EVIDENCE EXISTS AND THIS RECORDS IT. 2.4.2.2's training limb, and 2.9.2.1 (iii) personal
-- hygiene and (iv) Good Manufacturing Practices, are met: three active modules - TRN-002, TRN-002A
-- and TRN-002B - assigned to all three members of the team, all nine assignments complete. Records
-- are in the Team Portal, reported on REP-951, with competency on FRM-952 and attendance on
-- FRM-953. 13.8 asked for "training module plus assignment records" and both were already there;
-- the modules predate this wave.
--
-- *** BUT PART 10 AS ISSUED YESTERDAY WAS WRONG, AND THIS CORRECTS IT. *** It said the three
-- modules are "available in English and Spanish and assigned in the language the employee is
-- trained in". Neither half held:
--
--   1. TRN-002A and TRN-002B exist in ENGLISH ONLY. Only TRN-002 has a Spanish deck.
--   2. The one Spanish-preferring member of staff completed ALL THREE IN ENGLISH - including
--      TRN-002, whose Spanish version exists and is active.
--
-- The second is not a bug. Her assignments were complete before the language-aware rules applied,
-- and the sync deliberately never re-languages a completed record - doing so would destroy the
-- evidence that training happened. The system behaved correctly; the DOCUMENT overstated what that
-- behaviour achieves.
--
-- WHY THIS MATTERS MORE THAN THE WORDING. 2.9.2.2 requires training on tasks critical to food safety
-- to be provided in languages understood by staff. A completion record that says "trained" while the
-- delivery was in a language the employee is not trained in is exactly the kind of claim an auditor
-- disproves by asking one person what language they trained in. Part 10 now states what is true and
-- names the gap, which is a far better position than a tidy sentence that will not survive contact.
--
-- The correction is one bullet rewritten and one added. The body grows 92 -> 93 lines.
--
-- REVISION BUMPS New -> v2, SAME DAY. FSQM-012 was issued this morning and is corrected this
-- afternoon; it is an ACTIVE controlled document, so a content change bumps the revision - that is
-- precisely the drift INT-14's report looks for. The effective date stays 2026-09-01 because that
-- is genuinely when this version takes effect.
--
-- A THIRD OPEN ACTION IS ADDED, and the two halves of it are different sizes on purpose:
--   (a) TRN-002 already has an active Spanish deck, so a Spanish-preferring employee can simply be
--       assigned it. That is an assignment decision affecting a real person's training record, so it
--       is left to the SQF Practitioner rather than done by a migration.
--   (b) TRN-002A and TRN-002B have no Spanish version AND no generator source in the repository, so
--       producing one means translating the original decks or authoring content afresh from the
--       existing English narrations. That is a build, not an afternoon, and saying so is more useful
--       than promising it.
--
-- Guarded on FSQM-012 being the active 92-line rev New carrying the sentence being corrected.

begin;

do $$
declare
  st  text;
  rev text;
  n   int;
  old boolean;
begin
  select status, revision, jsonb_array_length(content->'procedure'),
         (content->'procedure')::text like '%assigned in the language the employee is trained in%'
    into st, rev, n, old
    from public.sop_documents where sop_number = 'FSQM-012';

  if st is distinct from 'active' or rev is distinct from 'New' then
    raise exception 'FSQM-012 is % at revision % - expected the active rev New issued by 20260901000015.', st, rev;
  end if;
  if n <> 92 or not old then
    raise exception 'FSQM-012 is not the version this migration was derived from (% lines, overstated sentence present=%). Re-derive before applying.', n, old;
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content, '{procedure}', $jproc$
[
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
  "• Every employee who handles food or food-contact surfaces completes **TRN-002 Personal Hygiene & GMPs**, **TRN-002A Personnel Hygiene & Visitor Policy** and **TRN-002B Good Manufacturing Practices**. All three are active, assigned to all staff, and complete for every current member of the team. **TRN-002 exists in English and Spanish; TRN-002A and TRN-002B exist in English only.**",
  "• **Language (2.9.2.2).** Training on tasks critical to food safety shall be provided in languages understood by staff. One member of production staff is trained in Spanish. She completed all three modules in **English** — including TRN-002, whose Spanish version exists — because her assignments were already complete before the language-aware assignment rules applied, and completed records are deliberately never re-languaged. **This program therefore does not yet meet 2.9.2.2 for Spanish-speaking staff**, and says so rather than letting a completion record imply otherwise. The remedy is recorded in the open actions.",
  "• Training is delivered at induction, **before the employee works unsupervised in a food handling area**, and refreshed at the frequency set in **SOP-2.9**.",
  "• Competency is verified on **FRM-952**; attendance on **FRM-953**. Assignment, completion and outstanding training are held in the Team Portal and reported on **REP-951** (Training Matrix).",
  "• Visitors are briefed through **FRM-906**, which is the visitor training required by 11.3.4.1."
]
$jproc$::jsonb),
                   '{revision_history}',
                   to_jsonb((content->>'revision_history') || $jrh$


TRAINING VERIFIED 2026-09-01 under D-13 task 13.8. The training limb of 2.4.2.2, and 2.9.2.1 (iii) personal hygiene and (iv) Good Manufacturing Practices, are met by three active modules — TRN-002, TRN-002A and TRN-002B — assigned to all three members of the team, with all nine assignments complete. Records are held in the Team Portal and reported on REP-951; competency is verified on FRM-952 and attendance on FRM-953.

PART 10 IS CORRECTED IN THE SAME BREATH, because as issued it was wrong. It said the modules are “available in English and Spanish and assigned in the language the employee is trained in”. Neither half held: TRN-002A and TRN-002B exist in English only, and the one Spanish-preferring member of staff completed all three in English. A claim that an auditor could disprove by asking one employee what language they trained in is worse than no claim, so Part 10 now states what is actually true and names the gap.

OPEN ACTIONS AT ISSUE — a third item joins the two already listed.
3. SPANISH TRAINING FOR 2.9.2.2. Two things are needed and they are different sizes. (a) TRN-002 already has an active Spanish deck, so a Spanish-preferring employee can be assigned it directly — this is an assignment decision, not a build, and it affects a real person's training record, so it is left to the SQF Practitioner rather than done by migration. (b) TRN-002A and TRN-002B have no Spanish version and no generator source in the repository, so producing one means either translating the original decks or authoring the content afresh from the existing English narrations. That is a build, not an afternoon. Until both are done, the position stated in Part 10 stands.
$jrh$)),
       revision = 'v2'
 where sop_number = 'FSQM-012'
   and status = 'active'
   and revision = 'New';

do $$
declare
  r record;
begin
  select revision, effective_date, approved_by,
         jsonb_array_length(content->'procedure')                                as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s not like '• %')                                      as parts,
         (content->'procedure')::text like '%assigned in the language the employee is trained in%' as stale,
         (content->'procedure')::text like '%TRN-002A and TRN-002B exist in English only%'         as truthful,
         (content->'procedure')::text like '%does not yet meet 2.9.2.2%'                           as gap_named,
         (content->>'revision_history') like '%TRAINING VERIFIED 2026-09-01%'                      as verified,
         (content->>'revision_history') like '%SPANISH TRAINING FOR 2.9.2.2%'                      as action3,
         -- the rest of the program must be untouched
         (content->'procedure')::text like '%sanitizing foot baths%'                               as foot_baths,
         (content->'procedure')::text like '%The basins are ceramic%'                              as ceramic,
         (content->'procedure')::text like '%recorded in **FSQM-013**%'                            as fsqm013
    into r
    from public.sop_documents where sop_number = 'FSQM-012';

  if r.revision <> 'v2' then
    raise exception 'FSQM-012 revision is %, expected v2.', r.revision;
  end if;
  if r.effective_date <> date '2026-09-01' or r.approved_by is distinct from 'GJM' then
    raise exception 'FSQM-012 issue metadata disturbed: effective %, approved %.',
      r.effective_date, r.approved_by;
  end if;
  if r.lines <> 93 or r.parts <> 10 then
    raise exception 'FSQM-012 body wrong shape: % lines, % Parts (expected 93 / 10).',
      r.lines, r.parts;
  end if;
  if r.stale then
    raise exception 'FSQM-012 still claims modules are assigned in the language the employee is trained in.';
  end if;
  if not (r.truthful and r.gap_named) then
    raise exception 'The correction did not land: English-only statement=%, 2.9.2.2 gap named=%.',
      r.truthful, r.gap_named;
  end if;
  if not (r.verified and r.action3) then
    raise exception 'Revision history wrong: training verified=%, third open action=%.',
      r.verified, r.action3;
  end if;
  if not (r.foot_baths and r.ceramic and r.fsqm013) then
    raise exception 'FSQM-012 regressed earlier content: foot baths=%, ceramic=%, FSQM-013 reference=%.',
      r.foot_baths, r.ceramic, r.fsqm013;
  end if;
end $$;

commit;
