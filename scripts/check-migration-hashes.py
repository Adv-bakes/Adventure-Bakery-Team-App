# -*- coding: utf-8 -*-
"""Check the untouched-sections guard in content migrations for three-way agreement.

THE PATTERN THIS CHECKS. A migration that edits part of sop_documents.content proves it
touched nothing else by hashing the rest before and after:

    create temporary table x_before on commit drop as
    select md5((content - 'procedure' - 'revision_history')::text) as h ...
    update ... set content = jsonb_set(jsonb_set(content, '{procedure}', ...),
                                       '{revision_history}', ...)
    select b.h = md5((d.content - 'procedure' - 'revision_history')::text) into untouched ...

THREE LISTS HAVE TO AGREE and nothing enforced it. 20260902000011 was generated writing three
keys, then hand-edited to write a fourth (form_references) when the linked-form fix was asked
for. The before-hash and the update were updated; the after-hash was not. The two hashes could
then never match, so the migration rejected its own correct work on the second push - after the
first had already failed on a different guessed constant.

The failure is loud rather than silent, so this costs a failed push rather than data. That is
still worth catching on disk: a `supabase db push` against production is not a cheap way to
find a typo.

Exit code is non-zero if any migration disagrees with itself.

Usage:  python scripts/check-migration-hashes.py
"""
import glob, io, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# md5((content - 'a' - 'b')::text) / md5((d.content - 'a' - 'b')::text)
HASH = re.compile(r"md5\(\(\s*(?:\w+\.)?content((?:\s*-\s*'[a-z_]+')+)\s*\)::text\)")
KEY  = re.compile(r"-\s*'([a-z_]+)'")
# Keys written by the update. Read from the update statement as a whole rather than by matching
# jsonb_set's arguments: nested jsonb_set calls put commas inside the first argument, so an
# argument-shaped regex sees only the innermost call and reports three of four keys as unwritten.
# Bounded by the update's WHERE clause at the start of a line, NOT by the first ";" - the
# dollar-quoted JSON payload contains semicolons, which truncated the region before the later
# keys and made a correct migration look like it excluded keys it never wrote.
UPDATE = re.compile(r"set\s+content\s*=(.*?)\n[ \t]*where\b", re.S | re.I)
PATH   = re.compile(r"'\{([a-z_]+)\}'")           # jsonb_set path literal
ARRPTH = re.compile(r"array\[\s*'([a-z_]+)'")     # jsonb_insert / #> array path

def check(path):
    sql = io.open(path, encoding="utf-8").read()
    hashes = [frozenset(KEY.findall(m.group(1))) for m in HASH.finditer(sql)]
    if len(hashes) < 2:
        return None                      # not this pattern
    written = set()
    for m in UPDATE.finditer(sql):
        written |= set(PATH.findall(m.group(1)))
        written |= set(ARRPTH.findall(m.group(1)))
    problems = []
    if len(set(hashes)) != 1:
        problems.append("the %d hash expressions exclude different keys: %s"
                        % (len(hashes), " vs ".join(sorted(",".join(sorted(h)) for h in hashes))))
    excluded = hashes[0]
    missing = written - excluded
    if missing:
        # A key the update writes but the hash does not exclude will always differ, so the
        # guard fires on correct work.
        problems.append("writes %s but the hash does not exclude %s"
                        % (", ".join(sorted(written)), ", ".join(sorted(missing))))
    unwritten = excluded - written
    if unwritten and written:
        # Not necessarily wrong - a key can be excluded deliberately - but worth showing.
        problems.append("excludes %s from the hash without writing them (check this is intended)"
                        % ", ".join(sorted(unwritten)))
    return problems

def main():
    files = sorted(glob.glob(os.path.join("supabase", "migrations", "*.sql")))
    checked = bad = 0
    for f in files:
        problems = check(f)
        if problems is None:
            continue
        checked += 1
        name = os.path.basename(f)
        hard = [p for p in problems if "check this is intended" not in p]
        for p in problems:
            print("%s  %s\n    %s" % ("FAIL " if p in hard else "note ", name, p))
        if hard:
            bad += 1
    print("\n%d migrations use the before/after content hash; %d disagree with themselves."
          % (checked, bad))
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
