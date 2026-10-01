-- FSQM-012 v3: the visitor acknowledgement is signed on the first visit, not at every visit.
--
-- Part 6 as issued says every visitor shall "read and acknowledge the site's food safety and
-- hygiene rules on FRM-906 before entry". Read literally that is every entry, and that is how the
-- forms were built: a regular contractor re-read ten rules and re-signed them each time they came.
-- 11.3.4.1 asks that a visitor is TRAINED before entering, or escorted. Training that was given and
-- signed for last month has been given. Re-reading it weekly adds a queue at the door and no control.
--
-- What changes (two lines of Part 6, nothing else):
--   - The FRM-906 acknowledgement is completed on the first visit and renewed every twelve months
--     and whenever FRM-906 is revised. The health declaration - which IS about today - is made on
--     FRM-905 at every visit.
--   - Retention: an acknowledgement signed in January is what lets a visitor in the following
--     December, so it has to outlive "twelve months from signing". It is kept for twelve months
--     after the last visit that relied on it.
--
-- The forms that implement this are FRM-905 v3 and FRM-906 v3 (20261001000002), and each FRM-905
-- entry records the FRM-906 acknowledgement it relied on.
--
-- Guarded on FSQM-012 being active at v2 with the 93-line, 10-Part body, and on each old line
-- being present exactly once, so this cannot land on a body it was not written against.

begin;

do $$
declare
  r record;
begin
  select status, revision,
         jsonb_array_length(content->'procedure') as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') e
           where e = $old1$• **Read and acknowledge the site's food safety and hygiene rules on FRM-906** (Visitor GMP Acknowledgement) before entry. A visitor who has completed the FRM-906 briefing satisfies the training requirement of 11.3.4.1; **any visitor who has not shall be escorted at all times** by an authorized employee.$old1$) as old1,
         (select count(*) from jsonb_array_elements_text(content->'procedure') e
           where e = $old2$• Completed visitor records are retained by QA for a minimum of **twelve months**.$old2$) as old2
    into r
    from public.sop_documents where sop_number = 'FSQM-012';

  if r.status is distinct from 'active' or r.revision is distinct from 'v2' then
    raise exception 'Expected FSQM-012 active at v2; found % / %. Re-derive before applying.', r.status, r.revision;
  end if;
  if r.lines <> 93 then
    raise exception 'FSQM-012 has % procedure lines, expected 93. Re-derive before applying.', r.lines;
  end if;
  if r.old1 <> 1 or r.old2 <> 1 then
    raise exception 'Part 6 does not read as expected: acknowledgement line x%, retention line x% (expected 1 each).', r.old1, r.old2;
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{procedure}',
           (select jsonb_agg(
                     case
                       when e = $old1$• **Read and acknowledge the site's food safety and hygiene rules on FRM-906** (Visitor GMP Acknowledgement) before entry. A visitor who has completed the FRM-906 briefing satisfies the training requirement of 11.3.4.1; **any visitor who has not shall be escorted at all times** by an authorized employee.$old1$
                         then $new1$• **Read and acknowledge the site's food safety and hygiene rules on FRM-906** (Visitor GMP Acknowledgement) on the first visit. The acknowledgement is **renewed every twelve months and whenever FRM-906 is revised**, and a health declaration is made on **FRM-905 at every visit**. A visitor holding a valid FRM-906 acknowledgement satisfies the training requirement of 11.3.4.1; **any visitor who does not shall be escorted at all times** by an authorized employee.$new1$
                       when e = $old2$• Completed visitor records are retained by QA for a minimum of **twelve months**.$old2$
                         then $new2$• Completed visitor records are retained by QA for a minimum of **twelve months**. An FRM-906 acknowledgement is retained for twelve months after the last visit that relied on it.$new2$
                       else e
                     end order by ord)
              from jsonb_array_elements_text(content->'procedure') with ordinality as t(e, ord))),
         '{revision_history}',
         to_jsonb(coalesce(content->>'revision_history', '') || $jrh$


v3, 2026-10-01 — VISITOR ACKNOWLEDGEMENT SIGNED ONCE, NOT AT EVERY VISIT. Part 6 required every visitor to read and acknowledge the rules on FRM-906 before entry, which in practice meant at every entry. 11.3.4.1 requires that a visitor is trained before entering or is escorted; a briefing given and signed for remains given. The acknowledgement is now completed on the first visit and renewed every twelve months and whenever FRM-906 is revised. The health declaration, which concerns the day of the visit, is made on FRM-905 at every visit, and each FRM-905 entry records the acknowledgement it relied on. Retention is extended so that an acknowledgement is kept for twelve months after the last visit that relied on it. The visitor's signature on both forms is now the visitor's own, drawn on the device, with the host recorded as witness.
$jrh$)),
       revision = 'v3',
       effective_date = date '2026-10-01'
 where sop_number = 'FSQM-012'
   and status = 'active'
   and revision = 'v2';

do $$
declare
  r record;
begin
  select revision, approved_by,
         jsonb_array_length(content->'procedure')                                as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s not like '• %')                                               as parts,
         (content->'procedure')::text like '%(Visitor GMP Acknowledgement) before entry%' as stale,
         (content->'procedure')::text like '%renewed every twelve months and whenever FRM-906 is revised%' as renewed,
         (content->'procedure')::text like '%after the last visit that relied on it%'     as retention,
         (content->>'revision_history') like '%VISITOR ACKNOWLEDGEMENT SIGNED ONCE%'      as history,
         -- the rest of the program must be untouched
         (content->'procedure')::text like '%sanitizing foot baths%'                      as foot_baths,
         (content->'procedure')::text like '%Sign in on FRM-905%'                         as sign_in
    into r
    from public.sop_documents where sop_number = 'FSQM-012';

  if r.revision <> 'v3' then
    raise exception 'FSQM-012 revision is %, expected v3.', r.revision;
  end if;
  if r.approved_by is distinct from 'GJM' then
    raise exception 'FSQM-012 approver disturbed: %.', r.approved_by;
  end if;
  if r.lines <> 93 or r.parts <> 10 then
    raise exception 'FSQM-012 body wrong shape: % lines, % Parts (expected 93 / 10).', r.lines, r.parts;
  end if;
  if r.stale or not r.renewed or not r.retention then
    raise exception 'Part 6 not updated: stale=%, renewed=%, retention=%.', r.stale, r.renewed, r.retention;
  end if;
  if not r.history then
    raise exception 'FSQM-012 revision history was not appended.';
  end if;
  if not r.foot_baths or not r.sign_in then
    raise exception 'FSQM-012 body disturbed outside the two Part 6 lines.';
  end if;
end $$;

commit;
