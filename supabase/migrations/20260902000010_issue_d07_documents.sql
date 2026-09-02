-- Issue the D-07 set: FSQM-009, FRM-007 and REP-007 go active, approved GJM. D-07.
--
-- ALL THREE IN ONE TRANSACTION, and that is the whole point of the migration rather than a
-- convenience. FSQM-009 requires every CAPA to be recorded on FRM-007 and reported on REP-007.
-- Activating the program while its record or its register were still draft would put an active
-- controlled document in the position FSQM-022 was in before task 13.4 - requiring a record that
-- is not available - which is the exact finding this wave exists to close. Either all three are
-- issued or none is.
--
-- THE OPEN LIST IS REWRITTEN, NOT LEFT SITTING IN AN ACTIVE DOCUMENT. FSQM-009's revision history
-- carried a heading "OPEN BEFORE ACTIVATION - five points only the site can settle". Once the
-- document is active that heading is telling a reader to settle things before something that has
-- already happened. Issuing the program as written ADOPTS the position each of items 1 to 4
-- states in the body: the retention period in Part 10, closure by the SQF Practitioner in Part 8,
-- the ten triggers in Part 3, and the verification arrangement in Part 7. The heading now says so.
--
-- The five items are KEPT, not deleted. The reasoning behind each - why a single closure signature
-- is a single point of failure on a team this size, why the trigger list was written from what an
-- auditor looks for rather than from watching the floor - is what an auditor will ask about, and
-- deleting it would leave the decisions looking arbitrary.
--
-- ITEM 5 STAYS GENUINELY OPEN and is called out separately rather than swept in with the rest.
-- FSQM-018 Non-Conforming Product and Equipment is an unapproved draft; that is a fact about
-- another document, not a decision this issue can make. FRM-702 is active and is the operative
-- record for holding and tagging non-conforming material until FSQM-018 is issued or withdrawn.
--
-- WHAT DOES NOT CHANGE. Revisions stay at New on all three - this is a first issue, not a
-- revision, the same as FSQM-012's issue under 20260901000015. Nothing is superseded and nothing
-- is archived: unlike FSQM-012, which absorbed SOP-11.3, this program replaces no existing
-- document. The four source forms it references (FRM-002, FRM-205, FRM-702, FRM-908) keep their
-- own records and are asserted still active below.
--
-- Only status, approved_by, effective_date and FSQM-009's revision_history are written.
-- content->'procedure', content->'form_schema' and content->'report_schema' are not in the write
-- path, and the assertions prove the bodies came through unchanged.

begin;

do $$
declare
  r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-009')            as s9,
    (select status from public.sop_documents where sop_number = 'FRM-007')             as s7,
    (select status from public.sop_documents where sop_number = 'REP-007')             as sr,
    (select revision from public.sop_documents where sop_number = 'FSQM-009')          as v9,
    (select revision from public.sop_documents where sop_number = 'FRM-007')           as v7,
    (select revision from public.sop_documents where sop_number = 'REP-007')           as vr,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-009')                        as lines,
    (select count(*) from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007')                                                  as fields,
    (select content->'report_schema'->>'sourceStatus'
       from public.sop_documents where sop_number = 'REP-007')                         as src_status,
    (select (content->>'revision_history') like '%OPEN BEFORE ACTIVATION%'
       from public.sop_documents where sop_number = 'FSQM-009')                        as open_head
  into r;

  if r.s9 is distinct from 'draft' or r.s7 is distinct from 'draft' or r.sr is distinct from 'draft' then
    raise exception 'Expected all three draft; found FSQM-009=%, FRM-007=%, REP-007=%.', r.s9, r.s7, r.sr;
  end if;
  if r.v9 <> 'New' or r.v7 <> 'New' or r.vr <> 'New' then
    raise exception 'Expected all three at revision New; found %, %, %.', r.v9, r.v7, r.vr;
  end if;
  -- the bodies must be the versions the follow-up migrations left behind
  if r.lines <> 79 then
    raise exception 'FSQM-009 has % procedure lines, expected the 79 left by 20260902000008.', r.lines;
  end if;
  if r.fields <> 54 then
    raise exception 'FRM-007 has % fields, expected 54.', r.fields;
  end if;
  if r.src_status is distinct from 'all' then
    raise exception 'REP-007 sourceStatus is % - open CAPAs would be invisible. Do not issue.',
      coalesce(r.src_status, 'unset');
  end if;
  if not r.open_head then
    raise exception 'FSQM-009 does not carry the OPEN BEFORE ACTIVATION heading this migration rewrites.';
  end if;
end $$;

-- FSQM-009: issue, and rewrite the open list in the same statement.
update public.sop_documents
   set content = jsonb_set(content, '{revision_history}', $jrh$"New — 2026-09-02 — Created under D-07 (CAPA Program + Investigation Form).\n\nWHY THIS DOCUMENT EXISTS. 2.5.3 Corrective and Preventative Action is a **Mandatory** element of the Code, and the site had no document against it. The gap assessment raised five Minor findings that this program and FRM-007 answer: 2.1.3.3 (no documented process for investigating and resolving complaints aligned to 2.5.3), 2.5.3.1 (no procedure stating the methods and responsibilities for corrective and preventive action), 2.5.3.2 (no records of investigation, root cause analysis and resolution), 2.5.4.4 (audit and inspection findings and their CAPAs not recorded per 2.5.3), and 2.6.3.3 (recall and withdrawal root cause investigations and their CAPAs not recorded).\n\nWHAT IT CLOSES, AND WHAT IT DOES NOT. The consultant's evidence against 2.5.4.4 reads that the site has not developed an Internal Audit Program, and against 2.6.3.3 that it has not developed a Product Recall and Withdrawal Program. **Those two programs are separate deliverables and this one does not claim them.** What this program closes is the records limb of each: that a finding from an audit or an inspection, and the root cause investigation into a withdrawal or recall, are raised, investigated, actioned, verified and retained through a documented CAPA process. When those two programs are written they will reference this one rather than restate it.\n\nIT ALSO CLOSES AN OPEN ITEM ON FSQM-022. That program was issued on 2026-09-01 stating: “the corrective-action half of this program has nowhere to live beyond FRM-913's own columns. D-07 (CAPA) is the object findings from any source should be raised into”. It now has one. FRM-913 gains a CAPA No. column in the same change, so an escalated inspection finding carries its number.\n\nTHE SITE WAS NOT STARTING FROM NOTHING, AND THIS PROGRAM SAYS SO. Four active fillable forms already capture root cause and corrective action for their own source: FRM-002 (complaints), FRM-205 (supplier SCAR), FRM-702 (non-conforming material hold) and FRM-908 (glass breakage, which has carried an unused CAR Ref field since it was written). What was missing was a governing procedure and a single register. Those forms are therefore kept and referenced, not replaced — a complaint needs the customer and the lot, a SCAR needs the supplier and the purchase order, and folding all of that into one universal form would have lost detail the sources need.\n\nESCALATION IS RISK-BASED BY DESIGN. Part 3 lists ten triggers that always open a CAPA and states that a routine on-the-spot correction stays on the form that found it. The alternative — a CAPA for every non-conformance — is simpler to audit but fills the register with trivia and hides the findings that matter, which for a site of this size would make the register useless within a quarter. 2.1.3.3 explicitly supports the risk-based reading: action is taken “based on the seriousness of the incident and the root cause analysis”.\n\nSETTLED AT ISSUE. The five points below were listed as open before activation. The program was reviewed and ISSUED AS WRITTEN by GJM on 2026-09-02, which adopts the position each of items 1 to 4 states in the body — the retention period in Part 10, closure by the SQF Practitioner in Part 8, the ten triggers in Part 3, and the verification arrangement in Part 7. Those are now the site's stated position and not open questions; they are kept here because the reasoning behind each is what an auditor will ask about. Item 5 is a dependency on another document and remains genuinely open.\n1. RETENTION PERIOD. Part 10 and Records state a minimum of two years, or shelf life plus twelve months where that is longer, and permanent retention for a recall-related CAPA. This is written to sit alongside FRM-908's two-year retention and FRM-903's twelve months. Confirm it, or state the period the site intends.\n2. WHO MAY CLOSE A CAPA. Part 8 gives closure to the SQF Practitioner alone. On a team this size that is a single point of failure, and a CAPA the practitioner owns as an action is one the practitioner then verifies and closes. Name a second person authorised to close, or confirm the single-signature arrangement deliberately.\n3. THE TEN TRIGGERS IN PART 3. They were written to catch what an auditor will look for, not from watching this floor. Read them against how the site actually runs: too low and the register fills with trivia, too high and a repeat finding reaches the auditor before it reaches the register.\n4. VERIFICATION INDEPENDENCE. Part 7 asks for verification by the SQF Practitioner or someone independent of the action owner. Where the practitioner is the action owner there is no independent verifier on site. Confirm the fallback — a second employee, or an accepted and stated limitation.\n5. FSQM-018 IS A DRAFT. The Scope points at it for the disposition of non-conforming product and says so plainly rather than implying an approved document exists. FRM-702 is active and is the operative record today. FSQM-018 should be issued or withdrawn.\n\nDELIVERED WITH THIS PROGRAM: FRM-007 (the report), REP-007 (the register), a CAPA Ref field on FRM-002 with the matching column on REP-003 — a gap the codebase had already documented and left open — and a CAPA No. column on each of FRM-913's eight Module 11 grids.\n\nEvery form, procedure and program named in this document was checked against the live register on 2026-09-02 and exists. FSQM-018 is named explicitly as a draft. Nothing here repeats the FSQM-022 mistake of requiring a record that was never built.\n\nISSUED 2026-09-02, approved GJM. Status active, revision New. FRM-007 (the record) and REP-007 (the register) are activated in the SAME TRANSACTION, so this program is never active without the form it requires or the register it reports from — the same sequencing that kept the site from ever being without a personnel hygiene document when FSQM-012 superseded SOP-11.3.\n\nSTILL OPEN AFTER ISSUE: FSQM-018 Non-Conforming Product and Equipment remains an unapproved draft. The Scope names it as a draft rather than implying otherwise. FRM-702 is active and is the operative record for holding and tagging non-conforming material until FSQM-018 is issued or withdrawn."$jrh$::jsonb),
       status = 'active',
       approved_by = 'GJM',
       effective_date = date '2026-09-02'
 where sop_number = 'FSQM-009' and status = 'draft' and revision = 'New';

update public.sop_documents
   set status = 'active', approved_by = 'GJM', effective_date = date '2026-09-02'
 where sop_number in ('FRM-007','REP-007') and status = 'draft' and revision = 'New';

do $$
declare
  r record;
begin
  select
    (select count(*) from public.sop_documents
      where sop_number in ('FSQM-009','FRM-007','REP-007')
        and status = 'active' and approved_by = 'GJM'
        and effective_date = date '2026-09-02' and revision = 'New')                   as issued,
    (select jsonb_array_length(content->'procedure')
       from public.sop_documents where sop_number = 'FSQM-009')                        as lines,
    (select count(*) from public.sop_documents d,
           jsonb_array_elements_text(d.content->'procedure') s
      where d.sop_number = 'FSQM-009' and s not like '• %' and s not like '> %')       as parts,
    (select count(*) from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007')                                                  as fields,
    (select jsonb_array_length(content->'report_schema'->'columns')
       from public.sop_documents where sop_number = 'REP-007')                         as cols,
    (select (content->>'revision_history') like '%OPEN BEFORE ACTIVATION%'
       from public.sop_documents where sop_number = 'FSQM-009')                        as stale_head,
    (select (content->>'revision_history') like '%SETTLED AT ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-009')                        as settled,
    (select (content->>'revision_history') like '%ISSUED 2026-09-02, approved GJM%'
       from public.sop_documents where sop_number = 'FSQM-009')                        as issue_note,
    (select (content->>'revision_history') like '%STILL OPEN AFTER ISSUE%'
       from public.sop_documents where sop_number = 'FSQM-009')                        as still_open,
    -- the reasoning behind the five items must survive; deleting it would leave the
    -- decisions looking arbitrary
    (select (content->>'revision_history') like '%WHO MAY CLOSE A CAPA%'
       from public.sop_documents where sop_number = 'FSQM-009')                        as items_kept,
    -- nothing is superseded by this issue, and the sources must still be active
    (select count(*) from public.sop_documents
      where sop_number in ('FRM-002','FRM-205','FRM-702','FRM-908','FRM-913','REP-003')
        and status <> 'active')                                                        as sources_down,
    (select count(*) from public.sop_documents where status = 'archived'
       and sop_number in ('FSQM-009','FRM-007','REP-007'))                             as wrongly_archived
  into r;

  if r.issued <> 3 then
    raise exception 'Only % of the three documents issued as active/GJM/2026-09-02/New.', r.issued;
  end if;
  -- the bodies must be untouched by an issue
  if r.lines <> 79 or r.parts <> 10 then
    raise exception 'FSQM-009 body changed during issue: % lines, % Parts.', r.lines, r.parts;
  end if;
  if r.fields <> 54 then
    raise exception 'FRM-007 field count changed during issue: %.', r.fields;
  end if;
  if r.cols <> 12 then
    raise exception 'REP-007 column count changed during issue: %.', r.cols;
  end if;
  if r.stale_head then
    raise exception 'FSQM-009 is active but still says OPEN BEFORE ACTIVATION.';
  end if;
  if not (r.settled and r.issue_note and r.still_open and r.items_kept) then
    raise exception 'Revision history wrong: settled=%, issue note=%, still-open item=%, reasoning kept=%.',
      r.settled, r.issue_note, r.still_open, r.items_kept;
  end if;
  if r.sources_down <> 0 then
    raise exception '% of the documents FSQM-009 depends on are no longer active.', r.sources_down;
  end if;
  if r.wrongly_archived <> 0 then
    raise exception '% of the issued documents were archived.', r.wrongly_archived;
  end if;
end $$;

commit;
