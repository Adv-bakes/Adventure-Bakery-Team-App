"""Generate FRM-951 Training Matrix as a printable PDF + DOCX, from the live database.

    python scripts/generate-training-matrix.py
    python scripts/generate-training-matrix.py --revision v2 --effective 2026-09-01

Pass --revision (and --approved-by) when reissuing: they default to "New"/"GJM", so regenerating
without them resets a revision that was stamped by hand.

Two tables:

  1. REQUIRED TRAINING BY DEPARTMENT — the standing requirement. One row per assignable module,
     one tick column per department, driven by sop_documents.required_departments. This is the
     matrix SQF 2.9.2.1 asks for.
  2. COMPLETION RECORD — a dated snapshot of where each team member actually is.

Why this is generated rather than maintained by hand: a hand-kept matrix is wrong the moment a
module's scope changes, and nothing tells you. FRM-903's printed blank drifted two revisions behind
the app exactly that way. Regenerating from the database means the paper copy is a photograph of the
truth on the day it was printed, and the effective date on it says which day that was.

Reads prod through the Supabase Management API using SUPABASE_ACCESS_TOKEN, the same read-only path
used elsewhere in this repo. Read-only: it runs two SELECTs and writes two files.
"""
import argparse, datetime, importlib.util, io, json, os, sys, urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT = "zsukaixinoqmggpxxonn"
DEPARTMENTS = ["Production", "Sourcing", "Quality Control", "Admin", "R&D", "Sales"]
TICK, BLANK = "X", ""

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# generate-form-blank.py has a hyphen in its name, so it cannot be imported by name.
_spec = importlib.util.spec_from_file_location("formblank", os.path.join(HERE, "generate-form-blank.py"))
fb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fb)


def query(sql):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        raise SystemExit("SUPABASE_ACCESS_TOKEN is not set — this reads the live database.")
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/%s/database/query" % PROJECT,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json",
                 # The API's edge rejects urllib's default Python-urllib/x.y agent with a 403.
                 # Any ordinary agent string is accepted; curl works for the same reason.
                 "User-Agent": "adventure-bakery-training-matrix/1.0"},
    )
    with urllib.request.urlopen(req) as r:
        out = json.loads(r.read().decode("utf-8"))
    if isinstance(out, dict):                      # the API returns an object only on error
        raise SystemExit("query failed: %s" % out.get("message", out))
    return out


MODULES_SQL = """
select coalesce(d.sop_number, '-') as num,
       regexp_replace(d.title, '\\s*\\(ES\\)\\s*$', '') as title,
       d.training_category as cat,
       d.required_departments as depts,
       exists (select 1 from public.sop_documents es
                where es.module_number is not null
                  and es.module_number = d.module_number
                  and es.title like '%(ES)%' and es.status = 'active') as has_spanish
  from public.sop_documents d
 where d.status = 'active' and d.training_category is not null
   and d.title not like '%(ES)%'
 order by d.training_category, d.sop_number nulls last, d.title;
"""

PEOPLE_SQL = """
select coalesce(p.full_name, 'User ' || left(p.id::text, 8)) as person,
       coalesce(p.department, '-') as dept,
       coalesce(g.sop_number, d.sop_number, '-') as module,
       case when ta.completed_at is not null then 'Completed ' || ta.completed_at::date
            when ta.progress is not null then 'In progress'
            else 'Not started' end as status,
       (d.title like '%(ES)%') as in_spanish
  from public.training_assignments ta
  join public.sop_documents d on d.id = ta.sop_id
  left join public.sop_documents g on g.id = public.governing_training_module(ta.sop_id)
  join public.profiles p on p.id = ta.employee_id
 order by p.full_name, module;
"""

CAT_LABEL = {1: "1 — Core Onboarding", 2: "2 — Safety & Risk Management",
             3: "3 — Job-Specific Operations", 4: "4 — Response Protocols"}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", default="sop-drafts")
    ap.add_argument("--effective", help="effective date on the printed form (default: today)")
    # Without this the revision is hardcoded and every regeneration silently resets whatever was
    # stamped by hand - the same drift that put FRM-903's printed blank two revisions behind the
    # app. Pass the revision you are issuing under and the sheet keeps it.
    ap.add_argument("--revision", default="New",
                    help="revision shown on the printed form (default: New)")
    ap.add_argument("--approved-by", dest="approved_by", default="GJM",
                    help="approver shown on the printed form (default: GJM)")
    a = ap.parse_args()

    eff = a.effective or datetime.date.today().isoformat()
    modules = query(MODULES_SQL)
    people_rows = query(PEOPLE_SQL)

    # ---- table 1: requirement matrix -------------------------------------------------
    req_cols = ["Module", "Title", "Cat"] + DEPARTMENTS + ["ES"]
    req_rows = []
    for m in modules:
        depts = m["depts"]                              # null means every department
        marks = [TICK if depts is None or dept in depts else BLANK for dept in DEPARTMENTS]
        req_rows.append([m["num"], m["title"], str(m["cat"]), *marks,
                         "Yes" if m["has_spanish"] else BLANK])
    # Module, Title, Cat, six departments, ES. The department columns must be wide enough for
    # "Production" to sit on one line: at 0.95 it broke mid-word as "Productio / n", which reads as
    # a typo on a printed compliance record. Width comes out of the title column, which wraps
    # cleanly at word boundaries.
    req_weights = [1.1, 3.3, 0.45] + [1.18] * len(DEPARTMENTS) + [0.6]

    # ---- table 2: completion snapshot ------------------------------------------------
    people, dept_of = [], {}
    for r in people_rows:
        if r["person"] not in dept_of:
            people.append(r["person"]); dept_of[r["person"]] = r["dept"]
    status = {(r["person"], r["module"]): (r["status"], r["in_spanish"]) for r in people_rows}

    comp_cols = ["Module", "Title"] + ["%s\n(%s)" % (p, dept_of[p]) for p in people]
    comp_rows = []
    for m in modules:
        cells = []
        for p in people:
            st = status.get((p, m["num"]))
            # "Not required" is a real and different answer from "not done" — the whole point of
            # a matrix is that not everyone owes everything.
            cells.append("Not required" if st is None
                         else st[0] + (" (ES)" if st[1] else ""))
        comp_rows.append([m["num"], m["title"], *cells])
    comp_weights = [1.1, 3.6] + [1.9] * len(people)

    blocks = [
        {"k": "section", "title": "1. Required Training by Department",
         "desc": ("Which training each department must complete (SQF 2.9.2.1). An X means the module "
                  "is required of everyone in that department; a module marked in every column is "
                  "required of all staff. ES marks the modules with a Spanish version, which is how "
                  "2.9.2.2 is met for Spanish-preferring employees.")},
        {"k": "reftable", "columns": req_cols, "rows": req_rows, "weights": req_weights},
        {"k": "section", "title": "2. Completion Record",
         "desc": "Status as at %s. “Not required” means the module is out of scope for that "
                 "person’s department, which is different from not yet done." % eff},
        {"k": "reftable", "columns": comp_cols, "rows": comp_rows, "weights": comp_weights},
        {"k": "section", "title": "3. Scope of this matrix", "desc": ""},
        {"k": "info", "text":
            "Training is assigned BY DEPARTMENT. SQF 2.9.2.1 ii asks for competencies by DUTY — "
            "“staff engaged in monitoring critical control points” and their named backups — "
            "and a duty is narrower than a department: not everyone in Production monitors a CCP. "
            "Recording that requires the job descriptions and named CCP monitors from deliverable "
            "D-01. Until those exist this matrix is accurate about what is assigned and incomplete "
            "about what the Code asks; the gap is here rather than hidden.\n\n"
            "Generated from the live system on %s by scripts/generate-training-matrix.py. Do not "
            "edit this sheet by hand — change a module's required departments in the SOPs Library "
            "and regenerate, or the paper and the app will disagree." % eff},
    ]

    meta = {"form_no": "FRM-951", "title": "Training Matrix", "revision": a.revision, "eff": eff,
            "appr": a.approved_by, "sqf": "2.9.1.1, 2.9.1.2, 2.9.2.1, 2.9.2.2, 2.9.2.3",
            "footer": fb.FOOT.format(no="FRM-951")}

    out_dir = a.out_dir if os.path.isabs(a.out_dir) else os.path.join(ROOT, a.out_dir)
    pdf = os.path.join(out_dir, "FRM-951-training-matrix.pdf")
    docx = os.path.join(out_dir, "FRM-951-training-matrix.docx")
    fb.build_pdf(pdf, meta, blocks, landscape_page=True)
    fb.build_docx(docx, meta, blocks, landscape_page=True)
    print("modules: %d   people: %d   rev %s   effective: %s   approved by %s"
          % (len(modules), len(people), a.revision, eff, a.approved_by))


if __name__ == "__main__":
    main()
