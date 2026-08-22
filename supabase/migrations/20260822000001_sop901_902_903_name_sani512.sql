-- Name the sanitizer and its strength in SOP-901, SOP-902, SOP-903.
--
-- Gap this closes: FRM-909/910/911 already tell the operator to record a sanitizer strength and
-- pre-fill 200 ppm, and their help text names Noble Sani-512 at 1:512 (migration 20260726000004 /
-- 20260726000005). Their PARENT SSOPs never did — all three said only "sanitizing solution at label
-- strength", so the record specified a target the procedure did not. SQF 11.2.5.3 wants the
-- concentration specified and verified; a form default is a record, not a specification. SOP-904
-- (Groen kettle) was written with the Sani-512 wording from the start — this brings its three
-- siblings into line with it.
--
-- Four wording changes per document, all inside content (a text replace on content::text, so it is
-- independent of the procedure array's element positions):
--   A. "sanitizing solution at label strength" -> Noble Sani-512 at 1:512 (1 fl oz / 4 gal), with the
--      test-strip figure.
--   B. the "don't towel them dry" sentence gains the no-rinse rule (Sani-512 is no-rinse at this
--      dilution — rinsing it off defeats it just as towel-drying does).
--   C. "Check the sanitizer strength with a test strip and record the reading on FRM-9NN." gains the
--      target and what to do when the strip reads low. Before this, "check the strength" had nothing
--      to check it against, which is the finding.
--   D. governing_reference gains the Sani-512 line SOP-904 already carries.
-- Plus revision -> v2, effective_date -> 2026-08-22, and a revision_history line.
--
-- ⚠️ 200 ppm IS STILL A CALCULATED FIGURE, NOT A READ ONE. It is 1:512 of a ~10% quat concentrate.
-- Nobody has yet checked it against the Sani-512 label's food-contact use directions. This migration
-- promotes it from a form default to the wording of three controlled SOPs, so confirm it before these
-- revisions go out. If the label says something else, ONE follow-up migration corrects all eight
-- places it now lives: SOP-901/902/903 here, FRM-903's concentration_ppm default, and FRM-909/910/911/
-- 912's sanitizer_ppm defaults. The dilution itself (1:512, 1 fl oz per 4 gallons) is off the SDS the
-- owner supplied and is not in question — only the ppm the strip should read.
--
-- ⚠️ effective_date is stamped 2026-08-22 / approved_by stays GJM, i.e. this treats the change as
-- approved today. Change the date if the owner approves it on a different day.
--
-- SOP-905 (pot & pan washer) is deliberately NOT in here. It sanitizes with heat — the ~190 °F final
-- rinse IS the sanitizing step — so pasting the Sani-512 sentence into it would misstate the process.
-- Its real gaps are different: the warewash detergent is unnamed with no concentration, and the SOP
-- hedges "if a chemical sanitizer feeder is fitted". Both need a fact from the floor before they can
-- be written.
--
-- Each document is ONE update statement. revision and effective_date are snapshot-watched fields and
-- all three rows are active, so each fires the sop_document_history trigger; doing content and the
-- watched fields together means the snapshot is a coherent picture of the pre-change document rather
-- than a half-updated one.
--
-- Idempotent: guarded on the old "at label strength" wording still being present. The assertion at the
-- end turns a silent no-op (source text drifted from what these replacements expect) into a failure.

begin;

-- The governing_reference replacement carries a literal backslash-n, because it is inserted into a
-- JSON string value where the line break must stay escaped. Pin the setting rather than trust the
-- session's: with standard_conforming_strings off, that backslash-n would become a real newline and
-- the ::jsonb cast would reject the document.
set local standard_conforming_strings = on;

-- SOP-901 — Hobart V-1401 mixer SSOP
update public.sop_documents
set content = jsonb_set(
      replace(replace(replace(replace(content::text,
        'sanitizing solution at label strength',
        'Noble Sani-512 at the food-contact dilution of 1:512 (1 fl oz per 4 gallons of water, or 0.25 oz per gallon; about 200 ppm quat on a test strip)'),
        'Do not towel them dry; that undoes the sanitizing.',
        'Sani-512 is a no-rinse sanitizer at this dilution — do not rinse it off, and do not towel them dry; either one undoes the sanitizing.'),
        'Check the sanitizer strength with a test strip and record the reading on FRM-909.',
        'Check the sanitizer strength with a test strip before you wash — the target is about 200 ppm quat — and record the reading on FRM-909. If the strip reads below target, remake the solution; do not wash in weak sanitizer.'),
        'FDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.',
        'Noble Chemical Sani-512 (quaternary sanitizer) — food-contact use at 1:512 (1 fl oz per 4 gallons), about 200 ppm quat; no-rinse: wet the surface at least 1 minute and let it air dry.\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.')::jsonb,
      '{revision_history}',
      to_jsonb((content->>'revision_history') || $rh$
v2 — 2026-08-22 — Named the sanitizer. The sink wash now specifies Noble Sani-512 at the food-contact dilution 1:512 (1 fl oz per 4 gallons, about 200 ppm quat), states that it is no-rinse, and gives the test-strip target and what to do when it reads low. Cleaning process itself unchanged.$rh$)),
    revision = 'v2',
    effective_date = date '2026-08-22'
where sop_number = 'SOP-901'
  and content::text like '%at label strength%';

-- SOP-902 — Kook-E-King depositor SSOP
update public.sop_documents
set content = jsonb_set(
      replace(replace(replace(replace(content::text,
        'sanitizing solution at label strength',
        'Noble Sani-512 at the food-contact dilution of 1:512 (1 fl oz per 4 gallons of water, or 0.25 oz per gallon; about 200 ppm quat on a test strip)'),
        'Don''t towel them dry; that undoes the sanitizing.',
        'Sani-512 is a no-rinse sanitizer at this dilution — don''t rinse it off, and don''t towel them dry; either one undoes the sanitizing.'),
        'Check the sanitizer strength with a test strip and record the reading on FRM-910.',
        'Check the sanitizer strength with a test strip before you wash — the target is about 200 ppm quat — and record the reading on FRM-910. If the strip reads below target, remake the solution; do not wash in weak sanitizer.'),
        'FDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.',
        'Noble Chemical Sani-512 (quaternary sanitizer) — food-contact use at 1:512 (1 fl oz per 4 gallons), about 200 ppm quat; no-rinse: wet the surface at least 1 minute and let it air dry.\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.')::jsonb,
      '{revision_history}',
      to_jsonb((content->>'revision_history') || $rh$
v2 — 2026-08-22 — Named the sanitizer. The sink wash now specifies Noble Sani-512 at the food-contact dilution 1:512 (1 fl oz per 4 gallons, about 200 ppm quat), states that it is no-rinse, and gives the test-strip target and what to do when it reads low. Cleaning process itself unchanged.$rh$)),
    revision = 'v2',
    effective_date = date '2026-08-22'
where sop_number = 'SOP-902'
  and content::text like '%at label strength%';

-- SOP-903 — Beldos 275 depositor SSOP
update public.sop_documents
set content = jsonb_set(
      replace(replace(replace(replace(content::text,
        'sanitizing solution at label strength',
        'Noble Sani-512 at the food-contact dilution of 1:512 (1 fl oz per 4 gallons of water, or 0.25 oz per gallon; about 200 ppm quat on a test strip)'),
        'Don''t towel them dry; that undoes the sanitizing.',
        'Sani-512 is a no-rinse sanitizer at this dilution — don''t rinse it off, and don''t towel them dry; either one undoes the sanitizing.'),
        'Check the sanitizer strength with a test strip and record the reading on FRM-911.',
        'Check the sanitizer strength with a test strip before you wash — the target is about 200 ppm quat — and record the reading on FRM-911. If the strip reads below target, remake the solution; do not wash in weak sanitizer.'),
        'FDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.',
        'Noble Chemical Sani-512 (quaternary sanitizer) — food-contact use at 1:512 (1 fl oz per 4 gallons), about 200 ppm quat; no-rinse: wet the surface at least 1 minute and let it air dry.\nFDA 21 CFR Part 117 Subpart B — Current Good Manufacturing Practice.')::jsonb,
      '{revision_history}',
      to_jsonb((content->>'revision_history') || $rh$
v2 — 2026-08-22 — Named the sanitizer. The sink wash now specifies Noble Sani-512 at the food-contact dilution 1:512 (1 fl oz per 4 gallons, about 200 ppm quat), states that it is no-rinse, and gives the test-strip target and what to do when it reads low. Cleaning process itself unchanged.$rh$)),
    revision = 'v2',
    effective_date = date '2026-08-22'
where sop_number = 'SOP-903'
  and content::text like '%at label strength%';

-- Fail loudly rather than leave a document half-done. A guard that no-ops because the live wording
-- drifted looks identical to success from the outside, and these are controlled documents.
do $$
declare
  bad text;
begin
  select string_agg(sop_number, ', ' order by sop_number) into bad
  from public.sop_documents
  where sop_number in ('SOP-901', 'SOP-902', 'SOP-903')
    and (content::text not like '%Sani-512%'
      or content::text like '%at label strength%');

  if bad is not null then
    raise exception 'Sani-512 wording did not apply to: %. The live text has drifted from what this migration replaces — re-read the rows and adjust the search strings.', bad;
  end if;

  select string_agg(sop_number, ', ' order by sop_number) into bad
  from public.sop_documents
  where sop_number in ('SOP-901', 'SOP-902', 'SOP-903')
    and revision is distinct from 'v2';

  if bad is not null then
    raise exception 'Revision not stamped v2 on: %.', bad;
  end if;
end $$;

commit;
