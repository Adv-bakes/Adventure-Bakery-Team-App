# -*- coding: utf-8 -*-
"""Compare the document numbers the remediation plan RESERVES against the ones the register
has ASSIGNED.

WHY. The plan tab reserves numbers in a spreadsheet; sop_documents assigns them in Postgres;
nothing compared the two. Both collisions found on 2026-09-04 were found by accident:

  FSQM-020  reserved by D-19 (Internal Audit), spent on the Product Release Program under
            D-17 on 2026-09-03.
  FSQM-013  reserved by D-14 (HACCP, Wave 1, all eight Majors), spent on the Module 11
            Exemption Analysis under D-13 task 13.6 on 2026-09-01.

Eleven days and two deliverables apart, same mistake. Neither was caught by review; the first
turned up while fixing a status, the second while checking the first.

WHAT IT REPORTS

  1  reserved twice        two deliverables reserving one number - always wrong
  2  reserved but taken    a NOT STARTED deliverable reserving a number that already exists.
                           Deliverables that are WIP/Completed are expected to name a live
                           document - they built it - and a cell saying revise / extend /
                           rebuild is naming an existing document on purpose. Both are
                           excluded, which is what keeps this from crying wolf on every row
                           that worked.
  3  free numbers          the lowest unused numbers per prefix, so picking one does not need
                           this analysis run by hand first.

SOP numbers are excluded from the free-number search on purpose: they are numbered by the SQF
clause they implement (SOP-2.3.1, SOP-11.7.5), which DOCUMENT_REGISTER.md sets out and
docNumber.ts encodes, so "the next free SOP number" is not a meaningful question.

Reads the register through the Supabase Management API using SUPABASE_ACCESS_TOKEN, or from a
file of numbers with --numbers for an offline run.

    python scripts/check-doc-numbers.py
    python scripts/check-doc-numbers.py --numbers live-numbers.txt

Exit code is non-zero if either kind of collision is found.
"""
import argparse, io, json, os, re, subprocess, sys, zipfile
from collections import defaultdict

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_WB = r"C:\AdventureBakes\RumCakeFactory_SQF_Gap Assessment_Ed 9 - Remediation Plan.xlsx"
SHEET = "xl/worksheets/sheet3.xml"          # Remediation Plan
PROJECT = "zsukaixinoqmggpxxonn"
ID_COL, DOCS_COL, STATUS_COL = "A", "D", "K"
HEADER_ROW = 4
# A cell using one of these is naming a document that already exists, deliberately.
# "upload" earns its place: D-24 Training Records Completion reserves FRM-953, which is the
# live Training Sign-In Sheet - the deliverable loads records INTO it and was never going to
# create it. Without the word, the check flags the one row it should not.
REUSE_WORDS = ("revise", "revised", "extend", "rebuild", "amend", "issued", "build out",
               "upload")
NUM = re.compile(r"\b(FSQM|FRM|REP|POL)-(\d{3})\b")


def unesc(s):
    return (s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
             .replace("&apos;", "'").replace("&amp;", "&"))


def plan_rows(wb):
    z = zipfile.ZipFile(wb)
    strings = [re.sub(r"<[^>]+>", "", si) for si in
               re.findall(r"<si>(.*?)</si>",
                          z.read("xl/sharedStrings.xml").decode("utf-8"), re.S)]
    out = []
    for rm in re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>',
                          z.read(SHEET).decode("utf-8"), re.S):
        n, cells = int(rm.group(1)), {}
        for cm in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>', rm.group(2), re.S):
            col, attrs, body = cm.groups()
            t = re.search(r"<is>.*?<t[^>]*>(.*?)</t>", body, re.S)
            v = re.search(r"<v>(.*?)</v>", body, re.S)
            if t:
                cells[col] = unesc(t.group(1))
            elif v:
                cells[col] = unesc(strings[int(v.group(1))]) if 't="s"' in attrs else v.group(1)
        if n > HEADER_ROW and (cells.get(ID_COL) or "").startswith("D-"):
            out.append(cells)
    return out


def live_numbers(path=None):
    if path:
        return set(re.findall(r"\b(?:FSQM|FRM|REP|POL)-\d{3}\b",
                              io.open(path, encoding="utf-8").read()))
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        raise SystemExit("SUPABASE_ACCESS_TOKEN is not set. Use --numbers for an offline run.")
    sql = ("select sop_number, status from public.sop_documents "
           "where sop_number ~ '^(FSQM|FRM|REP|POL)-[0-9]+$'")
    body = json.dumps({"query": sql})           # ASCII only - no UTF-8 round-trip hazard here
    out = subprocess.run(
        ["curl", "-s", "-X", "POST",
         "https://api.supabase.com/v1/projects/%s/database/query" % PROJECT,
         "-H", "Authorization: Bearer %s" % token,
         "-H", "Content-Type: application/json", "--data", body],
        capture_output=True, text=True).stdout
    rows = json.loads(out)
    if isinstance(rows, dict):
        raise SystemExit("register query failed: %s" % rows.get("message", rows))
    return {r["sop_number"] for r in rows if r.get("status") != "archived"}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--workbook", default=DEFAULT_WB)
    ap.add_argument("--numbers", help="file of live document numbers, instead of querying prod")
    a = ap.parse_args()

    rows = plan_rows(a.workbook)
    live = live_numbers(a.numbers)

    # A Document(s) cell reserves EVERY number in it, up to a "RENUMBERED" note. D-21 and D-22
    # each legitimately reserve two manuals, so taking only the first under-counts and then
    # offers the second as free. The renumbering notes added on 2026-09-04 name the numbers they
    # moved AWAY from, so counting those would re-report the collisions that were just fixed -
    # splitting on the marker separates the two cases without guessing.
    reserved, extras = {}, defaultdict(list)
    for c in rows:
        d = c.get(DOCS_COL, "")
        head, _, tail = d.partition("RENUMBERED")
        for pre, n in NUM.findall(head):
            reserved.setdefault("%s-%s" % (pre, n), []).append(c)
        for pre, n in NUM.findall(tail):
            num = "%s-%s" % (pre, n)
            # A renumbering note usually ends by naming the number it moved TO, which the head
            # already reserved. Listing it again as prose reads like a second, different claim.
            if c not in reserved.get(num, []):
                extras[num].append(c[ID_COL])

    dup = {k: [c[ID_COL] for c in v] for k, v in reserved.items() if len(v) > 1}
    taken = []
    for num, cs in reserved.items():
        for c in cs:
            status = (c.get(STATUS_COL) or "").strip()
            cell = (c.get(DOCS_COL) or "").lower()
            if num in live and status == "Not started" \
               and not any(w in cell for w in REUSE_WORDS):
                taken.append((num, c[ID_COL], (c.get("C") or "")[:44]))

    print("plan reserves %d numbers across %d deliverables; register holds %d"
          % (len(reserved), len(rows), len(live)))
    print()
    print("1. RESERVED TWICE")
    print("   " + ("none" if not dup else ""))
    for k, v in sorted(dup.items()):
        print("   %-9s %s" % (k, ", ".join(v)))
    print()
    print("2. RESERVED BY A NOT-STARTED DELIVERABLE BUT ALREADY IN THE REGISTER")
    print("   " + ("none" if not taken else ""))
    for num, d, name in sorted(taken):
        print("   %-9s %-6s %s" % (num, d, name))
    print()
    print("3. LOWEST FREE NUMBERS")
    for pre in ("FSQM", "FRM", "REP"):
        used = {int(n) for p, n in
                (NUM.match(x).groups() for x in live if NUM.match(x)) if p == pre}
        used |= {int(k.split("-")[1]) for k in reserved if k.startswith(pre + "-")}
        free = [i for i in range(1, 100) if i not in used][:6]
        print("   %-5s %s" % (pre, ", ".join("%s-%03d" % (pre, i) for i in free)))
    if extras:
        print()
        print("   (numbers mentioned in a cell after the first, read as prose not reservation: %s)"
              % ", ".join("%s in %s" % (k, "/".join(v)) for k, v in sorted(extras.items())))
    return 1 if (dup or taken) else 0


if __name__ == "__main__":
    sys.exit(main())
