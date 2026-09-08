# -*- coding: utf-8 -*-
"""Emit the SOP-401 and FRM-401 seed migrations from their JSON sources.

    python scripts/build-sop401.py

WHY A BUILDER RATHER THAN HAND-WRITTEN SQL. The bodies are large JSON documents with prose
full of apostrophes, degree signs and em dashes. Hand-quoting that into SQL is how a payload
of plain text ended up cast to ::jsonb on 2026-09-02 and failed the push with
'Token "SQF" is invalid'. Here the content is authored as JSON, validated by json.load
before anything is written, and emitted through json.dumps - so a payload that is not valid
JSON cannot be produced in the first place.

The dollar-quote tag is checked against the payload rather than assumed: prose containing
the tag would silently terminate the literal early.

Re-runnable. Overwrites the two migration files from the JSON sources, so an edit to a
document body is made in the .json and rebuilt, never by editing the generated .sql.
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG = os.path.join(HERE, "supabase", "migrations")

LF, CRLF = chr(10), chr(13) + chr(10)

SOP_JSON = "sop-drafts/SOP-401-temperature-controlled-storage.json"
FRM_JSON = "sop-drafts/FRM-401-temperature-monitoring-review.json"

SOP_SQL = "20260908000003_sop401_temperature_controlled_storage.sql"
FRM_SQL = "20260908000004_frm401_temperature_monitoring_review.sql"

# Documents SOP-401 points at. An active procedure must not cite a document that is missing
# or withdrawn - the whole FSQM-018 "Positive Release Procedure" episode was one dangling
# citation nobody checked.
SOP_REFS = ["FSQM-018", "FSQM-009", "FRM-702", "FRM-913"]


def dollar(payload, tag):
    """Dollar-quote a JSON payload. json.dumps ALWAYS - passing a str through unquoted is
    the exact bug this function exists to prevent."""
    text = json.dumps(payload, ensure_ascii=False)
    marker = "$%s$" % tag
    if marker in text:
        raise SystemExit("dollar-quote tag %r appears inside the payload" % marker)
    return marker + text + marker


def load(rel):
    with io.open(os.path.join(HERE, rel), encoding="utf-8") as fh:
        return json.load(fh)


def fill(template, **tokens):
    """Substitute @@TOKEN@@ placeholders.

    NOT %-formatting and NOT str.format: Postgres uses % as its own placeholder in RAISE
    and {} appears throughout JSON, so both would need escaping across a hundred lines of
    SQL and the first missed one is a build error at best and wrong SQL at worst.
    """
    out = template
    for k, v in tokens.items():
        out = out.replace("@@%s@@" % k, str(v))
    left = re.findall(r"@@[A-Z_]+@@", out)
    if left:
        raise SystemExit("unfilled tokens: %s" % ", ".join(sorted(set(left))))
    return out


def write(name, sql):
    """Write a seed migration, REFUSING to change one that already exists differently.

    Both seed migrations were applied to production on 2026-09-08. Applied migrations are
    history: a content change is a NEW migration, never an edit to an old one. But this
    script regenerates its output from the JSON sources, so editing a document body and
    re-running it silently rewrites an APPLIED file - the diff looks like an ordinary
    rebuild, and the change never reaches the database, because that version row is already
    recorded. That is not hypothetical: it happened on 2026-09-08 while the freezer wording
    was being changed, and was caught only by noticing the byte count had moved.

    scripts/build-sop401-amend.py is how a body change is delivered instead.
    """
    path = os.path.join(MIG, name)
    if os.path.exists(path):
        # newline="" so the comparison is not confused by a CRLF checkout on Windows.
        current = io.open(path, encoding="utf-8", newline="").read()
        if current.replace(CRLF, LF) == sql:
            print("unchanged %-54s (already applied)" % name)
            return
        raise SystemExit(
            "%s already exists and WOULD CHANGE.%s"
            "  It is an APPLIED migration - rewriting it would edit history, and the change%s"
            "  would never reach the database. Deliver the edit as a new migration:%s"
            "      python scripts/build-sop401-amend.py" % (name, LF, LF, LF))
    io.open(path, "w", encoding="utf-8", newline=LF).write(sql)
    print("wrote %-58s %6d bytes" % (name, len(sql.encode("utf-8"))))


def build_sop():
    content = load(SOP_JSON)
    proc = content["procedure"]
    parts = [l for l in proc if not l.startswith(("•", ">"))]
    bullets = [l for l in proc if l.startswith("•")]
    prose = [l for l in proc if l.startswith(">")]
    assert len(parts) + len(bullets) + len(prose) == len(proc)

    sql = """-- SOP-401 Temperature-Controlled Storage. Seeded draft. Closes SQF 11.6.2.
--
-- WHY IT EXISTS. Three YoLink sensors have logged temperature_logs continuously since
-- 2026-06-24 and /team/compliance/temperature has displayed them since, but NO DOCUMENT IN
-- THE REGISTER CITED 11.6.2 AT ALL. The data was being collected and nobody had written down
-- what "good" meant, what to do when it wasn't, or that anyone had looked. Of the four
-- obligations in 11.6.2.3 the sensors satisfied exactly one: records kept.
--
-- THE ALERT WAS BUILT BEFORE THIS WAS WRITTEN, deliberately. 11.6.2.3 wants a stated
-- frequency of checks and a corrective action for out-of-specification readings; with 3-4
-- staff the answer was not another daily clipboard round, so the Team App now checks every
-- in-service unit every fifteen minutes and records what the responder did (migrations
-- 20260908000001/2). FSQM-018 spent months citing a "Positive Release Procedure" that
-- existed nowhere, and a procedure describing an unbuilt alert would repeat that exactly.
--
-- ABSENCE OF DATA IS ALERTED, which is the real lesson of the first ten weeks: logging
-- stopped three times, the longest gap 3 days 2 hours, and nobody noticed. A dead sensor
-- reads as perfect compliance.
--
-- SEEDED DRAFT. The Revision History carries seven OPEN BEFORE ISSUE items, none of which
-- can be closed by writing - sensor placement in the warmest part of the room, a reading
-- visible without entering the unit, drainage tracing, a condition walk, the two devices'
-- accuracy specifications, the freezer's intended state, and the cause of the three logging
-- gaps. Do not issue this document until they are done.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'SOP-401';
  if n <> 0 then
    raise exception 'SOP-401 already exists.';
  end if;
  -- 400-499 is the Storage & Inventory block (DOC_STAGES in src/lib/docNumber.ts) and this
  -- is the first document in it. If that stops being true, the number needs rechecking
  -- against the register before this is pushed.
  select count(*) into n from public.sop_documents
   where sop_number ~ '^(SOP|FRM)-4[0-9][0-9]$' and status <> 'archived';
  if n <> 0 then
    raise exception 'The 400 block already holds % document(s); recheck SOP-401/FRM-401.', n;
  end if;
  select count(*) into n from public.sop_documents
   where sop_number in (@@REF_LIST@@) and status = 'active';
  if n <> @@N_REFS@@ then
    raise exception 'Only % of the @@N_REFS@@ documents SOP-401 references are active.', n;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'SOP-401',
  'Temperature-Controlled Storage',
  'sop',
  'Storage & Inventory',
  'draft',
  'New',
  '11.6.2.1, 11.6.2.2, 11.6.2.3, 11.6.2.4, 2.5.2.1',
  true,
  @@CONTENT@@
);

-- Guard: the body must have landed with the shape it was authored in. Counting the three
-- procedure line forms separately catches a payload that was mangled on the way in, which a
-- simple "is it there" check would not.
do $$
declare
  proc jsonb;
  n_parts int; n_bullets int; n_prose int;
begin
  select content -> 'procedure' into proc
    from public.sop_documents where sop_number = 'SOP-401';
  if proc is null or jsonb_typeof(proc) <> 'array' then
    raise exception 'SOP-401 procedure did not save as an array.';
  end if;
  select count(*) filter (where line not like '•%' and line not like '>%'),
         count(*) filter (where line like '•%'),
         count(*) filter (where line like '>%')
    into n_parts, n_bullets, n_prose
    from jsonb_array_elements_text(proc) as t(line);
  if n_parts <> @@N_PARTS@@ or n_bullets <> @@N_BULLETS@@ or n_prose <> @@N_PROSE@@ then
    raise exception 'SOP-401 body is % Parts / % bullets / % prose, expected @@N_PARTS@@ / @@N_BULLETS@@ / @@N_PROSE@@',
      n_parts, n_bullets, n_prose;
  end if;
end $$;

commit;
"""
    sql = fill(sql,
               REF_LIST=",".join("'%s'" % r for r in SOP_REFS),
               N_REFS=len(SOP_REFS),
               CONTENT=dollar(content, "j401"),
               N_PARTS=len(parts), N_BULLETS=len(bullets), N_PROSE=len(prose))
    write(SOP_SQL, sql)
    print("       SOP-401: %d Parts, %d bullets, %d prose" % (len(parts), len(bullets), len(prose)))


def build_frm():
    schema = load(FRM_JSON)
    n_sections = len(schema["sections"])
    n_fields = sum(len(s["fields"]) for s in schema["sections"])

    sql = """-- FRM-401 Temperature Monitoring Review. Seeded draft, fillable. The record SOP-401 keeps.
--
-- WHY MONTHLY AND NOT WEEKLY. Once the Team App watches every in-service unit every fifteen
-- minutes, the human job stops being observation and becomes verification under SQF 2.5.2.1
-- that the monitoring worked. A monthly review of an alert log is defensible and is likely
-- to actually happen; a weekly one layered on top of an automated check is work that adds
-- nothing and gets skipped - and a form nobody fills is worse than no form, because it
-- documents an intention the site is not meeting.
--
-- THIS IS NOT THE TEMPERATURE RECORD. The temperature record is the continuous per-sensor
-- log the sensors keep, which is what 11.6.2.3 asks be retained. This form is the evidence
-- that somebody read it, checked the alerts were closed properly, and compared the sensor
-- against a probe. Transcribing daily temperatures onto a form here would duplicate a record
-- that already exists in a better form.
--
-- The alert section asks for "No alerts raised" as an explicit row rather than accepting a
-- blank, because a blank section cannot distinguish a quiet month from an unreviewed one.

begin;

do $$
declare
  n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'FRM-401';
  if n <> 0 then
    raise exception 'FRM-401 already exists.';
  end if;
  -- FRM-401 is the record SOP-401 names, so the procedure must be there to name it.
  select count(*) into n from public.sop_documents where sop_number = 'SOP-401';
  if n <> 1 then
    raise exception 'SOP-401 is missing; seed it before its record.';
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-401',
  'Temperature Monitoring Review',
  'form',
  'Storage & Inventory',
  'draft',
  'New',
  '11.6.2.3, 2.5.2.1',
  true,
  -- ::jsonb is not optional. Without it jsonb_build_object receives TEXT and stores the
  -- whole schema as a JSON string, which renders as an empty form rather than an error.
  jsonb_build_object('form_schema', @@SCHEMA@@::jsonb)
);

-- Guard: the schema must be fillable and complete. A form_schema that saved as a string, or
-- lost a section on the way in, renders as an empty form rather than an error - which is how
-- a filler discovers it, mid-shift, instead of here.
do $$
declare
  sch jsonb;
  n_sections int; n_fields int;
begin
  select content -> 'form_schema' into sch
    from public.sop_documents where sop_number = 'FRM-401';
  if sch is null or jsonb_typeof(sch) <> 'object' then
    raise exception 'FRM-401 form_schema did not save as an object.';
  end if;
  select count(*) into n_sections from jsonb_array_elements(sch -> 'sections');
  select count(*) into n_fields
    from jsonb_array_elements(sch -> 'sections') s,
         jsonb_array_elements(s -> 'fields');
  if n_sections <> @@N_SECTIONS@@ or n_fields <> @@N_FIELDS@@ then
    raise exception 'FRM-401 saved % sections / % fields, expected @@N_SECTIONS@@ / @@N_FIELDS@@',
      n_sections, n_fields;
  end if;
end $$;

commit;
"""
    sql = fill(sql, SCHEMA=dollar(schema, "f401"),
               N_SECTIONS=n_sections, N_FIELDS=n_fields)
    write(FRM_SQL, sql)
    print("       FRM-401: %d sections, %d fields" % (n_sections, n_fields))


if __name__ == "__main__":
    build_sop()
    build_frm()
