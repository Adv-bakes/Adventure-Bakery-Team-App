-- FRM-913 v3: every Module 11 grid opens a row as a pop-up form.
--
-- WHY. FRM-913 is filled walking the site on a tablet. Each of its eight grids has four columns -
-- Conforms, Finding, Corrective action (owner & due date), CAPA No. - and two of those hold
-- sentences. The row dialog (GridRowDialog) switches itself on only at six columns, a proxy for
-- "too wide for a tablet" that says nothing about a narrow grid whose cells are prose. The owner
-- saw it standing in the bakery on 2026-09-17 while starting the first inspection (task 13.7) and
-- asked for it. GridField.rowDialog = true forces it on; this sets it on all eight grids.
--
-- WHAT DOES NOT CHANGE. Not a question, not a column, not a row label, not a field id. The flag
-- is presentation-only, so existing entries (if any) render exactly as before plus a button.
-- That is why this is NOT guarded on zero entries, unlike the v2 CAPA column.
--
-- WHY A REVISION ANYWAY. The owner's call: FRM-913 is an active controlled form and its
-- form_schema is changing, which is what the document control report compares revision against.
-- v2 -> v3, effective today. The sop_document_history trigger snapshots v2.
--
-- CONVERGENT. If FRM-913 is already at v3 with all eight grids flagged, this is a no-op (no
-- UPDATE, so no second history snapshot). Any other state raises.
--
-- Grids are selected by type + id prefix, never by array index, and the after-guard compares the
-- whole content with `rowDialog` stripped from BOTH sides, so nothing else can have moved.

begin;

create or replace function pg_temp.strip_row_dialog(c jsonb) returns jsonb
language sql immutable as $$
  select jsonb_set(c, '{form_schema,sections}', coalesce((
    select jsonb_agg(
             jsonb_set(s, '{fields}', coalesce((
               select jsonb_agg(f - 'rowDialog' order by fo)
                 from jsonb_array_elements(s->'fields') with ordinality x(f, fo)
             ), '[]'::jsonb))
             order by so)
      from jsonb_array_elements(c->'form_schema'->'sections') with ordinality y(s, so)
  ), '[]'::jsonb))
$$;

create temp table frm913_before on commit drop as
  select content, revision, effective_date, status
    from public.sop_documents where sop_number = 'FRM-913';

do $$
declare
  r record;
begin
  select b.status, b.revision,
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid')                                                    as grids,
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and f->>'id' like 'check_11_%'
             and jsonb_array_length(f->'columns') = 4)                                   as target,
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f ? 'rowDialog')                                                        as flagged,
         (select count(*) from frm913_before,
                               jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and f->>'id' like 'check_11_%'
             and f->'rowDialog' = 'true'::jsonb)                                          as flagged_on,
         (select count(*) from frm913_before)                                            as n
    into r
    from frm913_before b;

  if r.n <> 1 then
    raise exception 'Expected exactly one FRM-913 row, found %.', r.n;
  end if;
  if r.grids <> 8 or r.target <> 8 then
    raise exception 'FRM-913 has % grids, % of them 4-column check_11_* grids - expected 8 and 8. Re-derive.',
      r.grids, r.target;
  end if;

  -- already applied: leave it alone
  if r.status = 'active' and r.revision = 'v3' and r.flagged = 8 and r.flagged_on = 8 then
    raise notice 'FRM-913 is already v3 with rowDialog on all 8 grids - nothing to do.';
    return;
  end if;

  if r.status is distinct from 'active' or r.revision is distinct from 'v2' then
    raise exception 'FRM-913 is % at revision % - expected the active v2. Re-derive.', r.status, r.revision;
  end if;
  if r.flagged <> 0 then
    raise exception '% FRM-913 field(s) already carry rowDialog at v2 - partial state, re-derive.', r.flagged;
  end if;

  update public.sop_documents d
     set content = jsonb_set(d.content, '{form_schema,sections}', (
           select jsonb_agg(
                    jsonb_set(s, '{fields}', coalesce((
                      select jsonb_agg(
                               case when f->>'type' = 'grid' and f->>'id' like 'check_11_%'
                                    then f || '{"rowDialog": true}'::jsonb
                                    else f end
                               order by fo)
                        from jsonb_array_elements(s->'fields') with ordinality x(f, fo)
                    ), '[]'::jsonb))
                    order by so)
             from jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality y(s, so))),
         revision = 'v3',
         effective_date = date '2026-09-17'
   where d.sop_number = 'FRM-913' and d.status = 'active' and d.revision = 'v2';
end $$;

do $$
declare
  r record;
begin
  select a.revision, a.effective_date, a.status,
         (select count(*) from jsonb_array_elements(a.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'grid' and f->>'id' like 'check_11_%'
             and f->'rowDialog' = 'true'::jsonb)                                          as on_grids,
         (select count(*) from jsonb_array_elements(a.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f ? 'rowDialog')                                                        as any_flag,
         pg_temp.strip_row_dialog(a.content) = pg_temp.strip_row_dialog(b.content)       as same_otherwise
    into r
    from public.sop_documents a, frm913_before b
   where a.sop_number = 'FRM-913';

  if r.status <> 'active' or r.revision <> 'v3' or r.effective_date <> date '2026-09-17' then
    raise exception 'FRM-913 metadata wrong: %, revision %, effective %.', r.status, r.revision, r.effective_date;
  end if;
  if r.on_grids <> 8 or r.any_flag <> 8 then
    raise exception 'rowDialog on % check grids / % fields overall - expected 8 and 8.', r.on_grids, r.any_flag;
  end if;
  if not r.same_otherwise then
    raise exception 'FRM-913 content changed beyond the rowDialog flag - stop.';
  end if;
end $$;

commit;
