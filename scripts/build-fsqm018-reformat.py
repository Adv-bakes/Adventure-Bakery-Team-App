# -*- coding: utf-8 -*-
"""Build the FSQM-018 reformat migration from sop-drafts/FSQM-018-non-conforming-product.json.

The migration writes exactly three content keys - procedure, responsibility and
revision_history - and the DO block afterwards hashes everything else before and after, so
purpose/scope/definitions/form_references/attachments are provably untouched.

Refuses to overwrite an existing migration file: an applied migration is history.

Usage:  python scripts/build-fsqm018-reformat.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC = "sop-drafts/FSQM-018-non-conforming-product.json"
OUT = "supabase/migrations/20260902000011_fsqm018_reformat_scanned_body.sql"

BULLET, PARA = "• ", "> "

if os.path.exists(OUT):
    raise SystemExit("%s already exists - refusing to overwrite an applied migration." % OUT)

doc = json.load(io.open(SRC, encoding="utf-8"))
proc = doc["procedure"]

steps   = [l for l in proc if not l.startswith(BULLET) and not l.startswith(PARA)]
bullets = [l for l in proc if l.startswith(BULLET)]
prose   = [l for l in proc if l.startswith(PARA)]

# Every line must have exactly one recognised form.
assert len(steps) + len(bullets) + len(prose) == len(proc), "a line has two forms or none"

# The whole point of the pass: no step may carry its own number any more, in either the
# shape the renderer strips or the shape it does not.
LEADING_NUM = re.compile(r"^\s*\d+(?:\.\d+)*[.)]?\s")
for l in proc:
    body = l[2:] if (l.startswith(BULLET) or l.startswith(PARA)) else l
    if LEADING_NUM.match(body):
        raise SystemExit("a line still carries source numbering: %r" % body[:60])

# The OCR damage must be gone, and gone from the text rather than merely renumbered. The
# dead record name goes with it: "Hold Action Report" was the Compass Blending name for what
# FRM-702 is now, and the body may not use both.
for bad in ("NON-CONFORMING PRODUCT", "(4Iuten", "n 6.4", "6.3 thru 6.11", "Hold Action Report"):
    if any(bad in l for l in proc):
        raise SystemExit("OCR damage or a dead record name survives: %r" % bad)

FORM_REF_WAS = "Form-0021 Quality Hold Report"
FORM_REF_NOW = "FRM-702 Non-Conforming Material Hold & Tagging Record"
if doc["form_references"] != FORM_REF_NOW:
    raise SystemExit("form_references is %r, expected %r" % (doc["form_references"], FORM_REF_NOW))
if sum("FRM-702" in l for l in proc) != 3:
    raise SystemExit("FRM-702 should be named in exactly the 3 steps that were the Hold Action "
                     "Report; found %d" % sum("FRM-702" in l for l in proc))
if FORM_REF_WAS not in doc["revision_history"]:
    raise SystemExit("the revision history must say what the linked form used to read")

# ...and the requirements must not have gone with it. These are the load-bearing phrases.
for keep in ("Quarantine area immediately to prevent accidental usage",
             "like into like",
             "shall not be reworked into other certified Gluten Free products",
             "Positive Release Procedure",
             "reviewed biweekly by Quality personnel",
             "verify effectiveness of the corrective and preventive measures"):
    if not any(keep in l for l in proc):
        raise SystemExit("a requirement was lost in the reformat: %r" % keep)

N_LINES, N_STEPS, N_BULLETS, N_PROSE = len(proc), len(steps), len(bullets), len(prose)
LONGEST = max(len(l) for l in proc)

def dollar(value):
    s = json.dumps(value, ensure_ascii=False)
    assert "$j$" not in s, "payload contains the dollar-quote tag"
    return "$j$" + s + "$j$"

SQL = u"""-- FSQM-018: repair the scanned body so it prints. Presentation only, no requirement changes.
--
-- WHAT THE PDF ACTUALLY SHOWED. The document was imported from a scanned hardcopy and stored as
-- 41 lines that still carried the source document's own numbering - "2.1 Upon identification...",
-- "15.1.1 Certified Gluten Free products...". The renderer then numbered them a second time. Worse
-- than the doubling, groupProcedureSteps() stripped "2." off the front of "2.1" and left "1"
-- behind, so a correctly numbered clause printed as a different, plausible-looking one and the
-- document appeared to restart its numbering four times. That regex is fixed in the same change
-- (src/lib/sopDocxParser.ts); FSQM-018 is the only document of the 38 with multi-level numbering,
-- so it is the only one that was ever affected.
--
-- THE NUMBERS COME OUT OF THE DATA, not just out of the renderer. Storing a step's number in the
-- step is what created the problem, and no other document here does it. The rendered list owns the
-- numbering now. Nothing in the body cites a step number except one cross-reference, which pointed
-- at the SOURCE document's numbering and never resolved here at all - see the Revision History.
--
-- FLATTENED TO THE TWO LEVELS THAT EXIST. The source ran three deep (2, 2.1, 2.1.1). The renderer
-- has a numbered step and, under it, list items and prose. The hold triggers were promoted to
-- steps; the rework rules became bullets under the rework decision. Reading order is unchanged.
--
-- OCR DAMAGE REPAIRED. Three steps had been split across a scan page break and are rejoined. Two
-- steps had been merged into one line carrying a stray "n" ("n 6.4 ... 6.5 ...") and are two steps
-- again. The running header "NON-CONFORMING PRODUCT" appeared twice mid-body as though it were a
-- step and is removed. The four Root Cause Analysis criteria were unmarked and printed as four
-- numbered steps; they are a list and are marked as one.
--
-- TWO RECONSTRUCTIONS AND ONE WORDING FIX are recorded in the Revision History rather than made
-- silently: an illegible GFCO address, a cross-reference to numbering that no longer exists, and
-- step 1's "shall dispose of the product inspected/tested", which read as an instruction to throw
-- away everything inspected. Each says what it was and asks for confirmation before issue.
--
-- THE HOLD RECORD IS NAMED. Linked Form read "Form-0021 Quality Hold Report", a Compass Blending
-- number that does not exist in this register, and three steps called that record a "Hold Action
-- Report". Both now name FRM-702 Non-Conforming Material Hold & Tagging Record, which is active
-- with zero entries. This is not a find-and-replace on a similar-sounding title: FRM-702's three
-- sections ARE the three moments this procedure describes. Section 1 raises the hold and carries
-- hold_tag_number, material_status_tag and storage_location_segregated - the "issue a report" and
-- "label with a tag" steps. Section 3 Final Disposition & Release Authorization carries the
-- decision, its justification, a verification check and an authorising signature - the "revise the
-- report" step. The steps now say which section they complete. The one place the mapping is
-- imperfect - FRM-702 Section 1 is written around supplier-received material, while this procedure
-- also covers WIP and finished product - is recorded in the Revision History as a question about
-- the form, because those fields are not required and an internal hold records fine without them.
--
-- WHAT THIS DOES NOT DO. It does not answer the remaining content questions - the Compass Blending
-- roles, the reference FSQM-009 should now carry, the empty Records and clause reference, the
-- overlap with FSQM-019. Those are decisions about what the document should say, not about what it
-- already says, and they are written into the Revision History as OPEN BEFORE ISSUE. FSQM-018 stays
-- `draft`; FRM-702 is the operative hold record either way, which is why naming it changes nothing
-- about what anyone does today.
--
-- NO REVISION BUMP. The document has never been issued, so there is nothing to supersede. The
-- guard fails loudly if it has been activated since this was written, because then it would need
-- one. Only procedure, responsibility, form_references and revision_history are written; the DO
-- block hashes everything else before and after, so purpose, scope, definitions and attachments
-- are provably untouched.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s ~ '^\\s*\\d+(\\.\\d+)*[.)]?\\s')                                      as numbered,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s = 'NON-CONFORMING PRODUCT')                                        as headers,
         content->>'form_references'                                                  as form_ref,
         content ? 'attachments'                                                      as has_attachments
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r is null then
    raise exception 'FSQM-018 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is % - it has been issued, so a content change needs a revision bump. Stop and re-derive.',
      r.status;
  end if;
  if r.revision <> 'New' then
    raise exception 'FSQM-018 is at revision %, not New. Re-derive against the current body.', r.revision;
  end if;
  if r.type <> 'fsqm' then
    raise exception 'FSQM-018 is type %, not fsqm.', r.type;
  end if;
  -- the body must still be the raw importer output this was written against
  if r.lines <> 41 then
    raise exception 'FSQM-018 has % procedure lines, expected the 41 the importer left. Someone has already edited it.',
      r.lines;
  end if;
  if r.numbered < 30 or r.headers <> 2 then
    raise exception 'FSQM-018 does not look like the un-repaired scan: % numbered lines, % stray headers.',
      r.numbered, r.headers;
  end if;
  if r.form_ref is distinct from '@@FORM_REF_WAS@@' then
    raise exception 'Linked Form reads %, not the Compass number this replaces. Someone has already changed it.',
      coalesce(r.form_ref, 'null');
  end if;
end $$;

-- Hash everything this migration does NOT write, so the assertion afterwards can prove it.
create temporary table fsqm018_before on commit drop as
select md5((content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-018';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(content, '{procedure}', @@PROC@@::jsonb),
                       '{responsibility}', @@RESP@@::jsonb),
                     '{form_references}', @@FORM_REF@@::jsonb),
                   '{revision_history}', @@RH@@::jsonb)
 where sop_number = 'FSQM-018' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select
    jsonb_array_length(content->'procedure')                                          as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                    as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                             as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                             as prose,
    (select coalesce(max(length(s)), 0) from jsonb_array_elements_text(content->'procedure') s)
                                                                                      as longest,
    -- no step may carry its own number any more, in either shape
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where regexp_replace(s, '^(• |> )', '') ~ '^\\s*\\d+(\\.\\d+)*[.)]?\\s')          as numbered,
    -- the OCR damage must be gone from the text, not merely renumbered
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%NON-CONFORMING PRODUCT%' or s like '%(4Iuten%'
         or s like '%n 6.4%' or s like '%6.3 thru 6.11%'
         or s like '%Hold Action Report%')                                            as damage,
    -- the hold record is named, in exactly the three steps that were the Hold Action Report
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%FRM-702%')                                                       as frm702_steps,
    -- and the requirements must not have gone with it
    (content->'procedure')::text like '%Quarantine area immediately to prevent accidental usage%'
                                                                                      as segregate,
    (content->'procedure')::text like '%like into like%'                              as like_into_like,
    (content->'procedure')::text like '%shall not be reworked into other certified Gluten Free products%'
                                                                                      as gf_rework,
    (content->'procedure')::text like '%Positive Release Procedure%'                  as positive_release,
    (content->'procedure')::text like '%verify effectiveness of the corrective and preventive measures%'
                                                                                      as effectiveness,
    -- the two lists must be lists
    (content->'procedure')::text like '%• Plant Manager%'                              as recipients_listed,
    (content->'procedure')::text like '%• Food Safety risk%'                           as rca_listed,
    -- the reconstructions must be recorded, not silent
    (content->>'revision_history') like '%RECONSTRUCTIONS%'                           as reconstructions,
    (content->>'revision_history') like '%OPEN BEFORE ISSUE%'                         as open_list,
    (content->>'revision_history') like '%testing@gluten.org%'                        as gfco_addr,
    (content->>'revision_history') like '%FRM-702%'                                   as frm702,
    -- the dead form reference is replaced, and the replacement is recorded rather than silent
    (content->>'form_references') = '@@FORM_REF_NOW@@'                                as form_ref_now,
    (content->>'revision_history') like '%@@FORM_REF_WAS@@%'                          as form_ref_was_noted,
    (content->>'revision_history') like '%THE HOLD RECORD IS NAMED%'                  as hold_record_note,
    status                                                                            as status
  into r
  from public.sop_documents where sop_number = 'FSQM-018';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm018_before b where d.sop_number = 'FSQM-018';

  if r.lines <> @@N_LINES@@ or r.steps <> @@N_STEPS@@
     or r.bullets <> @@N_BULLETS@@ or r.prose <> @@N_PROSE@@ then
    raise exception 'FSQM-018 body wrong shape: % lines, % steps, % bullets, % prose (expected @@N_LINES@@ / @@N_STEPS@@ / @@N_BULLETS@@ / @@N_PROSE@@).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % steps + % bullets + % prose <> % lines.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if r.numbered <> 0 then
    raise exception '% procedure lines still carry their own step number - the renderer would number them twice.',
      r.numbered;
  end if;
  if r.damage <> 0 then
    raise exception '% lines still carry OCR damage or the dead record name (running header, illegible address, merged step, dead cross-reference, or "Hold Action Report").',
      r.damage;
  end if;
  if r.frm702_steps <> 3 then
    raise exception 'FRM-702 is named in % steps, expected the 3 that were the Hold Action Report.',
      r.frm702_steps;
  end if;
  if not (r.segregate and r.like_into_like and r.gf_rework and r.positive_release and r.effectiveness) then
    raise exception 'A requirement was lost: segregation=%, like-into-like=%, GF rework bar=%, positive release=%, effectiveness=%.',
      r.segregate, r.like_into_like, r.gf_rework, r.positive_release, r.effectiveness;
  end if;
  if not (r.recipients_listed and r.rca_listed) then
    raise exception 'A list did not survive as a list: Hold Action Report recipients=%, RCA criteria=%.',
      r.recipients_listed, r.rca_listed;
  end if;
  if not (r.reconstructions and r.open_list and r.gfco_addr and r.frm702) then
    raise exception 'Revision history incomplete: reconstructions=%, open list=%, GFCO address=%, FRM-702=%.',
      r.reconstructions, r.open_list, r.gfco_addr, r.frm702;
  end if;
  if not (r.form_ref_now and r.form_ref_was_noted and r.hold_record_note) then
    raise exception 'Linked Form change incomplete: reads FRM-702=%, old number recorded=%, note present=%.',
      r.form_ref_now, r.form_ref_was_noted, r.hold_record_note;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is now % - a formatting pass must not issue a document.', r.status;
  end if;
  if r.longest > 700 then
    raise exception 'The longest procedure line is % characters - a run-on has reappeared.', r.longest;
  end if;
  if not untouched then
    raise exception 'A section other than procedure/responsibility/revision_history changed. Rolled back.';
  end if;
end $$;

commit;
"""

sql = (SQL
       .replace("@@PROC@@", dollar(doc["procedure"]))
       .replace("@@RESP@@", dollar(doc["responsibility"]))
       .replace("@@FORM_REF@@", dollar(doc["form_references"]))
       .replace("@@RH@@",   dollar(doc["revision_history"]))
       .replace("@@FORM_REF_WAS@@", FORM_REF_WAS)
       .replace("@@FORM_REF_NOW@@", FORM_REF_NOW)
       .replace("@@N_LINES@@",   str(N_LINES))
       .replace("@@N_STEPS@@",   str(N_STEPS))
       .replace("@@N_BULLETS@@", str(N_BULLETS))
       .replace("@@N_PROSE@@",   str(N_PROSE)))

assert "@@" not in sql, "unsubstituted placeholder"

# Every LIKE pattern asserting document content must actually match its payload. LIKE is
# case-sensitive, and a mismatched capital failed the first push of 20260902000001 against a
# document that was entirely correct.
payload = json.dumps(doc["procedure"], ensure_ascii=False) + "\n" + doc["revision_history"] \
          + "\n" + doc["form_references"]
ABSENT = ("NON-CONFORMING PRODUCT", "(4Iuten", "n 6.4", "6.3 thru 6.11", "Hold Action Report")
checked, skipped = 0, 0
for m in re.finditer(r"like '%([^']*?)%'", sql):
    lit = m.group(1)
    if "%" in lit or lit in ABSENT:
        skipped += 1          # multi-wildcard, or asserted ABSENT and already checked above
        continue
    checked += 1
    if lit not in payload:
        low = lit.lower() in payload.lower()
        raise SystemExit("LIKE pattern never matches%s: %r"
                         % (" (case differs only)" if low else "", lit[:70]))

io.open(OUT, "w", encoding="utf-8", newline="\n").write(sql)
print("wrote %s" % OUT)
print("  procedure       41 -> %d lines  (%d steps, %d bullets, %d prose)"
      % (N_LINES, N_STEPS, N_BULLETS, N_PROSE))
print("  longest line    %d chars" % LONGEST)
print("  revision_history %d chars" % len(doc["revision_history"]))
print("  %d content LIKE patterns checked, %d absence/wildcard patterns skipped" % (checked, skipped))
