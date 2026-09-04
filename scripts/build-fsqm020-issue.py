# -*- coding: utf-8 -*-
"""No bulk product ships; then issue FSQM-020 and FRM-701 together.

  20260904000003  FSQM-020 Part 7 becomes a scope statement under Part 6. The site ships no
                  bulk or unlabeled product, so the second half of 2.4.7.2 does not arise.
  20260904000004  FRM-701 loses the bulk/unlabeled checkbox.
  20260904000005  Both go active, approved GJM, 2026-09-04, in ONE transaction.

Refuses to overwrite an existing migration file.

Usage:  python scripts/build-fsqm020-issue.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC20, SRC701 = ("sop-drafts/FSQM-020-product-release-program.json",
                 "sop-drafts/FRM-701-product-release-schema.json")
M = "supabase/migrations/"
OUT = [M + "20260904000003_fsqm020_no_bulk_product.sql",
       M + "20260904000004_frm701_no_bulk_field.sql",
       M + "20260904000005_issue_fsqm020.sql"]
B, P = "• ", "> "

for f in OUT:
    if os.path.exists(f):
        raise SystemExit("%s already exists - refusing to overwrite an applied migration." % f)

def dollar(v, tag):
    """Always json.dumps, including for str - see build-fsqm020-collection.py for why."""
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

# ==================================================== 1. no bulk product
doc = json.load(io.open(SRC20, encoding="utf-8"))
proc = list(doc["procedure"])
assert len(proc) == 27, "expected the 27-line body, found %d" % len(proc)

BULK_STEP = [i for i, l in enumerate(proc) if l.startswith("Where product is supplied in bulk")]
assert len(BULK_STEP) == 1
i = BULK_STEP[0]
assert proc[i - 1].startswith(P), "the bulk step should follow Part 6's prose"
# A Part describing something that never happens is the trap Part 7 was flagged for. It becomes
# a scope statement in prose under Part 6, where the rest of the labelling content already is -
# so 2.4.7.2's second limb is still addressed, but the program does not grow a Part for it.
proc[i] = ("> All finished product leaves the site labelled and in its finished pack. The site "
           "supplies no product in bulk or unlabeled, so the requirement in the second half of "
           "SQF 2.4.7.2 — that product information be made available to inform customers or "
           "consumers of the requirements for safe use — does not arise.")
doc["procedure"] = proc

steps = [l for l in proc if not l.startswith(B) and not l.startswith(P)]
bull = [l for l in proc if l.startswith(B)]
pros = [l for l in proc if l.startswith(P)]
N = (len(proc), len(steps), len(bull), len(pros))
assert N == (27, 10, 8, 9), "unexpected shape %s" % (N,)

rh = doc["revision_history"]
OLD2 = rh[rh.index("2. Part 7 requires safe-use information"):].rstrip()
assert "bulk or unlabeled" in OLD2
rh = rh[:rh.index("2. Part 7 requires safe-use information")].rstrip() + "\n"
rh = rh.replace("OPEN BEFORE ISSUE — two things the site must settle. Neither blocks issue; the "
                "one item that did was Part 8's written instruction, withdrawn on 2026-09-04 when "
                "the collection model was corrected:",
  "NO BULK OR UNLABELED PRODUCT, CONFIRMED 2026-09-04. The site was asked whether it ships any, "
  "because Part 7 required safe-use information to travel with such a consignment and a Part "
  "describing something that never happens is worse than no Part at all — it is the first thing "
  "an auditor tests and the first thing the floor learns to ignore. It ships none. Part 7 is "
  "therefore gone as a step and its clause limb is stated in prose under Part 6, with the "
  "labelling content it belongs with: all finished product leaves labelled and in its finished "
  "pack, so the second half of 2.4.7.2 does not arise. That is the same treatment Part 5 gives "
  "positive release on testing and Part 8 gives off-site storage — three limbs of 2.4.7 that do "
  "not apply here, each said so rather than left silent.\n\n"
  "OPEN BEFORE ISSUE — one item, and it does not block issue:")
doc["revision_history"] = rh
assert "2. Part 7 requires" not in rh and "NO BULK OR UNLABELED PRODUCT" in rh

io.open(SRC20, "w", encoding="utf-8", newline="\n").write(
    json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

SQL3 = u"""-- FSQM-020: no bulk or unlabeled product ships. Part 7 becomes a scope statement. Still draft.
--
-- Part 7 required safe-use information to travel with bulk or unlabeled product, and the Revision
-- History carried an open item asking whether the site ships any. It ships none - confirmed
-- 2026-09-04.
--
-- SO THE PART GOES AND THE CLAUSE LIMB STAYS. A Part describing something that never happens is
-- worse than no Part: it is the first thing an auditor tests and the first thing the floor learns
-- to ignore. But 2.4.7.2's second sentence still has to be addressed, so it becomes a prose
-- statement under Part 6, beside the labelling content it belongs with - all finished product
-- leaves labelled and in its finished pack, so the bulk-information requirement does not arise.
--
-- THAT IS NOW THE THIRD LIMB OF 2.4.7 THIS PROGRAM STATES AS NOT APPLYING, alongside positive
-- release on testing (Part 5) and off-site storage (Part 8). Three scope statements in one program
-- reads defensively only if they are hidden; said plainly, each one is the difference between a
-- clause an auditor has to ask about and a clause already answered.
--
-- 27 lines stay 27: a step becomes a paragraph. 11 Parts become 10, prose goes 8 to 9, the eight
-- Part 4 bullets are untouched - so the one-to-one with FRM-701's checklist still holds.
--
-- Writes procedure and revision_history; hashes the rest. Still draft, no revision bump.

begin;

do $$
declare
  r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                  as lines,
         (content->'procedure')::text like '%Where product is supplied in bulk%'    as bulk_step,
         (content->>'revision_history') like '%2. Part 7 requires safe-use%'        as open_item
    into r from public.sop_documents where sop_number = 'FSQM-020';

  if r is null then raise exception 'FSQM-020 does not exist.'; end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-020 is % - a content change to an issued document needs a revision bump.', r.status;
  end if;
  if r.revision <> 'New' then
    raise exception 'FSQM-020 is at revision %, not New.', r.revision;
  end if;
  if r.lines <> 27 then
    raise exception 'FSQM-020 has % procedure lines, expected 27.', r.lines;
  end if;
  if not r.bulk_step then
    raise exception 'FSQM-020 has no bulk product step to replace - this has run.';
  end if;
  if not r.open_item then
    raise exception 'FSQM-020 does not carry the bulk-product open item this migration answers.';
  end if;
end $$;

create temporary table fsqm020_bulk_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'FSQM-020';

update public.sop_documents
   set content = jsonb_set(jsonb_set(content, '{procedure}', @@P@@::jsonb),
                           '{revision_history}', @@H@@::jsonb)
 where sop_number = 'FSQM-020' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'procedure')                                       as lines,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s not like '• %' and s not like '> %')                                 as steps,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '• %')                                                          as bullets,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '> %')                                                          as prose,
    (content->'procedure')::text like '%Where product is supplied in bulk%'         as old_step,
    (content->'procedure')::text like '%supplies no product in bulk or unlabeled%'  as scope_stated,
    (content->'procedure')::text like '%second half of SQF 2.4.7.2%'               as clause_named,
    (content->>'revision_history') like '%NO BULK OR UNLABELED PRODUCT, CONFIRMED%' as recorded,
    (content->>'revision_history') like '%2. Part 7 requires safe-use%'             as stale_item,
    (content->>'revision_history') like '%one item, and it does not block issue%'   as one_item,
    -- the other two scope statements and the Part 4 checks must be untouched
    (content->'procedure')::text like '%does not use positive release based on pathogen or chemical testing%'
                                                                                   as no_testing,
    (content->'procedure')::text like '%does not use off-site or contract warehouses%' as no_offsite
  into r from public.sop_documents where sop_number = 'FSQM-020';

  select b.h = md5((d.content - 'procedure' - 'revision_history')::text) into untouched
    from public.sop_documents d, fsqm020_bulk_before b where d.sop_number = 'FSQM-020';

  if r.lines <> @@L@@ or r.steps <> @@S@@ or r.bullets <> @@BU@@ or r.prose <> @@PR@@ then
    raise exception 'FSQM-020 wrong shape: % / % / % / % (expected @@L@@ / @@S@@ / @@BU@@ / @@PR@@).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.old_step then raise exception 'The bulk product step survives.'; end if;
  if not (r.scope_stated and r.clause_named) then
    raise exception '2.4.7.2 second limb not addressed: scope=%, clause named=%.',
      r.scope_stated, r.clause_named;
  end if;
  if not (r.recorded and r.one_item) or r.stale_item then
    raise exception 'Revision history wrong: recorded=%, one item=%, stale item=%.',
      r.recorded, r.one_item, r.stale_item;
  end if;
  if not (r.no_testing and r.no_offsite) then
    raise exception 'Another scope statement was lost: testing=%, off-site=%.',
      r.no_testing, r.no_offsite;
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-020 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'A section other than procedure/revision_history changed. Rolled back.';
  end if;
end $$;

commit;
"""
sql3 = (SQL3.replace("@@P@@", dollar(proc, "$p20$")).replace("@@H@@", dollar(rh, "$h20$"))
            .replace("@@L@@", str(N[0])).replace("@@S@@", str(N[1]))
            .replace("@@BU@@", str(N[2])).replace("@@PR@@", str(N[3])))
assert "@@" not in sql3
c3, k3 = like_check(sql3, json.dumps(proc, ensure_ascii=False) + "\n" + rh,
                    absent=("Where product is supplied in bulk", "2. Part 7 requires safe-use"))
io.open(OUT[0], "w", encoding="utf-8", newline="\n").write(sql3)

# ==================================================== 2. FRM-701 loses the bulk checkbox
sch = json.load(io.open(SRC701, encoding="utf-8"))
before = sum(len(s["fields"]) for s in sch["sections"])
assert before == 21, "expected 21 fields, found %d" % before
for s in sch["sections"]:
    s["fields"] = [f for f in s["fields"] if f["id"] != "bulk_unlabeled"]
after = sum(len(s["fields"]) for s in sch["sections"])
assert after == 20, "expected 20 fields after removal, found %d" % after
blob = json.dumps(sch, ensure_ascii=False)
assert "bulk_unlabeled" not in blob and "bulk or unlabeled" not in blob
io.open(SRC701, "w", encoding="utf-8", newline="\n").write(
    json.dumps(sch, ensure_ascii=False, indent=2) + "\n")

SQL4 = u"""-- FRM-701 loses the bulk/unlabeled checkbox. The site ships none. Still draft.
--
-- Section 3 carried "Product is supplied in bulk or unlabeled - safe-use information provided to
-- the customer with the consignment". The site confirmed on 2026-09-04 that it ships no bulk or
-- unlabeled product, so that box would have been unticked on every record forever.
--
-- AN ALWAYS-BLANK FIELD IS NOT NEUTRAL. It teaches the person filling the form that some fields do
-- not need reading, and the next field they skim will be one that mattered. FSQM-020's Part 7 went
-- for the same reason in 20260904000003; this keeps the form and the program saying the same thing.
--
-- 21 fields become 20. Sections stay 4, the eight release checks, five list columns, single
-- signature and deletable=false are unchanged and asserted. FRM-701 has no entries.
--
-- Writes content->'form_schema' only; hashes the rest.

begin;

do $$
declare
  r record;
begin
  select d.status, d.revision,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                as fields,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'bulk_unlabeled')                                      as bulk_field,
         (select count(*) from public.sop_document_responses x where x.document_id = d.id) as entries
    into r from public.sop_documents d where d.sop_number = 'FRM-701';

  if r is null then raise exception 'FRM-701 does not exist.'; end if;
  if r.status <> 'draft' or r.revision <> 'New' then
    raise exception 'FRM-701 is % / %, not draft / New.', r.status, r.revision;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-701 has % entries - removing a field would orphan answers.', r.entries;
  end if;
  if r.fields <> 21 then
    raise exception 'FRM-701 has % fields, expected 21.', r.fields;
  end if;
  if r.bulk_field <> 1 then
    raise exception 'FRM-701 has no bulk_unlabeled field to remove - this has run.';
  end if;
end $$;

create temporary table frm701_bulk_before on commit drop as
select md5((content - 'form_schema')::text) as h
  from public.sop_documents where sop_number = 'FRM-701';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', @@SCH@@::jsonb)
 where sop_number = 'FRM-701' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  untouched boolean;
begin
  select status,
    jsonb_array_length(content->'form_schema'->'sections')                          as sections,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f)                      as fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'id' = 'bulk_unlabeled')                                            as bulk_field,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements_text(f->'rows'->'labels') l
      where f->>'id' = 'checks')                                                    as check_rows,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where (f->>'showInList')::boolean)                                            as list_fields,
    (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where f->>'type' = 'signature')                                               as signatures,
    (content->'form_schema'->'settings'->>'deletable')                              as deletable
  into r from public.sop_documents where sop_number = 'FRM-701';

  select b.h = md5((d.content - 'form_schema')::text) into untouched
    from public.sop_documents d, frm701_bulk_before b where d.sop_number = 'FRM-701';

  if r.fields <> @@F@@ or r.sections <> @@SE@@ then
    raise exception 'FRM-701 is % fields / % sections, expected @@F@@ / @@SE@@.', r.fields, r.sections;
  end if;
  if r.bulk_field <> 0 then raise exception 'bulk_unlabeled survives.'; end if;
  if r.check_rows <> 8 or r.list_fields <> 5 or r.signatures <> 1 then
    raise exception 'Form damaged: % checks, % list fields, % signatures.',
      r.check_rows, r.list_fields, r.signatures;
  end if;
  if r.deletable is distinct from 'false' then raise exception 'FRM-701 became deletable.'; end if;
  if r.status <> 'draft' then
    raise exception 'FRM-701 is now % - this migration must not issue it.', r.status;
  end if;
  if not untouched then
    raise exception 'Something outside form_schema changed. Rolled back.';
  end if;
end $$;

commit;
"""
sql4 = (SQL4.replace("@@SCH@@", dollar(sch, "$s701$"))
            .replace("@@F@@", str(after)).replace("@@SE@@", str(len(sch["sections"]))))
assert "@@" not in sql4
c4, k4 = like_check(sql4, blob)
io.open(OUT[1], "w", encoding="utf-8", newline="\n").write(sql4)

# ==================================================== 3. issue both
rh = doc["revision_history"]
OLD_HEAD = "OPEN BEFORE ISSUE — one item, and it does not block issue:"
assert OLD_HEAD in rh
rh = rh.replace(OLD_HEAD,
  "ISSUED 2026-09-04, approved GJM. Status active, revision New — a first issue, not a revision, "
  "so nothing is superseded and nothing is archived. FRM-701 Finished Product Release Record is "
  "activated in the SAME TRANSACTION: this program requires a release to be recorded on it, and an "
  "active procedure requiring a record that is not available is the finding this wave exists to "
  "close.\n\n"
  "SETTLED AT ISSUE. Both questions this document carried were answered by the site on 2026-09-04. "
  "It ships no bulk or unlabeled product, so Part 7 became a scope statement under Part 6. It uses "
  "no off-site or contract warehouse — the customer collects with their own carrier — so Part 8's "
  "written instruction, the one item that genuinely blocked issue, was withdrawn. Neither answer "
  "was assumed; both were asked for and given.\n\n"
  "WHAT ISSUING ADOPTS. Three limbs of 2.4.7 are stated as not applying here: positive release on "
  "pathogen or chemical testing (Part 5), off-site and contract warehouses (Part 8), and bulk or "
  "unlabeled supply (Part 6). Issuing this document adopts those three scope statements as the "
  "site's position. Each names what would have to change first — Part 5 in terms, and the other two "
  "by describing the practice they depend on — so none of them can quietly stop being true.\n\n"
  "STILL OPEN AFTER ISSUE — one item, and it is not about this document:")
doc["revision_history"] = rh
for need in ("ISSUED 2026-09-04, approved GJM", "SETTLED AT ISSUE", "STILL OPEN AFTER ISSUE",
             "WHAT ISSUING ADOPTS"):
    assert need in rh, need
assert "OPEN BEFORE ISSUE" not in rh

io.open(SRC20, "w", encoding="utf-8", newline="\n").write(
    json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

SQL5 = u"""-- Issue FSQM-020 and FRM-701. Active, approved GJM, 2026-09-04. Closes Mandatory 2.4.7.
--
-- BOTH IN ONE TRANSACTION, and that is the point of the migration rather than a convenience.
-- FSQM-020 requires every release to be recorded on FRM-701. Activating the program while its
-- record was still draft would put an active controlled document in the position FSQM-022 was in
-- before D-07 - requiring a record that is not available - which is the exact finding this wave
-- exists to close. Either both are issued or neither is.
--
-- WHAT ISSUING ADOPTS. Three limbs of 2.4.7 are stated as NOT APPLYING to this site: positive
-- release on pathogen or chemical testing (Part 5), off-site and contract warehouses (Part 8), and
-- bulk or unlabeled supply (Part 6). Issuing adopts those as the site's position. That is a real
-- decision, not a formality, so each one names what would have to change first: Part 5 says the
-- procedure must be revised before tested product ships, and the other two describe the practice
-- they depend on - collection by the customer's carrier, and finished product leaving labelled in
-- its finished pack - so none can quietly stop being true without someone noticing.
--
-- NEITHER ANSWER WAS ASSUMED. Both were asked for and given by the site on 2026-09-04: no bulk or
-- unlabeled product ships, and the customer arranges collection with their own carrier. The second
-- corrected an answer this program had been drafted against the day before, which is why it was
-- worth asking rather than inferring from the tolling inventory tables.
--
-- ONE ITEM CARRIED FORWARD, AND IT IS NOT ABOUT THIS DOCUMENT. There is no documented product
-- sampling, inspection and analysis method (2.4.4.1) and no finished product specification in the
-- register beyond SOP-2.3.1. The release check points at "the customer's agreed specification" and
-- "the product's appearance and sensory standard", and an auditor will follow that pointer. That is
-- a gap in a different element, not a defect here, and this program does not claim 2.4.4.
--
-- REVISION STAYS AT New on both. First issue, not a revision - the same as FSQM-009 under
-- 20260902000010 and FSQM-018 under 20260902000016. Nothing is superseded and nothing archived.
-- Every document FSQM-020 references is asserted active below.
--
-- Only status, approved_by, effective_date and FSQM-020's revision_history are written. The DO
-- block hashes the rest of both rows' content, so the procedure, the form schema and every other
-- section are provably untouched by the issue.

begin;

do $$
declare
  r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-020')          as s20,
    (select status from public.sop_documents where sop_number = 'FRM-701')           as s701,
    (select revision from public.sop_documents where sop_number = 'FSQM-020')        as v20,
    (select revision from public.sop_documents where sop_number = 'FRM-701')         as v701,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-020')                                                 as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-701')                                                as fields,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as open_head,
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-702','FRM-903','FRM-601','REP-602','REP-603','FSQM-018',
                           'FSQM-009','SOP-2.3.2.3','SOP-2.3.2','SOP-2.3.1')
        and status = 'active')                                                       as refs_live
  into r;

  if r.s20 is distinct from 'draft' or r.s701 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-020=%, FRM-701=%.', r.s20, r.s701;
  end if;
  if r.v20 <> 'New' or r.v701 <> 'New' then
    raise exception 'Expected both at revision New; found %, %.', r.v20, r.v701;
  end if;
  if r.lines <> 27 or r.fields <> 20 then
    raise exception 'Bodies are not what 20260904000003/4 left: % lines, % fields.', r.lines, r.fields;
  end if;
  if not r.open_head then
    raise exception 'FSQM-020 does not carry the OPEN BEFORE ISSUE heading this migration rewrites.';
  end if;
  if r.refs_live <> 10 then
    raise exception 'Only % of the 10 documents FSQM-020 references are active.', r.refs_live;
  end if;
end $$;

create temporary table issue020_before on commit drop as
select sop_number,
       md5((content - 'revision_history')::text) as h
  from public.sop_documents where sop_number in ('FSQM-020','FRM-701');

update public.sop_documents
   set content = jsonb_set(content, '{revision_history}', @@RH@@::jsonb),
       status = 'active', approved_by = 'GJM', effective_date = date '2026-09-04'
 where sop_number = 'FSQM-020' and status = 'draft' and revision = 'New';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-04'
 where sop_number = 'FRM-701' and status = 'draft' and revision = 'New';

do $$
declare
  r record;
  bad int;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-020','FRM-701') and status = 'active'
        and approved_by = 'GJM' and effective_date = date '2026-09-04'
        and revision = 'New')                                                        as issued,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-020')                                                 as lines,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-701')                                                as fields,
    (select (content->>'revision_history') like '%OPEN BEFORE ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as stale_head,
    (select (content->>'revision_history') like '%ISSUED 2026-09-04, approved GJM%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as issue_note,
    (select (content->>'revision_history') like '%SETTLED AT ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as settled,
    (select (content->>'revision_history') like '%WHAT ISSUING ADOPTS%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as adopts,
    (select (content->>'revision_history') like '%STILL OPEN AFTER ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as still_open,
    -- the three scope statements the issue adopts must all be present
    (select (content->'procedure')::text like '%does not use positive release based on pathogen or chemical testing%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as limb_testing,
    (select (content->'procedure')::text like '%does not use off-site or contract warehouses%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as limb_offsite,
    (select (content->'procedure')::text like '%supplies no product in bulk or unlabeled%'
       from public.sop_documents where sop_number = 'FSQM-020')                      as limb_bulk
  into r;

  select count(*) into bad
    from public.sop_documents d join issue020_before b on b.sop_number = d.sop_number
   where md5((d.content - 'revision_history')::text) is distinct from b.h;

  if r.issued <> 2 then
    raise exception 'Only % of the two documents issued as active/GJM/2026-09-04/New.', r.issued;
  end if;
  if r.lines <> 27 or r.fields <> 20 then
    raise exception 'A body changed during issue: % lines, % fields.', r.lines, r.fields;
  end if;
  if r.stale_head then
    raise exception 'FSQM-020 is active but still says OPEN BEFORE ISSUE.';
  end if;
  if not (r.issue_note and r.settled and r.adopts and r.still_open) then
    raise exception 'Revision history wrong: issued=%, settled=%, adopts=%, still open=%.',
      r.issue_note, r.settled, r.adopts, r.still_open;
  end if;
  if not (r.limb_testing and r.limb_offsite and r.limb_bulk) then
    raise exception 'A scope statement the issue adopts is missing: testing=%, off-site=%, bulk=%.',
      r.limb_testing, r.limb_offsite, r.limb_bulk;
  end if;
  if bad <> 0 then
    raise exception '% of the two rows changed outside revision_history. Rolled back.', bad;
  end if;
end $$;

commit;
"""
sql5 = SQL5.replace("@@RH@@", dollar(rh, "$i20$"))
assert "@@" not in sql5
c5, k5 = like_check(sql5, json.dumps(proc, ensure_ascii=False) + "\n" + rh,
                    absent=("OPEN BEFORE ISSUE",))
io.open(OUT[2], "w", encoding="utf-8", newline="\n").write(sql5)

print("wrote %s\n  FSQM-020 %d lines (%d Parts, %d bullets, %d prose); Part 7 -> scope statement" % ((OUT[0],) + N))
print("  %d LIKE patterns checked, %d skipped" % (c3, k3))
print("wrote %s\n  FRM-701 21 -> %d fields, %d sections" % (OUT[1], after, len(sch["sections"])))
print("  %d LIKE patterns checked, %d skipped" % (c4, k4))
print("wrote %s\n  FSQM-020 + FRM-701 -> active / GJM / 2026-09-04, one transaction" % OUT[2])
print("  %d LIKE patterns checked, %d skipped" % (c5, k5))
