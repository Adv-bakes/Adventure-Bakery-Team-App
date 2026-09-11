# -*- coding: utf-8 -*-
"""Issue FSQM-003, FSQM-004 and FRM-005: active, approved GJM, effective 2026-09-11.

FSQM-004 carries an OPEN BEFORE ISSUE block of three items. It is removed and a SETTLED AT ISSUE
block appended at the end of the revision history, after the 2026-09-10 amendments, so the history
stays in date order. The other two documents carry no revision history (a policy statement and a
form schema), so only their row columns are stamped.

The settled paragraphs are emitted as single-line dollar-quoted literals joined with chr(10), never
as one literal spanning lines: a CRLF checkout would otherwise put carriage returns into production.

Refuses to overwrite the migration file.

Usage:  python scripts/build-issue-d02.py
"""
import io, os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = "supabase/migrations/20260911000003_issue_fsqm003_fsqm004_frm005.sql"
if os.path.exists(OUT):
    raise SystemExit("%s already exists - refusing to overwrite an applied migration." % OUT)

NAMES = ("diana", "gabriela", "samboni", "juncos", "christina")
ISSUED = "ISSUED 2026-09-11, approved GJM (Senior Site Management), effective 2026-09-11."

SETTLED = [
    "SETTLED AT ISSUE — 2026-09-11:",

    "1. WHO APPROVES. Senior Site Management, GJM. This document gives the approval of controlled "
    "documents to the SQF Practitioner, and is itself the exception to that rule: it records that "
    "Senior Site Management designates the SQF Practitioner, and a document that appoints somebody is "
    "not approved by the appointee. FSQM-003 and FRM-005, which carry the same designation, were issued "
    "with it on the same approval for the same reason. From this date other controlled documents and "
    "their revisions are approved by the SQF Practitioner, as that position's job description states.",

    "2. THE COVER FOR THE SQF PRACTITIONER IS STATED BUT NOT YET IN FORCE. FRM-005 is issued alongside "
    "this document, but no designation has yet been signed on it, and neither holder has yet completed "
    "the HACCP training course that 2.1.1.5 requires specifically. Internal HACCP awareness training does "
    "not satisfy it, and a practitioner course satisfies it only if it includes a recognised HACCP "
    "module. The procedure already says so where it names the cover. The designation is in force when "
    "Senior Site Management signs and submits the first FRM-005 entry; the holders' qualification is met "
    "when both HACCP certificates are filed on FRM-952. This is an open action, not a standing limitation.",

    "3. THE CONTRACT SERVICES REGISTER DOES NOT YET EXIST, AND THAT DID NOT HOLD UP ISSUE. This document "
    "names the register rather than any provider, so the boundary it records between simple maintenance "
    "performed in-house and chronic or specialist work that is contracted is in force from this date. "
    "The reference is completed when the register is issued; until then no contracted provider is listed "
    "under document control.",

    "WHAT THIS CLOSES. 2.1.1.3 is in force from this date: the reporting structure, the job descriptions "
    "of key personnel, and the cover for each key position, with the exceptions set out in 2 and 3 above. "
    "FSQM-017 and FSQM-036, both already active, cite this document; until this date they cited a draft.",
]

for p in SETTLED:
    assert "\n" not in p and "\r" not in p and "$st$" not in p, p
    assert not any(n in p.lower() for n in NAMES), p

settled_sql = "\n        || chr(10) || chr(10) || ".join("$st$%s$st$" % p for p in SETTLED)
names_re = "|".join(NAMES)

SQL = """-- D-01 / D-02 - issue FSQM-003, FSQM-004 and FRM-005. Active, GJM, effective 2026-09-11.
--
-- WHY THESE THREE GO TOGETHER. FSQM-003 says Senior Site Management designates the primary and
-- substitute SQF Practitioner and that the designation is recorded on FRM-005; FSQM-004 is the
-- organizational structure that names the position and its cover and points at FRM-005 and FRM-952.
-- Issuing any one without the others would put an in-force document in the position of pointing at
-- a draft - the state FSQM-017 and FSQM-036 have been in with respect to FSQM-004 since they issued.
--
-- WHY GJM, AND NOT THE SQF PRACTITIONER. FSQM-004 gives document approval to the SQF Practitioner.
-- These three are the exception, because each records that Senior Site Management designates the
-- SQF Practitioner, and an appointment is not approved by the appointee. That was item 1 of
-- FSQM-004's OPEN BEFORE ISSUE block, and it is settled in its revision history here. Documents
-- issued after this one are the SQF Practitioner's to approve.
--
-- FSQM-003's EFFECTIVE DATE CHANGES FROM 2025-10-28 TO 2026-09-11. 2025-10-28 and the GJM approval
-- were carried over from the paper original when it was imported on 2026-06-08, and the row was never
-- active in the app. The text being approved today is not the text that date belonged to: the paper
-- original named an individual as holding overall responsibility and said nothing about where the
-- designation is recorded. Recorded here so the earlier date is not silently lost. The policy has no
-- revision history section to carry it.
--
-- WHAT THIS DOES NOT CLOSE. D-02 stays open. 2.1.1.4 is met when the first FRM-005 entry is signed
-- by Senior Site Management and submitted; 2.1.1.5 when both holders' HACCP course certificates are
-- on FRM-952. Neither holder has completed one. FSQM-004's revision history now says so in terms.
--
-- Content is not edited, apart from FSQM-004's revision history: every other key of all three
-- documents is fingerprinted before and compared after.

begin;

create temporary table _issue_before on commit drop as
  select sop_number,
         md5(content::text)                              as whole,
         md5((content - 'revision_history')::text)       as body
    from public.sop_documents
   where sop_number in ('FSQM-003', 'FSQM-004', 'FRM-005');

do $$
declare r record;
begin
  select
    (select count(*) from _issue_before)                                              as n,
    (select status from public.sop_documents where sop_number = 'FSQM-003')           as s003,
    (select approved_by from public.sop_documents where sop_number = 'FSQM-003')      as a003,
    (select effective_date from public.sop_documents where sop_number = 'FSQM-003')   as e003,
    (select status from public.sop_documents where sop_number = 'FSQM-004')           as s004,
    (select status from public.sop_documents where sop_number = 'FRM-005')            as s005,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-004', 'FRM-005')
        and (approved_by is not null or effective_date is not null))                  as stamped,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004', 'FRM-005')
        and revision is distinct from 'New')                                          as not_new,
    (select count(*) from public.sop_documents
      where sop_number = 'FSQM-003'
        and content->>'statement' like '%Senior Site Management has overall responsibility%'
        and content->>'statement' like '%recorded on FRM-005 SQF Practitioner Designation Record%'
        and content->>'statement' not like '%Managing Partner%')                      as fsqm003_reworded,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as lines,
    (select content->>'revision_history' from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as rh,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-005')                                                 as fields,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004', 'FRM-005')
        and lower(content::text) ~ '__NAMES__')                                       as named
  into r;

  if r.n <> 3 then
    raise exception 'Expected 3 documents, found %.', r.n;
  end if;
  if r.s003 is distinct from 'draft' or r.s004 is distinct from 'draft' or r.s005 is distinct from 'draft' then
    raise exception 'Expected all draft; FSQM-003=%, FSQM-004=%, FRM-005=%.', r.s003, r.s004, r.s005;
  end if;
  -- FSQM-003 arrived with the paper original's stamp; anything else means someone has touched it.
  if r.a003 is distinct from 'GJM' or r.e003 is distinct from date '2025-10-28' then
    raise exception 'FSQM-003 stamp is %/%, expected the imported GJM/2025-10-28.', r.a003, r.e003;
  end if;
  if r.stamped <> 0 then
    raise exception 'FSQM-004 or FRM-005 already carries an approval or effective date.';
  end if;
  if r.not_new <> 0 then
    raise exception '% document(s) are not at revision New.', r.not_new;
  end if;
  if r.fsqm003_reworded <> 1 then
    raise exception 'FSQM-003 does not carry the 20260911000002 wording; apply it first.';
  end if;
  if r.lines <> 32 then
    raise exception 'FSQM-004 is % procedure lines, expected 32.', r.lines;
  end if;
  if r.fields <> 28 then
    raise exception 'FRM-005 has % fields, expected 28; apply 20260911000001 first.', r.fields;
  end if;
  if r.named <> 0 then
    raise exception '% document(s) name an individual; a controlled document must not.', r.named;
  end if;

  -- The revision-history surgery depends on exactly this shape.
  if (length(r.rh) - length(replace(r.rh, 'OPEN BEFORE ISSUE', ''))) / length('OPEN BEFORE ISSUE') <> 1 then
    raise exception 'FSQM-004 must contain OPEN BEFORE ISSUE exactly once.';
  end if;
  if (length(r.rh) - length(replace(r.rh, 'AMENDED 2026-09-10, BEFORE ISSUE', ''))) / length('AMENDED 2026-09-10, BEFORE ISSUE') <> 1 then
    raise exception 'FSQM-004 must contain AMENDED 2026-09-10, BEFORE ISSUE exactly once.';
  end if;
  if position('AMENDED 2026-09-10, BEFORE ISSUE' in r.rh) < position('OPEN BEFORE ISSUE' in r.rh) then
    raise exception 'FSQM-004 amendment precedes the open block; the cut would remove it.';
  end if;
  if (length(r.rh) - length(replace(r.rh, 'DRAFT. Not approved, not in force.', ''))) / length('DRAFT. Not approved, not in force.') <> 1 then
    raise exception 'FSQM-004 draft stamp is not present exactly once.';
  end if;
  if position('SETTLED AT ISSUE' in r.rh) > 0 then
    raise exception 'FSQM-004 already carries a SETTLED AT ISSUE block.';
  end if;
end $$;

-- FSQM-004: drop the open block (its three items are restated as settled), keep the amendments,
-- append the settled block last so the history reads in date order.
update public.sop_documents
   set content = jsonb_set(content, '{revision_history}', to_jsonb(
         replace(
           left(content->>'revision_history',
                position('OPEN BEFORE ISSUE' in content->>'revision_history') - 1),
           'DRAFT. Not approved, not in force.',
           $iss$__ISSUED__$iss$)
        || substr(content->>'revision_history',
                  position('AMENDED 2026-09-10, BEFORE ISSUE' in content->>'revision_history'))
        || chr(10) || chr(10)
        || __SETTLED__))
 where sop_number = 'FSQM-004';

update public.sop_documents
   set status         = 'active',
       approved_by    = 'GJM',
       effective_date = '2026-09-11',
       revision       = 'New'
 where sop_number in ('FSQM-003', 'FSQM-004', 'FRM-005');

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004', 'FRM-005')
        and status = 'active' and approved_by = 'GJM'
        and effective_date = date '2026-09-11' and revision = 'New')                  as issued,
    (select count(*) from public.sop_documents d join _issue_before b using (sop_number)
      where d.sop_number in ('FSQM-003', 'FRM-005') and md5(d.content::text) <> b.whole) as moved_whole,
    (select count(*) from public.sop_documents d join _issue_before b using (sop_number)
      where d.sop_number = 'FSQM-004'
        and md5((d.content - 'revision_history')::text) <> b.body)                    as moved_body,
    (select content->>'revision_history' from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as rh,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004', 'FRM-005')
        and lower(content::text) ~ '__NAMES__')                                       as named,
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-003', 'FSQM-004', 'FRM-005')
        and position(chr(13) in content::text) > 0)                                   as crs
  into r;

  if r.issued <> 3 then
    raise exception 'Expected 3 documents issued; found %.', r.issued;
  end if;
  if r.moved_whole <> 0 or r.moved_body <> 0 then
    raise exception 'Issuing changed document content (FSQM-003/FRM-005=%, FSQM-004 body=%).', r.moved_whole, r.moved_body;
  end if;
  if r.rh not like '%__ISSUED__%' or r.rh like '%Not approved, not in force%' then
    raise exception 'FSQM-004 issue stamp is wrong.';
  end if;
  if position('OPEN BEFORE ISSUE' in r.rh) > 0 then
    raise exception 'FSQM-004 still carries the open block.';
  end if;
  -- What came before and after the open block must both have survived the cut.
  if r.rh not like 'Rev New %' or r.rh not like '%WHY IT EXISTS.%'
     or r.rh not like '%THE REMEDIATION PLAN''S CLAUSE MAPPING IS WRONG.%'
     or r.rh not like '%AMENDED 2026-09-10, BEFORE ISSUE%'
     or r.rh not like '%A PHOTOGRAPH WAS PROPOSED WITH THAT AMENDMENT%' then
    raise exception 'FSQM-004 revision history lost text around the open block.';
  end if;
  -- The last amendment paragraph ends "...unmet either way."; the settled block must follow it directly.
  if r.rh not like ('%is unmet either way.' || chr(10) || chr(10) || 'SETTLED AT ISSUE — 2026-09-11:%')
     or r.rh not like '%1. WHO APPROVES.%'
     or r.rh not like '%2. THE COVER FOR THE SQF PRACTITIONER%'
     or r.rh not like '%3. THE CONTRACT SERVICES REGISTER%'
     or r.rh not like '%WHAT THIS CLOSES. 2.1.1.3 is in force%cited a draft.' then
    raise exception 'FSQM-004 settled block is missing or misplaced.';
  end if;
  if r.named <> 0 then
    raise exception '% document(s) name an individual after issue.', r.named;
  end if;
  if r.crs <> 0 then
    raise exception 'CR characters are present in an issued document.';
  end if;
end $$;

commit;
"""

SQL = (SQL.replace("__SETTLED__", settled_sql)
          .replace("__ISSUED__", ISSUED)
          .replace("__NAMES__", names_re))
assert "__" not in SQL.replace("_issue_before", "")
io.open(OUT, "w", encoding="utf-8", newline="\n").write(SQL)
print("wrote %s" % OUT)
