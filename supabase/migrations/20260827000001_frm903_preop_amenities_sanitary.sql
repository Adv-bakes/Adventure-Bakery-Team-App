-- FRM-903 §1 — the pre-operational check gains the areas the clause names and the form omits.
--
-- SQF 11.2.5.7 requires the pre-op inspection to cover "food processing areas, product contact
-- surfaces, equipment, STAFF AMENITIES, SANITARY FACILITIES, and other essential areas". The grid
-- has eleven rows - Tables, Mixers, Bowls, Utensils, Pans, Racks, Ovens, Scales, Depositors,
-- Chopper, Floors - which is surfaces, equipment and floors. Nothing for amenities or sanitary
-- facilities.
--
-- 11.2.5.7 was scored COMPLIANT in the gap assessment, on this form. The score was right that the
-- form exists and wrong about what it covers - the same failure that hid the molds under 11.2.5.1.
-- See sop-drafts/compliant-rows-review.md.
--
-- Handwash stations are the case worth being explicit about: they already appear on this form, in
-- §5 Operational GMP ("Handwash stations stocked"). That is a different requirement at a different
-- time - §5 is filled DURING production, and 11.2.5.7 is a check BEFORE start-up. A station found
-- unstocked at 10 a.m. has already had people work past it. Both rows are wanted; neither replaces
-- the other.
--
-- The Sanitized column is `required` on this grid, and "sanitized" is not a meaningful state for a
-- locker room. pass_fail renders Pass / Fail / N/A, so the description now says N/A is the right
-- answer where sanitizing does not apply, rather than leaving the filler to pick a wrong Pass.
--
-- Rows are APPENDED, not rewritten: the grid is `deletable: true`, so the site may already have
-- added or removed items of its own, and the whole-array guard below only fires when the three new
-- labels are absent. A live draft entry keys its answers on row position, so appending at the end
-- leaves every existing answer aligned - inserting in the middle would silently shift them.
--
-- FRM-903 is active: revision v4 -> v5, effective 2026-08-27 (local and DB dates agree today), in
-- the same UPDATE as the content edit so the history snapshot captures a coherent v4.

begin;

update public.sop_documents
set content = jsonb_set(jsonb_set(content,
      '{form_schema,sections,1,fields,0,rows,labels}',
      (content #> '{form_schema,sections,1,fields,0,rows,labels}')
        || $l$["Handwash stations (clean, stocked, draining)","Restrooms / sanitary facilities","Break room / lockers (staff amenities)"]$l$::jsonb),
      '{form_schema,sections,1,description}',
      to_jsonb($d$Before production starts, following cleaning and sanitation, confirm each item is visibly clean and sanitized (SQF 11.2.5.7). The clause covers the processing areas and product contact surfaces AND the staff amenities and sanitary facilities, so all of them are listed here. Mark Pass, Fail, or N/A — N/A is the right answer for "Sanitized" on an area that is cleaned but not sanitized, such as a locker room. Note any corrective action taken before start-up. Add or remove items as the line changes.$d$::text)),
    revision = 'v5',
    effective_date = date '2026-08-27'
where sop_number = 'FRM-903'
  and content #>> '{form_schema,sections,1,id}' = 'preop_surfaces'
  and content #>> '{form_schema,sections,1,fields,0,id}' = 'surface_check'
  and not (content #> '{form_schema,sections,1,fields,0,rows,labels}')
          @> $l$["Restrooms / sanitary facilities"]$l$::jsonb;

do $$
declare
  bad text;
begin
  select string_agg(x, '; ') into bad from (
    select 'amenity/sanitary rows missing' as x from public.sop_documents
      where sop_number = 'FRM-903'
        and not (content #> '{form_schema,sections,1,fields,0,rows,labels}')
            @> $g$["Handwash stations (clean, stocked, draining)","Restrooms / sanitary facilities","Break room / lockers (staff amenities)"]$g$::jsonb
    union all
    -- the original eleven must survive: jsonb_set of the whole array would drop them silently.
    select 'lost an original row' from public.sop_documents
      where sop_number = 'FRM-903'
        and not (content #> '{form_schema,sections,1,fields,0,rows,labels}')
            @> $g$["Tables","Mixers","Bowls","Utensils","Pans","Racks","Ovens","Scales","Depositors","Chopper","Floors"]$g$::jsonb
    union all
    select 'row count is ' || jsonb_array_length(content #> '{form_schema,sections,1,fields,0,rows,labels}')
             || ', expected 14'
      from public.sop_documents
      where sop_number = 'FRM-903'
        and jsonb_array_length(content #> '{form_schema,sections,1,fields,0,rows,labels}') <> 14
    union all
    select 'description does not name amenities' from public.sop_documents
      where sop_number = 'FRM-903'
        and content #>> '{form_schema,sections,1,description}' not like '%staff amenities%'
    union all
    -- §5's handwash line is a separate, still-wanted check; this migration must not have touched it.
    select 'section 5 handwash row lost' from public.sop_documents
      where sop_number = 'FRM-903'
        and not (content #> '{form_schema,sections,5,fields,0,rows,labels}')
            @> $g$["Handwash stations stocked (soap, towels, sanitizer)"]$g$::jsonb
    union all
    -- last week's molds work must be intact.
    select 'section 2 molds row lost' from public.sop_documents
      where sop_number = 'FRM-903'
        and not (content #> '{form_schema,sections,2,fields,0,rows,labels}')
            @> $g$["Molds — SOP-906 (recorded here)"]$g$::jsonb
    union all
    select 'revision not v5' from public.sop_documents
      where sop_number = 'FRM-903' and revision is distinct from 'v5'
    union all
    select 'effective date not 2026-08-27' from public.sop_documents
      where sop_number = 'FRM-903' and effective_date is distinct from date '2026-08-27'
  ) t;

  if bad is not null then
    raise exception 'FRM-903 pre-op scope change did not apply cleanly: %', bad;
  end if;
end $$;

commit;
