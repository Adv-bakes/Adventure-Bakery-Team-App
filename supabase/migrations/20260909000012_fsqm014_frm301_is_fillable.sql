-- FSQM-014: FRM-301 IS a fillable record. Production still says it is not.
--
-- WHAT IS WRONG. Two statements in the production copy were true when this program was drafted on
-- the morning of 2026-09-09 and stopped being true a few hours later, when FRM-301 gained its form
-- schema:
--
--   procedure[10]  "FRM-301 is an active controlled document BUT IS NOT YET A FILLABLE RECORD in
--                   the Team Portal, so the incoming inspection is recorded on paper"
--   records        "...raw material and packaging. PRESENTLY KEPT ON PAPER; see Part 3."
--
-- Both are now false. FRM-301 carries a form schema, its Receiving Log runs the package-label scan
-- on every row, and its entries live in the Team Portal. An auditor reading this program would be
-- told to look for paper that does not exist, while Part 5 of the same document describes scanning
-- a label into the very record it calls paper.
--
-- WHY PRODUCTION AND THE REPO DISAGREE, AND WHY GIT DID NOT SHOW IT. The seed migration
-- 20260909000001 was corrected before it was ever committed - but AFTER the owner had already run
-- `db push`. `db push` records a migration by filename, so the correction could never run, and
-- because the edit happened pre-commit the file has a single clean commit and its history shows
-- nothing at all. This is the third instance of one mistake this session (see 20260909000011) and
-- the only one git could not have caught. THE LESSON IS SHARPER THAN THE RULE: git history is not
-- evidence that a migration file matches what ran. Only comparing production against the file is.
--
-- The corrected strings here are lifted from the seed file itself, which has held them all along.
--
-- FRM-703 IS ALSO LEFT DELETABLE ON PURPOSE. It was seeded `deletable: false`, matching FRM-701 on
-- the reasoning that a log entries can be removed from proves nothing. The owner turned deletion on
-- to clear a test entry and, asked directly, chose to leave it on while the form is in trial. That
-- is a decision, not drift, so the schema is converged to it rather than reverted - otherwise the
-- next person to replay these migrations would rebuild a form the site has deliberately changed.
-- No SQF clause in either code edition was found requiring records be protected from deletion, so
-- this is a house preference and is recorded as one.
--
-- CONVERGENT, like 000011: every step is a no-op where the target already holds the intended value,
-- so this is correct against production as it stands and against a fresh replay.
--
-- FSQM-014 and FRM-703 are both still DRAFT. Nothing false has been issued.

begin;

do $$
declare
  proc jsonb;
  recs text;
  n int;
begin
  select content->'procedure', content->>'records' into proc, recs
    from public.sop_documents where sop_number = 'FSQM-014';
  if proc is null then
    raise exception 'FSQM-014 does not exist.';
  end if;

  -- Exactly one line talks about FRM-301's fillability, and it must be either the stale wording
  -- or the corrected one. Anything else means the Part was rewritten and this must not guess.
  select count(*) into n from jsonb_array_elements_text(proc) s
   where s like '> FRM-301 is an active controlled document%';
  if n <> 1 then
    raise exception 'Found % lines describing FRM-301, expected exactly 1.', n;
  end if;
  select count(*) into n from jsonb_array_elements_text(proc) s
   where s like '> FRM-301 is an active controlled document%'
     and (s like '%is not yet a fillable record%' or s like '%and a fillable record%');
  if n <> 1 then
    raise exception 'The FRM-301 line is neither the stale nor the corrected wording.';
  end if;

  if recs not like '%Presently kept on paper%' and recs not like '%kept in the Team Portal%' then
    raise exception 'The Records section is neither the stale nor the corrected wording.';
  end if;

  -- The correction asserts FRM-301 is fillable. It must actually be fillable.
  select count(*) into n from public.sop_documents
   where sop_number = 'FRM-301' and status = 'active' and (content ? 'form_schema');
  if n <> 1 then
    raise exception 'FRM-301 is not an active document carrying a form_schema; the correction would be false.';
  end if;
end $$;

create temporary table fsqm014_f301_before on commit drop as
select md5((content - 'procedure' - 'records')::text)                 as rest_h,
       (select jsonb_agg(x.line order by x.ord)
          from jsonb_array_elements(content->'procedure') with ordinality x(line, ord)
         where (x.line #>> '{}') not like '> FRM-301 is an active controlled document%') as other_lines
  from public.sop_documents where sop_number = 'FSQM-014';

update public.sop_documents d
   set content = jsonb_set(
         jsonb_set(d.content, '{procedure}', (
           select jsonb_agg(
                    case when (x.line #>> '{}') like '> FRM-301 is an active controlled document%'
                         then to_jsonb($ln$> FRM-301 is an active controlled document and a fillable record in the Team Portal. Its Receiving Log carries a package-label scan on every row: the receiver photographs the material's own label and the supplier, the material description and the lot code are read from it into the row. That is the control worth having here — a lot code transcribed by hand at a loading dock is the entry most likely to be wrong, and it is the one every trace exercise afterwards depends on.$ln$::text)
                         else x.line end
                    order by x.ord)
             from jsonb_array_elements(d.content->'procedure') with ordinality x(line, ord))),
         '{records}', to_jsonb($rc$FRM-301 Incoming Material Receiving & Inspection Log — the incoming inspection of every delivery of raw material and packaging, kept in the Team Portal.
Batch sheets — the in-process inspection of every batch, recorded as the batch is made.
FRM-701 Finished Product Release Record — the finished product inspection, recorded as part of the release decision under FSQM-020.
FRM-703 Retention Sample Log — every retention sample taken, where it is stored, and its disposal.
FRM-702 Non-Conforming Material Hold & Tagging Record — where an inspection failure results in a hold.
Together these are the records of all inspections that SQF 2.4.4.6 requires. There are no records of analysis, because no analysis is performed — see Part 2.
Retention: two years, or the shelf life of the product plus twelve months, whichever is longer. This is the period set by FSQM-009 Part 10, so an inspection, a hold arising from it and any investigation that follows are retained on the same basis.$rc$::text))
 where d.sop_number = 'FSQM-014' and d.status = 'draft';

do $$
declare
  r record;
  drift int;
begin
  select status, revision,
         jsonb_array_length(content->'procedure')                                      as lines,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%is not yet a fillable record%')                              as stale_line,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '> FRM-301 is an active controlled document and a fillable record%') as fixed_line,
         (select count(*) from jsonb_array_elements_text(content->'procedure') s
           where s like '%package-label scan on every row%')                           as scan_sentence,
         (content->>'records') like '%Presently kept on paper%'                        as stale_records,
         (content->>'records') like '%packaging, kept in the Team Portal%'             as fixed_records,
         (content->>'records') like '%Retention: two years%'                           as retention_kept
    into r from public.sop_documents where sop_number = 'FSQM-014';

  if r.lines <> 35 then
    raise exception 'Procedure length changed to %.', r.lines;
  end if;
  if r.stale_line <> 0 or r.fixed_line <> 1 or r.scan_sentence <> 1 then
    raise exception 'Part 3 wrong: stale=%, fixed=%, scan sentence=%.',
      r.stale_line, r.fixed_line, r.scan_sentence;
  end if;
  if r.stale_records or not r.fixed_records then
    raise exception 'Records wrong: stale=%, fixed=%.', r.stale_records, r.fixed_records;
  end if;
  -- The Records section is replaced wholesale, so its other content must have survived.
  if not r.retention_kept then
    raise exception 'The record-retention rule vanished from the Records section.';
  end if;
  if r.status is distinct from 'draft' or r.revision is distinct from 'New' then
    raise exception 'FSQM-014 metadata moved (%/%).', r.status, r.revision;
  end if;

  select count(*) into drift
    from public.sop_documents d, fsqm014_f301_before b
   where d.sop_number = 'FSQM-014'
     and (md5((d.content - 'procedure' - 'records')::text) is distinct from b.rest_h
       or (select jsonb_agg(x.line order by x.ord)
             from jsonb_array_elements(d.content->'procedure') with ordinality x(line, ord)
            where (x.line #>> '{}') not like '> FRM-301 is an active controlled document%')
          is distinct from b.other_lines);
  if drift <> 0 then
    raise exception 'FSQM-014 changed beyond the FRM-301 line and the Records section. Rolled back.';
  end if;
end $$;

-- ---------------------------------------------------------------- FRM-703 stays deletable
do $$
declare r record;
begin
  update public.sop_documents
     set content = jsonb_set(content, '{form_schema,settings}',
           (content->'form_schema'->'settings') - 'deletable')
   where sop_number = 'FRM-703' and status = 'draft';

  select (content->'form_schema'->'settings' ? 'deletable')                            as has_deletable,
         (content->'form_schema'->'settings'->>'allowMultipleDrafts')                  as multi,
         (content->'form_schema'->'settings'->>'attachmentsEnabled')                   as attach,
         (content->'form_schema'->'settings'->>'instanceTitleTemplate')                as tmpl,
         (select count(*) from jsonb_array_elements(content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                    as fields,
         (content->'form_schema'->'sections'->0->>'scanLabel')                         as scan_on
    into r from public.sop_documents where sop_number = 'FRM-703';

  if r.has_deletable then
    raise exception 'FRM-703 still pins deletable; the owner chose to leave entries deletable.';
  end if;
  -- Everything else about the form must be untouched by that removal.
  if r.multi is distinct from 'true' or r.attach is distinct from 'true'
     or r.tmpl is null or r.fields <> 20 or r.scan_on is distinct from 'true' then
    raise exception 'FRM-703 settings collateral damage: multi=%, attach=%, tmpl=%, fields=%, scan=%.',
      r.multi, r.attach, coalesce(r.tmpl, 'unset'), r.fields, coalesce(r.scan_on, 'unset');
  end if;
end $$;

commit;
