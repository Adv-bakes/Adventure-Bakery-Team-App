# -*- coding: utf-8 -*-
"""Emit the migration that aligns SOP-401 and FRM-401 with the freezer service rule.

    python scripts/build-sop401-amend.py

WHY. The seed said the walk-in freezer was OUT OF SERVICE because it holds no product since
the vegan burger line was discontinued. The site's actual rule, settled 2026-09-08, is
different and better: a unit goes out of service when it is SWITCHED OFF, not when it happens
to be empty. The freezer is still running, so it stays in service and is judged against its
10 F limit - a running unit that fails to hold temperature is worth knowing about, and an
empty unit is the cheapest possible time to find that out.

The database was already in that state (changed through the Limits editor at 16:43 UTC on
2026-09-08); it was the two documents that disagreed with it. A procedure that contradicts
the configuration it describes is the FSQM-018 problem in miniature, so this closes it now
rather than at issue.

WHY A SEPARATE MIGRATION. 20260908000003 and 20260908000004 are applied. Applied migrations
are history and are never edited - a content change is a new migration. build-sop401.py now
refuses to overwrite them for the same reason.

TWO DOCUMENTS, ONE MIGRATION, deliberately. A partial application would leave SOP-401 saying
the freezer is out of service while its own record defaults to in service, which is worse
than either state on its own.
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = "20260908000005_freezer_in_service_while_running.sql"

SOP_JSON = "sop-drafts/SOP-401-temperature-controlled-storage.json"
FRM_JSON = "sop-drafts/FRM-401-temperature-monitoring-review.json"

# The exact wording being replaced. Asserted in the migration's before-state guard, so a body
# that has already moved on stops the migration instead of being silently overwritten.
OLD_FREEZER_BULLET = "out of service. It holds no product and may be switched off"
NEW_FREEZER_MARK = "in service and monitored"


def dollar(payload, tag):
    text = json.dumps(payload, ensure_ascii=False)
    marker = "$%s$" % tag
    if marker in text:
        raise SystemExit("dollar-quote tag %r appears inside the payload" % marker)
    return marker + text + marker


def fill(template, **tokens):
    out = template
    for k, v in tokens.items():
        out = out.replace("@@%s@@" % k, str(v))
    left = re.findall(r"@@[A-Z_]+@@", out)
    if left:
        raise SystemExit("unfilled tokens: %s" % ", ".join(sorted(set(left))))
    return out


def main():
    sop = json.load(io.open(os.path.join(HERE, SOP_JSON), encoding="utf-8"))
    frm = json.load(io.open(os.path.join(HERE, FRM_JSON), encoding="utf-8"))

    proc = sop["procedure"]
    parts = [l for l in proc if not l.startswith(("•", ">"))]
    bullets = [l for l in proc if l.startswith("•")]
    prose = [l for l in proc if l.startswith(">")]
    assert len(parts) + len(bullets) + len(prose) == len(proc)

    if not any(NEW_FREEZER_MARK in l for l in proc):
        raise SystemExit("the SOP JSON does not carry the new freezer wording; rebuild it first")
    if any(OLD_FREEZER_BULLET in l for l in proc):
        raise SystemExit("the SOP JSON still carries the OLD freezer wording")

    n_sections = len(frm["sections"])
    n_fields = sum(len(s["fields"]) for s in frm["sections"])

    sql = """-- Freezer stays IN SERVICE while it is running. Aligns SOP-401 and FRM-401 with the
-- site's actual rule, settled 2026-09-08.
--
-- THE RULE CHANGED, NOT THE FACT. The seed said the walk-in freezer was out of service because
-- it holds no product since the vegan burger line was discontinued. The site's rule is that a
-- unit goes out of service when it is SWITCHED OFF, not when it happens to be empty. The
-- freezer is still running, so it stays in service and is judged against its 10 F limit.
--
-- This is the better rule and the documents were the ones that were wrong. A running unit that
-- cannot hold its temperature is worth knowing about whether or not there is product in it that
-- day, and an empty unit is the cheapest possible moment to discover it. The temperature_limits
-- row was already changed through the Limits editor at 16:43 UTC on 2026-09-08; this makes the
-- procedure and its record say the same thing, because a procedure that contradicts the
-- configuration it describes is the FSQM-018 dangling-citation problem in miniature.
--
-- BOTH DOCUMENTS IN ONE MIGRATION on purpose: a partial application would leave SOP-401 saying
-- the freezer is out of service while its own record defaults it to in service.
--
-- SOP-401 keeps its line counts exactly (@@N_LINES@@ lines: @@N_PARTS@@ Parts, @@N_BULLETS@@
-- bullets, @@N_PROSE@@ prose) - this is a wording change in place, not a restructure, and the
-- guard below proves it.

begin;

-- Before-state. Both documents must still be drafts carrying the OLD wording; if either has
-- already moved on, stop rather than overwrite work this migration cannot see.
do $$
declare
  n int;
  st text;
begin
  select status into st from public.sop_documents where sop_number = 'SOP-401';
  if st is null then
    raise exception 'SOP-401 not found.';
  end if;
  if st <> 'draft' then
    raise exception 'SOP-401 is %, not draft. Amending an issued procedure needs a revision bump.', st;
  end if;

  select count(*) into n
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401'
     and t.line like '%@@OLD_MARK@@%';
  if n <> 1 then
    raise exception 'Expected exactly 1 procedure line with the old freezer wording, found %.', n;
  end if;

  select count(*) into n
    from public.sop_documents
   where sop_number = 'FRM-401'
     and content -> 'form_schema' :: text like '%Out of service%';
  if n <> 1 then
    raise exception 'FRM-401 does not carry the old freezer default; found % row(s).', n;
  end if;
end $$;

-- Prove nothing outside the edited keys moves.
create temporary table sop401_before on commit drop as
select md5((content - 'procedure' - 'revision_history')::text) as h
  from public.sop_documents where sop_number = 'SOP-401';

update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content, '{procedure}', @@PROCEDURE@@::jsonb),
                   '{revision_history}', @@REVHIST@@::jsonb)
 where sop_number = 'SOP-401';

do $$
declare
  untouched boolean;
begin
  select b.h = md5((d.content - 'procedure' - 'revision_history')::text) into untouched
    from public.sop_documents d, sop401_before b
   where d.sop_number = 'SOP-401';
  if not untouched then
    raise exception 'SOP-401: a section other than procedure/revision_history changed.';
  end if;
end $$;

-- FRM-401: the whole schema is rewritten, so the guard is on everything ELSE in content.
create temporary table frm401_before on commit drop as
select md5((content - 'form_schema')::text) as h
  from public.sop_documents where sop_number = 'FRM-401';

update public.sop_documents
   set content = jsonb_set(content, '{form_schema}', @@SCHEMA@@::jsonb)
 where sop_number = 'FRM-401';

do $$
declare
  untouched boolean;
begin
  select b.h = md5((d.content - 'form_schema')::text) into untouched
    from public.sop_documents d, frm401_before b
   where d.sop_number = 'FRM-401';
  if not untouched then
    raise exception 'FRM-401: content outside form_schema changed.';
  end if;
end $$;

-- After-state.
do $$
declare
  n_parts int; n_bullets int; n_prose int; n int;
  n_sections int; n_fields int;
begin
  select count(*) filter (where line not like '•%' and line not like '>%'),
         count(*) filter (where line like '•%'),
         count(*) filter (where line like '>%')
    into n_parts, n_bullets, n_prose
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401';
  if n_parts <> @@N_PARTS@@ or n_bullets <> @@N_BULLETS@@ or n_prose <> @@N_PROSE@@ then
    raise exception 'SOP-401 is now % Parts / % bullets / % prose, expected @@N_PARTS@@ / @@N_BULLETS@@ / @@N_PROSE@@',
      n_parts, n_bullets, n_prose;
  end if;

  select count(*) into n
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401' and t.line like '%@@OLD_MARK@@%';
  if n <> 0 then
    raise exception 'SOP-401 still carries the old freezer wording on % line(s).', n;
  end if;

  select count(*) into n
    from public.sop_documents d, jsonb_array_elements_text(d.content -> 'procedure') t(line)
   where d.sop_number = 'SOP-401' and t.line like '%@@NEW_MARK@@%';
  if n <> 1 then
    raise exception 'Expected 1 procedure line with the new freezer wording, found %.', n;
  end if;

  -- The freezer's service state must be gone from the OPEN BEFORE ISSUE list; the burger-line
  -- date is still owed, so the list itself must survive.
  select count(*) into n from public.sop_documents
   where sop_number = 'SOP-401' and content ->> 'revision_history' like '%OPEN BEFORE ISSUE%';
  if n <> 1 then
    raise exception 'SOP-401 lost its OPEN BEFORE ISSUE list; the other items are still open.';
  end if;

  select jsonb_array_length(content -> 'form_schema' -> 'sections') into n_sections
    from public.sop_documents where sop_number = 'FRM-401';
  select count(*) into n_fields
    from public.sop_documents d,
         jsonb_array_elements(d.content -> 'form_schema' -> 'sections') s,
         jsonb_array_elements(s -> 'fields')
   where d.sop_number = 'FRM-401';
  if n_sections <> @@N_SECTIONS@@ or n_fields <> @@N_FIELDS@@ then
    raise exception 'FRM-401 is now % sections / % fields, expected @@N_SECTIONS@@ / @@N_FIELDS@@',
      n_sections, n_fields;
  end if;

  select count(*) into n from public.sop_documents
   where sop_number = 'FRM-401'
     and content -> 'form_schema' :: text like '%Out of service%';
  if n <> 0 then
    raise exception 'FRM-401 still defaults the freezer to Out of service.';
  end if;
end $$;

-- The live configuration this wording now describes. If somebody puts the freezer back out of
-- service before this is pushed, the documents would be wrong again in the other direction.
do $$
declare
  svc boolean;
begin
  select in_service into svc from public.temperature_limits where equipment_name = 'Walk-In Freezer';
  if svc is null then
    raise exception 'No temperature_limits row for the Walk-In Freezer.';
  end if;
  if not svc then
    raise exception 'The freezer is OUT of service in temperature_limits, but this migration rewrites SOP-401 to say it is in service. Reconcile before pushing.';
  end if;
end $$;

commit;
"""
    sql = fill(sql,
               PROCEDURE=dollar(proc, "p401a"),
               REVHIST=dollar(sop["revision_history"], "r401a"),
               SCHEMA=dollar(frm, "f401a"),
               OLD_MARK=OLD_FREEZER_BULLET,
               NEW_MARK=NEW_FREEZER_MARK,
               N_LINES=len(proc),
               N_PARTS=len(parts), N_BULLETS=len(bullets), N_PROSE=len(prose),
               N_SECTIONS=n_sections, N_FIELDS=n_fields)

    path = os.path.join(HERE, "supabase", "migrations", OUT)
    io.open(path, "w", encoding="utf-8", newline="\n").write(sql)
    print("wrote %s  %d bytes" % (OUT, len(sql.encode("utf-8"))))
    print("  SOP-401 %d lines (%d/%d/%d)  FRM-401 %d sections / %d fields"
          % (len(proc), len(parts), len(bullets), len(prose), n_sections, n_fields))


if __name__ == "__main__":
    main()
