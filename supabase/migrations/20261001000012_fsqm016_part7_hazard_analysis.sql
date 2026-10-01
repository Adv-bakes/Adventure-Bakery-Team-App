-- D-14: FSQM-016 Food Safety Plan (still DRAFT) - Part 7, the hazard analysis, is written.
--
-- Workbook tasks 14.5 and 14.6, and the last Part of the plan that was marked NOT YET WRITTEN. The
-- eight Major findings (2.4.3.1 to 2.4.3.11) turn on a hazard analysis that follows the Codex steps;
-- this is it, in draft, for the food safety team to review.
--
-- WHAT IT IS: every step of the confirmed 20-step flow (Attachment A), each hazard typed B / C / P,
-- scored likelihood x severity by the method in Part 6, with the reason and the control measure.
-- Step headings are bullets and each hazard is a sub-item, so the Part reads as a table would.
--
-- WHAT IT IS NOT: the team's adopted analysis. It was drafted from the flow diagram, the issued
-- programs and the owner's answers. The document says so in its first lines and in its history.
--
-- WRITTEN WITHOUT THE WATER ACTIVITY. No sample has been sent. Under Part 6 a severity-3 hazard
-- cannot be called unlikely without evidence, so growth of C. botulinum / S. aureus in the
-- vacuum-sealed product is scored SIGNIFICANT until the finished, sealed product is measured. The
-- product description line that said the figure would be recorded BEFORE Part 7 was written is
-- reworded to say what was actually done.
--
-- THE SYRUP GAP FROM THE FLOOR WALK IS CLOSED (owner, 2026-10-01): two parts sugar to one part
-- water, rum added after heating; 30-day hold, sealed, ambient; container labelled with the date
-- made and a lot code. The supplier sheet offered for a six-month hold (an invert syrup, in its
-- original sealed packaging) describes a different product and is not used.
--
-- THE ANALYSIS REPORTS FOUR SIGNIFICANT HAZARDS WITHOUT A PROVEN CONTROL, in the document itself:
-- water activity, foreign material (no detection), the bake (not validated), post-bake
-- recontamination (environmental monitoring not in force). It also scores a failed seal as not
-- significant, which Part 8 has to deal with. None of that is softened here: a plan that read as
-- complete would be the defect the gap assessment found.
--
-- Draft content edit: status and revision untouched. Guarded on the md5 of the content EXCLUDING
-- attachments (the diagram files may be re-uploaded around this), as read from production
-- 2026-10-01.

begin;

do $guard$
declare h text; st text;
begin
  select md5((content - 'attachments')::text), status into h, st from public.sop_documents where sop_number = 'FSQM-016';
  if st is distinct from 'draft' or h <> 'e84d42a3c19effdd6ed5fdd5342bff21' then
    raise exception 'FSQM-016 is % or changed since this migration was written (md5 %).', st, h;
  end if;
end $guard$;

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content, '{procedure}', $proc$
[
 "Scope",
 "> The plan starts at the receipt of ingredients and packaging and ends when finished product is collected by the customer's carrier. Every input and output in between - raw materials, packaging, service inputs, the two overnight delays, waste and rework - is shown on the flow diagram in Attachment A (SQF 2.4.3.3).",
 "Product description",
 "• Product: rum cake, in several flavours, made for Bahamas Rum Cake Factory. A shelf-stable baked product, stored and distributed at ambient temperature.",
 "• Composition: cake mix (containing wheat flour, sugar and nonfat dry milk), liquid whole eggs, soybean oil, water and flavour emulsion; the molds are sprayed with a pan release of soybean oil and soy lecithin before depositing; after baking, dipped in a syrup of water, sugar and rum.",
 "• Allergens: wheat, milk, egg and soy, as declared on each flavour's approved label.",
 "• Packaging: vacuum-sealed pouch in a baking cup, in an individual product box; boxes packed in coded master cases, palletized and stretch wrapped.",
 "• Shelf life: 12 months, printed on the pack as a Best By month and year.",
 "• Water activity and pH: not yet measured.",
 "> Each flavour's finished product specification is its entry on FRM-704, which this description refers to (SQF 2.4.3.4). The product is called shelf stable because of reduced water activity, but that figure has not been measured, and the syrup added after baking returns water and sugar to the product. Part 7 has therefore been written with growth in the sealed product scored as significant. The water activity of the finished, sealed product is recorded here when it has been measured, and that line of Part 7 is then scored again.",
 "Intended use",
 "• Ready to eat; no further cooking by the consumer.",
 "• General public. The product contains rum. The June 2026 plan cautioned against its use by immunocompromised individuals, infants and pregnant women without physician guidance; the food safety team is to confirm that caution and the vulnerable groups it names (SQF 2.4.3.5).",
 "Food safety team",
 "• SQF Practitioner - leads the team. Brings the production process, the equipment and the CCP monitoring as they are performed on the floor.",
 "• Senior Site Manager - substitute SQF Practitioner. Brings the product, its formulation, raw materials and packaging, and approves this plan.",
 "• Engineering knowledge is not held on the team. It is taken from the equipment manufacturers' manuals and their service technicians, and the source is named wherever this plan relies on it (SQF 2.4.3.2).",
 "• Who holds each position is recorded on FRM-005 and in FSQM-004, not here, so that this plan does not have to be reissued when a person changes.",
 "• The team meets as each remaining Part of this plan is written, and afterwards at least annually for the full review and whenever a change requires one (Part 9). Its decisions are recorded by revising this plan, and the annual review is also recorded on FRM-001.",
 "> HACCP TRAINING - NOT YET HELD. No member of the team holds a HACCP training certificate. SQF 2.1.1.5 requires the SQF Practitioner to have completed HACCP training, and an auditor checks for it here first. The SQF Practitioner and the Senior Site Manager are each to complete a HACCP course; each certificate is filed on FRM-952 and this Part revised to say so. Until then the team meets 2.4.3.2 in its membership but cannot yet show the competence it asks for.",
 "Process flow diagram",
 "• The flow diagram is Attachment A. It shows every step from receipt to dispatch across the three days, every raw material, packaging item and service input, the two scheduled overnight delays, and every output including waste and the one rework loop.",
 "• The food safety team confirms it on the floor, on each day of the rotation, and records that by dating and signing the confirmation block on the diagram. That signed block is the confirmation SQF 2.4.3.6 requires.",
 "• The diagram is re-confirmed whenever the process, equipment or rotation changes, and at the annual review of this plan.",
 "> FSQM-039 Facility Layout and Product Flow shows where equipment stands and where product goes on the floor. It is not this flow diagram and is not offered as one.",
 "Hazard significance methodology",
 "• Name every hazard specifically and type it as biological, chemical (allergens included) or physical: Salmonella, not \"pathogens\"; hard or sharp foreign material from a named source, not \"foreign material\".",
 "• LIKELIHOOD, judged as if the step's own control measure were absent:",
 "◦ 1 = Unlikely: no record of it for this material or process, in the industry or at the site.",
 "◦ 2 = Possible: known to occur in the industry for this kind of material or process.",
 "◦ 3 = Likely: has occurred at this site, or is expected without control.",
 "• SEVERITY, the worst harm a consumer could reasonably suffer:",
 "◦ 1 = Low: brief discomfort, no lasting effect.",
 "◦ 2 = Moderate: illness or injury needing treatment, without lasting harm.",
 "◦ 3 = High: serious illness or injury, hospitalisation or death.",
 "• ALWAYS SEVERITY 3: an undeclared allergen; a pathogen such as Salmonella or Listeria monocytogenes; hard or sharp foreign material 7 mm to 25 mm long.",
 "• SCORE = likelihood × severity. 6 or 9 = SIGNIFICANT. 1 to 4 = not significant, and the analysis records why.",
 "• EVIDENCE FOR \"UNLIKELY\": a severity 3 hazard scored as unlikely (a score of 3) records the evidence that makes it unlikely. \"Unlikely\" cannot be asserted without it.",
 "> WHY THE STEP'S OWN CONTROL IS SET ASIDE. A hazard is judged as if the control at that step were not there. Otherwise every hazard the site already controls would score as unlikely and not significant, and the analysis would conclude that nothing needs controlling. A prerequisite program that is documented, implemented and verified - supplier approval, GMP, sanitation, pest control - may be counted when judging likelihood, and the analysis names the program it relies on.",
 "> Evidence for a likelihood or severity score comes from the FDA's Hazard Analysis and Risk-Based Preventive Controls for Human Food guidance (its appendix of hazards by ingredient and process), product recalls and outbreaks involving similar products, supplier information, and this site's own records of complaints, holds and deviations.",
 "• Every significant hazard is given a control measure in Part 7 and is taken through the CCP decision in Part 8. Every hazard that is not significant is recorded with the reason and the prerequisite program that keeps it so.",
 "• Each row of the analysis records the step, the hazard, its type and source, the likelihood, severity and score, whether it is significant, the justification, and the control measure.",
 "> This method is applied in exactly the same way to every hazard at every step (SQF 2.4.3.8). It is changed only by revising this Part, and a change to it means every hazard in Part 7 is scored again.",
 "Hazard analysis and control measures",
 "> This Part applies the method in Part 6 to every step on Attachment A. Each line under a step is one hazard: its type (B biological, C chemical including allergens, P physical), what it is and where it comes from, likelihood × severity = score, whether it is significant, why, and the control measure. Likelihood is judged as if the step's own control were absent (SQF 2.4.3.7 to 2.4.3.9).",
 "> THE SCORES BELOW ARE THE DRAFT PUT TO THE FOOD SAFETY TEAM. The team checks every line against the floor and adopts or changes it before this plan is issued.",
 "• STEP 1 - Receive ingredients and packaging.",
 "◦ B - Salmonella and Shiga toxin-producing E. coli in the cake mix (wheat flour, nonfat dry milk): L2 × S3 = 6, SIGNIFICANT. Flour is milled from raw grain and is not treated to kill pathogens; flour and dry mixes have caused outbreaks and recalls, and milk powder is a known Salmonella vehicle. Control: the bake at step 7.",
 "◦ B - Salmonella in the liquid whole egg: L2 × S3 = 6, SIGNIFICANT. Liquid egg is normally sold pasteurised, but Salmonella survives a failed pasteurisation and grows if the cold chain fails. Control: supplier approval (SOP-2.3.4, FRM-202), receipt at 41°F or below recorded on FRM-301 (FSQM-035), and the bake at step 7.",
 "◦ C - An allergen that is not on the finished product's label, arriving in an ingredient: a supplier changes a recipe, or a different brand is bought in place of the usual one. L2 × S3 = 6, SIGNIFICANT. The ingredients are bought from cash-and-carry suppliers, where the brand on the shelf can change. Control: each material's declaration is recorded word for word from its pack on FRM-207, and the brand received is recorded on FRM-301.",
 "◦ C - Mycotoxins and pesticide residues in the wheat flour and sugar: L1 × S2 = 2, not significant. Regulated at the mill and the refinery; no history at the site. Kept so by supplier approval (SOP-2.3.4).",
 "◦ P - Hard or sharp foreign material (metal, glass, stone, hard plastic) in an ingredient as received: L2 × S3 = 6, SIGNIFICANT. It is known to occur in bagged dry ingredients, and the site holds no supplier evidence that would make it unlikely. Control: NONE AT THIS SITE TODAY - there is no sieve, magnet or metal detector (FSQM-013). See the findings below.",
 "◦ C - Food-contact packaging (vacuum pouches, baking cups) that is not suitable for food: L1 × S2 = 2, not significant. Kept so by the packaging specifications on FRM-207; the suppliers' letters of guarantee are still to be obtained.",
 "• STEP 2 - Store: dry goods at ambient temperature, liquid eggs refrigerated.",
 "◦ B - Salmonella growing in liquid egg held above 41°F: L2 × S3 = 6, SIGNIFICANT. Control: the walk-in is monitored continuously, with alerts (SOP-401, FRM-401); the bake at step 7.",
 "◦ C - An allergen that is not on this product's label, from another product's ingredients stored on site: L2 × S3 = 6, SIGNIFICANT. Control: allergen ingredients are kept sealed on their own labelled rack and never above other ingredients (FSQM-035).",
 "◦ C - Cleaning chemicals contaminating stored ingredients or packaging: L1 × S2 = 2, not significant. Chemicals are kept in the locked locker, away from ingredients and packaging (FSQM-032, FSQM-035).",
 "◦ B, P - Contamination by pests: L2 × S2 = 4, not significant. Kept so by FSQM-031 and by sealed containers.",
 "• STEP 3 - Weigh and measure ingredients, including water.",
 "◦ B - Pathogens from hands, utensils or the bench into the ingredients: L2 × S3 = 6, SIGNIFICANT. Control: the bake at step 7; handwashing and illness rules (FSQM-012); the pre-operation check (FRM-903).",
 "◦ B, C - Contaminated water used as an ingredient: L1 × S3 = 3, not significant. Evidence: the City of Sanford's treated supply and its annual water quality report (FRM-915), and the water is then baked. FSQM-033 is still a draft and the site's own yearly test has not yet been done.",
 "◦ P - Pieces of ingredient packaging (paper, film, thread) falling in when a bag is opened: L2 × S2 = 4, not significant. Soft, not hard or sharp. Kept so by GMP (FSQM-012).",
 "• STEP 4 - Mix batter.",
 "◦ P - Metal from the mixer bowl, the agitator or a loose part: L2 × S3 = 6, SIGNIFICANT. Control: the mixer is checked clean, complete and with nothing left on it before use (FRM-909) and is on the monthly maintenance check (FSQM-029, FRM-508). There is no detection step after it - see the findings below.",
 "◦ C - An allergen that is not on this product's label, left on the mixer by a different product: L2 × S3 = 6, SIGNIFICANT. Control: the allergen changeover clean and inspection (SOP-901), recorded on FRM-909.",
 "◦ C - Detergent, sanitizer or lubricant left on the mixer: L1 × S2 = 2, not significant. The sanitizer is made up to its no-rinse food-contact strength and read with a test strip (SOP-901, FSQM-032).",
 "◦ B - Staphylococcus aureus growing and forming toxin in batter left standing: L1 × S2 = 2, not significant. All batter is deposited and baked on the day it is mixed.",
 "• STEP 5 - Spray molds with pan release.",
 "◦ C - Soy, from the soy lecithin in the pan spray: present by design and declared on the label, so it is not scored here. A change of pan spray is the ingredient hazard at step 1.",
 "◦ P - Fragments from a chipped, cracked or flaking mold: L1 × S3 = 3, not significant. Evidence: every mold is checked before each use and inspected at each wash, and a damaged mold is taken out of service (SOP-906, FRM-903).",
 "• STEP 6 - Deposit batter into the sprayed molds.",
 "◦ P - Metal, hard plastic, a seal or an O-ring from the depositor: L2 × S3 = 6, SIGNIFICANT. Control: the depositor is checked at reassembly and before use (FRM-910, FRM-911) and is on the monthly maintenance check (FSQM-029). There is no detection step after it - see the findings below.",
 "◦ C - An allergen left on the depositor by a different product: as for the mixer at step 4, SIGNIFICANT. Control: the allergen changeover clean (SOP-902, SOP-903), recorded on FRM-910 or FRM-911.",
 "• STEP 7 - Bake.",
 "◦ B - Salmonella, Shiga toxin-producing E. coli and Listeria monocytogenes from the flour, egg and milk powder surviving the bake: L3 × S3 = 9, SIGNIFICANT. They are expected in raw batter and this is the only step that kills them. Control: oven at 350°F or above for at least 27 minutes, recorded for every load on FRM-507. These limits are carried from the June 2026 plan and have not been validated for this product in this oven, and the product's internal temperature is not measured - see the findings below.",
 "◦ B - Spores of Bacillus cereus and Clostridium species from the flour, sugar and milk powder surviving the bake: L3 × S2 = 6, SIGNIFICANT. Baking does not kill spores; they are a hazard only if they can grow afterwards. Control: none at this step. Growth is prevented by the water activity of the finished product, which has not been measured - see step 13.",
 "◦ C - Acrylamide formed in baking: L2 × S1 = 2, not significant. A long-term dietary concern, not an acute one, at a normal bake colour.",
 "• STEP 8 - Remove from the oven and cool in the pans, covered, at room temperature.",
 "◦ B - Salmonella or Listeria monocytogenes reaching the baked product from racks, covers, hands or the room: L2 × S3 = 6, SIGNIFICANT. The product is ready to eat from here on, and nothing later kills what lands on it. Control: sanitation and the pre-operation release (FRM-903, FRM-902), GMP (FSQM-012) and the hygiene zoning of the cooling area (FSQM-039). The environmental monitoring that would verify this (FSQM-015) is still a draft.",
 "◦ B - Spores that survived the bake growing while the product cools: L2 × S2 = 4, not significant, PROVISIONAL. The cooling time is not limited - depanning may follow later the same day or the next day - and whether spores can grow in the baked product depends on its water activity, which has not been measured.",
 "• STEP 9 - Depan.",
 "◦ B - Staphylococcus aureus, norovirus or Salmonella from hands onto ready-to-eat product: L2 × S3 = 6, SIGNIFICANT. Control: handwashing, gloves and the illness and wound rules (FSQM-012), checked on the GMP inspection (FRM-913).",
 "• STEP 10 - Prepare dipping syrup, only when none is in stock.",
 "◦ B - Pathogens in the sugar, water or rum: L1 × S3 = 3, not significant. Evidence: refined sugar, treated city water and distilled spirit are not known vehicles for Salmonella, and the sugar and water are heated in the kettle before the rum is added. The temperature reached is not recorded.",
 "◦ B - Yeasts, molds or bacteria growing in syrup kept for a later run: L2 × S2 = 4, not significant. The syrup is two parts sugar to one part water, with rum added: a concentrated sugar syrup with alcohol, in which food-poisoning bacteria are not expected to grow. Its own water activity has not been measured and the amount of rum is not recorded here. Kept so by the hold rule below.",
 "◦ SYRUP HOLD RULE. Prepared syrup is kept sealed, at room temperature, for no more than 30 days from the day it was made; it is normally used within a few days. The container is labelled with the date made and a lot code in the same form as the product's - the last digit of the year and the three-digit day of the year. Syrup that is past 30 days, unlabelled, or showing gas, cloudiness, mold or an off smell is discarded.",
 "◦ P - Fragments from the kettle or utensils: L1 × S3 = 3, not significant. Evidence: the kettle is cleaned and checked before use (SOP-904, FRM-912).",
 "• STEP 11 - Dip the baked product in syrup at room temperature.",
 "◦ B - Pathogens carried onto ready-to-eat product by the syrup, the dip container, utensils or hands: L2 × S3 = 6, SIGNIFICANT. This is a wet step after the only kill step. Control: the changeover clean of the dunk bay before Day 2 and its pre-operation release (FRM-903); GMP (FSQM-012); the syrup hold rule at step 10.",
 "◦ B - The syrup adds water back to the baked product. Its effect on growth in the finished product is scored at step 13.",
 "• STEP 12 - Place in baking cups.",
 "◦ B - Hand contact with ready-to-eat product: as step 9, SIGNIFICANT, with the same control.",
 "• STEP 13 - Vacuum seal.",
 "◦ B - Clostridium botulinum or Staphylococcus aureus growing in the sealed product during up to twelve months at room temperature: L2 × S3 = 6, SIGNIFICANT UNTIL THE WATER ACTIVITY IS MEASURED. A vacuum pouch removes air, which favours C. botulinum, and the product is kept unrefrigerated. Below a water activity of 0.85 no food-poisoning bacteria grow, and the product is believed to be below it; but Part 6 does not allow a severity 3 hazard to be called unlikely without evidence, and there is none. Control: the product's formulation - its sugar and rum - which becomes a stated control with a limit once the water activity of the finished, sealed product has been measured.",
 "◦ B - Contamination or mold growth through a leaking, channelled or partial seal: L2 × S2 = 4, not significant by this method. Every pouch is checked and pull tested, and recorded on FRM-606.",
 "◦ REWORK - a pouch that fails is opened and the product re-pouched. The hand-contact hazard of step 9 applies, with the same control.",
 "• STEPS 14 TO 17 - Box; label, lot code and best-by date; pack and code master cases; palletize and stretch wrap.",
 "◦ C - The wrong label or box, or a label that does not declare wheat, milk, egg and soy: L2 × S3 = 6, SIGNIFICANT. Control: labels are approved on FRM-601 (SOP-2.3.2.3), and the label applied is checked against the approved label at release on FRM-701 (FSQM-020).",
 "◦ C - Coder ink: L1 × S1 = 1, not significant. It is applied to the outside of the box and the case only, never to a food-contact surface.",
 "• STEP 18 - Release check.",
 "◦ No hazard is introduced. The check on FRM-701 is itself a control: no batch leaves under an open hold, without its pre-operation release recorded, or with a label that is not the approved one (FSQM-020).",
 "• STEPS 19 AND 20 - Warehouse storage at ambient temperature, and dispatch.",
 "◦ B - Growth in the sealed product over its shelf life: scored at step 13.",
 "◦ B, P - Pests or handling damaging packs: L1 × S2 = 2, not significant. Kept so by FSQM-031, FSQM-035 and the loading check on FRM-801 (FSQM-036).",
 "• AT EVERY STEP.",
 "◦ P - Glass or brittle plastic from lights, gauges or fittings: L1 × S3 = 3, not significant. Evidence: every item is on the register and checked (SOP-11.7.3, FRM-907), and a breakage is handled on FRM-908.",
 "◦ P - Jewellery, pens, dressings and other personal items: L1 × S2 = 2, not significant. Kept so by FSQM-012.",
 "◦ C - Sanitizer or detergent on a food-contact surface at the wrong strength: L2 × S2 = 4, not significant. The strength is read with a test strip and recorded (FRM-903, FSQM-032).",
 "◦ Compressed air, ice and steam do not contact the product (FSQM-013), so no hazard arises from them.",
 "> WHAT THIS ANALYSIS FINDS. Four of the significant hazards above do not yet have a control that is in place and proven, and this plan cannot be issued as complete until each is settled.",
 "• WATER ACTIVITY. Whether pathogens can grow in the finished product is not known, because its water activity has never been measured. The measurement that decides it is of the product as sold - after the dip, sealed, and left a day or more to settle - and not of the cake before it is dipped: the syrup puts water back, and the sealed pack is what sits at room temperature for a year. Water activity is not wetness; sugar and alcohol hold water so that microbes cannot use it, which is why a syrup-soaked cake can still measure low.",
 "• FOREIGN MATERIAL. Hard or sharp foreign material is a significant hazard at steps 1, 4 and 6, and nothing in the process would find it. The metal detector named in FSQM-013 Part 5 is the planned control; until it is installed and its limits are set, the pre-use equipment checks are the only measure.",
 "• THE BAKE. The limits of 350°F and 27 minutes have not been validated against this product in this oven, and the internal temperature is not measured. Validation is workbook tasks 14.7 to 14.9.",
 "• AFTER THE BAKE. Recontamination of ready-to-eat product at steps 8 to 12 is controlled by cleaning and hygiene alone. Environmental monitoring (FSQM-015) is what would show that this control works, and it is not yet in force.",
 "> Part 8 takes each significant hazard through the CCP decision. Two results of this analysis bear on it. The failed-seal hazard at step 13 scores as not significant, so the team must decide whether vacuum sealing remains a critical control point. And if water activity proves to be the control for growth, its limit belongs in Part 8.",
 "Critical control points",
 "• CCP 1 - Baking: oven at least 350°F for at least 27 minutes, recorded on FRM-507 CCP 1 Baking Monitoring Record. The June 2026 plan also sets an internal temperature of at least 180°F at the end of the bake; the product is not probed today, and FRM-507 records that.",
 "• CCP 2 - Vacuum sealing: every pouch sealed intact with no leak, channel, wrinkle or partial seal, checked with the pull test, recorded on FRM-606 CCP 2 Vacuum Sealing Monitoring Record. The vacuum level and seal width for the site's machine are not yet confirmed.",
 "• A failed limit stops the step. The affected product is held on FRM-702 and dispositioned under FSQM-018, and the cause is corrected under FSQM-009 on FRM-007 (SQF 2.4.3.13).",
 "> The CCPs are carried forward from the June 2026 plan so that they are monitored and recorded while this plan is rebuilt. They are re-determined from the hazard analysis in Part 7 and their critical limits validated under workbook tasks 14.7 to 14.9 (SQF 2.4.3.10 and 2.4.3.11); this Part is revised then.",
 "Verification and review",
 "• The CCP records are reviewed and signed weekly under FSQM-017 (SQF 2.4.3.15 and 2.4.3.16).",
 "• The food safety team reviews this plan in full at least annually, and whenever the product, ingredients, process, equipment or packaging changes in a way that could affect food safety (SQF 2.4.3.14 and 2.3.1.3)."
]
$proc$::jsonb),
                   '{revision_history}', to_jsonb((content->>'revision_history') || $hist$

New (draft) - 2026-10-01 - PART 7 WRITTEN (workbook tasks 14.5 and 14.6): the hazard analysis, step by step against the confirmed 20-step flow diagram, scored by the method in Part 6. With it every Part of this plan has text; none is marked NOT YET WRITTEN.

IT IS A DRAFT FOR THE FOOD SAFETY TEAM, NOT THE TEAM'S ANALYSIS. The hazards, scores and controls were drafted from the flow diagram, the site's issued programs and what the site has said about its process. The team checks each line against the floor and adopts or changes it. No member of the team yet holds HACCP training (Part 4).

WRITTEN BEFORE THE WATER ACTIVITY IS KNOWN. The product description had said the water activity was to be recorded before Part 7 was written. It has not been measured, so growth in the sealed product is scored as significant, as Part 6 requires of a severity 3 hazard with no evidence. The measurement needed is of the finished, sealed product - not of the cake before it is dipped.

SYRUP (site, 2026-10-01): made two parts sugar to one part water, with rum added after heating; normally used within a few days; a hold limit of 30 days is set, sealed at room temperature; the container carries the date made and a lot code in the product's form. This closes the gap carried on the drawing since 2026-09-28. A supplier's specification for an invert syrup, giving six months in its original sealed packaging, was offered as the basis for a longer hold and was not used: it describes a different product in a different pack.

WHAT THE ANALYSIS FOUND: four significant hazards without a control that is in place and proven - growth in the sealed product (water activity unmeasured), hard or sharp foreign material (no detection; a metal detector is planned), the bake (limits not validated, internal temperature not measured), and recontamination after the bake (environmental monitoring not in force). It also scores a failed seal as not significant, which puts CCP 2 in question for Part 8.

OPEN BEFORE ISSUE: (1) the water activity, and pH, of the finished sealed product; (2) the team's review of every line; (3) which allergens other than wheat, milk, egg and soy are on the site; (4) that the liquid egg is pasteurised, from its pack - FRM-207 holds four materials so far; (5) whether a delivery of a brand that is not the one on FRM-207 is held until it has been checked - nothing requires it today; (6) the syrup: how much rum goes in, whether syrup already used for dipping may be kept, and writing the syrup's lot code on the lot record (FRM-520) of each batch dipped in it; the 30 days is the site's limit, not a measured one; (7) the metal detector; (8) validation of the bake; (9) FSQM-015; (10) the CCP decision in Part 8.$hist$))
 where sop_number = 'FSQM-016' and status = 'draft';

do $verify$
declare d record; p jsonb; rh text; n int;
begin
  select status, revision, content->'procedure' as p, content->>'revision_history' as rh,
         jsonb_array_length(coalesce(content->'attachments', '[]'::jsonb)) as att
    into d from public.sop_documents where sop_number = 'FSQM-016';
  p := d.p; rh := d.rh;
  if d.status <> 'draft' or d.revision <> 'New' then
    raise exception 'FSQM-016 status or revision changed: % / %.', d.status, d.revision;
  end if;
  if jsonb_array_length(p) <> 123 then
    raise exception 'FSQM-016 procedure is % lines, expected 123.', jsonb_array_length(p);
  end if;
  -- still nine Parts, in the same order
  select count(*) into n from jsonb_array_elements_text(p) l where left(l, 2) not in ('• ', '◦ ', '> ');
  if n <> 9 then raise exception 'FSQM-016 has % Part headings, expected 9.', n; end if;
  if p::text like '%NOT YET WRITTEN%' then
    raise exception 'FSQM-016 still has a Part marked NOT YET WRITTEN.';
  end if;
  -- every step of the flow is analysed
  select count(*) into n from jsonb_array_elements_text(p) l where l like '• STEP%';
  if n <> 16 then raise exception 'FSQM-016 Part 7 has % step headings.', n; end if;
  if (select count(*) from unnest(array['STEP 1 -','STEP 2 -','STEP 3 -','STEP 4 -','STEP 5 -','STEP 6 -','STEP 7 -','STEP 8 -',
         'STEP 9 -','STEP 10 -','STEP 11 -','STEP 12 -','STEP 13 -','STEPS 14 TO 17 -','STEP 18 -','STEPS 19 AND 20 -']) s
       where p::text like '%' || s || '%') <> 16 then
    raise exception 'FSQM-016 Part 7 does not cover every step of the flow.';
  end if;
  -- every scored hazard states its significance
  select count(*) into n from jsonb_array_elements_text(p) l
   where l ~ 'L[1-3] × S[1-3] = [1-9]' and l !~ '(SIGNIFICANT|not significant)';
  if n <> 0 then raise exception '% scored hazard(s) do not state significance.', n; end if;
  -- the arithmetic and the threshold of Part 6 hold on every line
  select count(*) into n
    from jsonb_array_elements_text(p) l, regexp_matches(l, 'L([1-3]) × S([1-3]) = ([1-9])') m
   where m[1]::int * m[2]::int <> m[3]::int
      or (m[3]::int >= 6) <> (l ~ ', SIGNIFICANT');
  if n <> 0 then raise exception '% hazard line(s) have a wrong score or the wrong side of the threshold.', n; end if;
  if p::text not like '%SYRUP HOLD RULE%' or p::text not like '%no more than 30 days%'
     or p::text not like '%SIGNIFICANT UNTIL THE WATER ACTIVITY IS MEASURED%' or p::text not like '%WHAT THIS ANALYSIS FINDS%' then
    raise exception 'FSQM-016 Part 7 is missing the syrup rule, the water activity line or the findings.';
  end if;
  if rh not like '%PART 7 WRITTEN%' or rh not like '%ATTACHMENT A CORRECTED IN FIVE PLACES%' then
    raise exception 'FSQM-016 revision history not appended as intended.';
  end if;
  if (p::text || rh) like '%' || chr(13) || '%' then raise exception 'FSQM-016 contains a carriage return.'; end if;
  if d.att <> 2 then raise exception 'FSQM-016 attachments changed: %.', d.att; end if;
  -- the Parts that were not meant to change
  if p->>0 <> 'Scope' or p->>25 <> 'Hazard significance methodology' or p->>43 <> 'Hazard analysis and control measures'
     or p->>115 <> 'Critical control points' then
    raise exception 'FSQM-016 changed outside Part 7 and the water activity note.';
  end if;
end $verify$;

commit;
