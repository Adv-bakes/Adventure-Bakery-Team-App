# -*- coding: utf-8 -*-
"""Issue FSQM-018: fill Records / Governing Reference / clause reference, then activate.

Runs after 20260902000011-13. Writes four content keys (procedure, records,
governing_reference, revision_history) and four columns (status, approved_by,
effective_date, sqf_reference), and hashes the rest of content before and after.

Refuses to overwrite an existing migration file: an applied migration is history.

Usage:  python scripts/build-fsqm018-issue.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC = "sop-drafts/FSQM-018-non-conforming-product.json"
OUT = "supabase/migrations/20260902000014_issue_fsqm018.sql"
BULLET, PARA = "• ", "> "
SQF_REF = "2.4.5.1, 2.4.5.2, 2.4.6.1, 11.1.7.9"

if os.path.exists(OUT):
    raise SystemExit("%s already exists - refusing to overwrite an applied migration." % OUT)

doc = json.load(io.open(SRC, encoding="utf-8"))

# ---------------------------------------------------------------- 1. the GFCO address
# An ACTIVE controlled document must not assert a fact nobody has verified. The scan read
# "testing(4Iuten.org", which is not an address; the draft carried testing@gluten.org as an
# explicit reconstruction awaiting confirmation. Issuing would turn that reconstruction into a
# requirement. Pointing at the certification agreement is not a workaround - it is what a
# controlled document should have said in the first place, because a certifier's contact
# details change without this document being revised.
OLD_GFCO = "• The SQF Practitioner shall notify GFCO at testing@gluten.org."
NEW_GFCO = ("• The SQF Practitioner shall notify GFCO, using the contact details in the current "
            "GFCO certification agreement.")
i = doc["procedure"].index(OLD_GFCO)
doc["procedure"][i] = NEW_GFCO

# ---------------------------------------------------------------- 2. Records
# Two of the clauses this document is issued against require records to be MAINTAINED
# (Food Manufacturing 2.4.5.2 and 11.1.7.9), and the body required records without ever
# saying which or for how long. The retention period is FSQM-009's, deliberately: a hold and
# the investigation that follows it should not be retained on two different bases.
doc["records"] = (
  "FRM-702 Non-Conforming Material Hold & Tagging Record — one per hold. Identification of the "
  "material or equipment, the hold tag number, the segregated storage location, the final "
  "disposition and its authorisation.\n"
  "FRM-007 Corrective and Preventive Action (CAPA) Report — the investigation, where a CAPA is "
  "raised under FSQM-009. Its number is recorded on FRM-702 so the hold and the investigation are "
  "traceable to each other.\n"
  "REP-701 QA Product & Material Release Log — release of held or reworked material.\n"
  "Batch sheets — identify rework material and the formulation used, and carry its traceability.\n"
  "Retention: two years, or the shelf life of the product plus twelve months, whichever is longer. "
  "This is the period set by FSQM-009 Part 10, so a hold and the investigation arising from it are "
  "retained on the same basis."
)

# ---------------------------------------------------------------- 3. Governing Reference
# FSQM-019 is deliberately NOT listed here. It is an unapproved draft, and an active document may
# not cite a draft as governing. The overlap with it is recorded in the Revision History instead.
doc["governing_reference"] = (
  "SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.4.5 Non-conforming Materials and "
  "Product; 2.4.6 Product Rework; 11.1.7.9 non-conforming equipment.\n"
  "SQF Quality Code, Edition 9 — 2.4.5 Non-conforming Product or Equipment; 2.4.6 Product Rework.\n"
  "FSQM-009 Corrective and Preventive Action (CAPA) Program — governs the investigation, root "
  "cause, corrective and preventive action, verification of effectiveness and closure of any CAPA "
  "raised from a hold under this procedure."
)

# ---------------------------------------------------------------- 4. Revision History
rh = doc["revision_history"]

OLD_RECON_HEAD = ("RECONSTRUCTIONS — two places where the scan was not legible and the text was "
                  "repaired rather than transcribed. Both need confirming before this document is "
                  "issued:")
assert OLD_RECON_HEAD in rh, "the reconstructions heading is not where this expected it"
NEW_RECON_HEAD = (
  "RECONSTRUCTIONS — two places where the scan was not legible and the text was repaired rather "
  "than transcribed. Both were resolved at issue, one by removing the reconstruction rather than "
  "adopting it:")
rh = rh.replace(OLD_RECON_HEAD, NEW_RECON_HEAD)

OLD_1 = ("1. The GFCO notification address read \"testing(4Iuten.org\", which is not an address. It "
         "is written as testing@gluten.org. Confirm against GFCO's current certification "
         "correspondence before issue.")
assert OLD_1 in rh
NEW_1 = (
  "1. The GFCO notification address read \"testing(4Iuten.org\", which is not an address. The draft "
  "carried testing@gluten.org as a reconstruction awaiting confirmation. AT ISSUE THE INVENTED "
  "ADDRESS WAS REMOVED rather than adopted: the step now says to notify GFCO using the contact "
  "details in the current GFCO certification agreement. An active controlled document must not "
  "assert a fact nobody has verified, and a certifier's contact details change without this "
  "document being revised, so the agreement is the better authority in any case.")
rh = rh.replace(OLD_1, NEW_1)

OLD_2_TAIL = ("It reads \"the hold, notification and segregation steps set out below\". If a specific "
              "range was meant, restore it against the paper original.")
assert OLD_2_TAIL in rh
rh = rh.replace(OLD_2_TAIL,
  "It reads \"the hold, notification and segregation steps set out below\". ADOPTED AT ISSUE as "
  "written; the descriptive form cannot go stale the way a numeric range can. If a narrower range "
  "was meant, it is a revision to make against the paper original.")

OLD_STEP1_TAIL = ("and it is written as \"shall determine the disposition of\". Confirm this is what "
                  "the original intended.")
assert OLD_STEP1_TAIL in rh
rh = rh.replace(OLD_STEP1_TAIL,
  "and it is written as \"shall determine the disposition of\". ADOPTED AT ISSUE: the literal "
  "reading directs that everything inspected be thrown away, which no procedure can have meant.")

# The open list: item 1 is answered by this migration, item 2 is not and cannot be.
OLD_OPEN_HEAD = ("OPEN BEFORE ISSUE — content questions still unanswered, because they are decisions "
                 "about what the document should say rather than about what it already says:")
assert OLD_OPEN_HEAD in rh
NEW_OPEN_HEAD = (
  "ISSUED 2026-09-02, approved GJM. Status active, revision New — a first issue, not a revision, so "
  "nothing is superseded and nothing is archived.\n\n"
  "SETTLED AT ISSUE. Records, Governing Reference and the SQF clause reference were empty, and a "
  "controlled document with no stated records and no clause reference cannot be audited against "
  "anything. All three are now filled. The clause reference is 2.4.5.1, 2.4.5.2, 2.4.6.1 and "
  "11.1.7.9 — the last covering non-conforming EQUIPMENT specifically, which this document's title "
  "claims and which nothing else here covers. Records name FRM-702, FRM-007, REP-701 and the batch "
  "sheets, and set retention at two years or shelf life plus twelve months, which is FSQM-009's "
  "period: a hold and the investigation arising from it should not be retained on two different "
  "bases. Governing Reference deliberately omits FSQM-019, because an active document may not cite "
  "an unapproved draft as governing.")
rh = rh.replace(OLD_OPEN_HEAD, NEW_OPEN_HEAD)

OLD_ITEM1 = rh[rh.index("1. Records, Governing Reference"):rh.index("2. \"Positive Release Procedure\"")]
rh = rh.replace(OLD_ITEM1, "")
rh = rh.replace("2. \"Positive Release Procedure\" is named",
  "STILL OPEN AFTER ISSUE — one item, and issuing this document cannot close it because it is not "
  "about this document.\n\n\"Positive Release Procedure\" is named")

# Make the carried-forward item say what it costs, and what stands in the meantime.
OLD_TAIL = ("Whether rework lives here or in FSQM-019 needs settling before either is issued.")
assert OLD_TAIL in rh
rh = rh.replace(OLD_TAIL,
  "Whether rework lives here or in FSQM-019 needs settling. ISSUING THIS DOCUMENT WITH THAT "
  "REFERENCE IN IT IS A KNOWN EXPOSURE, accepted deliberately: an auditor reading the rework steps "
  "will ask to see the Positive Release Procedure and there is not one. It was issued anyway "
  "because the alternative was leaving the site with no approved procedure at all for holding and "
  "dispositioning non-conforming product, which is the larger gap. Until a release procedure "
  "exists, final disposition of reworked material rests on the authority this document already "
  "gives the SQF Practitioner, recorded on FRM-702 and logged on REP-701.")

doc["revision_history"] = rh
doc["_sqf_reference"] = SQF_REF          # not a content key; recorded for the mirror

# ---------------------------------------------------------------- checks
proc    = doc["procedure"]
steps   = [l for l in proc if not l.startswith(BULLET) and not l.startswith(PARA)]
bullets = [l for l in proc if l.startswith(BULLET)]
prose   = [l for l in proc if l.startswith(PARA)]
assert len(steps) + len(bullets) + len(prose) == len(proc)
assert (len(proc), len(steps), len(bullets), len(prose)) == (27, 19, 6, 2), \
    "issuing must not change the body shape: %d/%d/%d/%d" % (len(proc), len(steps), len(bullets), len(prose))

body = "\n".join(proc)
if "testing@gluten.org" in body:
    raise SystemExit("the invented GFCO address is still in the body")
if "testing@gluten.org" not in rh:
    raise SystemExit("the revision history must still say what the reconstruction was")
if "OPEN BEFORE ISSUE" in rh:
    raise SystemExit("an active document would still be telling the reader to settle things first")
for need in ("ISSUED 2026-09-02, approved GJM", "SETTLED AT ISSUE", "STILL OPEN AFTER ISSUE",
             "KNOWN EXPOSURE", "certification agreement"):
    if need not in rh:
        raise SystemExit("revision history missing %r" % need)
for need in ("FRM-702", "FRM-007", "REP-701", "Retention"):
    if need not in doc["records"]:
        raise SystemExit("Records does not name %r" % need)
if "FSQM-019" in doc["governing_reference"]:
    raise SystemExit("Governing Reference cites an unapproved draft")

io.open(SRC, "w", encoding="utf-8", newline="\n").write(
    json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

def dollar(v):
    s = json.dumps(v, ensure_ascii=False)
    assert "$j$" not in s
    return "$j$" + s + "$j$"

SQL = u"""-- Issue FSQM-018: fill the three empty fields, then activate. Approved GJM, 2026-09-02.
--
-- WHAT ISSUING ADOPTS, stated plainly because activation is the moment a draft's caveats become
-- requirements. Three items in the Revision History asked for confirmation "before issue" and are
-- rewritten to record what was decided:
--
--   the GFCO address       NOT adopted. The scan read "testing(4Iuten.org"; the draft carried
--                          testing@gluten.org as a reconstruction. An ACTIVE controlled document
--                          must not assert a fact nobody has verified, so the invented address is
--                          REMOVED and the step points at the current GFCO certification
--                          agreement. That is the better authority regardless - a certifier's
--                          contact details change without this document being revised.
--   the cross-reference    adopted as written. "The hold, notification and segregation steps set
--                          out below" cannot go stale the way a numeric range can.
--   step 1's wording       adopted. The literal scan read "shall dispose of the product
--                          inspected/tested", which directs that everything inspected be thrown
--                          away. No procedure can have meant that.
--
-- THE THREE EMPTY FIELDS ARE FILLED, because that is what activation requires rather than an
-- improvement taken alongside it. A controlled document with no clause reference and no records
-- list cannot be audited against anything, and two of the clauses here require records to be
-- MAINTAINED (Food Manufacturing 2.4.5.2 and 11.1.7.9) while the body required records without
-- saying which or for how long.
--
--   sqf_reference          2.4.5.1, 2.4.5.2, 2.4.6.1, 11.1.7.9. The last covers non-conforming
--                          EQUIPMENT specifically, which this document's title claims and which no
--                          other document here covers. 2.4.7 Product Release is deliberately NOT
--                          claimed - see the exposure below.
--   records                FRM-702, FRM-007, REP-701, batch sheets, and retention at two years or
--                          shelf life plus twelve months. That period is FSQM-009 Part 10's, on
--                          purpose: a hold and the investigation arising from it should not be
--                          retained on two different bases.
--   governing_reference    both code editions plus FSQM-009. FSQM-019 is deliberately omitted - an
--                          active document may not cite an unapproved draft as governing.
--
-- ONE ITEM IS CARRIED FORWARD AND IT IS A KNOWN EXPOSURE. The rework steps make a "Positive
-- Release Procedure" the authority for final disposition of reworked material, and no such
-- document exists - the phrase appears nowhere else in the register. Product Release is MANDATORY
-- in the Food Manufacturing code (2.4.7) and Quality Code 2.4.7.1 requires a documented positive
-- release procedure, so this is a real gap and not a renamed document. An auditor reading the
-- rework steps will ask to see it and there is not one.
--
-- It is issued anyway, and the Revision History says why in those words: the alternative was
-- leaving the site with no approved procedure at all for holding and dispositioning non-conforming
-- product, which is the larger gap. Until a release procedure exists, final disposition of reworked
-- material rests on the authority this document already gives the SQF Practitioner, recorded on
-- FRM-702 and logged on REP-701. Naming the exposure in the document is what makes issuing it a
-- decision rather than an oversight.
--
-- REVISION STAYS AT New. First issue, not a revision - the same as FSQM-009 under 20260902000010
-- and FSQM-012 under 20260901000015. Nothing is superseded and nothing is archived: this document
-- replaces none. FRM-702 and FRM-007 are asserted still active below, because an active procedure
-- requiring a record that is not available is the exact finding this wave exists to close.
--
-- Writes procedure, records, governing_reference and revision_history, plus the status/approver/
-- effective-date/clause-reference columns. The DO block hashes the rest of content before and
-- after, so purpose, scope, definitions, responsibility, form_references and attachments are
-- provably untouched. scripts/check-migration-hashes.py verifies the two key lists agree.

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
         (select count(*) from public.sop_documents
           where sop_number in ('FRM-702','FRM-007') and status = 'active')           as records_live
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
  if r.lines <> 27 then
    raise exception 'FSQM-018 has % procedure lines, expected the 27 left by 20260902000013. Run that first.',
      r.lines;
  end if;
  if r.records <> '' or r.govref <> '' then
    raise exception 'Records or Governing Reference is already populated - re-derive before overwriting it.';
  end if;
  if r.sqf_reference is not null then
    raise exception 'sqf_reference already reads % - re-derive before overwriting it.', r.sqf_reference;
  end if;
  if not r.invented_addr then
    raise exception 'The body no longer carries the reconstructed GFCO address this migration removes.';
  end if;
  if not r.open_head then
    raise exception 'FSQM-018 does not carry the OPEN BEFORE ISSUE heading this migration rewrites.';
  end if;
  -- an active procedure may not require a record that is not available
  if r.records_live <> 2 then
    raise exception 'Only % of FRM-702 and FRM-007 are active. Do not issue a procedure that requires them.',
      r.records_live;
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
    -- the invented address is gone from the body but its history is not
    (content->'procedure')::text like '%testing@gluten.org%'                          as invented_addr,
    (content->'procedure')::text like '%GFCO certification agreement%'                as agreement_ref,
    (content->>'revision_history') like '%testing@gluten.org%'                        as recon_recorded,
    -- the three fields activation required
    (content->>'records') like '%REP-701%'                                            as rec_release,
    (content->>'records') like '%Retention%'                                          as rec_retention,
    (content->>'governing_reference') like '%FSQM-009%'                               as gov_capa,
    (content->>'governing_reference') like '%FSQM-019%'                               as gov_cites_draft,
    -- the open list is rewritten, not left sitting in an active document
    (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                          as stale_head,
    (content->>'revision_history') like '%ISSUED 2026-09-02, approved GJM%'           as issue_note,
    (content->>'revision_history') like '%SETTLED AT ISSUE%'                          as settled,
    (content->>'revision_history') like '%STILL OPEN AFTER ISSUE%'                    as still_open,
    (content->>'revision_history') like '%KNOWN EXPOSURE%'                            as exposure_named,
    -- and the body must be otherwise unchanged by an issue
    (content->'procedure')::text like '%before a CAPA can be closed%'                 as deadlock_note,
    (content->'procedure')::text like '%Positive Release Procedure%'                  as positive_release,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%FRM-702%')                                                       as frm702_steps
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
  if not r.agreement_ref then
    raise exception 'The GFCO step does not point at the certification agreement.';
  end if;
  if not r.recon_recorded then
    raise exception 'The revision history no longer records what the reconstruction was.';
  end if;
  if not (r.rec_release and r.rec_retention and r.gov_capa) then
    raise exception 'Required fields incomplete: REP-701=%, retention=%, FSQM-009 in govref=%.',
      r.rec_release, r.rec_retention, r.gov_capa;
  end if;
  if r.gov_cites_draft then
    raise exception 'Governing Reference cites FSQM-019, which is an unapproved draft.';
  end if;
  if r.stale_head then
    raise exception 'FSQM-018 is active but still says OPEN BEFORE ISSUE.';
  end if;
  if not (r.issue_note and r.settled and r.still_open and r.exposure_named) then
    raise exception 'Revision history wrong: issue note=%, settled=%, still-open=%, exposure named=%.',
      r.issue_note, r.settled, r.still_open, r.exposure_named;
  end if;
  if not (r.deadlock_note and r.positive_release) then
    raise exception 'Body altered during issue: deadlock sentence=%, positive release=%.',
      r.deadlock_note, r.positive_release;
  end if;
  if r.frm702_steps <> @@FRM702_STEPS@@ then
    raise exception 'FRM-702 is named in % steps, expected @@FRM702_STEPS@@.', r.frm702_steps;
  end if;
  if not untouched then
    raise exception 'A section other than the four written changed. Rolled back.';
  end if;
end $$;

commit;
"""

sql = (SQL
       .replace("@@PROC@@",    dollar(proc))
       .replace("@@RECORDS@@", dollar(doc["records"]))
       .replace("@@GOVREF@@",  dollar(doc["governing_reference"]))
       .replace("@@RH@@",      dollar(rh))
       .replace("@@SQF_REF@@", SQF_REF)
       .replace("@@N_LINES@@",   str(len(proc)))
       .replace("@@N_STEPS@@",   str(len(steps)))
       .replace("@@N_BULLETS@@", str(len(bullets)))
       .replace("@@N_PROSE@@",   str(len(prose)))
       .replace("@@FRM702_STEPS@@", str(sum("FRM-702" in l for l in proc))))
assert "@@" not in sql, "unsubstituted placeholder"

payload = json.dumps(proc, ensure_ascii=False) + "\n" + rh + "\n" + doc["records"] \
          + "\n" + doc["governing_reference"]
ABSENT = ("OPEN BEFORE ISSUE", "FSQM-019")   # asserted absent in the places checked above
checked = skipped = 0
for m in re.finditer(r"like '%([^']*?)%'", sql):
    lit = m.group(1)
    if "%" in lit or lit in ABSENT:
        skipped += 1
        continue
    checked += 1
    if lit not in payload:
        low = lit.lower() in payload.lower()
        raise SystemExit("LIKE pattern never matches%s: %r"
                         % (" (case differs only)" if low else "", lit[:70]))

io.open(OUT, "w", encoding="utf-8", newline="\n").write(sql)
print("wrote %s" % OUT)
print("  body unchanged  %d lines (%d steps, %d bullets, %d prose)"
      % (len(proc), len(steps), len(bullets), len(prose)))
print("  sqf_reference   %s" % SQF_REF)
print("  records         %d chars, governing_reference %d chars"
      % (len(doc["records"]), len(doc["governing_reference"])))
print("  revision_history %d chars" % len(rh))
print("  GFCO invented address removed from body, kept in history")
print("  %d content LIKE patterns checked, %d absence/wildcard skipped" % (checked, skipped))
