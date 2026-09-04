# -*- coding: utf-8 -*-
"""Seed FSQM-020 Product Release Program and FRM-701 Finished Product Release Record.

Closes SQF Food Safety Code: Food Manufacturing 2.4.7 Product Release, which is MANDATORY,
and SQF Quality Code 2.4.7.1. Both seeded DRAFT.

  20260903000001  FSQM-020 Product Release Program
  20260903000002  FRM-701 Finished Product Release Record (fillable)

Refuses to overwrite either existing migration file.

Usage:  python scripts/build-fsqm020-release.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC20 = "sop-drafts/FSQM-020-product-release-program.json"
SRC701 = "sop-drafts/FRM-701-product-release-schema.json"
OUT20 = "supabase/migrations/20260903000001_fsqm020_product_release_program.sql"
OUT701 = "supabase/migrations/20260903000002_frm701_product_release_record.sql"
B, P = "• ", "> "
SQF = "2.4.7.1, 2.4.7.2, 2.4.7.3"

for f in (OUT20, OUT701):
    if os.path.exists(f):
        raise SystemExit("%s already exists - refusing to overwrite an applied migration." % f)

def dollar(v, tag):
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    assert tag not in s, "payload contains the dollar-quote tag"
    return tag + s + tag

def like_check(sql, payload, absent=()):
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

# ---------------------------------------------------------------- FSQM-020
doc = json.load(io.open(SRC20, encoding="utf-8"))
proc = doc["procedure"]
steps = [l for l in proc if not l.startswith(B) and not l.startswith(P)]
bull = [l for l in proc if l.startswith(B)]
pros = [l for l in proc if l.startswith(P)]
assert len(steps) + len(bull) + len(pros) == len(proc), "a line has two forms or none"

body = "\n".join(proc) + "\n" + doc["responsibility"] + "\n" + doc["definitions"]
# Roles must be the six the issued programs use, and no Compass post may creep in.
for gone in ("QC personnel", "Quality Leader", "Plant Manager", "Warehouse personnel",
             "Customer Services and Sales Supply", "functional area manager", "R&D Manager"):
    if gone in body:
        raise SystemExit("a Compass Blending post appears in FSQM-020: %r" % gone)
for role in ("SQF Practitioner", "Quality Team", "Production staff", "Admin", "Management team"):
    if role not in doc["responsibility"]:
        raise SystemExit("Responsibility does not assign duties to %r" % role)
if "Gabriela" in body or "GJM" in body:
    raise SystemExit("the body names an individual; the issued programs name roles only")
# It must not claim a testing gate it does not operate, and must say so explicitly.
if "does not use positive release based on pathogen or chemical testing" not in body:
    raise SystemExit("Part 5 must state plainly that positive release on testing is not used")
# Every document it points at must be one that exists (checked against prod in the migration too).
REFS = ["FRM-701", "FRM-702", "FRM-903", "FRM-601", "REP-602", "REP-603",
        "FSQM-018", "FSQM-009", "SOP-2.3.2.3", "SOP-2.3.2", "SOP-2.3.1"]
# Scan the OPERATIVE sections only. revision_history is narrative and legitimately names
# documents this program does not depend on - FSQM-019, for instance, as the worked example of
# two documents drifting apart. A reference there is not a dependency, and treating it as one
# would force the history to be written around the guard.
operative = json.dumps({k: v for k, v in doc.items() if k != "revision_history"},
                       ensure_ascii=False)
for r in sorted(set(re.findall(r"\b(?:FRM|FSQM|REP|SOP|TRN)-[0-9][0-9A-Za-z.\-]*", operative))):
    if r.rstrip(".,;") not in REFS:
        raise SystemExit("FSQM-020's operative sections reference %r, which is not on the checked "
                         "list - add it there and to the migration's active-document guard, or "
                         "take it out of the body" % r)
# A draft may be named in the history but must never be cited as governing or as a linked form.
for draft in ("FSQM-019", "FSQM-001", "FSQM-003", "FSQM-005", "FSQM-008", "SOP-204"):
    if draft in doc["governing_reference"] or draft in doc["form_references"]:
        raise SystemExit("%s is an unapproved draft and cannot be cited as governing" % draft)

N20 = (len(proc), len(steps), len(bull), len(pros))
LONGEST20 = max(len(l) for l in proc)

# ---------------------------------------------------------------- FRM-701
# The sop-drafts schema files hold settings/sections at the TOP level - that is what
# scripts/generate-form-blank.py's load_schema() reads. Nesting under "form_schema" here
# would have made the printed blank unbuildable while every other check still passed.
sch = json.load(io.open(SRC701, encoding="utf-8"))
if "sections" not in sch:
    raise SystemExit("%s must hold settings/sections at the top level" % SRC701)
fields = [f for s in sch["sections"] for f in s["fields"]]
ids = [f["id"] for f in fields]
if len(ids) != len(set(ids)):
    raise SystemExit("duplicate field id in FRM-701")
VALID_W = {"full", "half", "third"}
for f in fields:
    w = f.get("width")
    if w is not None and w not in VALID_W:
        raise SystemExit("field %s has width %r; FormRenderer accepts only %s"
                         % (f["id"], w, sorted(VALID_W)))
    if not re.fullmatch(r"[a-z0-9_]+", f["id"]):
        raise SystemExit("field id %r is not a stable snake_case slug" % f["id"])
grids = [f for f in fields if f["type"] == "grid"]
for g in grids:
    if "mode" not in g.get("rows", {}):
        raise SystemExit("grid %s has no rows.mode - a fixed grid without it renders dynamic" % g["id"])
tmpl = sch["settings"].get("instanceTitleTemplate", "")
if tmpl.startswith("{"):
    raise SystemExit("instanceTitleTemplate must lead with literal text, or an empty draft "
                     "renders as '()'")
if sch["settings"].get("deletable") is not False:
    raise SystemExit("a product release record must not be deletable")
N701 = (len(sch["sections"]), len(fields), len(grids),
        sum(1 for f in fields if f.get("showInList")))
CHECK_ROWS = len(grids[0]["rows"]["labels"])
# The eight checks in the form must be the eight the program requires.
if CHECK_ROWS != len(bull) - 2:   # Part 4's bullets, less the two off-site storage bullets
    raise SystemExit("FRM-701 has %d checks; FSQM-020 Part 4 lists %d"
                     % (CHECK_ROWS, len(bull) - 2))

SQL20 = u"""-- FSQM-020 Product Release Program. Seeded draft. Closes SQF 2.4.7, which is MANDATORY.
--
-- WHY IT EXISTS. FSQM-018 named a "Positive Release Procedure" as the authority for the final
-- disposition of reworked material, and no document of that name existed anywhere in the register -
-- a Compass Blending reference that survived the scan. The citation was removed on 2026-09-02 when
-- FSQM-018 gained a release step of its own, but the gap underneath it was real: the site had no
-- documented method for releasing finished product at all.
--
-- IT IS A PRODUCT RELEASE PROGRAM, NOT A POSITIVE RELEASE PROCEDURE, and the difference is the
-- reason to read this. 2.4.7 has three limbs: release by authorised personnel after documented
-- checks (2.4.7.1), confirmation that labels comply with food law (2.4.7.2), and positive release
-- where testing gates it plus off-site storage (2.4.7.3). A document written to the name FSQM-018
-- used would have closed the third limb and left the Mandatory element open.
--
-- IT WRITES DOWN WHAT THE SITE ALREADY DOES. Confirmed 2026-09-03: before a batch ships, the batch
-- sheet is reviewed, the label is checked, and the packaging and the product itself are looked at.
-- That is most of what Quality Code 2.4.7.1 lists. The program adds only what the clause requires
-- on top - a named authority, a record, and the off-site storage rule - because a control nobody
-- performs is a finding waiting to be made, and long generic drafts do not survive contact with
-- the floor.
--
-- NO POSITIVE RELEASE ON TESTING, STATED RATHER THAN LEFT SILENT. No finished product goes to a lab
-- before shipment and none is held pending a result. 2.4.7.3 applies only where such testing gates
-- release, so Part 5 says the practice is not used - and says what has to happen before that
-- changes, a gluten result for certified Gluten Free product being the likely first since the site
-- is GFCO certified. A document implying a gate it does not operate is worse than one with none.
--
-- OFF-SITE STORAGE IS THE LIMB THAT DOES APPLY. Product goes both from our dock and into
-- customer-owned or third-party storage as tolling stock. Stock outside the site's physical control
-- could be drawn down before it was released, and the site would have released nothing. Part 8
-- requires release BEFORE transfer, a written instruction that only released stock may be drawn,
-- and an annual confirmation that it is followed.
--
-- LABEL COMPLIANCE IS REFERENCED, NOT REPEATED. Labels are approved under SOP-2.3.2.3 on FRM-601,
-- the approved version sits on REP-602, changes track on REP-603. Restating that here would create
-- a second copy to drift - which is exactly how FSQM-018 and FSQM-019 came to name different
-- authorities for rework.
--
-- SEEDED DRAFT, with three items in the Revision History. The third is a prerequisite rather than a
-- question: Part 8's written instruction to off-site storage locations does not yet exist and the
-- locations are not named, so that Part is unperformable until they have it. Do not issue this
-- document until it does.
--
-- Every form and program it references is asserted to exist and be active below.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-020';
  if n <> 0 then
    raise exception 'FSQM-020 already exists.';
  end if;
  -- an active procedure must not point at documents that are missing or withdrawn
  select count(*) into n from public.sop_documents
   where sop_number in ('FRM-702','FRM-903','FRM-601','REP-602','REP-603','FSQM-018','FSQM-009',
                        'SOP-2.3.2.3','SOP-2.3.2','SOP-2.3.1')
     and status = 'active';
  if n <> 10 then
    raise exception 'Only % of the 10 documents FSQM-020 references are active.', n;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FSQM-020',
  'Product Release Program',
  'fsqm',
  'Food Safety Quality Manual',
  'draft',
  'New',
  '@@SQF@@',
  true,
  @@CONTENT@@::jsonb
);

do $$
declare
  r record;
begin
  select status, revision, type, sqf_required, sqf_reference,
    jsonb_array_length(content->'procedure')                                          as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                    as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                             as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                             as prose,
    (select coalesce(max(length(s)),0) from jsonb_array_elements_text(content->'procedure') s)
                                                                                      as longest,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where regexp_replace(s, '^(• |> )', '') ~ '^\\s*\\d+(\\.\\d+)*[.)]?\\s')          as numbered,
    (content->'procedure')::text like '%does not use positive release based on pathogen or chemical testing%'
                                                                                      as no_positive_release,
    (content->'procedure')::text like '%released before it is transferred, not after it arrives%'
                                                                                      as offsite_before,
    (content->'procedure')::text like '%only product released by Adventure Bakery may be drawn%'
                                                                                      as offsite_instruction,
    (content->'procedure')::text like '%authorised by the SQF Practitioner alone%'     as single_authority,
    (content->'procedure')::text like '%FRM-701%'                                     as names_record,
    (content->'procedure')::text like '%REP-602 Approved Label Register%'             as label_register,
    (content->'procedure')::text like '%placed on Hold under FSQM-018%'               as failure_path,
    (content->>'records') like '%Retention%'                                          as retention,
    (content->>'governing_reference') like '%Mandatory%'                              as mandatory_noted,
    (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                          as open_items,
    (content->>'revision_history') like '%prerequisite to issue%'                      as prerequisite,
    (select count(*) from unnest(array['SQF Practitioner','Quality Team','Production staff',
                                       'Admin','Management team']) rn
      where strpos(content->>'responsibility', rn) = 0)                               as roles_missing
  into r
  from public.sop_documents where sop_number = 'FSQM-020';

  if r.status <> 'draft' or r.revision <> 'New' or r.type <> 'fsqm' or not r.sqf_required then
    raise exception 'FSQM-020 seeded wrong: % / % / % / sqf_required=%.',
      r.status, r.revision, r.type, r.sqf_required;
  end if;
  if r.sqf_reference is distinct from '@@SQF@@' then
    raise exception 'sqf_reference is %, expected @@SQF@@.', coalesce(r.sqf_reference,'null');
  end if;
  if r.lines <> @@L@@ or r.steps <> @@S@@ or r.bullets <> @@BU@@ or r.prose <> @@PR@@ then
    raise exception 'FSQM-020 body wrong shape: % / % / % / % (expected @@L@@ / @@S@@ / @@BU@@ / @@PR@@).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % + % + % <> %.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if r.numbered <> 0 then
    raise exception '% procedure lines carry their own step number.', r.numbered;
  end if;
  if not (r.no_positive_release and r.offsite_before and r.offsite_instruction) then
    raise exception '2.4.7.3 not covered: testing statement=%, release before transfer=%, written instruction=%.',
      r.no_positive_release, r.offsite_before, r.offsite_instruction;
  end if;
  if not (r.single_authority and r.names_record and r.label_register and r.failure_path) then
    raise exception '2.4.7.1/.2 not covered: sole authority=%, FRM-701=%, REP-602=%, failure path=%.',
      r.single_authority, r.names_record, r.label_register, r.failure_path;
  end if;
  if not (r.retention and r.mandatory_noted and r.open_items and r.prerequisite) then
    raise exception 'Sections incomplete: retention=%, Mandatory noted=%, open items=%, prerequisite flagged=%.',
      r.retention, r.mandatory_noted, r.open_items, r.prerequisite;
  end if;
  if r.roles_missing <> 0 then
    raise exception '% of the five roles have no duties in Responsibility.', r.roles_missing;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters.', r.longest;
  end if;
end $$;

commit;
"""

sql20 = (SQL20.replace("@@CONTENT@@", dollar(json.dumps(doc, ensure_ascii=False), "$j020$"))
              .replace("@@SQF@@", SQF)
              .replace("@@L@@", str(N20[0])).replace("@@S@@", str(N20[1]))
              .replace("@@BU@@", str(N20[2])).replace("@@PR@@", str(N20[3])))
assert "@@" not in sql20
c20, k20 = like_check(sql20, json.dumps(doc, ensure_ascii=False))
io.open(OUT20, "w", encoding="utf-8", newline="\n").write("begin;\n".join(sql20.split("begin;\n", 1)))

SQL701 = u"""-- FRM-701 Finished Product Release Record. Seeded draft. The record SQF 2.4.7.1 requires.
--
-- "Records of all product releases shall be maintained" is the limb of 2.4.7.1 that a program alone
-- cannot satisfy. FSQM-020 says a release is a decision; this is where the decision is written down,
-- one record per batch or lot.
--
-- FRM-701 SITS BESIDE FRM-702 ON PURPOSE. The 700 block is "QC / Testing / Hold & Release": 701 is
-- the release record, 702 the hold record, and a batch that fails a check here crosses from one to
-- the other. The Decision field names that path in its own option text rather than leaving a filler
-- to work out what "not released" means operationally.
--
-- THE EIGHT CHECKS ARE FSQM-020 PART 4, verbatim and in order, as a fixed grid with a pass_fail
-- column. The build refuses if the counts diverge, so the form and the program cannot drift into
-- listing different checks - the failure mode that put different rework authorities in FSQM-018 and
-- FSQM-019. Each row carries a title line and an explanatory line, which FixedRowLabel renders as
-- bold title over italic description; a filler reading it on a tablet gets the check and the reason
-- without opening the program.
--
-- N/A IS A LEGITIMATE ANSWER and the form says so, because a checklist that only offers pass or fail
-- gets a false pass the first time a check genuinely does not apply. A single Fail means the batch is
-- not released; that is stated in the instructions rather than enforced by validation, because the
-- decision belongs to the SQF Practitioner and a form that silently blocked submission would just be
-- filled in differently.
--
-- SECTION 3 SEPARATES TWO LABEL QUESTIONS that are easy to conflate. The Section 2 check confirms the
-- label applied is the approved one. Section 3 confirms the approved one is LAWFUL, which 2.4.7.2
-- requires at first release and at every label change - a different question, asked less often.
--
-- SECTION 4 IS BLANK FOR MOST ENTRIES, deliberately. It applies only to off-site storage transfers
-- and says so in its own instructions, rather than being hidden by conditional logic the schema does
-- not support.
--
-- NOT DELETABLE. A product release record is the evidence that release happened; deleting one would
-- remove the only proof for that lot. settings.deletable is false, and the build refuses otherwise.
--
-- Seeded draft alongside FSQM-020, which must be issued first or in the same transaction as this -
-- a form whose instructions cite a Part of an unissued program is not yet a controlled record.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FRM-701';
  if n <> 0 then
    raise exception 'FRM-701 already exists.';
  end if;
  select count(*) into n from public.sop_documents where sop_number = 'FSQM-020';
  if n <> 1 then
    raise exception 'FSQM-020 does not exist - seed the program first (20260903000001).';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-701',
  'Finished Product Release Record',
  'form',
  'Module 2',
  'draft',
  'New',
  '@@SQF@@',
  true,
  jsonb_build_object('form_schema', @@SCHEMA@@::jsonb)
);

do $$
declare
  r record;
begin
  select status, revision, type, category,
    jsonb_array_length(content->'form_schema'->'sections')                            as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                        as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'grid')                                                      as grids,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'grid' and f->'rows'->>'mode' is null)                       as grids_no_mode,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'rows'->'labels') l
      where f->>'id' = 'checks')                                                      as check_rows,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                              as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f ? 'width' and f->>'width' not in ('full','half','third'))               as bad_widths,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'signature')                                                 as signatures,
    (content->'form_schema'->'settings'->>'deletable')                                as deletable,
    (content->'form_schema'->'settings'->>'instanceTitleTemplate')                    as tmpl
  into r
  from public.sop_documents where sop_number = 'FRM-701';

  if r.status <> 'draft' or r.revision <> 'New' or r.type <> 'form' or r.category <> 'Module 2' then
    raise exception 'FRM-701 seeded wrong: % / % / % / %.', r.status, r.revision, r.type, r.category;
  end if;
  if r.sections <> @@SEC@@ or r.fields <> @@FLD@@ or r.grids <> @@GRD@@ then
    raise exception 'FRM-701 wrong shape: % sections, % fields, % grids (expected @@SEC@@ / @@FLD@@ / @@GRD@@).',
      r.sections, r.fields, r.grids;
  end if;
  if r.grids_no_mode <> 0 then
    raise exception '% grids have no rows.mode - a fixed grid without it renders dynamic.', r.grids_no_mode;
  end if;
  if r.check_rows <> @@CHK@@ then
    raise exception 'The release checklist has % rows; FSQM-020 Part 4 lists @@CHK@@.', r.check_rows;
  end if;
  if r.list_fields <> @@LST@@ then
    raise exception '% fields are flagged showInList, expected @@LST@@.', r.list_fields;
  end if;
  if r.bad_widths <> 0 then
    raise exception '% fields carry a width FormRenderer does not accept.', r.bad_widths;
  end if;
  if r.signatures <> 1 then
    raise exception 'Expected exactly one signature field, found %.', r.signatures;
  end if;
  if r.deletable is distinct from 'false' then
    raise exception 'FRM-701 is deletable - a product release record must not be.';
  end if;
  if r.tmpl is null or left(r.tmpl, 1) = '{' then
    raise exception 'instanceTitleTemplate is %, which renders as "()" on an empty draft.',
      coalesce(r.tmpl, 'unset');
  end if;
end $$;

commit;
"""

sql701 = (SQL701.replace("@@SCHEMA@@", dollar(json.dumps(sch, ensure_ascii=False), "$j701$"))
                .replace("@@SQF@@", SQF)
                .replace("@@SEC@@", str(N701[0])).replace("@@FLD@@", str(N701[1]))
                .replace("@@GRD@@", str(N701[2])).replace("@@LST@@", str(N701[3]))
                .replace("@@CHK@@", str(CHECK_ROWS)))
assert "@@" not in sql701
c701, k701 = like_check(sql701, json.dumps(sch, ensure_ascii=False))
io.open(OUT701, "w", encoding="utf-8", newline="\n").write(sql701)

print("wrote %s" % OUT20)
print("  FSQM-020  %d lines (%d steps, %d bullets, %d prose); longest %d chars" % (N20 + (LONGEST20,)))
print("  sqf_reference %s, sqf_required true, seeded draft" % SQF)
print("  %d LIKE patterns checked, %d skipped" % (c20, k20))
print("wrote %s" % OUT701)
print("  FRM-701   %d sections, %d fields, %d grid, %d list fields, %d release checks"
      % (N701 + (CHECK_ROWS,)))
print("  %d LIKE patterns checked, %d skipped" % (c701, k701))
