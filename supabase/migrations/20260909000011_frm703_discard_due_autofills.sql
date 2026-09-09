-- FRM-703: Discard due now fills itself, so its help must stop asking the filler to compute it.
--
-- WHAT CHANGED, AND WHY IT IS NOT COSMETIC. The field was seeded as something the filler works out:
-- "Thirty days after the printed date (FSQM-014 Part 6). Where the pack is coded to a month only,
-- count from the last day of that month." The app now derives it from the printed date and keeps it
-- in step as that date is corrected. Leaving the old wording would leave an instruction on a
-- controlled record that nobody performs - the same defect this workstream removed from FSQM-018
-- and FSQM-020, in miniature. A form that tells the floor to do something the software already did
-- is how the floor learns to stop reading the form.
--
-- THE OVERRIDE IS WHAT THE NEW HELP EXISTS TO EXPLAIN. The value is derived, but it is not locked:
-- a customer agreement requiring a longer period is a real case and Part 6 defers to it. So the
-- help now says what to do in the one situation where the filler must intervene, and points at the
-- field where the agreement is named. That is the only thing a person still has to decide here.
--
-- Only the help string moves. The guard rebuilds the whole document with this one key stripped from
-- both sides and compares hashes, so anything else changing rolls the migration back.
--
-- FRM-703 is still DRAFT, so there is no revision to bump and no history snapshot to make.

begin;

do $$
declare r record;
begin
  select status, revision,
         (content->'form_schema'->'sections'->0->>'id')                                as sec0,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'discard_due')                                             as n_field,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'discard_due'
             and f->>'help' like 'Thirty days after the printed date%')                as n_old_help,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                    as fields
    into r
    from public.sop_documents where sop_number = 'FRM-703';

  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FRM-703 is %/% , expected draft/New. An issued form is not amended this way.',
      r.status, r.revision;
  end if;
  -- The update addresses section 0 by position, so the position is asserted rather than assumed.
  if r.sec0 is distinct from 'sample_taken' then
    raise exception 'Section 0 is % , expected sample_taken.', coalesce(r.sec0, 'missing');
  end if;
  if r.fields <> 20 then
    raise exception 'FRM-703 has % fields, expected 20.', r.fields;
  end if;
  if r.n_field <> 1 or r.n_old_help <> 1 then
    raise exception 'discard_due is not the field this migration edits (found=%, with old help=%).',
      r.n_field, r.n_old_help;
  end if;
end $$;

-- The whole document with discard_due's help removed. Anything else that moves fails the after-guard.
create temporary table frm703_before on commit drop as
select md5(
         jsonb_set(content, '{form_schema,sections,0,fields}', (
           select jsonb_agg(case when f->>'id' = 'discard_due' then f - 'help' else f end order by ord)
             from jsonb_array_elements(content->'form_schema'->'sections'->0->'fields')
                  with ordinality x(f, ord)))::text
       ) as h
  from public.sop_documents where sop_number = 'FRM-703';

update public.sop_documents d
   set content = jsonb_set(d.content, '{form_schema,sections,0,fields}', (
         select jsonb_agg(
                  case when f->>'id' = 'discard_due'
                       then jsonb_set(f, '{help}', to_jsonb($help$Filled from the printed date — thirty days, counting from the last day of the month where the pack is coded to a month only (FSQM-014 Part 6). It updates if you correct the printed date. Change it by hand only where a customer agreement requires a longer period, and name that agreement in the next field.$help$::text))
                       else f end
                  order by ord)
           from jsonb_array_elements(d.content->'form_schema'->'sections'->0->'fields')
                with ordinality x(f, ord)))
 where d.sop_number = 'FRM-703' and d.status = 'draft';

do $$
declare
  r record;
  drift int;
begin
  select status, revision,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'discard_due'
             and f->>'help' like 'Filled from the printed date%')                      as n_new_help,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'help' like 'Thirty days after the printed date%')                as n_old_help,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'id' = 'discard_due' and f ? 'derive')                            as n_derive,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                    as fields
    into r
    from public.sop_documents where sop_number = 'FRM-703';

  if r.n_new_help <> 1 or r.n_old_help <> 0 then
    raise exception 'Help text did not swap (new=%, old still present=%).', r.n_new_help, r.n_old_help;
  end if;
  -- The new wording promises the field fills itself; the derivation is what keeps that true.
  if r.n_derive <> 1 then
    raise exception 'discard_due lost its derive block; the new help would then be a lie.';
  end if;
  if r.fields <> 20 or r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'Shape or metadata moved: % fields, %/%.', r.fields, r.status, r.revision;
  end if;

  select count(*) into drift
    from public.sop_documents d, frm703_before b
   where d.sop_number = 'FRM-703'
     and md5(
           jsonb_set(d.content, '{form_schema,sections,0,fields}', (
             select jsonb_agg(case when f->>'id' = 'discard_due' then f - 'help' else f end order by ord)
               from jsonb_array_elements(d.content->'form_schema'->'sections'->0->'fields')
                    with ordinality x(f, ord)))::text
         ) is distinct from b.h;
  if drift <> 0 then
    raise exception 'FRM-703 changed beyond discard_due''s help text. Rolled back.';
  end if;
end $$;

commit;
