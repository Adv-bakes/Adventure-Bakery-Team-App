# -*- coding: utf-8 -*-
"""Static checks on migrations before they are pushed.

WHY. Nothing in a migration is executed until `supabase db push` runs it against production,
so a mistake in a guard or a payload is found there rather than here. This workstream has now
produced four: a guessed numeric threshold, an after-hash that omitted a key the update wrote,
an invented function `already_done_check(...)`, and a dollar-quoted payload of plain prose cast
to ::jsonb. Three of the four reached a push.

TWO CHECKS, both aimed at that class:

  functions   identifiers used in call position that are neither a known Postgres function nor
              a PL/pgSQL keyword. A spell-check, not a parser: it cannot prove a migration is
              valid, only that it does not call something obviously invented.
  payloads    every $tag$...$tag$::jsonb payload must parse as JSON. The failing case looked
              like prose in the diff because it WAS prose - a builder's helper had passed str
              through without json.dumps, so only the string-valued keys were affected while
              the lists and objects beside them were fine.

Exit code is non-zero if either check finds anything.

Usage:  python scripts/check-migration-sql.py [migration.sql ...]
        with no arguments, checks every file under supabase/migrations/
"""
import glob, io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

KNOWN = set("""
abs array_agg array_append array_cat array_length array_position array_remove array_to_string
avg bool_and bool_or btrim cardinality cast ceil char_length coalesce concat concat_ws count
current_date current_setting current_timestamp date date_part date_trunc decode digest encode
exists extract floor format generate_series greatest gen_random_uuid has_role initcap
is_owner is_staff_or_admin jsonb_agg jsonb_array_elements jsonb_array_elements_text
jsonb_array_length jsonb_build_array jsonb_build_object jsonb_each jsonb_each_text jsonb_extract_path
jsonb_extract_path_text jsonb_insert jsonb_object_agg jsonb_object_keys jsonb_path_query
jsonb_pretty jsonb_set jsonb_strip_nulls jsonb_typeof json_agg json_build_object json_each
lag lead least left length lower lpad ltrim max md5 min mod now nullif num_nonnulls
octet_length overlay position power quote_ident quote_literal random rank regexp_matches
regexp_replace regexp_split_to_array regexp_split_to_table repeat replace reverse right round
row_number rpad rtrim setweight sign split_part sqrt starts_with string_agg string_to_array strpos
substr substring sum to_char to_date to_jsonb to_number to_timestamp translate trim trunc unnest
upper uuid_generate_v4 var_samp width_bucket
chr ascii pg_get_functiondef pg_typeof pg_sleep set_config txid_current age justify_interval
to_ascii convert_from convert_to sha256 crypt regexp_count regexp_substr
gen_random_bytes to_regclass to_regtype
""".split())

# Words that appear before "(" as syntax rather than as a call.
KEYWORDS = set("""
all and any array as asc begin between by case cast check coalesce commit constraint create
declare default delete desc distinct do drop else elsif end except exception execute exists
false for foreign from full function grant group having if ilike in index inner insert intersect
into is join key lateral left like limit loop natural not null nulls offset on or order outer
over partition primary raise references return returning returns right rollback row rows select
set some table then to true union unique update using values view when where while with
integer int bigint boolean text jsonb json numeric decimal timestamptz timestamp varchar char
uuid date interval smallint real float double record trigger language security definer stable
volatile immutable strict perform assert conflict reference nothing do_nothing
""".split())

CALL = re.compile(r"(?<![\w.])([a-z_][a-z0-9_]*)\s*\(")

def strip_noise(sql):
    """Remove line comments and dollar-quoted payloads, which contain prose, not SQL."""
    # TAGGED payloads only ($j20$ … $j20$): those are JSON prose, not SQL. The tag must be
    # non-empty, because a DO block's body is delimited by a BARE $$ … $$ and that body is the
    # code this checker exists to read. An earlier version allowed an empty tag, stripped every
    # DO block, and reported all-clear on a file containing an invented function.
    sql = re.sub(r"\$([a-z0-9_]+)\$.*?\$\1\$", " ", sql, flags=re.S)
    # COMMENTS BEFORE STRINGS, and the order is the whole trick. These headers are English prose
    # full of apostrophes - "the bakery's", "Part 8's" - and stripping strings first treats each
    # one as an opening quote, pairs it with the next apostrophe several lines down, and deletes
    # the real SQL in between. The first version of this checker did exactly that and reported
    # all-clear on a file it had effectively erased.
    sql = re.sub(r"--[^\n]*", " ", sql)                                # line comments
    sql = re.sub(r"'(?:[^']|'')*'", " ", sql)                          # string literals
    return sql

# A dollar-quoted payload immediately cast to ::jsonb must actually be JSON.
JSONB_PAYLOAD = re.compile(r"\$([a-z0-9_]+)\$(.*?)\$\1\$\s*::\s*jsonb", re.S)

def check_jsonb_payloads(path):
    """Every $tag$…$tag$::jsonb payload must parse as JSON.

    This exists because of a real failed push. A builder's dollar-quote helper passed str
    values through without json.dumps, so a plain-text section came out as bare prose cast to
    ::jsonb and Postgres rejected it with 'Token "SQF" is invalid'. The list and dict payloads
    in the same statement were fine, which is exactly why reading the migration did not catch
    it - the broken one looked like prose because it was prose.
    """
    sql = io.open(path, encoding="utf-8").read()
    bad = []
    for m in JSONB_PAYLOAD.finditer(sql):
        try:
            json.loads(m.group(2))
        except ValueError as e:
            head = m.group(2).strip()[:60].replace("\n", " ")
            bad.append((m.group(1), head, str(e).split(":")[0]))
    return bad

def check(path):
    sql = strip_noise(io.open(path, encoding="utf-8").read())
    # A DO block's body is itself dollar-quoted; keep it by only stripping tagged payloads above.
    bad = []
    for m in CALL.finditer(sql):
        name = m.group(1)
        if name in KNOWN or name in KEYWORDS:
            continue
        # "... with ordinality as t(line, ordinality)" is an alias with a column list, not a
        # call. Every one of these in this repo is preceded by AS, which is the cheapest way to
        # tell them apart without parsing the FROM clause.
        head = sql[:m.start()].rstrip()
        before = head.rsplit(None, 1)
        if before and before[-1].lower() == "as":
            continue
        # "from (values (...), (...)) s(k, v)" - the alias follows the subquery's closing paren
        # rather than an AS, so the AS rule alone does not catch it.
        if head.endswith(")"):
            continue
        # Table aliases in this repo are one or two characters - s, x, a, b1, t - and no function
        # it calls is. Ignoring short names loses nothing real and is what takes the sweep across
        # all 228 migrations to zero, which matters: a checker that fails on applied, working
        # migrations is one nobody runs, and then it catches nothing at all.
        if len(name) <= 2:
            continue
        bad.append((name, len(re.findall(r"(?<![\w.])%s\s*\(" % re.escape(name), sql))))
    return sorted(set(bad))

def main(argv):
    files = argv or sorted(glob.glob(os.path.join("supabase", "migrations", "*.sql")))
    total = 0
    for f in files:
        bad = check(f)
        payloads = check_jsonb_payloads(f)
        if bad or payloads:
            total += 1
            print("FAIL  %s" % os.path.basename(f))
            for name, n in bad:
                print("        unknown function %r (%d call%s)" % (name, n, "" if n == 1 else "s"))
            for tag, head, why in payloads:
                print("        $%s$ payload cast to ::jsonb is not JSON (%s)" % (tag, why))
                print("          starts: %s..." % head)
    print("\n%d migration%s scanned, %d with a problem."
          % (len(files), "" if len(files) == 1 else "s", total))
    return 1 if total else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
