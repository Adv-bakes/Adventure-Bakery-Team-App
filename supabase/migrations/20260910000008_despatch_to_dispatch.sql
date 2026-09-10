-- FSQM-036 and FRM-801: "despatch" -> "dispatch".
--
-- THE SQF CODE SPELLS IT "dispatch" - 2.6.1.1 ("receipt, production, storage, and dispatch") and
-- 2.6.3.1 ("finished product dispatch and destination"). An auditor reading FSQM-036 beside the code
-- it is written against should not meet a different spelling of the code's own word. "Despatch" is a
-- British variant and this is a US site; the owner caught it.
--
-- NO HOUSE PRECEDENT WAS BROKEN either way: these two documents are the only ones in the system that
-- use the word at all, in either spelling, and both are still draft. So this is a correction, not a
-- change of convention.
--
-- TWO OF THE 31 OCCURRENCES ARE FIELD IDS - despatch_date and despatched_by. Field ids are locked
-- after a form's first entry because answers key on them, so this is the last moment renaming them
-- costs nothing. FRM-801 has no entries and the migration refuses to run if that stops being true.
--
-- THE REPLACEMENT IS EXACT, NOT APPROXIMATE. The whole row is snapshotted, the substitution is applied
-- to the snapshot in Postgres, and the post-guard asserts the new content is byte-identical to that
-- computed value - so the migration cannot alter anything except the seven letters it is here for.
-- Runs after 20260910000007 and does not depend on it: it fixes whatever spelling is present.
--
-- The migration file 20260910000005_frm801_despatch_record.sql keeps its name. It is already applied
-- and a filename recorded in schema_migrations is immutable.

begin;

create temporary table _spell_before on commit drop as
select id, sop_number, title, content,
       md5(content::text) as old_hash,
       replace(replace(title, 'espatch', 'ispatch'), 'ESPATCH', 'ISPATCH')         as want_title,
       replace(replace(content::text, 'espatch', 'ispatch'), 'ESPATCH', 'ISPATCH') as want_content
  from public.sop_documents
 where sop_number in ('FSQM-036', 'FRM-801');

do $$
declare r record;
begin
  select
    (select status from public.sop_documents where sop_number = 'FSQM-036')  as s36,
    (select status from public.sop_documents where sop_number = 'FRM-801')   as s801,
    (select count(*) from _spell_before)                                     as docs,
    (select count(*) from public.sop_document_responses rr
       join public.sop_documents dd on dd.id = rr.document_id
      where dd.sop_number = 'FRM-801')                                       as entries,
    (select count(*) from _spell_before b,
            regexp_matches(b.content::text || coalesce(b.title, ''), 'espatch', 'gi'))
                                                                             as hits
  into r;

  if r.docs <> 2 then
    raise exception 'Expected FSQM-036 and FRM-801; found % rows.', r.docs;
  end if;
  if r.s36 is distinct from 'draft' or r.s801 is distinct from 'draft' then
    raise exception 'Expected both draft; found FSQM-036=%, FRM-801=%.', r.s36, r.s801;
  end if;
  -- Renaming a field id under an existing answer would orphan it into "Unmapped answers".
  if r.entries <> 0 then
    raise exception 'FRM-801 has % entries; field ids are locked once answers key on them.', r.entries;
  end if;
  if r.hits = 0 then
    raise exception 'Nothing to correct - no "despatch" found in either document.';
  end if;
end $$;

update public.sop_documents d
   set title   = b.want_title,
       content = b.want_content::jsonb
  from _spell_before b
 where d.id = b.id;

do $$
declare r record;
begin
  select
    (select count(*) from public.sop_documents d
       join _spell_before b on b.id = d.id
      where d.title is distinct from b.want_title
         or d.content::text is distinct from b.want_content)                 as mismatched,
    (select count(*) from public.sop_documents d
            join _spell_before b on b.id = d.id,
            regexp_matches(d.content::text || coalesce(d.title, ''), 'espatch', 'gi'))
                                                                             as remaining,
    (select count(*) from public.sop_documents d
       join _spell_before b on b.id = d.id
      where md5(d.content::text) = b.old_hash)                               as unchanged,
    (select count(*) from public.sop_documents d,
            jsonb_array_elements(d.content->'form_schema'->'sections') s,
            jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-801'
        and f->>'id' in ('dispatch_date', 'dispatched_by'))                  as renamed,
    (select title from public.sop_documents where sop_number = 'FRM-801')    as t801
  into r;

  -- Byte-identical to the substitution computed before the update: nothing else moved.
  if r.mismatched <> 0 then
    raise exception '% row(s) differ from the computed substitution.', r.mismatched;
  end if;
  if r.remaining <> 0 then
    raise exception '% occurrence(s) of "despatch" remain.', r.remaining;
  end if;
  if r.unchanged <> 0 then
    raise exception '% row(s) were not changed at all.', r.unchanged;
  end if;
  if r.renamed <> 2 then
    raise exception 'Expected dispatch_date and dispatched_by; found % of 2.', r.renamed;
  end if;
  if r.t801 <> 'Dispatch and Vehicle Loading Record' then
    raise exception 'FRM-801 title is "%".', r.t801;
  end if;
end $$;

commit;
