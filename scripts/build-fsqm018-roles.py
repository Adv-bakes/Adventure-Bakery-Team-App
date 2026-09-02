# -*- coding: utf-8 -*-
"""Build the FSQM-018 roles + CAPA-reference migration from the draft JSON.

Runs AFTER 20260902000011 (the formatting/OCR repair) and 20260902000012 (FRM-702's
Associated CAPA Number field), and its guard asserts the state those two leave behind.

Writes four content keys - procedure, responsibility, form_references, revision_history -
and hashes everything else before and after.

Refuses to overwrite an existing migration file: an applied migration is history.

Usage:  python scripts/build-fsqm018-roles.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC = "sop-drafts/FSQM-018-non-conforming-product.json"
OUT = "supabase/migrations/20260902000013_fsqm018_roles_and_capa_reference.sql"

BULLET, PARA = "• ", "> "

# The six roles the issued programs already use. Anything outside this set in the body is a
# Compass Blending post that survived the substitution.
ROLES = ["SQF Practitioner", "Quality Team", "Management team", "Production staff",
         "Admin", "All staff"]
GONE = ["QC personnel", "Quality personnel", "Quality Technicians", "Quality Leader",
        "Quality Management", "Plant Manager", "Production associate", "Warehouse personnel",
        "Customer Services and Sales Supply", "functional area manager"]

if os.path.exists(OUT):
    raise SystemExit("%s already exists - refusing to overwrite an applied migration." % OUT)

doc = json.load(io.open(SRC, encoding="utf-8"))
proc = doc["procedure"]
resp = doc["responsibility"]
rh   = doc["revision_history"]

steps   = [l for l in proc if not l.startswith(BULLET) and not l.startswith(PARA)]
bullets = [l for l in proc if l.startswith(BULLET)]
prose   = [l for l in proc if l.startswith(PARA)]
assert len(steps) + len(bullets) + len(prose) == len(proc), "a line has two forms or none"

body = "\n".join(proc) + "\n" + resp

# Not one Compass post may survive in the body or the Responsibility section. The Revision
# History is exempt: it has to name them to say what they were replaced by.
for post in GONE:
    if post in body:
        raise SystemExit("a Compass Blending post survives in the body: %r" % post)
    if post not in rh:
        raise SystemExit("the revision history does not record what happened to %r" % post)

# "R&D" is the eighth substitution and needs a word-boundary check, not a substring one.
if re.search(r"\bR&D\b", body):
    raise SystemExit("R&D survives in the body")

for role in ROLES:
    if role not in resp:
        raise SystemExit("Responsibility does not assign duties to %r" % role)

# The document must defer to FSQM-009 rather than restate it, and must not name an individual.
if "FSQM-009" not in body or "FRM-007" not in body:
    raise SystemExit("the body does not reference FSQM-009 / FRM-007")
for restated in ("at Management discretion", "verify effectiveness of the corrective",
                 "Root Cause Analyses shall be conducted"):
    if restated in body:
        raise SystemExit("a CAPA rule is still restated here: %r" % restated)
if "Gabriela" in body or "GJM" in body:
    raise SystemExit("the body names an individual; the issued programs name roles only")

# Requirements that must survive the rewrite. These are the load-bearing sentences, not
# a spot check - each is a clause obligation the reformat could plausibly have dropped.
for keep in ("Quarantine area immediately to prevent accidental usage",
             "like into like",
             "shall not be reworked into other certified Gluten Free products",
             "clearly identified in the batch sheet and traceable",
             "Positive Release Procedure",
             "reviewed biweekly by the Quality Team",
             "testing@gluten.org",
             "Final Disposition and Release Authorization section of FRM-702"):
    if keep not in body:
        raise SystemExit("a requirement was lost in the rewrite: %r" % keep)

N_LINES, N_STEPS, N_BULLETS, N_PROSE = len(proc), len(steps), len(bullets), len(prose)
FRM702_STEPS = sum("FRM-702" in l for l in proc)

def dollar(value):
    s = json.dumps(value, ensure_ascii=False)
    assert "$j$" not in s, "payload contains the dollar-quote tag"
    return "$j$" + s + "$j$"

SQL = u"""-- FSQM-018: real roles, and corrective action deferred to FSQM-009 rather than restated.
--
-- 20260902000011 made this document print. It did not make it followable. The body named ELEVEN
-- actors - QC personnel, Quality personnel, Quality Technicians, Quality Leader, Quality
-- Management, Plant Manager, Production associate, Warehouse personnel, R&D, the Customer Services
-- and Sales Supply specialist, and "the appropriate functional area manager" - which is a Compass
-- Blending organisation chart. None of those posts exists here, so no responsibility in this
-- document was assigned to anybody, and SQF 2.4.5.1 makes responsibility a limb of the clause:
-- "The responsibility and methods outlining how to handle non-conforming product ... shall be
-- documented and implemented."
--
-- THE SIX ROLES ARE NOT NEW. SQF Practitioner, Quality Team, Management team, Production staff,
-- Admin and All staff are what FSQM-009, FSQM-012, FSQM-013 and FSQM-022 already use. No individual
-- is named, in this document or in those: a document that names a person has to be reissued when
-- the person changes. The site confirmed on 2026-09-02 that the SQF Practitioner and R&D are the
-- same person, which is what collapses the third rewrite below.
--
-- THREE STEPS DID NOT SURVIVE THE SUBSTITUTION, and that is why this is a rewrite and not a
-- find-and-replace. Each described a hand-off between two posts that turn out to be one person.
--
--   the four-party notification   became an instruction to notify oneself. It is now one sentence:
--                                 raise FRM-702, notify the SQF Practitioner and the Management
--                                 team. The four-name list is deleted.
--   "the Plant Manager AND        was one person written as two agreeing. It is the SQF
--    Quality Leader shall          Practitioner alone. A quorum of one is not a control, and
--    determine final disposition"  writing it as one invites an auditor to test a separation of
--                                 duties that does not exist.
--   R&D determines the formula,   both are the same person. Merged into one bullet that keeps what
--   R&D communicates it to the    2.4.6.1 requires - a qualified person determines the formulation,
--   Plant Manager                 the material and formulation are identified in the batch sheet
--                                 and traceable - and drops only the hand-off.
--
-- CORRECTIVE ACTION DEFERS TO FSQM-009 INSTEAD OF RESTATING IT, and the two had already diverged on
-- both things that matter. This document said root cause analyses happen "at Management discretion"
-- on four criteria; FSQM-009 Part 3 lists ten triggers and non-conforming product is one of them,
-- so as written this document permitted skipping an investigation FSQM-009 requires - and an
-- auditor holding both would fairly take the weaker rule as the site's practice. It also gave
-- verification of effectiveness to the Plant Manager and Quality Leader, where FSQM-009 gives it to
-- the Practitioner or someone independent of the action owner. Four steps become one step plus one
-- paragraph pointing at FSQM-009 and FRM-007. The four discretion criteria are deleted outright.
--
-- THE HOLD DOES NOT WAIT ON THE CAPA. FSQM-009 Part 8 cannot close a CAPA until the disposition of
-- affected product is resolved. Requiring the hold to stay open until its CAPA closes would deadlock
-- the two documents against each other, so the closing step says the hold closes on final
-- disposition and the CAPA continues separately. That sentence is the reason to read this migration
-- rather than skim it: the deadlock is invisible unless both documents are read together.
--
-- The CAPA number is written back onto FRM-702, which gained an Associated CAPA Number field in
-- 20260902000012 - that migration must run first, and the guard below does not enforce it because a
-- procedure requiring a field is not broken by the field arriving in the same push.
--
-- STILL DRAFT, STILL NO REVISION BUMP. Never issued, nothing to supersede. The remaining OPEN
-- BEFORE ISSUE items are down to two: the empty Records / Governing Reference / clause reference,
-- and the Positive Release Procedure that does not exist alongside the FSQM-019 rework overlap.
--
-- Writes procedure, responsibility, form_references and revision_history. The DO block hashes
-- everything else before and after, so purpose, scope, definitions and attachments are provably
-- untouched.

begin;

do $$
declare
  r record;
begin
  select status, revision, type,
         jsonb_array_length(content->'procedure')                                     as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Hold Action Report%')                                       as legacy_name,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%Quality personnel%' or s like '%Plant Manager%')            as compass_posts,
         (content->'procedure')::text like '%FSQM-009%'                               as already_done
    into r
    from public.sop_documents where sop_number = 'FSQM-018';

  if r is null then
    raise exception 'FSQM-018 does not exist.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is % - it has been issued, so a content change needs a revision bump. Stop and re-derive.',
      r.status;
  end if;
  if r.revision <> 'New' or r.type <> 'fsqm' then
    raise exception 'FSQM-018 is revision % / type %, not New / fsqm.', r.revision, r.type;
  end if;
  -- the body must be the one 20260902000011 left behind
  if r.lines <> 37 then
    raise exception 'FSQM-018 has % procedure lines, expected the 37 left by 20260902000011. Run that first.',
      r.lines;
  end if;
  if r.legacy_name <> 0 then
    raise exception 'FSQM-018 still says "Hold Action Report" - 20260902000011 has not run.';
  end if;
  if r.already_done then
    raise exception 'FSQM-018 already references FSQM-009 - this migration has run, or the body has moved on.';
  end if;
  if r.compass_posts = 0 then
    raise exception 'FSQM-018 no longer names the Compass posts this migration replaces.';
  end if;
end $$;

create temporary table fsqm018_roles_before on commit drop as
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
    -- not one Compass post may survive, in the body OR in Responsibility
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%QC personnel%' or s like '%Quality personnel%'
         or s like '%Quality Technicians%' or s like '%Quality Leader%'
         or s like '%Quality Management%' or s like '%Plant Manager%'
         or s like '%Production associate%' or s like '%Warehouse personnel%'
         or s like '%Customer Services and Sales Supply%'
         or s like '%functional area manager%' or s ~ '\\mR&D\\M')                      as compass_body,
    (case when (content->>'responsibility') ~ 'QC personnel|Quality personnel|Quality Technicians|Quality Leader|Quality Management|Plant Manager|Production associate|Warehouse personnel|Customer Services and Sales Supply|functional area manager|\\mR&D\\M'
          then 1 else 0 end)                                                          as compass_resp,
    -- and every one of the six roles must be assigned duties
    (select count(*) from unnest(array['SQF Practitioner','Quality Team','Management team',
                                       'Production staff','Admin','All staff']) as rname
      where strpos(content->>'responsibility', rname) = 0)                            as roles_missing,
    -- corrective action defers to FSQM-009 and is not restated
    (content->'procedure')::text like '%FSQM-009%'                                    as refs_program,
    (content->'procedure')::text like '%FRM-007%'                                     as refs_record,
    (content->'procedure')::text like '%at Management discretion%'                    as restates_trigger,
    (content->'procedure')::text like '%verify effectiveness of the corrective%'      as restates_verify,
    -- the deadlock sentence, which is the whole reason the two documents can coexist
    (content->'procedure')::text like '%before a CAPA can be closed%'                 as deadlock_note,
    -- requirements that had to survive
    (content->'procedure')::text like '%Quarantine area immediately to prevent accidental usage%'
                                                                                      as segregate,
    (content->'procedure')::text like '%like into like%'                              as like_into_like,
    (content->'procedure')::text like '%shall not be reworked into other certified Gluten Free products%'
                                                                                      as gf_rework,
    (content->'procedure')::text like '%clearly identified in the batch sheet and traceable%'
                                                                                      as traceable,
    (content->'procedure')::text like '%Positive Release Procedure%'                  as positive_release,
    (content->'procedure')::text like '%testing@gluten.org%'                          as gfco,
    (select count(*) from jsonb_array_elements_text(content->'procedure') s
      where s like '%FRM-702%')                                                       as frm702_steps,
    -- no individual may be named
    (content::text like '%Gabriela%' or (content->'procedure')::text like '%GJM%')     as names_person,
    status                                                                            as status
  into r
  from public.sop_documents where sop_number = 'FSQM-018';

  select b.h = md5((d.content - 'procedure' - 'responsibility' - 'form_references' - 'revision_history')::text)
    into untouched
    from public.sop_documents d, fsqm018_roles_before b where d.sop_number = 'FSQM-018';

  if r.lines <> @@N_LINES@@ or r.steps <> @@N_STEPS@@
     or r.bullets <> @@N_BULLETS@@ or r.prose <> @@N_PROSE@@ then
    raise exception 'FSQM-018 body wrong shape: % lines, % steps, % bullets, % prose (expected @@N_LINES@@ / @@N_STEPS@@ / @@N_BULLETS@@ / @@N_PROSE@@).',
      r.lines, r.steps, r.bullets, r.prose;
  end if;
  if r.steps + r.bullets + r.prose <> r.lines then
    raise exception 'A line has no recognised form: % steps + % bullets + % prose <> % lines.',
      r.steps, r.bullets, r.prose, r.lines;
  end if;
  if r.compass_body <> 0 or r.compass_resp <> 0 then
    raise exception 'Compass Blending posts survive: % in the body, % in Responsibility.',
      r.compass_body, r.compass_resp;
  end if;
  if r.roles_missing <> 0 then
    raise exception '% of the six roles have no duties in Responsibility.', r.roles_missing;
  end if;
  if not (r.refs_program and r.refs_record) then
    raise exception 'The body does not defer to CAPA: FSQM-009=%, FRM-007=%.',
      r.refs_program, r.refs_record;
  end if;
  if r.restates_trigger or r.restates_verify then
    raise exception 'A CAPA rule is still restated here: discretion trigger=%, effectiveness=%.',
      r.restates_trigger, r.restates_verify;
  end if;
  if not r.deadlock_note then
    raise exception 'The closing step no longer says the hold closes independently of the CAPA - the two documents would deadlock.';
  end if;
  if not (r.segregate and r.like_into_like and r.gf_rework and r.traceable
          and r.positive_release and r.gfco) then
    raise exception 'A requirement was lost: segregation=%, like-into-like=%, GF bar=%, traceability=%, positive release=%, GFCO=%.',
      r.segregate, r.like_into_like, r.gf_rework, r.traceable, r.positive_release, r.gfco;
  end if;
  if r.frm702_steps <> @@FRM702_STEPS@@ then
    raise exception 'FRM-702 is named in % steps, expected @@FRM702_STEPS@@.', r.frm702_steps;
  end if;
  if r.names_person then
    raise exception 'The document names an individual. The issued programs name roles only.';
  end if;
  if r.status <> 'draft' then
    raise exception 'FSQM-018 is now % - this migration must not issue a document.', r.status;
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

sql = (SQL
       .replace("@@PROC@@", dollar(proc))
       .replace("@@RESP@@", dollar(resp))
       .replace("@@FORM_REF@@", dollar(doc["form_references"]))
       .replace("@@RH@@", dollar(rh))
       .replace("@@N_LINES@@",   str(N_LINES))
       .replace("@@N_STEPS@@",   str(N_STEPS))
       .replace("@@N_BULLETS@@", str(N_BULLETS))
       .replace("@@N_PROSE@@",   str(N_PROSE))
       .replace("@@FRM702_STEPS@@", str(FRM702_STEPS)))

assert "@@" not in sql, "unsubstituted placeholder"

# Every LIKE pattern asserting document content must actually match its payload. LIKE is
# case-sensitive, and a mismatched capital failed the first push of 20260902000001 against a
# document that was entirely correct.
payload = json.dumps(proc, ensure_ascii=False) + "\n" + resp + "\n" + rh \
          + "\n" + doc["form_references"]
ABSENT = tuple(GONE) + ("at Management discretion", "verify effectiveness of the corrective",
                        "Hold Action Report", "Gabriela", "GJM", "R&D")
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
print("  procedure       37 -> %d lines  (%d steps, %d bullets, %d prose)"
      % (N_LINES, N_STEPS, N_BULLETS, N_PROSE))
print("  FRM-702 named in %d steps" % FRM702_STEPS)
print("  roles assigned  %s" % ", ".join(ROLES))
print("  Compass posts   0 in body, 0 in Responsibility (%d checked)" % (len(GONE) + 1))
print("  revision_history %d chars" % len(rh))
print("  %d content LIKE patterns checked, %d absence/wildcard patterns skipped" % (checked, skipped))
