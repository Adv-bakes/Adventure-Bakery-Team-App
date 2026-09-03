# -*- coding: utf-8 -*-
"""FSQM-018: close the four gaps the pre-activation vetting found. Still draft.

  1  the procedure explained two of the four dispositions FRM-702 offers. Adds the release
     step and the return-to-supplier step, and a lead-in naming all four.
  2  the intended clause reference claimed Food Manufacturing 2.4.6.1, whose limbs iii
     (food safety plan) and iv (each batch inspected before release) were not covered.
     Both are now written, and limb vi's dangling "Positive Release Procedure" reference is
     replaced by the release step this migration adds - so the document no longer cites a
     document that does not exist.
  3  11.1.7.9 was claimed against a record with no equipment fields. Adds the out-of-service
     step for equipment that cannot be moved, and the repair / return-to-service step, with
     equipment records going to FRM-004 Equipment Register rather than FRM-702.
  7  step 1 said "determine the disposition", colliding with the final-disposition step.

Writes procedure, responsibility, form_references and revision_history; hashes the rest.
Refuses to overwrite an existing migration file.

Usage:  python scripts/build-fsqm018-dispositions.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC = "sop-drafts/FSQM-018-non-conforming-product.json"
OUT = "supabase/migrations/20260902000014_fsqm018_disposition_coverage.sql"
B, P = "• ", "> "

if os.path.exists(OUT):
    raise SystemExit("%s already exists - refusing to overwrite an applied migration." % OUT)

doc = json.load(io.open(SRC, encoding="utf-8"))
proc = list(doc["procedure"])
assert len(proc) == 27, "expected the 27-line body left by 20260902000013, found %d" % len(proc)

def replace_one(old_frag, new):
    hits = [i for i, l in enumerate(proc) if old_frag in l]
    assert len(hits) == 1, "%r matches %d lines" % (old_frag[:40], len(hits))
    proc[hits[0]] = new
    return hits[0]

def insert_after(frag, *lines):
    hits = [i for i, l in enumerate(proc) if frag in l]
    assert len(hits) == 1, "%r matches %d lines" % (frag[:40], len(hits))
    for k, l in enumerate(lines):
        proc.insert(hits[0] + 1 + k, l)
    return hits[0] + 1

# ---- fix 7: step 1 stops competing with the final-disposition step ------------------
replace_one("Upon completion of inspection and/or testing",
  "Upon completion of inspection and/or testing of raw material, work in progress, finished "
  "product samples, and equipment, the Quality Team shall determine whether the material or "
  "equipment conforms to specification, and shall record the result.")

# ---- fix 3a: equipment that cannot be moved ----------------------------------------
# Segregation into a Quarantine warehouse is written for material. A mixer cannot be carried
# there, and 11.1.7.9 accepts "identified, tagged, and/or segregated" for exactly that reason.
insert_after("Production staff shall physically segregate",
  "Where non-conforming equipment cannot be moved to the Quarantine area, it shall be tagged "
  "where it stands and taken out of service. Equipment taken out of service shall not be used "
  "again until it is released under the repair step below.")

# ---- fix 1: all four dispositions ---------------------------------------------------
replace_one("shall determine the final disposition of the product or equipment.",
  "The SQF Practitioner shall determine the final disposition of the product or equipment. "
  "FRM-702 records one of four outcomes: approved for production release, return to supplier, "
  "rework, or destruction and disposal.")

insert_after("complete the Final Disposition and Release Authorization section of FRM-702",
  # release - the most common outcome of a hold, and the one 2.4.7.1 governs
  "Material shall be approved for production release only after the inspections and analyses "
  "relevant to the reason for the hold are complete, their results are acceptable and recorded, "
  "and the SQF Practitioner has authorised the release on FRM-702. The Quality Team shall then "
  "remove the hold tag, and Admin shall return the material to available stock in the inventory "
  "system. Released material is listed on REP-701 QA Product & Material Release Log.",
  # return to supplier - and this is what FRM-702's Associated SCAR Number field is for
  "If the disposition is return to supplier, the Quality Team shall raise a Supplier "
  "Non-Conformance & Corrective Action Report (FRM-205) and record its number in the Associated "
  "SCAR Number field on FRM-702. Admin shall arrange the return under the approved supplier "
  "agreement terms and complete the necessary inventory transactions.")

replace_one("If the disposition is disposal, Admin shall discard",
  "If the disposition is destruction and disposal, Admin shall discard the held product or "
  "equipment, verify that the disposal is complete, and complete the necessary inventory "
  "transactions.")

# ---- fix 2: 2.4.6.1's uncovered limbs, and the dangling reference -------------------
insert_after("shall determine the rework formulation",
  B + "Reworked product shall be processed in accordance with the site's food safety plan. "
      "Rework shall not be used where it would affect the safety or integrity of the finished "
      "product.")

# limb iv wants EACH BATCH inspected before release, not "as needed"; limb vi wants release to
# conform to 2.4.7, which the release step above now provides - so the reference to a
# "Positive Release Procedure" that exists in no other document is removed.
replace_one("Positive Release Procedure",
  B + "Each batch of reworked material shall be inspected or analyzed against the finished "
      "product specification before release, and shall then be released under the release "
      "requirements of this procedure - recorded on FRM-702 and listed on REP-701.")

# ---- fix 3b: repair and return to service ------------------------------------------
# Placed with the dispositions - after the rework rules, before the closing steps - not at the
# end of the document. Matching on "reviewed biweekly by the Quality Team" put it after the hold
# inventory review, so the procedure ended on equipment repair two steps past its own closure
# rule. The last rework bullet is the right anchor: equipment repair is the fifth outcome, and it
# belongs beside the other four.
insert_after("Each batch of reworked material shall be inspected",
  "Non-conforming equipment shall not be returned to service until the repair is complete and "
  "the SQF Practitioner has confirmed that the equipment is capable of producing product that "
  "meets specification. The repair, that confirmation and the return to service shall be "
  "recorded against the equipment on FRM-004 Equipment Register, as shall the disposal of "
  "equipment that cannot be repaired.")

doc["procedure"] = proc

# ---- responsibility and linked forms follow the new steps ---------------------------
doc["responsibility"] = doc["responsibility"].replace(
  "determines rework formulations, and confirms reworked material meets the finished product "
  "specification before release.",
  "determines rework formulations, confirms each batch of reworked material meets the finished "
  "product specification before release, authorises the release of held material, and confirms "
  "that non-conforming equipment is capable of producing conforming product before it returns "
  "to service.")
assert "authorises the release of held material" in doc["responsibility"]
doc["responsibility"] = doc["responsibility"].replace(
  "discards material on a disposal disposition, and locates the remaining inventory of a suspect "
  "lot on request.",
  "discards material on a disposal disposition, arranges returns to suppliers under the approved "
  "supplier agreement terms, returns released material to available stock, and locates the "
  "remaining inventory of a suspect lot on request.")
assert "arranges returns to suppliers" in doc["responsibility"]

doc["form_references"] = ("FRM-702 Non-Conforming Material Hold & Tagging Record; "
                          "FRM-007 Corrective and Preventive Action (CAPA) Report; "
                          "FRM-205 Supplier Non-Conformance & Corrective Action Report (SCAR); "
                          "FRM-004 Equipment Register; "
                          "REP-701 QA Product & Material Release Log")

# ---- revision history ---------------------------------------------------------------
rh = doc["revision_history"]
NOTE = (
 "PRE-ACTIVATION VETTING, 2026-09-02. Activation was held back and the document was read clause "
 "by clause against the code, and step by step against the record it writes to. Four gaps were "
 "found and closed. Still draft.\n\n"
 "1. THE PROCEDURE EXPLAINED TWO OF THE FOUR DISPOSITIONS ITS OWN RECORD OFFERS. FRM-702's Final "
 "Disposition Decision is a four-option field — approved for production release, return to "
 "supplier, rework, destruction and disposal — and only rework and disposal had steps. Release is "
 "the most common outcome of a hold and the one SQF 2.4.7.1 governs, and nothing stated the "
 "conditions for it, who removes the hold tag, or how material returns to stock. Return to "
 "supplier had no step at all, although FRM-205 exists for it and FRM-702 carries an Associated "
 "SCAR Number field that nothing filled. Both steps are added, and the final-disposition step now "
 "names all four outcomes so the procedure and the form cannot be read apart.\n\n"
 "2. THE INTENDED CLAUSE REFERENCE OVERCLAIMED 2.4.6.1. Food Manufacturing 2.4.6.1 has seven "
 "limbs. Limb iii — reworked product processed in accordance with the site's food safety plan — "
 "was not in the document at all, and limb iv wants EACH BATCH inspected or analyzed before "
 "release where the text said \"as needed\". Both are now written. Limb vi requires release of "
 "reworked product to conform to 2.4.7, which is what the new release step provides. Claiming a "
 "clause that is only partly met is worse than claiming fewer, because it tells an auditor where "
 "to look.\n\n"
 "3. \"POSITIVE RELEASE PROCEDURE\" IS NO LONGER CITED. The rework rules made it the authority for "
 "the final disposition of reworked material, and no document of that name exists anywhere in the "
 "register — it was a Compass Blending reference that survived the import. Reworked material is now "
 "released under the release requirements of this procedure, recorded on FRM-702 and listed on "
 "REP-701. What remains unowned is a site-wide finished-product release procedure and a positive "
 "release procedure based on pathogen or chemical testing (2.4.7.3); neither is in this document's "
 "scope, and this document no longer implies they exist.\n\n"
 "4. NON-CONFORMING EQUIPMENT HAD NOWHERE TO GO AND NO WAY BACK. 11.1.7.9 requires equipment to be "
 "identified, tagged and/or segregated for repair or disposal, with records maintained. Segregation "
 "into a Quarantine warehouse is written for material; a mixer cannot be carried there, which is "
 "why the clause says \"and/or\". A step now covers tagging equipment where it stands and taking it "
 "out of service, and a second covers repair, the SQF Practitioner's confirmation that it can "
 "produce conforming product, and its return to service. Equipment records go to FRM-004 Equipment "
 "Register, not to FRM-702 — FRM-702's fields are Material Name, Supplier Name, P.O. Number and "
 "Supplier Lot, and its dispositions have no \"repaired and returned to service\", so recording a "
 "broken machine there would have been a record in name only.\n\n"
 "5. Step 1 gave the Quality Team \"determine the disposition\" while the final-disposition step "
 "gave it to the SQF Practitioner. Step 1 now determines whether the material or equipment "
 "conforms, and records the result.\n\n"
 "Linked Form now lists all five records the procedure requires: FRM-702, FRM-007, FRM-205, "
 "FRM-004 and REP-701. Body: 27 lines become 32 — 23 steps, 7 list items, 2 paragraphs."
)

OPEN_HEAD = ("OPEN BEFORE ISSUE — content questions still unanswered, because they are decisions "
             "about what the document should say rather than about what it already says:")
assert OPEN_HEAD in rh
rh = rh.replace(OPEN_HEAD, NOTE + "\n\n" + OPEN_HEAD)

# open item 2 loses the dangling-reference half, which is now fixed
OLD2 = rh[rh.index('2. "Positive Release Procedure" is named'):rh.index("UNTIL THIS DOCUMENT IS ISSUED")]
NEW2 = (
 '2. FSQM-019 Rework Procedure is an unapproved four-line draft, and it names a different '
 'authority for rework than this document does: FSQM-019 says the R&D Manager authorises it, this '
 'procedure says the SQF Practitioner. The substantive rework rules are here. Leaving a live draft '
 'that contradicts an active procedure is a document-control exposure under SOP-2.2.3, so FSQM-019 '
 'should be withdrawn or archived when this document is issued, or its rework rules moved into it '
 'and this document made to defer. That decision belongs to the SQF Practitioner and is the last '
 'thing outstanding before issue.\n\n'
 '3. Not in this document\'s scope but adjacent and unowned: there is no site-wide product release '
 'procedure (2.4.7 Product Release is Mandatory in the Food Manufacturing code), no positive '
 'release procedure based on pathogen or chemical testing (2.4.7.3), and no returned-product '
 'procedure (Quality Code 2.4.5.3). This document releases held and reworked material only, and '
 'says so.\n\n')
rh = rh.replace(OLD2, NEW2)
doc["revision_history"] = rh

# ---------------------------------------------------------------- checks
steps   = [l for l in proc if not l.startswith(B) and not l.startswith(P)]
bullets = [l for l in proc if l.startswith(B)]
prose   = [l for l in proc if l.startswith(P)]
assert len(steps) + len(bullets) + len(prose) == len(proc)
body = "\n".join(proc) + "\n" + doc["responsibility"]

if "Positive Release Procedure" in body:
    raise SystemExit("the dangling reference survives")
for need in ("approved for production release, return to supplier, rework, or destruction and disposal",
             "Associated SCAR Number field on FRM-702", "FRM-205", "FRM-004 Equipment Register",
             "REP-701", "site's food safety plan", "Each batch of reworked material",
             "taken out of service", "capable of producing product that meets specification",
             "conforms to specification, and shall record the result"):
    if need not in body:
        raise SystemExit("fix not applied: %r" % need)
for keep in ("Quarantine area immediately to prevent accidental usage", "like into like",
             "shall not be reworked into other certified Gluten Free products",
             "clearly identified in the batch sheet and traceable", "testing@gluten.org",
             "before a CAPA can be closed", "FSQM-009", "FRM-007"):
    if keep not in body:
        raise SystemExit("a requirement was lost: %r" % keep)
for gone in ("QC personnel", "Quality Leader", "Plant Manager", "Warehouse personnel",
             "Customer Services and Sales Supply", "functional area manager"):
    if gone in body:
        raise SystemExit("a Compass post reappeared: %r" % gone)
if re.search(r"\bR&D\b", body):
    raise SystemExit("R&D reappeared in the body")

N = (len(proc), len(steps), len(bullets), len(prose))
assert N == (32, 23, 7, 2), "unexpected body shape %s" % (N,)

io.open(SRC, "w", encoding="utf-8", newline="\n").write(
    json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

def dollar(v):
    s = json.dumps(v, ensure_ascii=False)
    assert "$j$" not in s
    return "$j$" + s + "$j$"

SQL = u"""-- FSQM-018: close the four gaps the pre-activation vetting found. Still draft.
--
-- Activation was held back and the document was read clause by clause against both code editions,
-- and step by step against the record it writes to. What that turned up was not wording.
--
-- 1. THE PROCEDURE EXPLAINED TWO OF THE FOUR DISPOSITIONS ITS OWN RECORD OFFERS. FRM-702's Final
-- Disposition Decision is a four-option select - APPROVED FOR PRODUCTION RELEASE, RETURN TO
-- SUPPLIER, REWORK, DESTRUCTION / DISPOSAL - and only rework and disposal had steps. Release is the
-- most common outcome of a hold and the one 2.4.7.1 governs ("released by authorized personnel, and
-- only after all inspections and analyses are successfully completed and documented"), and nothing
-- stated its conditions, who removes the hold tag, or how material returns to stock. Return to
-- supplier had no step at all, though FRM-205 is active for exactly that and FRM-702 carries an
-- Associated SCAR Number field that nothing ever filled. Both steps are added; the
-- final-disposition step now names all four, so the form and the procedure cannot be read apart.
--
-- 2. THE INTENDED CLAUSE REFERENCE OVERCLAIMED 2.4.6.1, whose seven limbs were checked one by one.
-- Limb iii - reworked product processed in accordance with the site's food safety plan - was absent
-- entirely. Limb iv wants EACH BATCH inspected or analyzed before release; the text said "as
-- needed". Both are now written. Limb vi requires release of reworked product to conform to 2.4.7,
-- which is what the new release step provides. Claiming a clause only partly met is worse than
-- claiming fewer, because it tells an auditor exactly where to look.
--
-- 3. "POSITIVE RELEASE PROCEDURE" IS NO LONGER CITED, and this is the finding worth the delay. The
-- rework rules made it the authority for final disposition of reworked material and no document of
-- that name exists anywhere in the register - a Compass Blending reference that survived the
-- import. Reworked material is now released under this procedure's own release requirements,
-- recorded on FRM-702 and listed on REP-701 (which is a derived register over FRM-702 filtered to
-- the release disposition, so it populates without a manual step). An active document citing a
-- procedure that does not exist was the one thing that made issuing this a known exposure; it is
-- gone. What remains unowned - a site-wide product release procedure, positive release on pathogen
-- or chemical testing (2.4.7.3), and returned product (Quality Code 2.4.5.3) - is outside this
-- document's scope, and it no longer implies those exist.
--
-- 4. NON-CONFORMING EQUIPMENT HAD NOWHERE TO GO AND NO WAY BACK. 11.1.7.9 requires equipment to be
-- identified, tagged AND/OR segregated for repair or disposal, with records maintained. Segregation
-- into a Quarantine warehouse is written for material; a mixer cannot be carried there, which is
-- why the clause says "and/or". One step now covers tagging equipment where it stands and taking it
-- out of service; another covers repair, the SQF Practitioner's confirmation that it can produce
-- conforming product, and return to service. EQUIPMENT RECORDS GO TO FRM-004 Equipment Register,
-- not FRM-702: FRM-702's fields are Material Name, Supplier Name, P.O. Number and Supplier Lot, and
-- its four dispositions have no "repaired and returned to service", so recording a broken machine
-- there would have been a record in name only.
--
-- 5. Step 1 gave the Quality Team "determine the disposition" while the final-disposition step gave
-- it to the SQF Practitioner. Step 1 now determines whether the material or equipment conforms.
--
-- Linked Form lists all five records the procedure requires: FRM-702, FRM-007, FRM-205, FRM-004,
-- REP-701. All five are asserted active below - an active procedure requiring a record that is not
-- available is the finding this wave exists to close, and this migration adds three such
-- requirements.
--
-- STILL DRAFT, NO REVISION BUMP. Never issued, nothing to supersede. Issue is a separate migration
-- once the last open item is decided: FSQM-019 Rework Procedure is a live draft naming a different
-- rework authority (R&D Manager) than this document (SQF Practitioner), and leaving it live against
-- an active procedure is a document-control exposure under SOP-2.2.3.
--
-- Writes procedure, responsibility, form_references and revision_history. The DO block hashes
-- everything else before and after; scripts/check-migration-hashes.py verifies the key lists agree.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (content->'procedure')::text like '%Positive Release Procedure%'              as dangling_ref,
         (content->'procedure')::text like '%FRM-205%'                                as already_done,
         (select count(*) from public.sop_documents
           where sop_number in ('FRM-702','FRM-007','FRM-205','FRM-004','REP-701')
             and status = 'active')                                                   as records_live
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r is null then
    raise exception 'FSQM-018 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is % - a content change to an issued document needs a revision bump. Stop and re-derive.',
      r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-018 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  if r.lines <> 27 then
    raise exception 'FSQM-018 has % procedure lines, expected the 27 left by 20260902000013.', r.lines;
  end if;
  if not r.dangling_ref then
    raise exception 'FSQM-018 no longer cites the Positive Release Procedure this migration removes.';
  end if;
  if r.already_done then
    raise exception 'FSQM-018 already references FRM-205 - this migration has run.';
  end if;
  if r.records_live <> 5 then
    raise exception 'Only % of FRM-702, FRM-007, FRM-205, FRM-004 and REP-701 are active. Do not require a record that is not available.',
      r.records_live;
  end if;
end $$;

create temporary table fsqm018_disp_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-018';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', @@PROC@@::jsonb),
                       '{responsibility}', @@RESP@@::jsonb),
                     '{form_references}', @@FORMREF@@::jsonb),
                   '{revision_history}', @@RH@@::jsonb)
 where sop_number = 'FSQM-018' and status = 'draft' and revision = 'New';

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
    (select coalesce(max(length(s)), 0) from jsonb_array_elements_text(content->'procedure') s)
                                                                                      as longest,
    -- fix 1: all four dispositions are explained
    (content->'procedure')::text like '%approved for production release, return to supplier, rework, or destruction and disposal%'
                                                                                      as four_named,
    (content->'procedure')::text like '%approved for production release only after the inspections%'
                                                                                      as release_step,
    (content->'procedure')::text like '%Associated SCAR Number field on FRM-702%'     as return_step,
    (content->'procedure')::text like '%destruction and disposal, Admin shall discard%' as disposal_step,
    -- fix 2: the two uncovered limbs of 2.4.6.1
    (content->'procedure')::text like '%site''s food safety plan%'                    as limb_iii,
    (content->'procedure')::text like '%Each batch of reworked material shall be inspected%'
                                                                                      as limb_iv,
    -- and the reference to a document that does not exist is gone
    (content->'procedure')::text like '%Positive Release Procedure%'                  as dangling_ref,
    -- fix 3: equipment out of service, repair, and records to FRM-004
    (content->'procedure')::text like '%tagged where it stands and taken out of service%'
                                                                                      as out_of_service,
    (content->'procedure')::text like '%capable of producing product that meets specification%'
                                                                                      as repair_step,
    (content->'procedure')::text like '%FRM-004 Equipment Register%'                  as equip_register,
    -- fix 7
    (content->'procedure')::text like '%conforms to specification, and shall record the result%'
                                                                                      as step1_fixed,
    -- linked forms list every record the procedure now requires
    (select count(*) from unnest(array['FRM-702','FRM-007','FRM-205','FRM-004','REP-701']) fr
      where strpos(content->>'form_references', fr) = 0)                              as forms_missing,
    -- and nothing earlier was undone
    (content->'procedure')::text like '%before a CAPA can be closed%'                 as deadlock_note,
    (content->'procedure')::text like '%like into like%'                              as like_into_like,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s ~ 'QC personnel|Quality Leader|Plant Manager|Warehouse personnel|Customer Services and Sales Supply|functional area manager|\\mR&D\\M')
                                                                                      as compass_back,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where regexp_replace(s, '^(• |> )', '') ~ '^\\s*\\d+(\\.\\d+)*[.)]?\\s')          as numbered
  into r
  from public.sop_documents where sop_number = 'FSQM-018';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm018_disp_before b where d.sop_number = 'FSQM-018';

  if r.lines <> @@N_LINES@@ or r.steps <> @@N_STEPS@@
     or r.bullets <> @@N_BULLETS@@ or r.prose <> @@N_PROSE@@ then
    raise exception 'FSQM-018 body wrong shape: % lines, % steps, % bullets, % prose (expected @@N_LINES@@ / @@N_STEPS@@ / @@N_BULLETS@@ / @@N_PROSE@@).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % + % + % <> %.', r.steps, r.bullets, r.prose, r.lines;
  end if;
  if not (r.four_named and r.release_step and r.return_step and r.disposal_step) then
    raise exception 'Dispositions incomplete: all four named=%, release=%, return to supplier=%, disposal=%.',
      r.four_named, r.release_step, r.return_step, r.disposal_step;
  end if;
  if not (r.limb_iii and r.limb_iv) then
    raise exception '2.4.6.1 still overclaimed: food safety plan=%, each batch before release=%.',
      r.limb_iii, r.limb_iv;
  end if;
  if r.dangling_ref then
    raise exception 'The document still cites a Positive Release Procedure that does not exist.';
  end if;
  if not (r.out_of_service and r.repair_step and r.equip_register) then
    raise exception '11.1.7.9 still uncovered: out of service=%, repair=%, FRM-004=%.',
      r.out_of_service, r.repair_step, r.equip_register;
  end if;
  if not r.step1_fixed then
    raise exception 'Step 1 still competes with the final-disposition step.';
  end if;
  if r.forms_missing <> 0 then
    raise exception '% of the five required records are missing from Linked Form.', r.forms_missing;
  end if;
  if not (r.deadlock_note and r.like_into_like) then
    raise exception 'Earlier work undone: deadlock sentence=%, like-into-like=%.',
      r.deadlock_note, r.like_into_like;
  end if;
  if r.compass_back <> 0 then
    raise exception '% lines reintroduced a Compass Blending post.', r.compass_back;
  end if;
  if r.numbered <> 0 then
    raise exception '% lines carry their own step number.', r.numbered;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is now % - this migration must not issue it.', r.status;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters - a run-on has appeared.', r.longest;
  end if;
  if not untouched then
    raise exception 'A section other than the four written changed. Rolled back.';
  end if;
end $$;

commit;
"""

sql = (SQL.replace("@@PROC@@", dollar(proc))
          .replace("@@RESP@@", dollar(doc["responsibility"]))
          .replace("@@FORMREF@@", dollar(doc["form_references"]))
          .replace("@@RH@@", dollar(doc["revision_history"]))
          .replace("@@N_LINES@@", str(N[0])).replace("@@N_STEPS@@", str(N[1]))
          .replace("@@N_BULLETS@@", str(N[2])).replace("@@N_PROSE@@", str(N[3])))
assert "@@" not in sql

payload = json.dumps(proc, ensure_ascii=False) + "\n" + doc["responsibility"] + "\n" \
          + doc["form_references"] + "\n" + doc["revision_history"]
ABSENT = ("Positive Release Procedure",)
checked = skipped = 0
for m in re.finditer(r"like '%([^']*?)%'", sql):
    lit = m.group(1)
    if "%" in lit or lit in ABSENT:
        skipped += 1
        continue
    checked += 1
    probe = lit.replace("''", "'")          # SQL-escaped quote back to a literal one
    if probe not in payload:
        low = probe.lower() in payload.lower()
        raise SystemExit("LIKE pattern never matches%s: %r"
                         % (" (case differs only)" if low else "", probe[:70]))

io.open(OUT, "w", encoding="utf-8", newline="\n").write(sql)
print("wrote %s" % OUT)
print("  procedure       27 -> %d lines  (%d steps, %d bullets, %d prose)" % N)
print("  new steps       equipment out of service · production release · return to supplier · equipment repair")
print("  new bullet      food safety plan (2.4.6.1 limb iii)")
print("  removed         the Positive Release Procedure reference")
print("  linked forms    FRM-702, FRM-007, FRM-205, FRM-004, REP-701")
print("  %d content LIKE patterns checked, %d absence/wildcard skipped" % (checked, skipped))
