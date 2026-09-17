"""FRM-913 row guidance: "what to look at" for each of the 34 Module 11 checklist rows.

Shown ONLY at the top of a row's pop-up form (GridRows.guidance -> GridRowDialog), never in the
table, the entry PDF or the printed blank. The row label is only a clause heading
("11.1.2 Building Materials"); this is what the inspector needs standing in front of the thing.

Paraphrased from SQF Food Safety Code: Food Manufacturing, Edition 9, Module 11 - plain site
language, not the Code's text. Conditional wording ("if ... is on site") wherever applicability is
a site fact the inspector confirms on the walk, so the guidance never asserts one.

Writes:
  sop-drafts/FRM-913-gmp-inspection-schema.json   (tracked schema, guidance added in place)
  supabase/migrations/20260917000002_frm913_row_guidance.sql

Run from the repo root:  python scripts/build-frm913-row-guidance.py
"""
import io
import json
import os
import re

B = "• "

GUIDANCE = {
    "check_11_1": [
        # 11.1.1
        [B + "Anything nearby that could threaten product: neighbouring businesses, dumpsters, standing water, overgrowth",
         B + "Any risk found is controlled, and the assessment is updated when the surroundings change",
         B + "The building is approved/permitted to operate"],
        # 11.1.2
        [B + "Floors smooth, sealed, free of cracks and pooled water; they drain properly",
         B + "Drains clean and not a trip or contamination hazard",
         B + "Walls, ceilings and doors durable, smooth, light-coloured and clean; wall-to-floor corners sealed",
         B + "No pipes or ducting over product that could drip or shed",
         B + "Windows shatterproof; doors solid",
         B + "Ceiling (or drop ceiling) intact, no missing tiles or gaps",
         B + "Stairs or platforms, if any, are not over open product"],
        # 11.1.3
        [B + "Enough light to work and inspect by",
         B + "Lights over exposed product, ingredients or packaging are shatterproof or covered, with no cracked or missing covers",
         B + "Warehouse lights protected from breakage"],
        # 11.1.4
        [B + "If product is inspected on the line: the spot is clean, has handwashing nearby and a waste bin",
         "N/A if there is no inspection station on the line - say so in Finding."],
        # 11.1.5
        [B + "Outside doors and windows seal when closed - no daylight at the gaps",
         B + "Personnel doors close themselves and are insect-proofed",
         B + "Dock/overhead doors: self-closing, screen, air curtain or good seal",
         B + "Traps and bait stations placed where they cannot contaminate product, packaging or equipment",
         B + "No poison bait inside production or storage areas"],
        # 11.1.6
        [B + "Enough airflow; no condensation build-up",
         B + "Vents and fans clean and screened against insects",
         B + "Hood/extraction over heat and steam sources (oven, kettle) works and is clean"],
        # 11.1.7
        [B + "Equipment in good repair: smooth, no cracks, rust, flaking paint or crevices that trap food",
         B + "Tables, benches and machines placed so they can be cleaned around",
         B + "Utensils and containers stored clean and off the floor; food-contact kept apart from non-food",
         B + "Waste bins clearly marked",
         B + "Broken equipment tagged or set aside so nobody uses it",
         B + "Carts, pallet jacks or other vehicles in production are clean and not a hazard"],
        # 11.1.8
        [B + "Outside kept free of rubbish, clutter, stored junk and overgrowth that would attract pests",
         B + "No pooled water at the loading area; outside drains clear",
         B + "Paths into the building sealed, not bare dirt"],
    ],
    "check_11_2": [
        # 11.2.1
        [B + "No temporary fixes (tape, cardboard, wire) left in place without a plan to repair them",
         B + "Recent repairs cleaned up after; supervisor was told before work in production areas",
         B + "Lubricant on or over food-contact equipment is food-grade",
         B + "Paint in production areas intact, not flaking, and not on product-contact surfaces",
         B + "Equipment failures are recorded and the repair is on the maintenance schedule"],
        # 11.2.2
        [B + "Contractors and maintenance staff follow the same hygiene rules (hair net, no jewellery, handwashing)",
         B + "Contractors not trained on site food safety rules are escorted",
         B + "No tools, screws, wire or debris left behind after a job"],
        # 11.2.3
        [B + "Scales, thermometers and other measuring devices are on the calibration list and within date",
         B + "Devices protected from damage and not adjusted by unauthorised people",
         B + "If a device was found out of calibration: the product it measured was assessed"],
        # 11.2.4
        [B + "No signs of pests: droppings, gnaw marks, insects, nests, webs",
         B + "Traps and bait stations in place, numbered, matching the site map, not damaged or overdue",
         B + "Pest control visit reports current; any activity found has been acted on",
         B + "Pesticides, if kept on site, labelled and stored with the chemicals",
         B + "No animals in food handling or storage areas"],
        # 11.2.5
        [B + "Equipment and areas clean to the eye, including under, behind and above",
         B + "Daily sanitation and pre-op records (FRM-903) filled in and current",
         B + "Sani-512 mixed to 200 ppm; test strips on hand and the check is recorded",
         B + "Only approved chemicals present; containers labelled",
         B + "Cleaning tools marked, stored off the floor, in good condition",
         B + "Toilets, break room and change areas clean"],
    ],
    "check_11_3": [
        # 11.3.1
        [B + "Nobody working with exposed food while visibly ill",
         B + "Cuts covered with a coloured, metal-detectable bandage; a glove over it if on the hand",
         B + "Staff know to report illness and what to do if blood or bodily fluid gets on a surface"],
        # 11.3.2
        [B + "Watch people wash hands: on entering production, after toilet, eating, smoking, cleaning or handling waste",
         B + "Handwash sinks near entrances: hot and cold water, soap in a dispenser, paper towels, a bin",
         B + "Sinks used only for handwashing, not blocked or used for storage",
         B + "Handwashing signs posted in the languages staff read",
         B + "People wearing gloves still wash hands"],
        # 11.3.3
        [B + "Uniforms and shoes clean at the start of the shift; heavily soiled clothing changed",
         B + "Hair nets and beard covers worn and covering all hair",
         B + "No jewellery apart from plain bands or medical alert items, covered",
         B + "Gloves and aprons changed after breaks and when damaged; not left on product, packaging or equipment",
         B + "Racks for aprons/smocks by the entrance, used when leaving production",
         B + "Phones and personal belongings kept in lockers or offices, not in production"],
        # 11.3.4
        [B + "Visitors signed in and acknowledged the GMP rules (FRM-905 / FRM-906)",
         B + "Visitors escorted or briefed; wearing hair nets and suitable clothing; jewellery removed",
         B + "Visitors come in through the staff entrance and wash hands",
         B + "No visibly ill visitors in production"],
        # 11.3.5
        [B + "Toilets clean, stocked and separate from production; handwash sink right by them",
         B + "Street clothes and personal items stored away from uniforms, food and packaging",
         B + "Change area clean",
         B + "Break room separate from production, clean, with a fridge and sink; no food waste left out",
         B + "Outside eating/smoking area clean and not attracting pests"],
    ],
    "check_11_4": [
        # 11.4.1
        [B + "People enter production through the personnel door only; doors kept closed",
         B + "No eating, drinking, gum or tasting product in production (except controlled sensory testing)",
         B + "No false nails, nail polish, long nails or false eyelashes when handling exposed food",
         B + "No product, packaging or utensils placed on the floor",
         B + "Staff don't move from dirty areas (waste, raw materials) to finished product without washing up",
         B + "Dropped product discarded, not put back"],
    ],
    "check_11_5": [
        # 11.5.1
        [B + "Hot and cold water available at every sink needed for cleaning",
         B + "Hoses stored off the floor; no hose ends sitting in buckets or drains (back-siphonage)",
         B + "Backflow preventers in place; annual backflow test current where applicable",
         B + "Any non-potable water lines clearly marked and not connected to potable",
         B + "Staff know what to do if the water supply is declared unsafe"],
        # 11.5.2
        [B + "If water is filtered or treated on site: equipment working, filters changed on schedule, checks recorded",
         "N/A if the site uses municipal water with no treatment - say so in Finding."],
        # 11.5.3
        [B + "Water testing result on file and within the last 12 months",
         B + "Result meets potable water standards"],
        # 11.5.4
        [B + "If ice is used in the process or as an ingredient: made from potable water, from an approved supplier, stored in a clean covered container, scoop kept out of the ice",
         "N/A if no ice is used - say so in Finding."],
        # 11.5.5
        [B + "If compressed air or another gas touches food or food-contact surfaces: filters maintained and quality checked at least annually",
         "N/A if no air or gas touches food or food-contact surfaces - say which uses were checked."],
    ],
    "check_11_6": [
        # 11.6.1
        [B + "Goods stored off the floor and away from walls so the space can be inspected and cleaned",
         B + "Oldest stock used first; nothing past its date",
         B + "Raw materials kept apart from finished product; allergens stored so they cannot spill onto other goods",
         B + "Open ingredients covered and labelled",
         B + "Anything in overflow or temporary storage is protected and the risk is considered"],
        # 11.6.2
        [B + "Fridge and freezer at temperature; sensors reporting",
         B + "Temperature records and any alerts reviewed and acted on (FRM-401)",
         B + "Units clean, not overloaded, door seals intact, no ice build-up",
         B + "Condensate and defrost water drains to a drain, not onto product or the floor"],
        # 11.6.3
        [B + "Dry storage away from wet areas, clean and dry",
         B + "Packaging protected from dust and pests; no damaged or open cases",
         B + "Racks cleanable, with room to see and clean floors and behind racks"],
        # 11.6.4
        [B + "Chemicals in a marked, lockable area away from food and packaging",
         B + "Every container labelled with what is in it; no chemicals in food containers",
         B + "Safety Data Sheets current and available",
         B + "Food-grade and non-food-grade chemicals not mixed together",
         B + "Spill kit and PPE on hand; empty containers not reused"],
        # 11.6.5
        [B + "Vehicle check done before loading and recorded (FRM-801)",
         B + "Loading area clean; product not left sitting exposed during loading",
         B + "Loaded vehicle secured with a latch, lock or seal"],
    ],
    "check_11_7": [
        # 11.7.1
        [B + "If a high-risk process exists (product handled after a kill step and not cooked again before eating): area separated, dedicated staff, clothing change on entry",
         "N/A if there is no high-risk process on site - say so in Finding."],
        # 11.7.2
        [B + "If product or ingredients are thawed: done in a suitable place and way (refrigerated, or controlled air/water), not on the floor or at room temperature uncontrolled",
         B + "Packaging from thawed product disposed of promptly",
         "N/A if nothing is thawed - say so in Finding."],
        # 11.7.3
        [B + "No glass, ceramic or brittle plastic items in production that are not on the glass & brittle plastic register",
         B + "Items on the register are intact",
         B + "Nothing loose on equipment or overhead: nuts, bolts, screws, tape, cable ties",
         B + "Knives controlled and in good condition; no snap-off blades anywhere",
         B + "Wooden pallets or utensils in production are clean and not splintering",
         B + "Gaskets, belts, seals and scrapers not worn or shedding pieces"],
        # 11.7.4
        [B + "If a metal detector, sieve, screen or filter is used: working, checked at the set frequency, and checks recorded",
         B + "Rejected or contaminated product isolated and its disposition recorded",
         "N/A for the detector limb if no detection or removal device is used - say so in Finding."],
    ],
    "check_11_8": [
        # 11.8.1
        [B + "Waste removed regularly; not building up in production",
         B + "Bins clean, lidded where needed, clearly marked as waste",
         B + "Outside dumpster area clean, lids closed, not attracting pests",
         B + "Liquid waste goes to a drain or a lidded container",
         B + "Packaging with our brand or customer brands disposed of so it can't be misused"],
    ],
}


def main():
    schema_path = "sop-drafts/FRM-913-gmp-inspection-schema.json"
    raw = io.open(schema_path, encoding="utf-8", newline="").read()
    schema = json.loads(raw)

    patch = {}
    for sec in schema["sections"]:
        for f in sec["fields"]:
            if f["type"] != "grid":
                continue
            g = GUIDANCE[f["id"]]
            labels = f["rows"]["labels"]
            assert len(g) == len(labels), (f["id"], len(g), len(labels))
            texts = ["\n".join(lines) for lines in g]
            f["rows"]["guidance"] = texts
            patch[f["id"]] = texts
    assert len(patch) == 8, len(patch)
    for fid, texts in patch.items():
        for t in texts:
            assert "Adventure" not in t and len(t) < 1000

    nl = "\r\n" if "\r\n" in raw else "\n"
    out = json.dumps(schema, indent=2, ensure_ascii=False)
    io.open(schema_path, "w", encoding="utf-8", newline="").write(out.replace("\n", nl) + nl)

    payload = json.dumps(patch, indent=2, ensure_ascii=False)
    assert "$g$" not in payload
    n_rows = sum(len(v) for v in patch.values())
    sql = MIGRATION.replace("__PAYLOAD__", payload).replace("__ROWS__", str(n_rows))
    mpath = "supabase/migrations/20260917000002_frm913_row_guidance.sql"
    with io.open(mpath, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(sql)
    print(f"wrote {mpath}: {len(patch)} grids, {n_rows} rows")


MIGRATION = r"""-- FRM-913: "what to look at" guidance for every checklist row, shown in the row pop-up only.
--
-- GENERATED by scripts/build-frm913-row-guidance.py - edit the script, not this file.
--
-- WHY. FRM-913's row labels are clause headings ("11.1.2 Building Materials"). The inspector on the
-- floor needs to know what that heading means in front of a wall, a drain or a fridge. Asked for on
-- site on 2026-09-17 during the first inspection (task 13.7), after the row pop-up went live (v3,
-- 20260917000001). Each grid's rows.guidance is parallel to rows.labels; GridRowDialog shows it above
-- the first field. It is NOT shown in the table, the entry PDF or the printed blank.
--
-- NO REVISION BUMP, ON PURPOSE (owner's call). No question, column, row or field id changes - this is
-- help text. And an entry resolves its schema by the revision it was started on: bumping to v4 would
-- pin the inspection already in progress on v3 to the v3 history snapshot, which has no guidance -
-- the very inspection it was written for would never show it. The sop_document_history trigger still
-- snapshots the prior v3 content, so the change is on record.
--
-- CONVERGENT. Grids are matched by field id, never array index. If every grid already carries exactly
-- this guidance the UPDATE is skipped (no second history snapshot). A grid whose row count no longer
-- matches, or partial/different guidance already present, raises.
--
-- The after-guard compares the whole content with rows.guidance stripped from BOTH sides.

begin;

create or replace function pg_temp.map_grids(c jsonb, fn text, payload jsonb) returns jsonb
language sql immutable as $$
  select jsonb_set(c, '{form_schema,sections}', coalesce((
    select jsonb_agg(
             jsonb_set(s, '{fields}', coalesce((
               select jsonb_agg(
                        case
                          when f->>'type' <> 'grid' then f
                          when fn = 'strip' then jsonb_set(f, '{rows}', (f->'rows') - 'guidance')
                          when payload ? (f->>'id')
                            then jsonb_set(f, '{rows,guidance}', payload->(f->>'id'))
                          else f
                        end
                        order by fo)
                 from jsonb_array_elements(s->'fields') with ordinality x(f, fo)
             ), '[]'::jsonb))
             order by so)
      from jsonb_array_elements(c->'form_schema'->'sections') with ordinality y(s, so)
  ), '[]'::jsonb))
$$;

create temp table frm913_guidance on commit drop as
  select $g$__PAYLOAD__$g$::jsonb as payload;

create temp table frm913_before on commit drop as
  select content, revision, status from public.sop_documents where sop_number = 'FRM-913';

do $$
declare
  p  jsonb := (select payload from frm913_guidance);
  r  record;
begin
  select b.status, b.revision,
         (select count(*) from frm913_before) as n,
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid')                                                    as grids,
         -- grids whose id is in the payload AND whose row count matches the payload
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and p ? (f->>'id')
             and f->'rows'->>'mode' = 'fixed'
             and jsonb_array_length(f->'rows'->'labels') = jsonb_array_length(p->(f->>'id'))) as matched,
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->'rows' ? 'guidance')                                                 as has_any,
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and f->'rows'->'guidance' = p->(f->>'id'))           as has_same
    into r
    from frm913_before b;

  if r.n <> 1 then
    raise exception 'Expected exactly one FRM-913 row, found %.', r.n;
  end if;
  if r.status is distinct from 'active' or r.revision is distinct from 'v3' then
    raise exception 'FRM-913 is % at revision % - expected the active v3. Re-derive.', r.status, r.revision;
  end if;
  if r.grids <> 8 or r.matched <> 8 then
    raise exception 'FRM-913: % grids, % match the guidance payload by id and row count - expected 8 and 8.',
      r.grids, r.matched;
  end if;

  if r.has_any = 8 and r.has_same = 8 then
    raise notice 'FRM-913 already carries this guidance on all 8 grids - nothing to do.';
    return;
  end if;
  if r.has_any <> 0 then
    raise exception '% FRM-913 grid(s) already carry different or partial guidance - re-derive.', r.has_any;
  end if;

  update public.sop_documents
     set content = pg_temp.map_grids(content, 'set', p)
   where sop_number = 'FRM-913' and status = 'active' and revision = 'v3';
end $$;

do $$
declare
  p  jsonb := (select payload from frm913_guidance);
  r  record;
begin
  select a.revision,
         (select count(*) from jsonb_array_elements(a.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and f->'rows'->'guidance' = p->(f->>'id'))           as set_grids,
         (select coalesce(sum(jsonb_array_length(f->'rows'->'guidance')), 0)
            from jsonb_array_elements(a.content->'form_schema'->'sections') s,
                 jsonb_array_elements(s->'fields') f
           where f->'rows' ? 'guidance')                                                 as rows_total,
         pg_temp.map_grids(a.content, 'strip', null) = pg_temp.map_grids(b.content, 'strip', null)
                                                                                         as same_otherwise
    into r
    from public.sop_documents a, frm913_before b
   where a.sop_number = 'FRM-913';

  if r.revision <> 'v3' then
    raise exception 'FRM-913 revision moved to % - this migration must not change it.', r.revision;
  end if;
  if r.set_grids <> 8 or r.rows_total <> __ROWS__ then
    raise exception 'Guidance on % grids / % rows - expected 8 and __ROWS__.', r.set_grids, r.rows_total;
  end if;
  if not r.same_otherwise then
    raise exception 'FRM-913 content changed beyond rows.guidance - stop.';
  end if;
end $$;

commit;
"""

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    main()
