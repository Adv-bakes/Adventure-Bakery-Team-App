-- FSQM-015 Environmental Monitoring Program (DRAFT): shortened, and the sampling schedule written in.
--
-- Owner, 2026-10-07: the draft read as far heavier than the work it describes. Rewritten in plain
-- wording, 79 procedure lines to 62 (18 of them are the sample points). Same eight Parts, so FRM-706's
-- pointer to Part 7 still holds; the sample points are unchanged, word for word.
--
-- New: the schedule (SQF 2.4.8.2 ii, iii). A round at least every FOUR MONTHS (the Code sets no
-- interval; the owner chose four months), eight swabs a round - the dunk sink and the perforated tray
-- every round, six other points in turn, every point at least once a year - on a Day 2 morning after
-- the changeover clean.
--
-- Roles: "Production Supervisor" and "Senior Site Management" are replaced by the positions the
-- site has (Production staff, Management team).
--
-- Still draft. Form references, records and attachments are untouched. ONE UPDATE.

begin;

do $guard$
declare d record;
begin
  select status, revision, md5(content::text) as cmd5 into d from public.sop_documents where sop_number = 'FSQM-015';
  if d.status is distinct from 'draft' or d.revision is distinct from 'New' then
    raise exception 'FSQM-015 is not the draft this migration expects.';
  end if;
  if d.cmd5 <> 'b9917d97db7b8206afa30c6abbde0494' then
    raise exception 'FSQM-015 has changed since this migration was written (%).', d.cmd5;
  end if;
  if (select count(distinct sop_number) from public.sop_documents
       where sop_number in ('FSQM-009', 'FSQM-012', 'FSQM-013', 'FSQM-014', 'FSQM-016', 'FSQM-017', 'FSQM-018', 'FSQM-020', 'FSQM-039',
                            'FRM-001', 'FRM-007', 'FRM-009', 'FRM-206', 'FRM-702', 'FRM-706', 'FRM-952')
         and status in ('active', 'draft')) <> 16 then
    raise exception 'a document FSQM-015 names is missing.';
  end if;
end $guard$;

update public.sop_documents
   set content = content || $q${"purpose": "This program states how Adventure Bakery checks its production rooms for harmful bacteria: where and when swabs are taken, what they are tested for, what is done about a bad result, and how the results are reviewed. It addresses SQF 2.4.8, Environmental Monitoring.", "scope": "The production room on all three days of the rotation, the packaging materials storage, the warehouse where finished product is held, and the break area.\n\nIt does not cover testing of ingredients, packaging or product (FSQM-014), the zoning drawing (FSQM-039), or the cleaning procedures themselves.", "definitions": "Zone (1 to 4): how close a sample point is to open product. It belongs to the point, and is not one of the hygiene areas drawn on FSQM-039.\nRound: the set of swabs taken on one visit.\nPresumptive positive: a first result showing the organism may be present, reported before the confirming test is finished.", "responsibility": "SQF Practitioner - owns this program, takes or supervises the swabs, reads the results, decides what is done about a bad one, and reports the results.\nManagement team - approves this program and pays for the testing at the frequency it states.\nProduction staff - keep to the hygiene rules of FSQM-012 and do not clean a sample point specially before a round.\nLaboratory - analyses the samples by an accredited method and reports the results.", "procedure": ["Why this program exists", "• The oven is the only step that kills bacteria. After it the product cools in its molds on covered racks, is depanned onto a table, is dunked and drained on a perforated tray, and is placed on a baking tray before it goes into its pouch. All of that time it is open to the room.", "• Anything living in the room can reach the product then, and nothing later kills it. This program looks for it in the room, because testing finished product rarely finds a problem that sits in one corner of a room (SQF 2.4.8.1).", "What it covers", "• The production room on all three days of the rotation, the packaging materials storage, the warehouse where finished product is held, and the break area.", "• Not covered: testing of ingredients, packaging or product. The site inspects product and does not analyse it (FSQM-014). Every sample here is taken from the room.", "• Not covered: ambient air testing and the other high-risk process clauses (SQF 11.7.1.1 to 11.7.1.5). FSQM-013 records that the site processes no high-risk food, so those clauses are not engaged. HIGH CARE on FSQM-039 is the site's own name for where product is open after the oven; it is not a high-risk area under the Code. This is looked at again when the water activity of the finished product is measured.", "Zones and sample points", "• Every sample point is in one of four zones, by how close it is to open product. The zones are not the hygiene areas drawn on FSQM-039: an area says what may happen in a place, a zone says what a result found there would mean.", "• Zone 1 - surfaces that touch open product.", "◦ 1-A Depanning table top", "◦ 1-B Dunk sink, inside", "◦ 1-C Perforated dunking tray", "◦ 1-D Baking tray the dunked product is placed on", "• Zone 2 - surfaces close to Zone 1 that do not touch product. The vacuum sealer is here because the product is already in its pouch when it reaches it.", "◦ 2-A Cooling rack shelf, where the pans sit", "◦ 2-B Cooling rack cover, inside", "◦ 2-C Cooling rack upright and castor", "◦ 2-D Dunk sink, outside and stand", "◦ 2-E Vacuum sealer, bed, seal bar, lid and control panel", "◦ 2-F Kettle, outside and tilt handle", "• Zone 3 - the rest of the production room.", "◦ 3-A Floor under the cooling racks", "◦ 3-B Floor at the dunk sink (in use)", "◦ 3-C Floor drain nearest the dunk sink (in use)", "◦ 3-D Hand-wash sink, taps and basin", "◦ 3-E Mop sink and cleaning tools", "◦ 3-F Waste bin, lid and rim (in use)", "• Zone 4 - outside the production room.", "◦ 4-A Warehouse floor at the door from production", "◦ 4-B Break area table", "• Each point keeps its number, so its results can be compared over time. A point is added, moved or removed by revising this list, never on the day.", "• The dunk area matters most. It holds raw batter on Day 1 and baked product on Day 2, and only the changeover clean separates the two.", "What is tested for", "• Listeria species, at the points in the cooling and dunk areas. The dunk is a wet step after the oven, which is where Listeria settles. The whole genus is tested for, not only Listeria monocytogenes, because it shows a problem sooner.", "• Enterobacteriaceae, on Zone 1 and Zone 2 surfaces, as a check that the cleaning is working.", "• Salmonella is not tested for on the raw side, because everything there goes through the bake. This is looked at again if raw-side material could ever reach product after the oven: rework, a topping added cold, or a shared utensil.", "• These choices are looked at again when the water activity of the finished, sealed product is measured (FSQM-016). If the product cannot support growth, testing leans to Enterobacteriaceae, with Listeria less often (SQF 2.4.8.2 i).", "When and how samples are taken", "• A round of swabs is taken at least every four months (SQF 2.4.8.2 ii).", "• A round is eight swabs: the inside of the dunk sink and the perforated dunking tray every round, and six of the other points in turn, so that every point is sampled at least once a year (SQF 2.4.8.2 iii).", "• The round is taken on a Day 2 morning, after the changeover clean and before dunking starts. A bad result then points at the clean, which can be put right, and not at a batch already made. Points marked (in use) are swabbed during or just after the run.", "• No point is cleaned specially because it is about to be swabbed.", "• Swabs are taken by the SQF Practitioner, or by a person the SQF Practitioner has trained (FRM-952), in the way the laboratory instructs, and are sent the day they are taken.", "• An extra round is taken after an unsatisfactory result (Part 7) and after a change to the floor, the process or the clean.", "The laboratory", "• Samples are analysed by an outside laboratory accredited to ISO/IEC 17025, or an equivalent standard, for the tests it does for the site.", "• The laboratory is entered on FRM-206, with its accreditation, before the first sample is sent.", "• The test method, its detection limit and the reporting time are those on the laboratory's report, which is attached to FRM-706.", "• FSQM-014 says no outside laboratory is used. That is about product and stays true. FSQM-014 is amended to say so when this program is issued.", "An unsatisfactory result", "• A presumptive positive is acted on as a positive. Confirmation is asked for, and the work starts without waiting for it (SQF 2.4.8.2 iv).", "• More swabs are taken around the point - what it drains to, sits on, touches or shares a route with - to find where the organism is living.", "• The point is cleaned and sanitized, then swabbed again until three results in a row are clear.", "• If the organism comes back at the same point, the cause is put right - standing water, a cracked surface, a hollow frame, a clean that cannot reach - and not only the surface.", "• Where the result is on a Zone 1 surface, the product that touched it is held on FRM-702 (FSQM-018) and is not released (FSQM-020) until the SQF Practitioner decides what is done with it.", "• A CAPA is raised on FRM-007 where FSQM-009 requires one, and always for a confirmed Listeria result in Zone 1.", "Records and review", "• Every round is recorded on FRM-706 Environmental Monitoring Results Log: each sample with its point, organism and result, with the laboratory's report attached.", "• The SQF Practitioner reads the results when they arrive and reports them in the next monthly update on FRM-009. The year's results are reviewed at the management review on FRM-001 (SQF 2.4.8.3).", "• A trend is: the same point positive more than once, counts rising at any point, positives that share a drain or a route, or a listed point that was not sampled. A trend is acted on through FSQM-009.", "• This program is reviewed every year, and sooner when the floor, the process or the clean changes, when the water activity is measured, or when the results show the points are in the wrong places."], "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 - 2.4.8.1, 2.4.8.2 and 2.4.8.3, Environmental Monitoring.\n\n11.7.1 High-Risk Processes, including the annual ambient air test, is not part of this program. FSQM-013 records 11.7.1.1 to 11.7.1.5 as not engaged.\n\nFSQM-039 Facility Layout and Product Flow - the hygiene areas the sample points sit in.\nFSQM-012 Good Manufacturing Practices Program - the hygiene rules for the rooms this program samples.\nFSQM-013 Module 11 Applicability & Exemption Analysis - where the high-risk process clauses are recorded as not engaged.\nFSQM-014 Product Sampling, Inspection and Analysis Program - the product side; amended when this program is issued.\nFSQM-016 Food Safety Plan - where the water activity of the finished product belongs.\nFSQM-009 CAPA Program, FSQM-018 Non-Conforming Product and Equipment, FSQM-020 Product Release Program - where a bad result is followed up.\nFSQM-017 Validation and Verification Program - the schedule the sampling round joins when this program is issued.", "revision_history": "Rev New - written 2026-09-17. Shortened, and the sampling schedule set at a round every four months, 2026-10-07. DRAFT: not approved, not in force. No sampling is carried out yet.\n\nOpen before issue:\n1. A laboratory is chosen and entered on FRM-206.\n2. The Management team confirms what is tested for (Part 4) and the schedule (Part 5).\n3. The SQF Practitioner confirms the sample points on the floor, and the list of points on FRM-706 is changed to match.\n4. The water activity of the finished product is measured (FSQM-016), and Part 4 is looked at again.\n\nAt issue: FSQM-014 Part 2 is amended to say that its statement about laboratories is about product, and the sampling round joins the verification schedule."}$q$::jsonb
 where sop_number = 'FSQM-015' and status = 'draft';

do $verify$
declare d record; f jsonb;
begin
  select status, revision, approved_by, effective_date, sqf_reference, content into d
    from public.sop_documents where sop_number = 'FSQM-015';
  if d.status <> 'draft' or d.revision <> 'New' or d.approved_by is not null or d.effective_date is not null
     or d.sqf_reference <> '2.4.8.1, .2, .3' then
    raise exception 'FSQM-015 status, revision, approval or clause reference changed.';
  end if;
  if jsonb_array_length(d.content->'procedure') <> 62 then
    raise exception 'FSQM-015 procedure is % lines, expected 62.', jsonb_array_length(d.content->'procedure');
  end if;
  if md5((d.content - 'purpose' - 'scope' - 'definitions' - 'responsibility' - 'procedure' - 'governing_reference' - 'revision_history')::text)
     <> 'c850c9e0b0d42343f6d53fc48debebdf' then
    raise exception 'the form references, records or attachments of FSQM-015 changed.';
  end if;
  select content->'form_schema'->'sections'->1->'fields'->0->'columns'->0->'options' into f
    from public.sop_documents where sop_number = 'FRM-706';
  if (select count(*) from jsonb_array_elements_text(d.content->'procedure') l where l ~ '^◦ [1-4]-[A-F] ' and f ? substr(l, 3)) <> 18
     or jsonb_array_length(f) <> 19 then
    raise exception 'the sample points in FSQM-015 and on FRM-706 no longer match.';
  end if;
  if (select count(*) from unnest(array['2.4.8.1)', '2.4.8.2 i)', '2.4.8.2 ii)', '2.4.8.2 iii)', '2.4.8.2 iv)', '2.4.8.3)']) c
       where (d.content->'procedure')::text like '%' || c || '%') <> 6 then
    raise exception 'FSQM-015 does not cite every limb of 2.4.8.';
  end if;
  if d.content::text !~ 'at least every four months' then raise exception 'the schedule is missing.'; end if;
  if d.content::text ~* 'Production Supervisor|Senior Site Management|Diana|Gabriela|Christina|GJM|Mercer|Pillsbury|Amazon|Sysco|Bahamas' then
    raise exception 'FSQM-015 names a post the site does not have, or a person, supplier or customer.';
  end if;
end $verify$;

commit;
