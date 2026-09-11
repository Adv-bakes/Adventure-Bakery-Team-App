# -*- coding: utf-8 -*-
"""Issue FSQM-003, FSQM-004 and FRM-005: active, approved GJM, effective 2026-09-11.

FSQM-004 carries an OPEN BEFORE ISSUE block of three items. It is removed and a SETTLED AT ISSUE
block appended at the end of the revision history, after the 2026-09-10 amendments, so the history
stays in date order. The other two documents carry no revision history (a policy statement and a
form schema), so only their row columns are stamped.

APPROVAL STAYS WITH SENIOR SITE MANAGEMENT. The draft of FSQM-004 gave the approval of controlled
documents to the SQF Practitioner. The owner reversed that at issue on 2026-09-11, so the two job
descriptions that carry it - procedure[10] Senior Site Management and procedure[11] SQF Practitioner -
are replaced whole here, each guarded on its exact prior text, and every other procedure line is
fingerprinted unchanged.

The settled paragraphs and replacement lines are emitted as single-line dollar-quoted literals,
never as one literal spanning lines: a CRLF checkout would otherwise put carriage returns into
production.

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

# FSQM-004 procedure, 0-based jsonb indexes.
L10_OLD = (
    "• Senior Site Management — owns the food safety policy and the resources behind it; designates the "
    "primary and substitute SQF Practitioner; ensures the site is appropriately staffed; is notified where "
    "an inspection failure stops production or shipment. Records: the policy statement and the management "
    "review. Covered by the SQF Practitioner for day-to-day decisions only — the power to designate is not "
    "delegable."
)
L10_NEW = (
    "• Senior Site Management — owns the food safety policy and the resources behind it; designates the "
    "primary and substitute SQF Practitioner; approves controlled documents and their revisions; ensures "
    "the site is appropriately staffed; is notified where an inspection failure stops production or "
    "shipment. Records: the policy statement, the management review and document approvals. Covered by the "
    "SQF Practitioner for day-to-day decisions only — the power to designate and the approval of controlled "
    "documents are not delegable."
)
L11_OLD = (
    "• SQF Practitioner — develops, implements, reviews and maintains the SQF System; approves controlled "
    "documents and their revisions; decides finished product release under FSQM-020 and signs the "
    "pre-operational release of the line; owns corrective and preventive action under FSQM-009; sets the "
    "inspection criteria and reviews the inspection records under FSQM-014; confirms at least annually that "
    "the documented programmes are what the floor performs. Records: FRM-701, FRM-007, FRM-903 and document "
    "approvals. Covered by the substitute SQF Practitioner."
)
L11_NEW = (
    "• SQF Practitioner — develops, implements, reviews and maintains the SQF System; prepares and reviews "
    "controlled documents and their revisions and submits them to Senior Site Management for approval; "
    "decides finished product release under FSQM-020 and signs the pre-operational release of the line; "
    "owns corrective and preventive action under FSQM-009; sets the inspection criteria and reviews the "
    "inspection records under FSQM-014; confirms at least annually that the documented programmes are what "
    "the floor performs. Records: FRM-701, FRM-007 and FRM-903. Covered by the substitute SQF Practitioner."
)

SETTLED = [
    "SETTLED AT ISSUE — 2026-09-11:",

    "1. WHO APPROVES CONTROLLED DOCUMENTS. Senior Site Management: this document, and every controlled "
    "document and revision after it. The draft gave that approval to the SQF Practitioner, as a change from "
    "the arrangement under which every document to date had been approved. The change was reversed at "
    "issue, and the two job descriptions in the procedure were amended to match: Senior Site Management "
    "approves controlled documents and their revisions, and that approval is not delegable; the SQF "
    "Practitioner prepares and reviews them and submits them for approval. The Code requires documents to be "
    "approved by someone authorised to approve them and leaves it to the site to say who that is. The "
    "arrangement also keeps the appointee from approving their own appointment, which this document, "
    "FSQM-003 and FRM-005 each record.",

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

for p in SETTLED + [L10_OLD, L10_NEW, L11_OLD, L11_NEW]:
    assert "\n" not in p and "\r" not in p and "$st$" not in p and "$ln$" not in p, p
for p in SETTLED + [L10_NEW, L11_NEW]:
    assert not any(n in p.lower() for n in NAMES), p
assert "approves controlled documents" not in L11_NEW
assert "approves controlled documents" in L10_NEW


def ln(s):
    return "$ln$%s$ln$" % s


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
-- WHO APPROVES, AND A REVERSAL AT ISSUE. The draft of FSQM-004 gave the approval of controlled
-- documents to the SQF Practitioner, from that document forward. On 2026-09-11, at issue, the owner
-- kept approval with Senior Site Management instead - it is who has approved 96 of the active
-- documents, and the Code only asks that the approver be authorised and that the site say who. So the
-- two job descriptions carrying it are amended here: Senior Site Management approves controlled
-- documents and their revisions, not delegably; the SQF Practitioner prepares and reviews them. Each
-- line is replaced whole and guarded on its exact prior text; every other line is fingerprinted.
--
-- KNOWN AND NOT FIXED HERE: SOP-2.2.3 Document Control, which is active, still says "The Quality
-- Leader is responsible for preparing, approving, and controlling all documents and records", and
-- Quality Leader is the site's shorthand for the SQF Practitioner. It contradicts FSQM-004 as issued
-- and needs its own revision; an active document is not quietly edited from another's issue migration.
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

begin;

create temporary table _issue_before on commit drop as
  select sop_number,
         md5(content::text)                                              as whole,
         md5((content - 'revision_history' - 'procedure')::text)         as body,
         md5((((content->'procedure') - 11) - 10)::text)                  as proc_rest
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
    (select content->'procedure'->>10 from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as l10,
    (select content->'procedure'->>11 from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as l11,
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
  -- The two job descriptions are replaced whole, so they must be exactly what was reviewed.
  if r.l10 is distinct from __L10_OLD__ then
    raise exception 'FSQM-004 procedure[10] is not the reviewed Senior Site Management line.';
  end if;
  if r.l11 is distinct from __L11_OLD__ then
    raise exception 'FSQM-004 procedure[11] is not the reviewed SQF Practitioner line.';
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

-- FSQM-004: approval of controlled documents moves from the SQF Practitioner's job description to
-- Senior Site Management's.
update public.sop_documents
   set content = jsonb_set(
                   jsonb_set(content, '{procedure,10}', to_jsonb(__L10_NEW__::text)),
                   '{procedure,11}', to_jsonb(__L11_NEW__::text))
 where sop_number = 'FSQM-004';

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
        and (md5((d.content - 'revision_history' - 'procedure')::text) <> b.body
             or md5((((d.content->'procedure') - 11) - 10)::text) <> b.proc_rest))  as moved_body,
    (select jsonb_array_length(content->'procedure') from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as lines,
    (select content->'procedure'->>10 from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as l10,
    (select content->'procedure'->>11 from public.sop_documents
      where sop_number = 'FSQM-004')                                                  as l11,
    (select count(*) from public.sop_documents d, jsonb_array_elements_text(d.content->'procedure') p
      where d.sop_number = 'FSQM-004'
        and p like '%approves controlled documents%')                                 as approver_lines,
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
    raise exception 'Issuing changed content it should not have (FSQM-003/FRM-005=%, FSQM-004=%).', r.moved_whole, r.moved_body;
  end if;
  if r.lines <> 32 then
    raise exception 'FSQM-004 is % procedure lines after issue, expected 32.', r.lines;
  end if;
  if r.l10 is distinct from __L10_NEW__ or r.l11 is distinct from __L11_NEW__ then
    raise exception 'FSQM-004 job descriptions were not replaced as reviewed.';
  end if;
  -- Exactly one position approves controlled documents, and it is Senior Site Management.
  if r.approver_lines <> 1 or r.l10 not like '%approves controlled documents%' then
    raise exception 'FSQM-004 names % approver line(s); expected Senior Site Management alone.', r.approver_lines;
  end if;
  if r.rh not like '%__ISSUED__%' or r.rh like '%Not approved, not in force%' then
    raise exception 'FSQM-004 issue stamp is wrong.';
  end if;
  if position('OPEN BEFORE ISSUE' in r.rh) > 0 then
    raise exception 'FSQM-004 still carries the open block.';
  end if;
  -- The cut removes the draft's "the SQF Practitioner approves controlled documents"; nothing may keep it.
  if position('SQF Practitioner approves controlled documents' in r.rh) > 0 then
    raise exception 'FSQM-004 revision history still gives approval to the SQF Practitioner.';
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
     or r.rh not like '%1. WHO APPROVES CONTROLLED DOCUMENTS. Senior Site Management%'
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
          .replace("__L10_OLD__", ln(L10_OLD))
          .replace("__L10_NEW__", ln(L10_NEW))
          .replace("__L11_OLD__", ln(L11_OLD))
          .replace("__L11_NEW__", ln(L11_NEW))
          .replace("__NAMES__", names_re))
assert "__" not in SQL.replace("_issue_before", "")
io.open(OUT, "w", encoding="utf-8", newline="\n").write(SQL)
print("wrote %s" % OUT)
