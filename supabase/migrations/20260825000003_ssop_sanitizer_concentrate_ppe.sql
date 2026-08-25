-- SOP-901/902/903/904 — PPE for handling the Sani-512 concentrate.
--
-- The Sani-512 SDS arrived 2026-08-25 (Clark Core Services, revised 2021-07-15, EPA reg.
-- 6836-266-65239) and the concentrate is classified far more severely than anything these SSOPs
-- suggest: signal word DANGER, Acute Toxicity (Oral) Cat 4, Skin Corrosion Cat 1, Serious Eye
-- Damage Cat 1 (H302/H314/H318), with P280 requiring gloves, protective clothing and eye/face
-- protection.
--
-- Checked with word-boundary matching across all four SSOPs: NONE of them mentioned gloves,
-- goggles, eye protection, a face shield, an apron or PPE - while all four instruct staff to make
-- the sanitizer up, i.e. to handle the concentrate. (A naive grep is misleading here: "PPE" matches
-- inside "hoPPEr" and "droPPEd", which is how this nearly went unnoticed.)
--
-- THE NUANCE MATTERS AND IS WRITTEN IN DELIBERATELY: at the 1:512 use dilution the working solution
-- is NOT corrosive - the classification is for the product as supplied. So the precaution attaches
-- to measuring and pouring the concentrate, not to wiping a sanitized surface. Written any stronger
-- than that it reads as alarmism about a solution people handle all day, and gets ignored.
--
-- Two touch points per document:
--   * the step where the solution is made up gains the PPE sentence;
--   * governing_reference gains the SDS citation, so the requirement has a source an auditor can
--     follow rather than appearing as house opinion.
--
-- Anchors were read from the live rows rather than assumed, and each appears exactly once:
--   SOP-901/902/903  "If the strip reads below target, remake the solution; do not wash in weak
--                     sanitizer."   (identical in all three)
--   SOP-904          "Record the sanitizer strength on FRM-912."
--   all four         "no-rinse: wet the surface at least 1 minute and let it air dry."
--
-- All four are ACTIVE, so this is a controlled change: SOP-901/902/903 v2 -> v3 and SOP-904
-- New -> v2, all effective 2026-08-25, in the SAME statement as the content edit so each history
-- snapshot captures a coherent pre-change document.
--
-- Guards key on the TARGET state (the PPE sentence not already being present), not on the old
-- wording - the lesson from 20260825000001, where a guard keyed on the old value silently matched
-- nothing after someone had edited the record by hand.
--
-- Storage is deliberately NOT mentioned. The SDS carries P405 "store locked up", but this project
-- has not yet established a lockable chemical store - that is D-30. Writing an instruction the site
-- cannot currently follow would be worse than leaving it to the programme that will build it.

begin;

-- SOP-901 / SOP-902 / SOP-903 — the three sink-wash SSOPs share an anchor.
update public.sop_documents
set content = replace(replace(content::text,
      'If the strip reads below target, remake the solution; do not wash in weak sanitizer.',
      'If the strip reads below target, remake the solution; do not wash in weak sanitizer. Wear gloves and eye protection while you measure and pour the concentrate — undiluted Sani-512 is rated DANGER and causes severe skin burns and serious eye damage. Once it is mixed at 1:512 the working solution is not corrosive, so this is about making the solution up, not about using it.'),
      'no-rinse: wet the surface at least 1 minute and let it air dry.',
      'no-rinse: wet the surface at least 1 minute and let it air dry. The SDS for the concentrate (Clark Core Services, revised 2021-07-15; EPA reg. 6836-266-65239) classifies it DANGER — H302 harmful if swallowed, H314 causes severe skin burns and eye damage, H318 causes serious eye damage — and requires gloves and eye/face protection when it is handled.')::jsonb,
    revision = 'v3',
    effective_date = date '2026-08-25'
where sop_number in ('SOP-901', 'SOP-902', 'SOP-903')
  and content::text not like '%Wear gloves and eye protection%';

-- SOP-904 — the kettle SSOP sanitizes in place, so its anchor is the record-the-strength sentence.
update public.sop_documents
set content = replace(replace(content::text,
      'Record the sanitizer strength on FRM-912.',
      'Record the sanitizer strength on FRM-912. Wear gloves and eye protection while you measure and pour the concentrate — undiluted Sani-512 is rated DANGER and causes severe skin burns and serious eye damage. Once it is mixed at 1:512 the working solution is not corrosive, so this is about making the solution up, not about using it.'),
      'no-rinse: wet the surface at least 1 minute and let it air dry.',
      'no-rinse: wet the surface at least 1 minute and let it air dry. The SDS for the concentrate (Clark Core Services, revised 2021-07-15; EPA reg. 6836-266-65239) classifies it DANGER — H302 harmful if swallowed, H314 causes severe skin burns and eye damage, H318 causes serious eye damage — and requires gloves and eye/face protection when it is handled.')::jsonb,
    revision = 'v2',
    effective_date = date '2026-08-25'
where sop_number = 'SOP-904'
  and content::text not like '%Wear gloves and eye protection%';

do $$
declare
  bad text;
begin
  select string_agg(sop_number || ': ' || issue, '; ' order by sop_number) into bad from (
    select sop_number, 'PPE sentence missing' as issue from public.sop_documents
      where sop_number in ('SOP-901','SOP-902','SOP-903','SOP-904')
        and content::text not like '%Wear gloves and eye protection%'
    union all
    select sop_number, 'SDS citation missing' from public.sop_documents
      where sop_number in ('SOP-901','SOP-902','SOP-903','SOP-904')
        and content->>'governing_reference' not like '%6836-266-65239%'
    union all
    select sop_number, 'revision not bumped' from public.sop_documents
      where (sop_number in ('SOP-901','SOP-902','SOP-903') and revision is distinct from 'v3')
         or (sop_number = 'SOP-904' and revision is distinct from 'v2')
    union all
    -- the PPE sentence must land once per document, not twice: a re-run that slipped past the
    -- guard would duplicate it inside the step text and nothing else would complain.
    select sop_number, 'PPE sentence appears more than once' from public.sop_documents
      where sop_number in ('SOP-901','SOP-902','SOP-903','SOP-904')
        and (select count(*) from regexp_matches(content::text, 'Wear gloves and eye protection', 'g')) > 1
  ) t;

  if bad is not null then
    raise exception 'Sanitizer PPE change did not apply cleanly: %', bad;
  end if;
end $$;

commit;
