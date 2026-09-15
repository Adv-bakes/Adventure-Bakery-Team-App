-- FSQM-039: record where the editable master lives and how to open it.
--
-- WHY. The document already says the master travels with the PDFs, but not where to find it or
-- what opens it. A .drawio file is inert without that: the reader has an attachment they cannot
-- use, which is the same practical problem as having no master at all. This names the Reference
-- Documents tab and app.diagrams.net, and states the re-export discipline that keeps the three
-- attachments agreeing with each other.
--
-- THE RE-EXPORT RULE IS THE POINT, not the URL. Editing the master and not re-exporting leaves the
-- record holding sheets that disagree with the drawing they came from. That happened twice while
-- this document was being built -- once after the FSQM-037 -> FSQM-039 renumber and once after the
-- page-height fix -- and both times the attached PDFs contradicted the record until they were
-- replaced. Writing the rule down is cheaper than rediscovering it.
--
-- SCOPE: two strings. One procedure line is extended and the records section gains a sentence.
-- Nothing else changes: same 27 procedure lines, same attachments, still draft, still no clause.
--
-- IDEMPOTENT: guarded on the new text being absent, so a second run is a clean no-op.

begin;

do $$
declare n int;
begin
  select count(*) into n from public.sop_documents
   where sop_number = 'FSQM-039' and status = 'draft';
  if n <> 1 then
    raise exception 'FSQM-039 is not a single draft row; refusing to edit content.';
  end if;
  -- The line being extended must still be there verbatim, or the replace would silently no-op.
  select count(*) into n from public.sop_documents
   where sop_number = 'FSQM-039'
     and (content->'procedure')::text like '%so the master travels with the PDFs.%';
  if n <> 1 then
    raise exception 'FSQM-039 procedure no longer carries the master line this migration extends.';
  end if;
end $$;

update public.sop_documents
   set content = jsonb_set(
         jsonb_set(content, '{procedure}',
           (select jsonb_agg(
                     replace(e,
                       'so the master travels with the PDFs.',
                       'so the master travels with the PDFs. It is attached to this record in the '
                       || 'Reference Documents tab as a .drawio file, and is opened and edited at '
                       || 'app.diagrams.net (File, Open From, Device) with nothing to install. '
                       || 'After any change to the master, re-export BOTH sheets and replace all '
                       || 'three attachments together, so the record never holds sheets that '
                       || 'disagree with the drawing they came from.')
                     order by ord)
              from jsonb_array_elements_text(content->'procedure') with ordinality as t(e, ord))),
         '{records}',
         to_jsonb(
           replace(content->>'records',
             'and the editable draw.io master from which both sheets are exported.',
             'and the editable draw.io master from which both sheets are exported. The master is '
             || 'in the Reference Documents tab of this record and is edited at app.diagrams.net; '
             || 'both sheets are re-exported from it and all three attachments replaced together '
             || 'whenever it changes.')))
 where sop_number = 'FSQM-039'
   and (content->'procedure')::text not like '%app.diagrams.net%';

do $$
declare r record;
begin
  select status, revision, sqf_reference, sqf_required,
         jsonb_array_length(content->'procedure')   as lines,
         jsonb_array_length(content->'attachments') as files,
         (content->'procedure')::text like '%app.diagrams.net (File, Open From, Device)%' as how_to_open,
         (content->'procedure')::text like '%Reference Documents tab as a .drawio file%'   as where_it_is,
         (content->'procedure')::text like '%re-export BOTH sheets and replace all three%'  as reexport_rule,
         (content->>'records') like '%edited at app.diagrams.net%'                          as records_note,
         (content->>'governing_reference') like '%WHAT IT IS NOT%'                          as disclaimer,
         (content->>'revision_history') like '%OPEN BEFORE ISSUE — ONE ITEM%'               as one_item
    into r
    from public.sop_documents where sop_number = 'FSQM-039';

  if r.lines <> 27 then
    raise exception 'procedure is % lines, expected 27; the array rebuild lost elements.', r.lines;
  end if;
  if not r.how_to_open or not r.where_it_is or not r.reexport_rule then
    raise exception 'the master-editing note did not land in procedure.';
  end if;
  if not r.records_note then
    raise exception 'the records section was not updated.';
  end if;
  -- nothing this migration touches should have disturbed what made the document correct
  if r.status is distinct from 'draft' or r.revision is distinct from 'New'
     or r.sqf_reference is not null or r.sqf_required is not false
     or coalesce(r.files, 0) <> 3 or not r.disclaimer or not r.one_item then
    raise exception 'FSQM-039 lost draft status, the clause disclaimer, the one-open-item '
                    'structure, or its attachments.';
  end if;
  raise notice 'FSQM-039: master location and app.diagrams.net editing recorded; % lines, % files.',
    r.lines, r.files;
end $$;

commit;
