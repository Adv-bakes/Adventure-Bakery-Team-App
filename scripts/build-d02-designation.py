# -*- coding: utf-8 -*-
"""D-02 - the SQF Practitioner designation record, and the two documents that must point at it.

SQF Food Safety Code: Food Manufacturing, Edition 9:
  2.1.1.4  senior site management designates a primary AND substitute SQF Practitioner, with the
           responsibility and authority to run the SQF System.
  2.1.1.5  both holders must be employed by the site, hold a responsible position, HAVE COMPLETED A
           HACCP TRAINING COURSE, be competent with HACCP-based plans, and understand the Code.

  20260911000001  FRM-005 SQF Practitioner Designation Record, seeded draft.
  20260911000002  FSQM-003 reworded so it names a position rather than a person; FSQM-004 told
                  where the designation and the competency evidence are recorded.

DOCUMENTS NAME POSITIONS; RECORDS NAME PEOPLE. The consultant's improvement note on 2.1.1.4 was to
take employee names out of documentation so a change of personnel does not force a revision, and
FSQM-004 already refuses by guard to name anyone. But a designation is inherently about people. The
resolution is that the controlled documents say "the SQF Practitioner" and FRM-005's ENTRIES say who
that is, dated and signed - so a change of personnel is a new entry, never a reissue. The form's own
guard refuses it if it names anyone, for the same reason FSQM-004's does.

THE CERTIFICATES DO NOT GO HERE. FRM-952 Training Competency Verification Record is already active
and is the per-person competency record. FRM-005 points at it. A second place to file a HACCP
certificate would be two accounts of one qualification - the lesson FRM-008 was deleted over.

Refuses to overwrite either migration.

Usage:  python scripts/build-d02-designation.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT1 = "supabase/migrations/20260911000001_frm005_sqf_practitioner_designation.sql"
OUT2 = "supabase/migrations/20260911000002_fsqm003_fsqm004_point_at_frm005.sql"
for f in (OUT1, OUT2):
    if os.path.exists(f):
        raise SystemExit("%s already exists - refusing to overwrite an applied migration." % f)

# Names that must never appear in a controlled document or a form schema. Entries may name people;
# the documents and the form definition may not.
NAMES = ("diana", "gabriela", "samboni", "juncos", "christina")


def dollar(v, tag):
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    assert ("$%s$" % tag) not in s
    return "$%s$%s$%s$" % (tag, s, tag)


# ══════════════════════════════════════════════════════════ FRM-005

LIMB_OPTS = ["Met", "Pending"]

HOW = (
 "ONE ENTRY IS ONE DESIGNATION. Make a new entry whenever the primary or the substitute changes, and "
 "at least once a year to confirm the designation in force. Earlier entries are never edited: they are "
 "the history of who held the authority, and when.\n\n"
 "THIS RECORD NAMES PEOPLE SO THE DOCUMENTS DO NOT HAVE TO. FSQM-004 and every other controlled "
 "document name the position, not the person. The individuals holding it are recorded here, so a change "
 "of personnel is a new entry rather than a document revision.\n\n"
 "WHO SIGNS WHAT. Each acknowledgement is signed by the person named, in their own login. Only senior "
 "site management can sign the designation itself, and the app enforces that. A staff login can edit "
 "only an entry it started, so the person designated primary should start this entry and sign first; "
 "senior site management then completes and submits it.\n\n"
 "SENIOR SITE MANAGEMENT MAY ALSO BE THE SUBSTITUTE. 2.1.1.4 makes the designation senior site "
 "management's act and does not stop it naming itself, and in a small site it often has to. Where that "
 "is the case the same person signs both, and the record should show it as it is."
)

AUTHORITY = (
 "The primary and the substitute SQF Practitioner are given the responsibility and authority to:\n"
 "i. oversee how the SQF System is developed, put in place, reviewed and kept up;\n"
 "ii. act to protect the integrity of the SQF System; and\n"
 "iii. make sure the people who need it are told what keeps the SQF System working.\n\n"
 "The substitute holds the same responsibility and authority whenever the primary is absent. The duties "
 "of the post are set out in FSQM-004. This record confers the authority; it does not restate the job."
)

PRIMARY_QUAL = (
 "Answer each point for the person named as primary. PENDING IS AN HONEST ANSWER and is expected while "
 "training is outstanding - it is not a failure, and writing Met to avoid it would be.\n\n"
 "Point iii means a recognised external HACCP course with a certificate. File the certificate on FRM-952 "
 "Training Competency Verification Record and note the reference below. The internal TRN-005 training "
 "module is awareness training for the floor and is not a HACCP course."
)

SUBSTITUTE_QUAL = (
 "As Section 3, for the person named as substitute. The substitute must meet 2.1.1.5 in full, exactly as "
 "the primary does. It is the same qualification held in reserve, not a lesser one."
)


def qual_section(sid, title, prefix, info):
    return {"id": sid, "title": title, "fields": [
        {"id": prefix + "_info", "type": "info", "label": "How to answer", "text": info},
        {"id": prefix + "_employed", "type": "select", "width": "half", "required": True,
         "label": "i. Employed by the site", "options": LIMB_OPTS},
        {"id": prefix + "_position", "type": "select", "width": "half", "required": True,
         "label": "ii. Holds a position of responsibility for managing the SQF System",
         "options": LIMB_OPTS},
        {"id": prefix + "_haccp", "type": "select", "width": "half", "required": True,
         "label": "iii. Has completed a HACCP training course", "options": LIMB_OPTS},
        {"id": prefix + "_competent", "type": "select", "width": "half", "required": True,
         "label": "iv. Competent to implement and maintain HACCP-based food safety plans",
         "options": LIMB_OPTS},
        {"id": prefix + "_code", "type": "select", "width": "half", "required": True,
         "label": "v. Understands the SQF Food Safety Code: Food Manufacturing as it applies here",
         "options": LIMB_OPTS},
        {"id": prefix + "_haccp_detail", "type": "text",
         "label": "HACCP course",
         "help": "Course name, provider, date completed and FRM-952 reference - or, while pending, when it is booked."},
        {"id": prefix + "_notes", "type": "textarea",
         "label": "Evidence for points iv and v, and anything pending",
         "help": "What shows the competency: experience, the course, how understanding of the Code was confirmed."},
    ]}


FRM005 = {
 "settings": {
   "deletable": False,
   "attachmentsEnabled": True,
   # One open designation at a time per person. Stops a half-started entry being duplicated by a
   # second click; the next designation starts once this one is submitted.
   "allowMultipleDrafts": False,
   "requireVerification": True,
   "instanceTitleTemplate": "{effective_date} — {primary_name} / {substitute_name}",
 },
 "sections": [
  {"id": "designation", "title": "1. Designation", "fields": [
    {"id": "how_this_works", "type": "info", "label": "How this record works", "text": HOW},
    {"id": "effective_date", "type": "date", "width": "half", "required": True,
     "defaultToday": True, "showInList": True, "label": "Effective date"},
    {"id": "reason", "type": "select", "width": "half", "required": True, "label": "Reason",
     "options": ["First designation", "Change of primary SQF Practitioner",
                 "Change of substitute SQF Practitioner", "Annual confirmation - no change"]},
    {"id": "primary_name", "type": "text", "width": "half", "required": True, "showInList": True,
     "label": "Primary SQF Practitioner"},
    {"id": "primary_position", "type": "text", "width": "half", "required": True,
     "label": "Position held", "help": "The post in FSQM-004 this person holds."},
    {"id": "substitute_name", "type": "text", "width": "half", "required": True, "showInList": True,
     "label": "Substitute SQF Practitioner"},
    {"id": "substitute_position", "type": "text", "width": "half", "required": True,
     "label": "Position held", "help": "The post in FSQM-004 this person holds."},
  ]},
  {"id": "authority", "title": "2. Responsibility and authority (2.1.1.4)", "fields": [
    {"id": "authority_info", "type": "info", "label": "What is designated", "text": AUTHORITY},
    {"id": "informed", "type": "pass_fail", "width": "half", "required": True,
     "label": "Both designees have been told of this responsibility and authority"},
  ]},
  qual_section("primary_qual", "3. Primary SQF Practitioner - qualification (2.1.1.5)", "p", PRIMARY_QUAL),
  qual_section("substitute_qual", "4. Substitute SQF Practitioner - qualification (2.1.1.5)", "s", SUBSTITUTE_QUAL),
  {"id": "signatures", "title": "5. Signatures", "fields": [
    # Acknowledgements are NOT required. A staff login can edit only an entry it started, so a
    # staff substitute could never sign an entry the primary began - a required signature there
    # would be a rule the site cannot always follow. The designation itself IS required, and only
    # admin/owner can sign a verifier-role signature, so an entry cannot be submitted without it.
    {"id": "primary_ack", "type": "signature", "role": "filler", "width": "half",
     "label": "Primary SQF Practitioner - acknowledgement",
     "statement": "I accept the designation above and the responsibility and authority it carries."},
    {"id": "substitute_ack", "type": "signature", "role": "filler", "width": "half",
     "label": "Substitute SQF Practitioner - acknowledgement",
     "statement": "I accept the designation above and the responsibility and authority it carries."},
    {"id": "designated_by", "type": "signature", "role": "verifier", "width": "half", "required": True,
     "label": "Designated by Senior Site Management",
     "statement": "As senior site management, I designate the primary and substitute SQF Practitioner named above, with the responsibility and authority in Section 2."},
  ]},
 ],
}

N_FIELDS = sum(len(s["fields"]) for s in FRM005["sections"])
N_REQ_SELECTS = sum(1 for s in FRM005["sections"] for f in s["fields"]
                    if f["type"] == "select" and f.get("required") and f["id"][:2] in ("p_", "s_"))
blob = json.dumps(FRM005, ensure_ascii=False).lower()
bad = [n for n in NAMES if n in blob]
assert not bad, "the form schema names a person: %s" % bad
assert N_REQ_SELECTS == 10, N_REQ_SELECTS

SQL1 = """-- D-02 - FRM-005 SQF Practitioner Designation Record, seeded DRAFT.
--
-- WHAT 2.1.1.4 REQUIRES IS AN ACT, AND AN ACT NEEDS A RECORD. Senior site management designates a
-- primary and substitute SQF Practitioner. The gap assessment found the practitioner assigned by name
-- in FSQM-003 and no substitute at all. This form is where the designation is made and evidenced.
--
-- DOCUMENTS NAME POSITIONS; RECORDS NAME PEOPLE. The consultant's improvement note was to take
-- employee names out of documentation so that personnel changes do not force revisions, and FSQM-004
-- refuses by guard to name anyone. A designation is inherently about people, so the names live in this
-- form's ENTRIES - dated and signed - and never in its definition. The post-guard below refuses the
-- schema if it names a person, for the same reason FSQM-004's does. A change of personnel becomes a new
-- entry; the entries in order are the history of who held the authority, and when.
--
-- ONLY SENIOR SITE MANAGEMENT CAN SIGN THE DESIGNATION, and that is enforced rather than stated.
-- designated_by is a verifier-role signature, which SignatureFieldInput allows only for admin or owner,
-- and it is required - so an entry cannot be submitted until senior management has signed it.
--
-- THE ACKNOWLEDGEMENTS ARE DELIBERATELY NOT REQUIRED, and the reason is in the RLS rather than in the
-- Code. Response policy lets a staff login update only drafts it created; admin and owner can update
-- anything. So the primary starts the entry and signs, and senior management completes it. But if the
-- substitute were ever a second staff member, they could never sign an entry the primary began, and a
-- required acknowledgement would make that designation impossible to submit. A rule the site cannot
-- always follow is worse than a weaker one it can.
--
-- 2.1.1.5 IS ANSWERED LIMB BY LIMB, PER PERSON, WITH PENDING AS A FIRST-CLASS ANSWER. Neither
-- designee has yet completed a HACCP training course - both are to book one - so the first entry will
-- honestly read Pending on limb iii for both. The form says in terms that Pending is not a failure and
-- that writing Met to avoid it would be. Ten required selects rather than a grid: gridZod only enforces
-- a column's required on rows the filler started, so a grid would validate with a limb left blank.
--
-- THE CERTIFICATES ARE NOT FILED HERE. FRM-952 Training Competency Verification Record is already the
-- per-person competency record, and FRM-005 points at it. Two places to file one certificate would be
-- two accounts of one qualification - the reason FRM-008 was deleted before issue.

begin;

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents where sop_number = 'FRM-005')             as exists_005,
    (select status from public.sop_documents where sop_number = 'FRM-952')               as s952,
    (select count(*) from public.sop_documents where content::text like '%FRM-005%')     as cited
  into r;
  if r.exists_005 <> 0 then
    raise exception 'FRM-005 already exists.';
  end if;
  -- The form sends people to FRM-952 for the certificate; it must be there to send them to.
  if r.s952 is distinct from 'active' then
    raise exception 'FRM-952 is %, expected active - FRM-005 points at it for the HACCP certificate.', r.s952;
  end if;
  if r.cited <> 0 then
    raise exception '% document(s) already cite FRM-005; the number is not free.', r.cited;
  end if;
end $$;

insert into public.sop_documents
  (sop_number, title, type, category, status, revision, sqf_reference, sqf_required, content)
values (
  'FRM-005',
  'SQF Practitioner Designation Record',
  'form',
  'Module 2',
  'draft',
  'New',
  '2.1.1.4, 2.1.1.5',
  true,
  jsonb_build_object('form_schema', __SCHEMA__::jsonb)
);

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005')                                                    as fields,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005' and f->>'type' = 'signature' and f->>'role' = 'verifier'
        and coalesce((f->>'required')::boolean, false))                                  as req_verifier,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005' and f->>'type' = 'signature' and f->>'role' = 'filler'
        and not coalesce((f->>'required')::boolean, false))                              as optional_acks,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005' and f->>'type' = 'select'
        and f->>'id' ~ '^[ps]_' and coalesce((f->>'required')::boolean, false))           as limb_selects,
    (select content->'form_schema'->'settings'->>'deletable' from public.sop_documents
      where sop_number = 'FRM-005')                                                      as deletable,
    (select content->'form_schema'->'settings'->>'allowMultipleDrafts' from public.sop_documents
      where sop_number = 'FRM-005')                                                      as multi,
    (select count(*) from public.sop_documents
      where sop_number = 'FRM-005'
        and lower(content::text) ~ '(diana|gabriela|samboni|juncos|christina)')          as names,
    (select status from public.sop_documents where sop_number = 'FRM-005')               as st,
    (select count(*) from public.sop_documents
      where sop_number = 'FRM-005' and position(chr(13) in content::text) > 0)           as crs
  into r;

  if r.fields <> __FIELDS__ then
    raise exception 'FRM-005 has % fields, expected __FIELDS__.', r.fields;
  end if;
  -- 2.1.1.4 is senior management's act; this is the one field that makes the form enforce it.
  if r.req_verifier <> 1 then
    raise exception 'FRM-005 needs exactly one required verifier-role signature; found %.', r.req_verifier;
  end if;
  if r.optional_acks <> 2 then
    raise exception 'Expected two optional acknowledgement signatures; found %.', r.optional_acks;
  end if;
  -- Five limbs of 2.1.1.5, per person, every one answered.
  if r.limb_selects <> 10 then
    raise exception 'Expected 10 required 2.1.1.5 limb selects; found %.', r.limb_selects;
  end if;
  if r.deletable is distinct from 'false' or r.multi is distinct from 'false' then
    raise exception 'Settings wrong (deletable=%, allowMultipleDrafts=%).', r.deletable, r.multi;
  end if;
  if r.names <> 0 then
    raise exception 'The FRM-005 definition names a person. Entries may; the form may not.';
  end if;
  if r.st is distinct from 'draft' then
    raise exception 'FRM-005 should be draft; found %.', r.st;
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present in FRM-005.'; end if;
end $$;

commit;
"""
SQL1 = SQL1.replace("__SCHEMA__", dollar(FRM005, "j05")).replace("__FIELDS__", str(N_FIELDS))
io.open(OUT1, "w", encoding="utf-8", newline="\n").write(SQL1)
print("wrote %s  (%d fields)" % (OUT1, N_FIELDS))


# ══════════════════════════════════════════════════════════ FSQM-003 and FSQM-004

A003 = "The Managing Partner (Gabriela Juncos Mercer) has overall responsibility"
B003 = "Senior Site Management has overall responsibility"
C003 = "The SQF Practitioner is responsible for implementing"
D003 = ("The primary and substitute SQF Practitioner are designated by Senior Site Management, and the "
        "designation is recorded on FRM-005 SQF Practitioner Designation Record. "
        "The SQF Practitioner is responsible for implementing")

R004_OLD = ("The designation of the primary and substitute SQF Practitioner, and the evidence of their "
            "competency, are recorded separately under 2.1.1.4 and 2.1.1.5.")
R004_NEW = ("The designation of the primary and substitute SQF Practitioner is recorded on FRM-005 SQF "
            "Practitioner Designation Record under 2.1.1.4, and the evidence of their competency, "
            "including each holder's HACCP training certificate, on FRM-952 Training Competency "
            "Verification Record under 2.1.1.5.")
F004_ADD = "; FRM-005 SQF Practitioner Designation Record; FRM-952 Training Competency Verification Record"
P004_OLD = "is a designation this document cannot make."
P004_NEW = ("is a designation this document cannot make: senior site management makes it, and it is "
            "recorded on FRM-005.")

for s in (B003, D003, R004_NEW, F004_ADD, P004_NEW):
    assert not any(n in s.lower() for n in NAMES), s

SQL2 = """-- D-02 - FSQM-003 names a position instead of a person, and FSQM-004 says where the designation lives.
--
-- FSQM-003 WAS THE EVIDENCE THE CONSULTANT SCORED. Its Responsibility and Authority paragraph read
-- "The Managing Partner (Gabriela Juncos Mercer) has overall responsibility for maintaining and
-- improving the FSQMS". That names a person in a controlled document, which the gap assessment's
-- improvement note on 2.1.1.4 asked to remove, and once the primary SQF Practitioner is designated on
-- FRM-005 it would sit beside that designation saying something different. One sentence is reworded to
-- the position - Senior Site Management, the vocabulary FSQM-004 uses - and one sentence is added saying
-- where the designation is recorded. NOTHING ELSE IN FSQM-003 IS TOUCHED; the guard proves it by
-- rebuilding the expected statement from the old one and requiring an exact match.
--
-- FSQM-004 ALREADY KNEW THIS RECORD WOULD EXIST. Its Records section says the designation and the
-- competency evidence "are recorded separately under 2.1.1.4 and 2.1.1.5" - true, but it could not say
-- where, because neither record had a number. Now it names FRM-005 for the designation and FRM-952 for
-- the certificates, and the Part that explains why the substitute is not yet in force says who makes
-- that designation and where. Its conditional - "until that designation exists and its holder meets
-- 2.1.1.5" - is left exactly as it is, because it stays true until the entry is signed AND the HACCP
-- courses are completed, and neither has happened.
--
-- Both documents are drafts, so neither takes a revision bump and no history snapshot is written.

begin;

create temporary table _d02_before on commit drop as
select sop_number, status, content,
       md5((content - 'records' - 'form_references' - 'procedure' - 'statement')::text) as rest_hash
  from public.sop_documents
 where sop_number in ('FSQM-003', 'FSQM-004');

do $$
declare r record;
begin
  select
    (select status from _d02_before where sop_number = 'FSQM-003')                        as s003,
    (select status from _d02_before where sop_number = 'FSQM-004')                        as s004,
    (select (length(content->>'statement') - length(replace(content->>'statement', __A003__, '')))
            / length(__A003__) from _d02_before where sop_number = 'FSQM-003')          as n_a003,
    (select (length(content->>'statement') - length(replace(content->>'statement', __C003__, '')))
            / length(__C003__) from _d02_before where sop_number = 'FSQM-003')          as n_c003,
    (select (length(content->>'records') - length(replace(content->>'records', __R004_OLD__, '')))
            / length(__R004_OLD__) from _d02_before where sop_number = 'FSQM-004')      as n_r004,
    (select count(*) from _d02_before b, jsonb_array_elements_text(b.content->'procedure') l(line)
      where b.sop_number = 'FSQM-004' and position(__P004_OLD__ in l.line) > 0)            as n_p004,
    (select jsonb_array_length(content->'procedure') from _d02_before
      where sop_number = 'FSQM-004')                                                      as lines004,
    (select count(*) from _d02_before where content::text like '%FRM-005%')               as already
  into r;

  if r.s003 is distinct from 'draft' or r.s004 is distinct from 'draft' then
    raise exception 'Expected both drafts; found FSQM-003=%, FSQM-004=%.', r.s003, r.s004;
  end if;
  -- Each anchor exactly once, so every replace below touches exactly the intended place.
  if r.n_a003 <> 1 or r.n_c003 <> 1 then
    raise exception 'FSQM-003 anchors not found exactly once (managing partner=%, practitioner=%).',
      r.n_a003, r.n_c003;
  end if;
  if r.n_r004 <> 1 or r.n_p004 <> 1 then
    raise exception 'FSQM-004 anchors not found exactly once (records=%, procedure=%).', r.n_r004, r.n_p004;
  end if;
  if r.lines004 <> 32 then
    raise exception 'FSQM-004 is % procedure lines, expected 32.', r.lines004;
  end if;
  if r.already <> 0 then
    raise exception 'FRM-005 is already referenced; this has run before.';
  end if;
end $$;

update public.sop_documents d
   set content = jsonb_set(b.content, '{statement}',
         to_jsonb(replace(replace(b.content->>'statement', __A003__, __B003__), __C003__, __D003__)))
  from _d02_before b
 where d.sop_number = 'FSQM-003' and b.sop_number = 'FSQM-003';

update public.sop_documents d
   set content = jsonb_set(jsonb_set(jsonb_set(b.content,
         '{records}', to_jsonb(replace(b.content->>'records', __R004_OLD__, __R004_NEW__))),
         '{form_references}', to_jsonb((b.content->>'form_references') || __F004_ADD__)),
         '{procedure}', (select jsonb_agg(to_jsonb(replace(l.line, __P004_OLD__, __P004_NEW__)) order by l.ord)
                           from jsonb_array_elements_text(b.content->'procedure') with ordinality l(line, ord)))
  from _d02_before b
 where d.sop_number = 'FSQM-004' and b.sop_number = 'FSQM-004';

do $$
declare r record;
begin
  select
    -- FSQM-003: exactly the two substitutions and nothing else.
    (select count(*) from public.sop_documents d join _d02_before b using (sop_number)
      where d.sop_number = 'FSQM-003'
        and d.content->>'statement'
            = replace(replace(b.content->>'statement', __A003__, __B003__), __C003__, __D003__)) as exact003,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-003' and lower(content->>'statement') ~ '(gabriela|juncos|managing partner)') as names003,
    -- FSQM-004: only records, form_references and one procedure line moved.
    (select count(*) from public.sop_documents d join _d02_before b using (sop_number)
      where d.sop_number = 'FSQM-004'
        and md5((d.content - 'records' - 'form_references' - 'procedure' - 'statement')::text) = b.rest_hash) as rest004,
    (select count(*) from public.sop_documents d join _d02_before b using (sop_number)
      where d.sop_number = 'FSQM-003'
        and md5((d.content - 'records' - 'form_references' - 'procedure' - 'statement')::text) = b.rest_hash) as rest003,
    (select count(*) from
       (select l.ord, l.line from public.sop_documents d,
               jsonb_array_elements_text(d.content->'procedure') with ordinality l(line, ord)
         where d.sop_number = 'FSQM-004') n
       join
       (select l.ord, l.line from _d02_before b,
               jsonb_array_elements_text(b.content->'procedure') with ordinality l(line, ord)
         where b.sop_number = 'FSQM-004') o using (ord)
      where n.line <> o.line)                                                                 as changed_lines,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-004')                                                          as lines004,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-004'
        and content->>'records' like '%FRM-005%' and content->>'records' like '%FRM-952%'
        and content->>'form_references' like '%FRM-005 SQF Practitioner Designation Record%') as refs004,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-004' and lower(content::text) ~ '(diana|gabriela|samboni|juncos|christina)') as names004,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004') and status <> 'draft')                    as not_draft,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004') and position(chr(13) in content::text) > 0) as crs
  into r;

  if r.exact003 <> 1 then
    raise exception 'FSQM-003 statement is not exactly the two intended substitutions.';
  end if;
  if r.names003 <> 0 then
    raise exception 'FSQM-003 still names a person or the Managing Partner.';
  end if;
  if r.rest003 <> 1 or r.rest004 <> 1 then
    raise exception 'Other content keys moved (FSQM-003=%, FSQM-004=%).', r.rest003, r.rest004;
  end if;
  if r.changed_lines <> 1 or r.lines004 <> 32 then
    raise exception 'FSQM-004 procedure: % lines changed, % lines total; expected 1 and 32.',
      r.changed_lines, r.lines004;
  end if;
  if r.refs004 <> 1 then
    raise exception 'FSQM-004 does not name FRM-005 and FRM-952 where it should.';
  end if;
  -- FSQM-004's standing rule: it names positions, never people.
  if r.names004 <> 0 then
    raise exception 'FSQM-004 names a person.';
  end if;
  if r.not_draft <> 0 then
    raise exception 'A draft was issued by accident.';
  end if;
  if r.crs <> 0 then raise exception 'CR characters are present.'; end if;
end $$;

commit;
"""

subs = {"__A003__": A003, "__B003__": B003, "__C003__": C003, "__D003__": D003,
        "__R004_OLD__": R004_OLD, "__R004_NEW__": R004_NEW, "__F004_ADD__": F004_ADD,
        "__P004_OLD__": P004_OLD, "__P004_NEW__": P004_NEW}
tags = iter("t%d" % i for i in range(100))
# Every literal is dollar-quoted with its own tag, so apostrophes and dashes need no escaping.
for k, v in subs.items():
    SQL2 = SQL2.replace(k, dollar(v, next(tags)))
assert "__" not in re.sub(r"--[^\n]*", "", SQL2), "unreplaced placeholder"
io.open(OUT2, "w", encoding="utf-8", newline="\n").write(SQL2)
print("wrote %s" % OUT2)

io.open("sop-drafts/FRM-005-sqf-practitioner-designation-schema.json", "w",
        encoding="utf-8", newline="\n").write(json.dumps(FRM005, indent=2, ensure_ascii=False) + "\n")
print("wrote sop-drafts/FRM-005-sqf-practitioner-designation-schema.json")
