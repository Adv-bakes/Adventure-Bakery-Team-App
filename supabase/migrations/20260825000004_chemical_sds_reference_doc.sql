-- Chemical Safety Data Sheets — reference document to hold the site's SDS set.
--
-- Task 30.2 on the remediation plan ("Collect and file current SDS"), and a prerequisite for D-30
-- (Chemical Control Program) and SQF 11.6.4, which wants an SDS on file for every chemical on site.
--
-- Until now SDS files have had no home. Two arrived on 2026-08-25 (Dawn Professional, Sani-512) and
-- three more already sit in the shared Drive folder. Attaching them ad hoc to whichever form
-- happens to name the chemical - FRM-903 names both, so it was the obvious temptation - would
-- scatter safety documents across daily record forms, where nobody would think to look for them
-- and where they would be pruned with the records they were attached to.
--
-- Shaped exactly like the app's own "Add Reference Document" flow (createRefDoc in
-- SopsLibrary.tsx): type 'sop', status 'draft', training_category null, no sop_number. Unnumbered
-- is deliberate - this is a collection, not a controlled procedure, so it does not belong in the
-- Document Register's numbered stages. Number it later if it is ever made a controlled document in
-- its own right.
--
-- The files themselves are NOT attached here and cannot be: `training-content` storage policies are
-- is_staff_or_admin-gated, so uploads need a signed-in staff session. The body below lists what
-- belongs in the collection and where each item currently stands, so the person doing the uploading
-- has the worklist in front of them in the drawer.
--
-- Idempotent: guarded on the title not already existing.

begin;

insert into public.sop_documents (title, type, category, status, content)
select
  'Chemical Safety Data Sheets (SDS)',
  'sop',
  'Module 11',
  'draft',
  $json$
{
  "purpose": "To hold the current Safety Data Sheet for every chemical used on site, in one place, so that anyone handling a chemical can find its hazards, its handling precautions and its emergency information without hunting through the forms that happen to mention it.\n\nSQF 11.6.4 requires an SDS for each chemical on site. This collection is the evidence for that clause and the input to the Chemical Control Program.",
  "scope": "Every chemical used or stored on site, including detergents, sanitizers, rinse additives, degreasers and floor cleaners. Attach each SDS as a file in the Reference Documents tab.\n\nAn SDS does not carry use directions or dilution rates — those are on the product LABEL. Where a chemical's use concentration is specified in an SOP or recorded on a form, the label is the supporting evidence and should be filed alongside the SDS.",
  "procedure": [
    "Noble Chemical Sani-512 (sanitizer, quaternary ammonium chloride). SDS obtained 2026-08-25 — Clark Core Services LLC, revised 2021-07-15, Revision 1, EPA reg. 6836-266-65239. DANGER: H302, H314, H318; store locked up. Total quat 10.0% w/w. Used at 1:512 for food contact (about 200 ppm) and 1:160 for foot baths. THE LABEL IS STILL NEEDED — it is what states the 200 ppm food-contact figure; the master label can be pulled from the EPA PPLS database using the registration number.",
    "Dawn Professional Dish Detergent Concentrate (manual dish detergent). SDS obtained 2026-08-25 — Procter & Gamble Professional, product identifier 90077106_PROF_NG, issued 2021-05-26, revised 2021-12-06, Revision 1. WARNING: causes eye irritation (Cat 2B). Used at 1-2 oz per 10 gallons in the sink. Confirm with P&G that Revision 1 is still current.",
    "Keystone liquid rinse additive. A copy is in the shared SQF Working Folder in Drive; file it here and confirm where and how it is used.",
    "Green dishwashing liquid. A copy is in the shared SQF Working Folder in Drive; file it here and confirm whether it is still in use.",
    "Mr. Clean Professional Degreaser Floor Cleaner. A copy is in the shared SQF Working Folder in Drive; file it here.",
    "Walk the plant and add anything not listed above — the list is only as complete as the last walk. Any chemical found on site without an SDS here is a finding waiting to happen."
  ],
  "records": "The SDS files themselves are the record, held as attachments on this document. Superseded SDS versions are replaced, not kept, except where a record refers to the version in force at the time.",
  "governing_reference": "SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.6.4 (hazardous chemicals: approved list, SDS available, trained handlers, segregated and secure storage).\n29 CFR 1910.1200 — OSHA Hazard Communication Standard (SDS availability to employees).",
  "revision_history": "New — 2026-08-25 — Created as the home for the site's SDS set. Sani-512 and Dawn Professional SDS obtained the same day; three more identified in the shared Drive folder. Files are attached through the app; they cannot be loaded by migration."
}
$json$::jsonb
where not exists (
  select 1 from public.sop_documents where title = 'Chemical Safety Data Sheets (SDS)'
);

do $$
begin
  if not exists (
    select 1 from public.sop_documents
     where title = 'Chemical Safety Data Sheets (SDS)'
       and training_category is null
       and status = 'draft'
  ) then
    raise exception 'Chemical SDS reference document was not created as a draft reference doc.';
  end if;
end $$;

commit;
