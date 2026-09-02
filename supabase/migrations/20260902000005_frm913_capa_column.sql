-- FRM-913 gains a CAPA No. column on each of its eight Module 11 grids. D-07.
--
-- FSQM-022 was issued on 2026-09-01 with this open item recorded against it:
--
--   "OPEN: the corrective-action half of this program has nowhere to live beyond FRM-913's own
--    columns. D-07 (CAPA) is the object findings from any source should be raised into, and until
--    it exists a finding closed on FRM-913 is tracked only on the form that raised it. Task 13.7,
--    the first inspection, depends on it."
--
-- FSQM-009 Part 3 (vi) now says an inspection finding that is not corrected on the spot opens a
-- CAPA, and Part 4 says the number is written back onto the record that raised it. FRM-913 had
-- nowhere to write it: its grids carry Conforms / Finding / Corrective action, owner & due date,
-- and nothing else. A number typed into the free-text action column would be a number nobody could
-- query, sort or reconcile against the register.
--
-- NOW, NOT LATER, BECAUSE FRM-913 HAS ZERO ENTRIES. It was seeded draft yesterday and has never
-- been filled - a query against sop_document_responses confirms it, and the guard below re-checks
-- at apply time. Adding a grid column to a form with live entries is a materially more careful
-- operation (existing rows carry no key for the new column, and the printed blank goes out of date
-- against records already filed). Doing it in the same wave that creates the CAPA it refers to
-- costs nothing; doing it after the first inspection would mean a second revision on a form already
-- in use, and 13.7 is the very next task.
--
-- THE COLUMN IS DELIBERATELY NARROW (width 1, the same weight as Conforms). It holds CAPA-2026-001
-- and nothing else. The finding and action columns keep their weight of 3 each, so the grid goes
-- from 1+3+3 to 1+3+3+1 and the two columns that carry sentences are not squeezed by the one that
-- carries an identifier. GridFieldInput sums the row's weights, so relative widths are what matter.
--
-- IT IS NOT REQUIRED, ON PURPOSE. Most rows on a monthly inspection conform, and most findings that
-- do not are corrected on the spot and stay on this form - FSQM-009 Part 3 is explicit that a
-- routine on-the-spot correction does not open a CAPA. A required column would force a value into
-- every row of a 34-row checklist and turn the register's own escalation rule into noise.
--
-- All eight grids are patched in one loop keyed on the grid's own field id, so this cannot append
-- to the wrong field if FRM-913 is ever re-sectioned. Revision bumps New -> v2 with today's
-- effective date: FRM-913 is an ACTIVE controlled form whose content is changing, which is exactly
-- the drift the document control report looks for when revision and content disagree.
--
-- Written with jsonb_set on each grid's columns array, so content->'attachments' is never in the
-- write path.

begin;

do $$
declare
  r record;
begin
  select
    (select status   from public.sop_documents where sop_number = 'FRM-913')            as st,
    (select revision from public.sop_documents where sop_number = 'FRM-913')            as rev,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-913' and f->>'type' = 'grid')                           as grids,
    (select count(*) from public.sop_documents d,
                          jsonb_array_elements(d.content->'form_schema'->'sections') s,
                          jsonb_array_elements(s->'fields') f,
                          jsonb_array_elements(f->'columns') c
      where d.sop_number = 'FRM-913' and c->>'id' = 'capa_no')                          as already,
    (select count(*) from public.sop_document_responses p
       join public.sop_documents d on d.id = p.document_id
      where d.sop_number = 'FRM-913')                                                   as entries
  into r;

  if r.st is distinct from 'active' or r.rev is distinct from 'New' then
    raise exception 'FRM-913 is % at revision % - expected the active rev New. Re-derive.', r.st, r.rev;
  end if;
  if r.grids <> 8 then
    raise exception 'FRM-913 has % grids, expected 8 (one per Module 11 section).', r.grids;
  end if;
  if r.already <> 0 then
    raise exception '% FRM-913 grid(s) already carry a capa_no column.', r.already;
  end if;
  -- the whole justification for doing this now rather than later
  if r.entries <> 0 then
    raise exception 'FRM-913 now has % entries. Adding a grid column under live records is a different and more careful operation - stop and re-derive.',
      r.entries;
  end if;
end $$;

do $$
declare
  g   record;
  col jsonb := $c$
{
  "id": "capa_no",
  "type": "text",
  "label": "CAPA No.",
  "width": 1
}
$c$::jsonb;
  n   int := 0;
begin
  for g in
    select (so - 1)::int as sec_idx, (fo - 1)::int as fld_idx
      from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality s(s, so),
           jsonb_array_elements(s->'fields') with ordinality x(f, fo)
     where d.sop_number = 'FRM-913'
       and f->>'type' = 'grid'
       and f->>'id' like 'check_11_%'
     order by so, fo
  loop
    update public.sop_documents
       set content = jsonb_set(
             content,
             array['form_schema','sections', g.sec_idx::text,
                   'fields', g.fld_idx::text, 'columns'],
             (content #> array['form_schema','sections', g.sec_idx::text,
                               'fields', g.fld_idx::text, 'columns']) || col)
     where sop_number = 'FRM-913';
    n := n + 1;
  end loop;

  if n <> 8 then
    raise exception 'Patched % grids, expected 8.', n;
  end if;

  update public.sop_documents
     set revision = 'v2', effective_date = date '2026-09-02'
   where sop_number = 'FRM-913' and status = 'active' and revision = 'New';
end $$;

do $$
declare
  r record;
begin
  select revision, effective_date,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f,
                               jsonb_array_elements(f->'columns') c
           where c->>'id' = 'capa_no')                                                  as capa_cols,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and jsonb_array_length(f->'columns') <> 4)         as wrong_width,
         -- the CAPA column must be LAST, after the action column, not spliced into the middle
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and f->'columns'->3->>'id' <> 'capa_no')           as misplaced,
         -- the three original columns must be untouched on every grid
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid'
             and (f->'columns'->0->>'id' <> 'conforms'
               or f->'columns'->1->>'id' <> 'finding'
               or f->'columns'->2->>'id' <> 'action'))                                  as clobbered,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and not (f->'rows' ? 'mode'))                      as modeless,
         jsonb_array_length(content->'attachments')                                     as atts
    into r
    from public.sop_documents where sop_number = 'FRM-913';

  if r.revision <> 'v2' or r.effective_date <> date '2026-09-02' then
    raise exception 'FRM-913 metadata wrong: revision %, effective %.', r.revision, r.effective_date;
  end if;
  if r.capa_cols <> 8 then
    raise exception '% grids carry a capa_no column, expected 8.', r.capa_cols;
  end if;
  if r.wrong_width <> 0 then
    raise exception '% grid(s) do not have exactly 4 columns.', r.wrong_width;
  end if;
  if r.misplaced <> 0 then
    raise exception '% grid(s) have capa_no somewhere other than last.', r.misplaced;
  end if;
  if r.clobbered <> 0 then
    raise exception '% grid(s) lost or reordered their original Conforms/Finding/Action columns.',
      r.clobbered;
  end if;
  if r.modeless <> 0 then
    raise exception '% grid(s) lost rows.mode - a fixed grid without it renders dynamic.', r.modeless;
  end if;
  if r.atts is null then
    raise exception 'FRM-913 attachments list was disturbed.';
  end if;
end $$;

commit;
