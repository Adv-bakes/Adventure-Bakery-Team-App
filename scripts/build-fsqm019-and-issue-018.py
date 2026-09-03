# -*- coding: utf-8 -*-
"""Align FSQM-019's rework authority, then issue FSQM-018. Two migrations, one decision.

The owner decided on 2026-09-02 that rework authority is the SQF Practitioner's. FSQM-019
said the R&D Manager, which was the last thing blocking FSQM-018's issue: two live documents
disagreeing on who authorises rework is a document-control finding under SOP-2.2.3.

  20260902000015  FSQM-019 rework authority -> SQF Practitioner, house role vocabulary, the
                  importer's "Related Links" artifact out of procedure[], and a cross-reference
                  so it defers to FSQM-018 rather than restating it. Stays draft.
  20260902000016  FSQM-018 issued: Records / Governing Reference / clause reference filled,
                  the reconstructed GFCO address removed, active / GJM / 2026-09-02.

Refuses to overwrite either existing migration file.

Usage:  python scripts/build-fsqm019-and-issue-018.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

D18 = "sop-drafts/FSQM-018-non-conforming-product.json"
D19 = "sop-drafts/FSQM-019-rework-procedure.json"
OUT19 = "supabase/migrations/20260902000015_fsqm019_rework_authority.sql"
OUT18 = "supabase/migrations/20260902000016_issue_fsqm018.sql"
B, P = "• ", "> "
SQF_REF = "2.4.5.1, 2.4.5.2, 2.4.6.1, 11.1.7.9"

for f in (OUT19, OUT18):
    if os.path.exists(f):
        raise SystemExit("%s already exists - refusing to overwrite an applied migration." % f)

def dollar(v):
    s = json.dumps(v, ensure_ascii=False)
    assert "$j$" not in s
    return "$j$" + s + "$j$"

def like_check(sql, payload, absent=()):
    """Every LIKE pattern asserting content must match its payload. LIKE is case-sensitive; a
    mismatched capital failed the first push of 20260902000001 against a correct document."""
    checked = skipped = 0
    for m in re.finditer(r"like '%([^']*?)%'", sql):
        lit = m.group(1)
        if "%" in lit or lit in absent:
            skipped += 1
            continue
        checked += 1
        probe = lit.replace("''", "'")
        if probe not in payload:
            low = probe.lower() in payload.lower()
            raise SystemExit("LIKE pattern never matches%s: %r"
                             % (" (case differs only)" if low else "", probe[:70]))
    return checked, skipped

# ======================================================================= FSQM-019
# Read from prod on 2026-09-02. Four procedure lines, of which two are importer artifacts:
# a "Related Links" heading and the link under it, both of which belong in form_references.
P19_OLD = [
 "1. Rework is performed under supervision of the quality department. The R&D Manager needs to "
 "authorize the rework process. Rework process is only authorized when the product quality, "
 "safety or legality is not compromised, e.g. allergy status, ingredient declarations, etc. "
 "Quality Department keeps record of all rework by providing instructions in the Batch Sheet "
 "or/and Rework form. All products reworked should have the Batch Sheet marked in \"REWORK\" to "
 "maintain traceability.",
 "2. After a product is reworked, it will follow the same procedure for release, verification "
 "and monitoring activities.",
 "Related Links",
 "Batch Sheets Rework form",
]

doc19 = {
 "purpose": "The company has documented and implemented procedures for controlling rework, which "
            "are maintained in order to ensure all products conform to agreed specifications in "
            "order that the quality and safety of the end product is not compromised.",
 "scope": "The scope of the procedure for controlling rework includes all products and activities "
          "that have the potential to impact on food safety and quality.",
 "definitions": "",
 "responsibility":
   "SQF Practitioner — authorises every rework, and only where product quality, safety and "
   "legality are not compromised. Authorises the release of reworked product under FSQM-018.\n"
   "Quality Team — supervises rework, records it on the batch sheet, and marks the batch sheet "
   "\"REWORK\" so the rework remains traceable.\n"
   "Production staff — perform rework only against an authorised instruction on the batch sheet.",
 "procedure": [
   "Rework is performed under the supervision of the Quality Team. The SQF Practitioner "
   "authorises the rework process, and authorises it only where product quality, safety and "
   "legality are not compromised — allergen status and ingredient declarations in particular.",
   "The Quality Team shall record all rework by providing instructions on the batch sheet and/or "
   "the rework form. Every batch sheet for reworked product shall be marked \"REWORK\" so that "
   "the rework remains traceable.",
   "Reworked product is released under the release requirements of FSQM-018 Non-Conforming "
   "Product and Equipment: inspected or analyzed against the finished product specification "
   "before release, authorised by the SQF Practitioner on FRM-702, and listed on REP-701.",
   "> The detailed rework rules — like-into-like, the bar on reworking certified Gluten Free "
   "product segregated for a positive gluten result, the formulation, batch-sheet traceability, "
   "and the biweekly review of rework quantities held in the Quarantine area — are set out in "
   "FSQM-018 and are not restated here, so the two documents cannot give different answers.",
 ],
 "form_references": "Batch sheets (marked \"REWORK\"); FRM-702 Non-Conforming Material Hold & "
                    "Tagging Record; REP-701 QA Product & Material Release Log",
 "records": "",
 "governing_reference": "",
 "revision_history":
   "Rev New — imported 2026-06-17 from a scanned Compass Blending hardcopy through the Word "
   "importer. DRAFT. Not approved, not in force.\n\n"
   "REWORK AUTHORITY, 2026-09-02. The site decided that rework authority is the SQF "
   "Practitioner's. This document said \"The R&D Manager needs to authorize the rework process\", "
   "while FSQM-018 Non-Conforming Product and Equipment gives it to the SQF Practitioner. Two "
   "documents naming different authorities for the same decision is a document-control problem "
   "under SOP-2.2.3 regardless of which is right, and it was the last item blocking FSQM-018's "
   "issue. This document now says the SQF Practitioner, and both are the same person here in any "
   "case — see the role vocabulary note below.\n\n"
   "ROLES. \"The quality department\" and \"Quality Department\" become the Quality Team, and the "
   "R&D Manager becomes the SQF Practitioner: the six roles FSQM-009, FSQM-012, FSQM-013, "
   "FSQM-018 and FSQM-022 use. Responsibility was empty and now assigns duties to the three roles "
   "this procedure actually needs. No individual is named — a document that names a person has to "
   "be reissued when the person changes.\n\n"
   "IT DEFERS TO FSQM-018 RATHER THAN RESTATING IT. FSQM-018 carries the substantive rework "
   "rules, because that is where the scanned original put them. Restating them here would let the "
   "two drift, which is exactly what the authority conflict was. A closing paragraph names what "
   "lives there and says it is deliberately not repeated. The release step likewise points at "
   "FSQM-018's release requirements instead of the original's vague \"the same procedure for "
   "release, verification and monitoring activities\".\n\n"
   "IMPORTER ARTIFACTS REMOVED. Two of the four stored procedure lines were not steps: a "
   "\"Related Links\" heading and \"Batch Sheets Rework form\" underneath it, which the importer "
   "read as procedure content. Both are now expressed in Form References, where a linked record "
   "belongs.\n\n"
   "OPEN BEFORE ISSUE:\n\n"
   "1. \"The rework form\" is named in the body and has no document number. No FRM in the "
   "register is a rework form, so either the batch sheet is the only record — in which case that "
   "phrase should go — or a form exists on paper and needs numbering. The body keeps the "
   "inherited wording rather than inventing either answer.\n\n"
   "2. This document is thin: four steps, no Records, no Governing Reference, no clause "
   "reference. It is aligned but not complete, and it is a candidate for withdrawal in favour of "
   "FSQM-018's rework section rather than issue. Aligning it removed the contradiction; deciding "
   "whether it should exist at all is separate and does not block anything.",
}

p19 = doc19["procedure"]
s19 = [l for l in p19 if not l.startswith(B) and not l.startswith(P)]
b19 = [l for l in p19 if l.startswith(B)]
r19 = [l for l in p19 if l.startswith(P)]
assert len(s19) + len(b19) + len(r19) == len(p19)
body19 = "\n".join(p19) + "\n" + doc19["responsibility"]
for gone in ("R&D Manager", "quality department", "Quality Department", "Related Links"):
    if gone in body19:
        raise SystemExit("FSQM-019 still carries %r" % gone)
for need in ("The SQF Practitioner\nauthorises", "SQF Practitioner"):
    pass
if "The SQF Practitioner " not in body19:
    raise SystemExit("FSQM-019 does not name the SQF Practitioner as authority")
for keep in ("allergen status and ingredient declarations", "marked \"REWORK\"", "FSQM-018"):
    if keep not in body19:
        raise SystemExit("FSQM-019 lost %r" % keep)

io.open(D19, "w", encoding="utf-8", newline="\n").write(
    json.dumps(doc19, ensure_ascii=False, indent=2) + "\n")

SQL19 = u"""-- FSQM-019: rework authority is the SQF Practitioner's. Stays draft. Unblocks FSQM-018.
--
-- THE LAST THING BLOCKING FSQM-018'S ISSUE. This document said "The R&D Manager needs to authorize
-- the rework process"; FSQM-018 gives that authority to the SQF Practitioner. Two documents naming
-- different authorities for the same decision is a document-control problem under SOP-2.2.3 no
-- matter which one is right, and issuing FSQM-018 over a live draft that contradicts it would have
-- created the finding rather than closed it. The site decided on 2026-09-02: the SQF Practitioner.
--
-- BOTH POSTS ARE THE SAME PERSON HERE, which is why this is a vocabulary fix and not a transfer of
-- power. "The quality department" and "Quality Department" become the Quality Team, and the R&D
-- Manager becomes the SQF Practitioner - the six roles FSQM-009, FSQM-012, FSQM-013, FSQM-018 and
-- FSQM-022 already use. Responsibility was EMPTY and now assigns duties to the three roles this
-- procedure needs.
--
-- IT DEFERS TO FSQM-018 RATHER THAN RESTATING IT. FSQM-018 carries the substantive rework rules -
-- like-into-like, the gluten-free bar, formulation, batch-sheet traceability, the biweekly review -
-- because that is where the scanned original put them. Copying them here would let the two drift,
-- which is precisely how the authority conflict arose. A closing paragraph names what lives there
-- and says it is deliberately not repeated, the same pattern FSQM-018 uses toward FSQM-009. The
-- release step now points at FSQM-018's release requirements instead of the original's vague "the
-- same procedure for release, verification and monitoring activities".
--
-- TWO OF THE FOUR STORED LINES WERE NOT STEPS. "Related Links" and "Batch Sheets Rework form" are
-- importer artifacts - a heading and the link under it, read as procedure content. They move to
-- Form References, where a linked record belongs. Four lines in, four lines out, but three of them
-- are now real steps and one is a paragraph.
--
-- STILL DRAFT. Aligning it removes the contradiction; whether this document should exist at all,
-- rather than being withdrawn in favour of FSQM-018's rework section, is a separate decision and
-- blocks nothing. Recorded in its Revision History as an open item, along with "the rework form",
-- which is named in the body and matches no numbered form in the register.
--
-- Writes procedure, responsibility, form_references and revision_history; hashes the rest.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                              as lines,
         (content->'procedure')::text like '%R&D Manager needs to authorize%'   as old_authority,
         coalesce(content->>'responsibility','')                               as resp,
         (select count(*) from public.sop_documents
           where sop_number in ('FSQM-018','FRM-702','REP-701'))              as refs_exist
    into r
    from public.sop_documents where sop_number = 'FSQM-019';

  if r is null then
    raise exception 'FSQM-019 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-019 is % - a content change to an issued document needs a revision bump.', r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-019 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  if r.lines <> 4 then
    raise exception 'FSQM-019 has % procedure lines, expected the 4 the importer left.', r.lines;
  end if;
  if not r.old_authority then
    raise exception 'FSQM-019 no longer names the R&D Manager as rework authority - this has run.';
  end if;
  if r.resp <> '' then
    raise exception 'FSQM-019 Responsibility is already populated - re-derive before overwriting it.';
  end if;
  if r.refs_exist <> 3 then
    raise exception 'Only % of FSQM-018, FRM-702 and REP-701 exist to be referenced.', r.refs_exist;
  end if;
end $$;

create temporary table fsqm019_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-019';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', @@P19@@::jsonb),
                       '{responsibility}', @@R19@@::jsonb),
                     '{form_references}', @@F19@@::jsonb),
                   '{revision_history}', @@H19@@::jsonb)
 where sop_number = 'FSQM-019' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'procedure')                                   as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                             as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                      as prose,
    (content->'procedure')::text like '%The SQF Practitioner authorises the rework process%'
                                                                               as new_authority,
    (content->'procedure')::text like '%R&D%'                                  as rd_left,
    (content->'procedure')::text like '%uality Department%'                    as dept_left,
    (content->'procedure')::text like '%Related Links%'                        as artifact_left,
    (content->'procedure')::text like '%are not restated here%'                as defers,
    (content->'procedure')::text like '%so that the rework remains traceable%' as rework_mark,
    (content->'procedure')::text like '%allergen status and ingredient declarations%'
                                                                               as allergen,
    (content->>'form_references') like '%FRM-702%'                             as formrefs,
    (select count(*) from unnest(array['SQF Practitioner','Quality Team','Production staff']) rn
      where strpos(content->>'responsibility', rn) = 0)                        as roles_missing
  into r
  from public.sop_documents where sop_number = 'FSQM-019';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm019_before b where d.sop_number = 'FSQM-019';

  if r.lines <> @@L19@@ or r.steps <> @@S19@@ or r.prose <> @@PR19@@ then
    raise exception 'FSQM-019 body wrong shape: % lines, % steps, % prose (expected @@L19@@ / @@S19@@ / @@PR19@@).',
      r.lines, r.steps, r.prose;
  end if;
  if not r.new_authority then
    raise exception 'FSQM-019 does not give rework authority to the SQF Practitioner.';
  end if;
  if r.rd_left or r.dept_left or r.artifact_left then
    raise exception 'Old vocabulary or importer artifact survives: R&D=%, Quality Department=%, Related Links=%.',
      r.rd_left, r.dept_left, r.artifact_left;
  end if;
  if not (r.defers and r.rework_mark and r.allergen and r.formrefs) then
    raise exception 'FSQM-019 incomplete: defers to FSQM-018=%, REWORK marking=%, allergen wording=%, form refs=%.',
      r.defers, r.rework_mark, r.allergen, r.formrefs;
  end if;
  if r.roles_missing <> 0 then
    raise exception '% of the three roles have no duties in Responsibility.', r.roles_missing;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-019 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'A section other than the four written changed on FSQM-019. Rolled back.';
  end if;
end $$;

commit;
"""

sql19 = (SQL19.replace("@@P19@@", dollar(p19)).replace("@@R19@@", dollar(doc19["responsibility"]))
              .replace("@@F19@@", dollar(doc19["form_references"]))
              .replace("@@H19@@", dollar(doc19["revision_history"]))
              .replace("@@L19@@", str(len(p19))).replace("@@S19@@", str(len(s19)))
              .replace("@@PR19@@", str(len(r19))))
assert "@@" not in sql19
pay19 = json.dumps(p19, ensure_ascii=False) + "\n" + doc19["responsibility"] + "\n" \
        + doc19["form_references"] + "\n" + doc19["revision_history"]
c19, k19 = like_check(sql19, pay19,
                      absent=("R&D Manager needs to authorize", "R&D", "uality Department",
                              "Related Links"))
io.open(OUT19, "w", encoding="utf-8", newline="\n").write(sql19)

# ======================================================================= FSQM-018 issue
doc = json.load(io.open(D18, encoding="utf-8"))
proc = doc["procedure"]
assert len(proc) == 32, "expected the 32-line body left by 20260902000014, found %d" % len(proc)

OLD_GFCO = "• The SQF Practitioner shall notify GFCO at testing@gluten.org."
NEW_GFCO = ("• The SQF Practitioner shall notify GFCO, using the contact details in the current "
            "GFCO certification agreement.")
proc[proc.index(OLD_GFCO)] = NEW_GFCO

doc["records"] = (
  "FRM-702 Non-Conforming Material Hold & Tagging Record — one per hold. Identification of the "
  "material or equipment, the hold tag number, the segregated storage location, the final "
  "disposition and its authorisation.\n"
  "FRM-007 Corrective and Preventive Action (CAPA) Report — the investigation, where a CAPA is "
  "raised under FSQM-009. Its number is recorded on FRM-702 so the hold and the investigation are "
  "traceable to each other.\n"
  "FRM-205 Supplier Non-Conformance & Corrective Action Report (SCAR) — where the disposition is "
  "return to supplier. Its number is recorded in the Associated SCAR Number field on FRM-702.\n"
  "FRM-004 Equipment Register — the repair of non-conforming equipment, the confirmation that it "
  "can produce conforming product, its return to service, and the disposal of equipment that "
  "cannot be repaired.\n"
  "REP-701 QA Product & Material Release Log — the release of held or reworked material. Derived "
  "from FRM-702, so a release recorded there is listed without a further entry.\n"
  "Batch sheets — identify rework material and the formulation used, and carry its traceability.\n"
  "Retention: two years, or the shelf life of the product plus twelve months, whichever is longer. "
  "This is the period set by FSQM-009 Part 10, so a hold and the investigation arising from it are "
  "retained on the same basis."
)
doc["governing_reference"] = (
  "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.4.5 Non-conforming Materials and "
  "Product; 2.4.6 Product Rework; 11.1.7.9 non-conforming equipment.\n"
  "SQF Quality Code, Edition 9 — 2.4.5 Non-conforming Product or Equipment; 2.4.6 Product Rework.\n"
  "FSQM-009 Corrective and Preventive Action (CAPA) Program — governs the investigation, root "
  "cause, corrective and preventive action, verification of effectiveness and closure of any CAPA "
  "raised from a hold under this procedure.\n"
  "FSQM-019 Rework Procedure — aligned to this document on 2026-09-02 and still an unapproved "
  "draft, so it is named here for the reader and is not cited as governing."
)

rh = doc["revision_history"]

# The roles pass left a sentence that reads as a current statement and is no longer true.
STALE = "The body is 27 lines: 19 steps, 6 list items and 2 paragraphs."
assert STALE in rh
rh = rh.replace(STALE, "That pass left the body at 27 lines: 19 steps, 6 list items and 2 paragraphs.")

OLD_RECON = ("RECONSTRUCTIONS — two places where the scan was not legible and the text was "
             "repaired rather than transcribed. Both need confirming before this document is "
             "issued:")
assert OLD_RECON in rh
rh = rh.replace(OLD_RECON,
  "RECONSTRUCTIONS — two places where the scan was not legible and the text was repaired rather "
  "than transcribed. Both were resolved at issue, the first by removing the reconstruction rather "
  "than adopting it:")

OLD_1 = ("1. The GFCO notification address read \"testing(4Iuten.org\", which is not an address. It "
         "is written as testing@gluten.org. Confirm against GFCO's current certification "
         "correspondence before issue.")
assert OLD_1 in rh
rh = rh.replace(OLD_1,
  "1. The GFCO notification address read \"testing(4Iuten.org\", which is not an address. The draft "
  "carried testing@gluten.org as a reconstruction awaiting confirmation. AT ISSUE THE INVENTED "
  "ADDRESS WAS REMOVED rather than adopted: the step now says to notify GFCO using the contact "
  "details in the current GFCO certification agreement. An active controlled document must not "
  "assert a fact nobody has verified, and a certifier's contact details change without this "
  "document being revised, so the agreement is the better authority in any case.")

OLD_2T = ("It reads \"the hold, notification and segregation steps set out below\". If a specific "
          "range was meant, restore it against the paper original.")
assert OLD_2T in rh
rh = rh.replace(OLD_2T,
  "It reads \"the hold, notification and segregation steps set out below\". ADOPTED AT ISSUE as "
  "written; the descriptive form cannot go stale the way a numeric range can. If a narrower range "
  "was meant, it is a revision to make against the paper original.")

OLD_S1 = ("and it is written as \"shall determine the disposition of\". Confirm this is what the "
          "original intended.")
assert OLD_S1 in rh
rh = rh.replace(OLD_S1,
  "and it was written as \"shall determine the disposition of\", then narrowed again by the "
  "pre-activation vetting to determining whether the material conforms. ADOPTED AT ISSUE: the "
  "literal reading directed that everything inspected be thrown away, which no procedure can have "
  "meant.")

OLD_OPEN = ("OPEN BEFORE ISSUE — content questions still unanswered, because they are decisions "
            "about what the document should say rather than about what it already says:")
assert OLD_OPEN in rh
rh = rh.replace(OLD_OPEN,
  "ISSUED 2026-09-02, approved GJM. Status active, revision New — a first issue, not a revision, "
  "so nothing is superseded and nothing is archived.\n\n"
  "SETTLED AT ISSUE. Records, Governing Reference and the SQF clause reference were empty, and a "
  "controlled document with no stated records and no clause reference cannot be audited against "
  "anything. All three are now filled. The clause reference is " + SQF_REF + " — 11.1.7.9 covering "
  "non-conforming EQUIPMENT specifically, which this document's title claims and which nothing "
  "else here covers, and 2.4.6.1 claimed only because the pre-activation vetting wrote in its "
  "limbs iii and iv rather than leaving them uncovered. 2.4.7 Product Release is deliberately NOT "
  "claimed: this document releases held and reworked material, not the site's finished product "
  "generally. Records name FRM-702, FRM-007, FRM-205, FRM-004, REP-701 and the batch sheets, and "
  "set retention at two years or shelf life plus twelve months, which is FSQM-009 Part 10's "
  "period: a hold and the investigation arising from it should not be retained on two different "
  "bases. Governing Reference names FSQM-019 for the reader but does not cite it as governing, "
  "because it is still an unapproved draft.\n\n"
  "REWORK AUTHORITY SETTLED, which is what allowed this to be issued. FSQM-019 gave rework "
  "authority to the R&D Manager where this document gives it to the SQF Practitioner. Two "
  "documents naming different authorities for one decision is a document-control problem under "
  "SOP-2.2.3 regardless of which is right, and issuing over a live draft that contradicted this "
  "one would have created a finding rather than closed one. The site decided on 2026-09-02 in "
  "favour of the SQF Practitioner, and FSQM-019 was aligned in migration 20260902000015 — it now "
  "defers to this document for the substantive rework rules instead of restating them.\n\n"
  "STILL OPEN AFTER ISSUE — none of it a defect in this document, and none of it in its scope:")

OLD_ITEM1 = rh[rh.index("1. Records, Governing Reference"):rh.index("2. FSQM-019 Rework Procedure")]
rh = rh.replace(OLD_ITEM1, "")
rh = rh.replace("2. FSQM-019 Rework Procedure is an unapproved four-line draft, and it names a "
                "different authority for rework than this document does: FSQM-019 says the R&D "
                "Manager authorises it, this procedure says the SQF Practitioner. The substantive "
                "rework rules are here. Leaving a live draft that contradicts an active procedure "
                "is a document-control exposure under SOP-2.2.3, so FSQM-019 should be withdrawn "
                "or archived when this document is issued, or its rework rules moved into it and "
                "this document made to defer. That decision belongs to the SQF Practitioner and "
                "is the last thing outstanding before issue.",
                "1. FSQM-019 Rework Procedure remains an unapproved draft. It no longer "
                "contradicts this document, but it is thin — four steps, no Records, no clause "
                "reference — and it is a candidate for withdrawal in favour of this document's "
                "rework section rather than issue. That decision blocks nothing.")
rh = rh.replace("3. Not in this document's scope but adjacent and unowned:",
                "2. Not in this document's scope but adjacent and unowned:")
doc["revision_history"] = rh
doc["procedure"] = proc
doc["_sqf_reference"] = SQF_REF

body = "\n".join(proc)
if "testing@gluten.org" in body:
    raise SystemExit("the invented GFCO address is still in the body")
if "testing@gluten.org" not in rh:
    raise SystemExit("the revision history must still record what the reconstruction was")
if "OPEN BEFORE ISSUE" in rh:
    raise SystemExit("an active document would still tell the reader to settle things first")
for need in ("ISSUED 2026-09-02, approved GJM", "SETTLED AT ISSUE", "STILL OPEN AFTER ISSUE",
             "REWORK AUTHORITY SETTLED", "certification agreement"):
    if need not in rh:
        raise SystemExit("revision history missing %r" % need)
if "KNOWN EXPOSURE" in rh:
    raise SystemExit("the exposure language survives - the Positive Release reference is gone")
for need in ("FRM-205", "FRM-004", "REP-701", "Retention"):
    if need not in doc["records"]:
        raise SystemExit("Records does not name %r" % need)

st = [l for l in proc if not l.startswith(B) and not l.startswith(P)]
bu = [l for l in proc if l.startswith(B)]
pr = [l for l in proc if l.startswith(P)]
N = (len(proc), len(st), len(bu), len(pr))
assert N == (32, 23, 7, 2), "issuing must not change the body shape: %s" % (N,)

io.open(D18, "w", encoding="utf-8", newline="\n").write(
    json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

SQL18 = u"""-- Issue FSQM-018: fill the three empty fields, then activate. Approved GJM, 2026-09-02.
--
-- WHY NOW AND NOT THREE MIGRATIONS AGO. Activation was held back for a clause-by-clause vetting,
-- which found that the procedure explained two of the four dispositions its own record offers, that
-- the intended clause reference overclaimed 2.4.6.1, that non-conforming equipment had no repair
-- path and no record that could hold it, and that the rework rules cited a "Positive Release
-- Procedure" existing in no document anywhere. All four were fixed in 20260902000014. The last item
-- was the rework-authority conflict with FSQM-019, settled by the site in favour of the SQF
-- Practitioner and aligned in 20260902000015. There is no longer a known exposure in this document.
--
-- WHAT ISSUING ADOPTS, stated plainly because activation is the moment a draft's caveats become
-- requirements:
--
--   the GFCO address     NOT adopted. The scan read "testing(4Iuten.org"; the draft carried
--                        testing@gluten.org as a reconstruction. An ACTIVE controlled document must
--                        not assert a fact nobody has verified, so the invented address is REMOVED
--                        and the step points at the current GFCO certification agreement - the
--                        better authority regardless, since a certifier's contact details change
--                        without this document being revised.
--   the cross-reference  adopted as written; the descriptive form cannot go stale the way a numeric
--                        range can.
--   step 1's wording     adopted, as narrowed by the vetting to determining conformance.
--
-- THE THREE EMPTY FIELDS ARE FILLED because activation requires it, not as an improvement taken
-- alongside. Two of the clauses here require records to be MAINTAINED (Food Manufacturing 2.4.5.2
-- and 11.1.7.9) and the body required records without saying which or for how long.
--
--   sqf_reference        @@SQF_REF@@. 11.1.7.9 covers non-conforming EQUIPMENT, which the title
--                        claims and nothing else here covers. 2.4.6.1 is claimed only because
--                        20260902000014 wrote in its limbs iii and iv. 2.4.7 Product Release is
--                        deliberately NOT claimed - this document releases held and reworked
--                        material, not the site's finished product generally, and claiming a clause
--                        only partly met tells an auditor where to look.
--   records              FRM-702, FRM-007, FRM-205, FRM-004, REP-701, batch sheets, and retention
--                        at two years or shelf life plus twelve months - FSQM-009 Part 10's period,
--                        so a hold and its investigation are not retained on two different bases.
--   governing_reference  both code editions plus FSQM-009. FSQM-019 is NAMED for the reader but not
--                        cited as governing, because it is still an unapproved draft.
--
-- ALSO CORRECTED: the roles pass left the sentence "The body is 27 lines: 19 steps, 6 list items and
-- 2 paragraphs", which read as a current statement and stopped being true when the vetting took the
-- body to 32. It now says what that pass left behind.
--
-- REVISION STAYS AT New. First issue, not a revision - the same as FSQM-009 under 20260902000010 and
-- FSQM-012 under 20260901000015. Nothing is superseded and nothing archived: this replaces no
-- document. All five records it requires are asserted active below, because an active procedure
-- requiring a record that is not available is the exact finding this wave exists to close.
--
-- Writes procedure, records, governing_reference and revision_history, plus the status/approver/
-- effective-date/clause-reference columns. The DO block hashes the rest of content before and after.

begin;

do $$
declare
  r record;
begin
  select status, revision, type, sqf_reference,
         jsonb_array_length(content->'procedure')                                     as lines,
         coalesce(content->>'records','')                                             as records,
         coalesce(content->>'governing_reference','')                                 as govref,
         (content->'procedure')::text like '%testing@gluten.org%'                     as invented_addr,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                     as open_head,
         (content->'procedure')::text like '%Positive Release Procedure%'              as dangling_ref,
         (select count(*) from public.sop_documents
           where sop_number in ('FRM-702','FRM-007','FRM-205','FRM-004','REP-701')
             and status = 'active')                                                   as records_live,
         (select count(*) from public.sop_documents d2
           where d2.sop_number = 'FSQM-019'
             and (d2.content->'procedure')::text like '%R&D Manager%')                as fsqm019_conflict
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r is null then
    raise exception 'FSQM-018 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is already % - it cannot be issued twice.', r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-018 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  if r.lines <> 32 then
    raise exception 'FSQM-018 has % procedure lines, expected the 32 left by 20260902000014. Run that first.',
      r.lines;
  end if;
  if r.dangling_ref then
    raise exception 'FSQM-018 still cites a Positive Release Procedure that does not exist. Do not issue.';
  end if;
  if r.records <> '' or r.govref <> '' then
    raise exception 'Records or Governing Reference is already populated - re-derive before overwriting.';
  end if;
  if r.sqf_reference is not null then
    raise exception 'sqf_reference already reads % - re-derive before overwriting.', r.sqf_reference;
  end if;
  if not r.invented_addr then
    raise exception 'The body no longer carries the reconstructed GFCO address this migration removes.';
  end if;
  if not r.open_head then
    raise exception 'FSQM-018 does not carry the OPEN BEFORE ISSUE heading this migration rewrites.';
  end if;
  if r.records_live <> 5 then
    raise exception 'Only % of the five required records are active. Do not issue a procedure that requires them.',
      r.records_live;
  end if;
  -- the rework-authority conflict must be gone, or issuing creates the finding it should close
  if r.fsqm019_conflict <> 0 then
    raise exception 'FSQM-019 still names the R&D Manager as rework authority. Run 20260902000015 first.';
  end if;
end $$;

create temporary table fsqm018_issue_before on commit drop as
select md5((content - 'procedure' - 'records' - 'governing_reference' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-018';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', @@PROC@@::jsonb),
                       '{records}', @@RECORDS@@::jsonb),
                     '{governing_reference}', @@GOVREF@@::jsonb),
                   '{revision_history}', @@RH@@::jsonb),
       status = 'active',
       approved_by = 'GJM',
       effective_date = date '2026-09-02',
       sqf_reference = '@@SQF_REF@@'
 where sop_number = 'FSQM-018' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status, revision, approved_by, effective_date, sqf_reference,
    jsonb_array_length(content->'procedure')                                          as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                    as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                             as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                             as prose,
    (content->'procedure')::text like '%testing@gluten.org%'                          as invented_addr,
    (content->'procedure')::text like '%GFCO certification agreement%'                as agreement_ref,
    (content->>'revision_history') like '%testing@gluten.org%'                        as recon_recorded,
    (select count(*) from unnest(array['FRM-702','FRM-007','FRM-205','FRM-004','REP-701']) fr
      where strpos(content->>'records', fr) = 0)                                      as rec_missing,
    (content->>'records') like '%Retention%'                                          as rec_retention,
    (content->>'governing_reference') like '%FSQM-009%'                               as gov_capa,
    (content->>'governing_reference') like '%not cited as governing%'                 as gov_draft_caveat,
    (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                          as stale_head,
    (content->>'revision_history') like '%ISSUED 2026-09-02, approved GJM%'           as issue_note,
    (content->>'revision_history') like '%SETTLED AT ISSUE%'                          as settled,
    (content->>'revision_history') like '%REWORK AUTHORITY SETTLED%'                  as rework_settled,
    (content->>'revision_history') like '%STILL OPEN AFTER ISSUE%'                    as still_open,
    (content->>'revision_history') like '%That pass left the body at 27 lines%'       as stale_count_fixed,
    -- the body must be otherwise untouched by an issue
    (content->'procedure')::text like '%before a CAPA can be closed%'                 as deadlock_note,
    (content->'procedure')::text like '%approved for production release only after the inspections%'
                                                                                      as release_step,
    (content->'procedure')::text like '%FRM-004 Equipment Register%'                  as equip_register,
    (content->'procedure')::text like '%Positive Release Procedure%'                  as dangling_ref
  into r
  from public.sop_documents where sop_number = 'FSQM-018';

  select b.h = md5((d.content - 'procedure' - 'records' - 'governing_reference' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm018_issue_before b where d.sop_number = 'FSQM-018';

  if r.status <> 'active' or r.approved_by <> 'GJM'
     or r.effective_date <> date '2026-09-02' or r.revision <> 'New' then
    raise exception 'FSQM-018 not issued as expected: % / % / % / %.',
      r.status, r.approved_by, r.effective_date, r.revision;
  end if;
  if r.sqf_reference is distinct from '@@SQF_REF@@' then
    raise exception 'sqf_reference reads %, expected @@SQF_REF@@.', coalesce(r.sqf_reference,'null');
  end if;
  if r.lines <> @@N_LINES@@ or r.steps <> @@N_STEPS@@
     or r.bullets <> @@N_BULLETS@@ or r.prose <> @@N_PROSE@@ then
    raise exception 'Body changed shape during issue: % lines, % steps, % bullets, % prose.',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.invented_addr then
    raise exception 'An active document still asserts the reconstructed GFCO address.';
  end if;
  if not (r.agreement_ref and r.recon_recorded) then
    raise exception 'GFCO handling wrong: agreement referenced=%, reconstruction recorded=%.',
      r.agreement_ref, r.recon_recorded;
  end if;
  if r.rec_missing <> 0 or not r.rec_retention then
    raise exception 'Records incomplete: % of five forms missing, retention stated=%.',
      r.rec_missing, r.rec_retention;
  end if;
  if not (r.gov_capa and r.gov_draft_caveat) then
    raise exception 'Governing Reference wrong: FSQM-009=%, draft caveat on FSQM-019=%.',
      r.gov_capa, r.gov_draft_caveat;
  end if;
  if r.stale_head then
    raise exception 'FSQM-018 is active but still says OPEN BEFORE ISSUE.';
  end if;
  if not (r.issue_note and r.settled and r.rework_settled and r.still_open and r.stale_count_fixed) then
    raise exception 'Revision history wrong: issued=%, settled=%, rework=%, still-open=%, stale count fixed=%.',
      r.issue_note, r.settled, r.rework_settled, r.still_open, r.stale_count_fixed;
  end if;
  if r.dangling_ref then
    raise exception 'The Positive Release reference reappeared.';
  end if;
  if not (r.deadlock_note and r.release_step and r.equip_register) then
    raise exception 'Body altered during issue: deadlock=%, release step=%, FRM-004=%.',
      r.deadlock_note, r.release_step, r.equip_register;
  end if;
  if not untouched then
    raise exception 'A section other than the four written changed. Rolled back.';
  end if;
end $$;

commit;
"""

sql18 = (SQL18.replace("@@PROC@@", dollar(proc)).replace("@@RECORDS@@", dollar(doc["records"]))
              .replace("@@GOVREF@@", dollar(doc["governing_reference"]))
              .replace("@@RH@@", dollar(rh)).replace("@@SQF_REF@@", SQF_REF)
              .replace("@@N_LINES@@", str(N[0])).replace("@@N_STEPS@@", str(N[1]))
              .replace("@@N_BULLETS@@", str(N[2])).replace("@@N_PROSE@@", str(N[3])))
assert "@@" not in sql18
pay18 = json.dumps(proc, ensure_ascii=False) + "\n" + rh + "\n" + doc["records"] + "\n" \
        + doc["governing_reference"]
c18, k18 = like_check(sql18, pay18, absent=("OPEN BEFORE ISSUE", "Positive Release Procedure",
                                            "R&D Manager", "testing@gluten.org"))
io.open(OUT18, "w", encoding="utf-8", newline="\n").write(sql18)

print("wrote %s" % OUT19)
print("  FSQM-019  %d lines (%d steps, %d prose); authority -> SQF Practitioner; stays draft"
      % (len(p19), len(s19), len(r19)))
print("  %d LIKE patterns checked, %d skipped" % (c19, k19))
print("wrote %s" % OUT18)
print("  FSQM-018  body unchanged at %d lines (%d/%d/%d); active / GJM / 2026-09-02" % N)
print("  sqf_reference %s" % SQF_REF)
print("  records %d chars, governing_reference %d chars, revision_history %d chars"
      % (len(doc["records"]), len(doc["governing_reference"]), len(rh)))
print("  %d LIKE patterns checked, %d skipped" % (c18, k18))
