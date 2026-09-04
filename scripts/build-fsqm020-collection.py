# -*- coding: utf-8 -*-
"""Correct FSQM-020 and FRM-701 to the collection model the CEO confirmed 2026-09-04.

The program was drafted on 2026-09-03 believing product went both from our dock and into
customer-owned or third-party storage. It does not: the customer arranges collection with
their own carrier and takes responsibility for the product once it leaves the facility. The
site uses no off-site or contract warehouse.

  20260904000001  FSQM-020 Part 8 states that off-site storage is not used, in the same form
                  Part 5 uses for positive release on testing. The written instruction it
                  required - recorded as a PREREQUISITE to issue - is withdrawn.
  20260904000002  FRM-701 loses its off-site storage section and its destination field.

Both stay draft. Refuses to overwrite an existing migration file.

Usage:  python scripts/build-fsqm020-collection.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC20, SRC701 = ("sop-drafts/FSQM-020-product-release-program.json",
                 "sop-drafts/FRM-701-product-release-schema.json")
OUT20 = "supabase/migrations/20260904000001_fsqm020_collection_model.sql"
OUT701 = "supabase/migrations/20260904000002_frm701_collection_model.sql"
B, P = "• ", "> "

for f in (OUT20, OUT701):
    if os.path.exists(f):
        raise SystemExit("%s already exists - refusing to overwrite an applied migration." % f)

def dollar(v, tag):
    """Dollar-quote a value as JSON for a `::jsonb` cast.

    ALWAYS json.dumps, including for strings. An earlier version here passed str through
    unchanged, on the theory that a caller might hand it pre-serialized JSON. The list and
    dict payloads were unaffected, so the migration looked right - but `responsibility` and
    `revision_history` are plain strings, and they came out as bare prose cast to ::jsonb:

        '{responsibility}', $r20$SQF Practitioner — the only person who...$r20$::jsonb

    which Postgres rejects with 'invalid input syntax for type json ... Token "SQF" is
    invalid'. A JSON string needs its quotes. If a caller ever does hold pre-serialized
    JSON, it should parse it first rather than this function guessing.
    """
    s = json.dumps(v, ensure_ascii=False)
    assert tag not in s, "payload contains the dollar-quote tag"
    return tag + s + tag

def like_check(sql, payload, absent=()):
    c = k = 0
    for m in re.finditer(r"like '%([^']*?)%'", sql):
        lit = m.group(1)
        if "%" in lit or lit in absent:
            k += 1
            continue
        c += 1
        probe = lit.replace("''", "'")
        if probe not in payload:
            raise SystemExit("LIKE pattern never matches%s: %r"
                             % (" (case differs only)" if probe.lower() in payload.lower() else "",
                                probe[:70]))
    return c, k

# ============================================================ FSQM-020
doc = json.load(io.open(SRC20, encoding="utf-8"))
proc = list(doc["procedure"])
assert len(proc) == 28, "expected the 28-line body seeded by 20260903000001, found %d" % len(proc)

def one(frag):
    hits = [i for i, l in enumerate(proc) if frag in l]
    assert len(hits) == 1, "%r matches %d lines" % (frag[:40], len(hits))
    return hits[0]

# Part 1: the trigger is collection, not shipment or transfer.
proc[one("No finished product shall be shipped")] = (
  "No finished product shall be made available for collection, or leave the site, until it has "
  "been released under this procedure.")

# Part 8: four lines describing a practice the site does not have, replaced by three that say so.
i = one("Product destined for customer-owned or third-party storage")
assert proc[i + 1].startswith(B) and proc[i + 2].startswith(B) and proc[i + 3].startswith(P), \
    "Part 8 is not the shape this migration was derived against"
proc[i:i + 4] = [
  "The site does not use off-site or contract warehouses. Finished product is collected from the "
  "site by a carrier the customer arranges, and responsibility for the product passes to the "
  "customer on collection.",
  "> SQF 2.4.7.3 requires release requirements to be communicated to off-site or contract "
  "warehouses and verified as being followed, where such warehouses are used. They are not used "
  "here, so that requirement does not arise. This is stated rather than left silent, for the same "
  "reason Part 5 states that positive release on testing is not used: a reader should not have to "
  "work out for themselves which limbs of a clause apply to this site.",
  "> What collection does change is the timing. Release has to be complete before the carrier "
  "arrives, not while it waits on the dock. Once product is loaded it has left, and a release "
  "recorded afterwards records nothing.",
]

proc[one("Released product may then be shipped, collected or transferred")] = (
  "Released product may then be made available for collection. FRM-701 shall be completed and "
  "signed before that happens, not afterwards.")

doc["procedure"] = proc

doc["responsibility"] = doc["responsibility"].replace(
  "Admin — does not ship, make available for collection, or transfer to off-site storage any batch "
  "without a completed FRM-701, and issues the release requirement in writing to each off-site "
  "storage location.",
  "Admin — does not make any batch available for collection without a completed FRM-701, and "
  "confirms that the lot handed to the carrier is the lot released.")
assert "confirms that the lot handed to the carrier" in doc["responsibility"]

rh = doc["revision_history"]
OLD_PARA = rh[rh.index("OFF-SITE STORAGE IS THE REAL WORK HERE."):rh.index("LABEL COMPLIANCE IS REFERENCED")]
rh = rh.replace(OLD_PARA,
 "OFF-SITE STORAGE DOES NOT APPLY — CORRECTED 2026-09-04. This program was drafted on 2026-09-03 "
 "on the understanding that product went both from our own dock and into customer-owned or "
 "third-party storage, and Part 8 accordingly required a written instruction to each storage "
 "location, reissued on change and confirmed annually. The CEO and Operations Manager confirmed on "
 "2026-09-04 that this is not how it works: the customer arranges collection with their own "
 "carrier, and responsibility for the product passes to the customer once it leaves the facility. "
 "The site uses no off-site or contract warehouse. Part 8 now says so, in the same form Part 5 "
 "uses for positive release on testing, and the written instruction it required — which was "
 "recorded here as a prerequisite to issue — is withdrawn as an open item because there is nobody "
 "to issue it to.\n\n"
 "WHAT THAT DOES NOT CHANGE, and it is worth saying because \"no longer our responsibility\" is "
 "easy to read more widely than it holds. Collection makes the timing of release SHARPER, not "
 "softer: the record has to be complete before the carrier arrives rather than before a transfer "
 "the site controls, because once product is loaded it has gone. And the passing of responsibility "
 "at the dock is a commercial fact about custody and risk, not a food-safety one — traceability, "
 "and any withdrawal or recall, still reach product after it has been collected. Neither is in "
 "this program's scope; both belong to the recall and withdrawal program, which does not yet "
 "exist.\n\n")

# item 3 was the prerequisite; it is gone, so the list is two items again
i3 = rh.index("3. **Part 8's written instruction") if "3. **Part 8's written instruction" in rh \
     else rh.index("3. Part 8's written instruction")
rh = rh[:i3].rstrip() + "\n"
rh = rh.replace("OPEN BEFORE ISSUE — three things the site must settle, and the third is a "
                "prerequisite rather than a question:",
                "OPEN BEFORE ISSUE — two things the site must settle. Neither blocks issue; the "
                "one item that did was Part 8's written instruction, withdrawn on 2026-09-04 when "
                "the collection model was corrected:")
doc["revision_history"] = rh

steps = [l for l in proc if not l.startswith(B) and not l.startswith(P)]
bull = [l for l in proc if l.startswith(B)]
pros = [l for l in proc if l.startswith(P)]
assert len(steps) + len(bull) + len(pros) == len(proc)
N20 = (len(proc), len(steps), len(bull), len(pros))
assert N20 == (27, 11, 8, 8), "unexpected body shape %s" % (N20,)

body = "\n".join(proc) + "\n" + doc["responsibility"]
for gone in ("off-site storage location shall be told", "reissued whenever the storage arrangement",
             "shipped, collected or transferred", "transferred into off-site storage"):
    if gone in body:
        raise SystemExit("the off-site storage practice survives: %r" % gone)
for need in ("does not use off-site or contract warehouses",
             "carrier the customer arranges", "before the carrier arrives",
             "does not use positive release based on pathogen or chemical testing"):
    if need not in body:
        raise SystemExit("correction not applied: %r" % need)
if "prerequisite to issue" not in rh:
    raise SystemExit("the revision history must record that the prerequisite was withdrawn")

io.open(SRC20, "w", encoding="utf-8", newline="\n").write(
    json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

SQL20 = u"""-- FSQM-020: the site does not use off-site storage. Corrected before issue, still draft.
--
-- WHAT WAS WRONG. The program was drafted 2026-09-03 on the understanding that finished product
-- went both from our own dock and into customer-owned or third-party storage as tolling stock.
-- Part 8 therefore required each storage location to be told in writing that only released product
-- may be drawn, reissued on change and confirmed annually - and that written instruction did not
-- exist, so it was recorded as a PREREQUISITE to issuing this document.
--
-- The CEO and Operations Manager confirmed on 2026-09-04 that this is not how it works. The
-- customer arranges collection with their own carrier, and responsibility for the product passes to
-- the customer once it leaves the facility. The site uses no off-site or contract warehouse.
--
-- SO PART 8 NOW SAYS SO, rather than being deleted. SQF 2.4.7.3's second limb applies only "in the
-- event that off-site or contract warehouses are used"; they are not, so it does not arise. That is
-- stated in the same form Part 5 already uses for positive release on testing, because a reader
-- should not have to work out for themselves which limbs of a clause apply to this site - and
-- because silence reads as an omission where a statement reads as a decision.
--
-- THE PREREQUISITE IS WITHDRAWN. There is nobody to issue the instruction to. That was the one open
-- item blocking issue; the two that remain - where the customer's agreed specification and the
-- sensory standard live, and whether any bulk or unlabeled product ships at all - are questions,
-- not prerequisites.
--
-- COLLECTION MAKES THE TIMING SHARPER, NOT SOFTER, and the body now says that too. Release has to
-- be complete before the carrier arrives rather than before a transfer the site controls, because
-- once product is loaded it has gone and a release recorded afterwards records nothing. Part 1's
-- trigger becomes "made available for collection, or leave the site", and Part 10 matches.
--
-- ONE THING DELIBERATELY NOT ABSORBED. "No longer the bakery's responsibility" is a fact about
-- custody and commercial risk. It is not true of traceability, or of withdrawal and recall, which
-- still reach product after it has been collected. Neither is in this program's scope and neither is
-- claimed here; the Revision History says so plainly so that a later reader does not take the
-- collection model as covering more than it does. The recall and withdrawal program does not yet
-- exist.
--
-- 28 lines become 27: Part 8's step plus two bullets and a paragraph become a step plus two
-- paragraphs. All eight remaining bullets are Part 4's release checks, which is why the FRM-701
-- migration alongside this one can assert a straight one-to-one against them.
--
-- Writes procedure, responsibility and revision_history; hashes the rest. Still draft, no revision
-- bump - never issued, nothing to supersede.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (content->'procedure')::text like '%off-site storage location shall be told%' as old_part8,
         (content->'procedure')::text like '%does not use off-site or contract warehouses%'
                                                                                      as already_done,
         (content->>'revision_history') like '%prerequisite rather than a question%'   as prereq_listed
    into r
    from public.sop_documents where sop_number = 'FSQM-020';

  if r is null then
    raise exception 'FSQM-020 does not exist - run 20260903000001 first.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-020 is % - a content change to an issued document needs a revision bump.',
      r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-020 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  if r.lines <> 28 then
    raise exception 'FSQM-020 has % procedure lines, expected the 28 seeded by 20260903000001.', r.lines;
  end if;
  if r.already_done then
    raise exception 'FSQM-020 already states that off-site storage is not used - this has run.';
  end if;
  if not r.old_part8 then
    raise exception 'FSQM-020 does not carry the off-site storage instruction this migration replaces.';
  end if;
  if not r.prereq_listed then
    raise exception 'FSQM-020 does not carry the prerequisite open item this migration withdraws.';
  end if;
end $$;

create temporary table fsqm020_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-020';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(content, '{procedure}', @@PROC@@::jsonb),
                     '{responsibility}', @@RESP@@::jsonb),
                   '{revision_history}', @@RH@@::jsonb)
 where sop_number = 'FSQM-020' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'procedure')                                          as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                    as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                             as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                             as prose,
    (content->'procedure')::text like '%does not use off-site or contract warehouses%' as not_used,
    (content->'procedure')::text like '%carrier the customer arranges%'               as collection,
    (content->'procedure')::text like '%before the carrier arrives%'                  as timing,
    (content->'procedure')::text like '%made available for collection, or leave the site%'
                                                                                      as trigger_fixed,
    (content->'procedure')::text like '%off-site storage location shall be told%'     as old_part8,
    (content->'procedure')::text like '%shipped, collected or transferred%'           as old_part10,
    (content->>'responsibility') like '%lot handed to the carrier is the lot released%'
                                                                                      as admin_role,
    (content->>'responsibility') like '%off-site storage location%'                   as admin_stale,
    -- the two limbs the site does not operate are both STATED, not left silent
    (content->'procedure')::text like '%does not use positive release based on pathogen or chemical testing%'
                                                                                      as no_testing,
    (content->>'revision_history') like '%CORRECTED 2026-09-04%'                      as correction_noted,
    (content->>'revision_history') like '%withdrawn as an open item%'                 as prereq_withdrawn,
    (content->>'revision_history') like '%prerequisite rather than a question%'        as prereq_stale,
    (content->>'revision_history') like '%still reach product after it has been collected%'
                                                                                      as recall_caveat,
    -- nothing earlier undone
    (content->'procedure')::text like '%authorised by the SQF Practitioner alone%'     as authority,
    (content->'procedure')::text like '%placed on Hold under FSQM-018%'                as hold_path
  into r
  from public.sop_documents where sop_number = 'FSQM-020';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm020_before b where d.sop_number = 'FSQM-020';

  if r.lines <> @@L@@ or r.steps <> @@S@@ or r.bullets <> @@BU@@ or r.prose <> @@PR@@ then
    raise exception 'FSQM-020 body wrong shape: % / % / % / % (expected @@L@@ / @@S@@ / @@BU@@ / @@PR@@).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % + % + % <> %.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if not (r.not_used and r.collection and r.timing and r.trigger_fixed) then
    raise exception 'Correction incomplete: not-used=%, collection=%, timing=%, Part 1 trigger=%.',
      r.not_used, r.collection, r.timing, r.trigger_fixed;
  end if;
  if r.old_part8 or r.old_part10 or r.admin_stale then
    raise exception 'The off-site practice survives: Part 8=%, Part 10=%, Responsibility=%.',
      r.old_part8, r.old_part10, r.admin_stale;
  end if;
  if not (r.admin_role and r.no_testing) then
    raise exception 'Admin duty=%, positive-release statement=%.', r.admin_role, r.no_testing;
  end if;
  if not (r.correction_noted and r.prereq_withdrawn and r.recall_caveat) then
    raise exception 'Revision history incomplete: correction=%, prerequisite withdrawn=%, recall caveat=%.',
      r.correction_noted, r.prereq_withdrawn, r.recall_caveat;
  end if;
  if r.prereq_stale then
    raise exception 'The open list still calls an item a prerequisite - it was withdrawn.';
  end if;
  if not (r.authority and r.hold_path) then
    raise exception 'Earlier work undone: sole authority=%, hold path=%.', r.authority, r.hold_path;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-020 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'A section other than the three written changed. Rolled back.';
  end if;
end $$;

commit;
"""

sql20 = (SQL20.replace("@@PROC@@", dollar(proc, "$j20$"))
              .replace("@@RESP@@", dollar(doc["responsibility"], "$r20$"))
              .replace("@@RH@@", dollar(rh, "$h20$"))
              .replace("@@L@@", str(N20[0])).replace("@@S@@", str(N20[1]))
              .replace("@@BU@@", str(N20[2])).replace("@@PR@@", str(N20[3])))
assert "@@" not in sql20
pay20 = json.dumps(proc, ensure_ascii=False) + "\n" + doc["responsibility"] + "\n" + rh
c20, k20 = like_check(sql20, pay20, absent=("off-site storage location shall be told",
                                            "shipped, collected or transferred",
                                            "off-site storage location",
                                            "prerequisite rather than a question"))
io.open(OUT20, "w", encoding="utf-8", newline="\n").write(sql20)

# ============================================================ FRM-701
sch = json.load(io.open(SRC701, encoding="utf-8"))
before_secs = len(sch["sections"])
before_flds = sum(len(s["fields"]) for s in sch["sections"])
assert (before_secs, before_flds) == (5, 26), "unexpected FRM-701 shape %s" % ((before_secs, before_flds),)

sch["sections"] = [s for s in sch["sections"] if s["id"] != "offsite_storage"]
for s in sch["sections"]:
    s["fields"] = [f for f in s["fields"] if f["id"] != "destination"]
    for f in s["fields"]:
        if f["id"] == "release_info":
            f["text"] = f["text"].replace(
              "One record per batch or lot released. Nothing ships, is collected, or is "
              "transferred into off-site storage until this record is complete and signed — not "
              "afterwards.",
              "One record per batch or lot released. Nothing is made available for collection "
              "until this record is complete and signed — not afterwards. The customer's carrier "
              "will not wait, so this is done before it arrives.")

fields = [f for s in sch["sections"] for f in s["fields"]]
N701 = (len(sch["sections"]), len(fields),
        sum(1 for f in fields if f["type"] == "grid"),
        sum(1 for f in fields if f.get("showInList")))
assert N701 == (4, 21, 1, 5), "unexpected FRM-701 shape after edit %s" % (N701,)
blob = json.dumps(sch, ensure_ascii=False)
for gone in ("offsite_storage", "storage_location", "requirement_communicated",
             "instruction_date", "destination", "off-site storage"):
    if gone in blob:
        raise SystemExit("FRM-701 still carries %r" % gone)
if "carrier will not wait" not in blob:
    raise SystemExit("the instruction text was not updated")
checks = [f for f in fields if f["id"] == "checks"][0]
if len(checks["rows"]["labels"]) != len(bull):
    raise SystemExit("FRM-701 has %d checks; FSQM-020 now has %d bullets, all of them Part 4's"
                     % (len(checks["rows"]["labels"]), len(bull)))

io.open(SRC701, "w", encoding="utf-8", newline="\n").write(
    json.dumps(sch, ensure_ascii=False, indent=2) + "\n")

SQL701 = u"""-- FRM-701 follows FSQM-020 to the collection model: no off-site section, no destination.
--
-- Section 4 asked which off-site storage location the product was going to, whether that location
-- held our written instruction, and when it was last reissued. The site does not use off-site or
-- contract warehouses - the customer arranges collection with their own carrier - so every one of
-- those questions would have been answered blank forever, and a form with a section nobody fills is
-- a form people learn to skim.
--
-- THE DESTINATION FIELD GOES TOO, and this is the less obvious half. It was a required select of
-- three options - shipped from our dock, collected by the customer, transferred to off-site storage
-- - and two of the three do not happen. A required field with one real answer is not a control, it
-- is a keystroke. Who collects and when belongs on the dispatch paperwork; the release record
-- records the release.
--
-- RELEASE HAPPENS BEFORE THE CARRIER ARRIVES, so the carrier is often not known when this record is
-- signed. That is the substantive reason not to replace destination with a carrier field: it would
-- invite the record to be completed at handover, which is exactly what FSQM-020 Part 10 forbids. The
-- instructions at the top of the form now say the carrier will not wait.
--
-- 5 sections and 26 fields become 4 and 21. The eight release checks, the five list columns, the
-- single signature and settings.deletable=false are unchanged, and the migration asserts each.
--
-- FRM-701 has no entries - it was seeded draft yesterday - so removing fields costs nothing. The
-- guard re-checks that at apply time, because removing a field from a form with live responses
-- would orphan answers into the "Unmapped answers" block rather than deleting them.
--
-- Writes content->'form_schema' only; hashes the rest.

begin;

do $$
declare
  r record;
begin
  select d.status, d.revision, d.type,
         jsonb_array_length(d.content->'form_schema'->'sections')                      as sections,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                    as fields,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s
           where s->>'id' = 'offsite_storage')                                         as offsite_sec,
         (select count(*) from public.sop_document_responses x where x.document_id = d.id) as entries
    into r
    from public.sop_documents d where d.sop_number = 'FRM-701';

  if r is null then
    raise exception 'FRM-701 does not exist - run 20260903000002 first.';
  end if;
  if r.status <> 'draft' or r.revision <> 'New' then
    raise exception 'FRM-701 is % / %, not draft / New.', r.status, r.revision;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-701 has % entries. Removing a field would orphan answers - stop and re-plan.',
      r.entries;
  end if;
  if r.sections <> 5 or r.fields <> 26 then
    raise exception 'FRM-701 is % sections / % fields, not the 5 / 26 seeded by 20260903000002.',
      r.sections, r.fields;
  end if;
  if r.offsite_sec <> 1 then
    raise exception 'FRM-701 has no off-site storage section to remove - this has run.';
  end if;
end $$;

create temporary table frm701_before on commit drop as
select md5((content - 'form_schema')::text) as h
  from public.sop_documents where sop_number = 'FRM-701';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', @@SCHEMA@@::jsonb)
 where sop_number = 'FRM-701' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'form_schema'->'sections')                             as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                         as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'id' in ('destination','storage_location','requirement_communicated',
                         'instruction_date','offsite_info'))                           as removed_left,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s
      where s->>'id' = 'offsite_storage')                                              as offsite_sec,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'rows'->'labels') l
      where f->>'id' = 'checks')                                                       as check_rows,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                               as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'signature')                                                  as signatures,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f ? 'width' and f->>'width' not in ('full','half','third'))                as bad_widths,
    (content->'form_schema'->'settings'->>'deletable')                                 as deletable,
    (content->'form_schema')::text like '%carrier will not wait%'                      as instructions,
    (content->'form_schema')::text like '%off-site storage%'                           as offsite_text
  into r
  from public.sop_documents where sop_number = 'FRM-701';

  select b.h = md5((d.content - 'form_schema')::text) into untouched
    from public.sop_documents d, frm701_before b where d.sop_number = 'FRM-701';

  if r.sections <> @@SEC@@ or r.fields <> @@FLD@@ then
    raise exception 'FRM-701 is % sections / % fields, expected @@SEC@@ / @@FLD@@.',
      r.sections, r.fields;
  end if;
  if r.removed_left <> 0 or r.offsite_sec <> 0 or r.offsite_text then
    raise exception 'Off-site content survives: % fields, % sections, text=%.',
      r.removed_left, r.offsite_sec, r.offsite_text;
  end if;
  if r.check_rows <> @@CHK@@ then
    raise exception 'The release checklist has % rows, expected @@CHK@@ - it must match FSQM-020 Part 4.',
      r.check_rows;
  end if;
  if r.list_fields <> @@LST@@ or r.signatures <> 1 or r.bad_widths <> 0 then
    raise exception 'Form damaged: % list fields, % signatures, % bad widths.',
      r.list_fields, r.signatures, r.bad_widths;
  end if;
  if r.deletable is distinct from 'false' then
    raise exception 'FRM-701 became deletable.';
  end if;
  if not r.instructions then
    raise exception 'The instruction text was not updated for collection.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FRM-701 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'Something outside form_schema changed on FRM-701. Rolled back.';
  end if;
end $$;

commit;
"""

sql701 = (SQL701.replace("@@SCHEMA@@", dollar(sch, "$j701$"))
                .replace("@@SEC@@", str(N701[0])).replace("@@FLD@@", str(N701[1]))
                .replace("@@CHK@@", str(len(checks["rows"]["labels"])))
                .replace("@@LST@@", str(N701[3])))
assert "@@" not in sql701
c701, k701 = like_check(sql701, blob, absent=("off-site storage",))
io.open(OUT701, "w", encoding="utf-8", newline="\n").write(sql701)

print("wrote %s" % OUT20)
print("  FSQM-020  28 -> %d lines (%d steps, %d bullets, %d prose); prerequisite withdrawn" % N20)
print("  %d LIKE patterns checked, %d skipped" % (c20, k20))
print("wrote %s" % OUT701)
print("  FRM-701   5/26 -> %d sections / %d fields; %d checks, %d list fields" % (N701[0], N701[1], len(checks["rows"]["labels"]), N701[3]))
print("  %d LIKE patterns checked, %d skipped" % (c701, k701))
