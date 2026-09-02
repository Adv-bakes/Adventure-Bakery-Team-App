-- FRM-007: expand "CAPA" on the form, and show a worked Five Whys example. D-07, follow-up.
--
-- TWO GAPS FOUND BY READING THE FORM AS SOMEBODY WHO HAS NOT READ THE PROGRAM.
--
-- 1. THE ACRONYM WAS NEVER EXPANDED ON THE FORM ITSELF. FRM-007 used the string "CAPA"
--    thirteen times and expanded it nowhere in the body - the only expansion was the
--    document title. That title does print on the blank and does show in the drawer, but
--    the Entries list shows "Corrective action CAPA-2026-001 - ...", and anybody handed the
--    form mid-process never sees the header at all. The term is also defined in FSQM-009,
--    but that is a different document and the person filling this form is often not the
--    person who read the program.
--
--    This is more than housekeeping. THE SQF CODE NEVER USES THE ACRONYM - zero occurrences
--    across both code editions - so it is industry shorthand, not code language, and nobody
--    is primed for it by the standard. FSQM-009 says any employee may raise a
--    non-conformance and that action owners include Maintenance, so the audience is wider
--    than QA. One member of production staff is trained in Spanish, and 2.9.2.2 is about
--    exactly this: a form that assumes its own jargon excludes the people it is for.
--
--    The first info block now opens with the expansion and names the three things a CAPA
--    holds - correction, corrective action, preventive action - before listing the triggers.
--
-- 2. THE FIVE WHYS GRID SHOWED NO EXAMPLE OF ITS OWN USE. It is the hardest thing on the
--    form and the easiest to do badly; the failure mode is stopping at the first plausible
--    answer and writing "remind staff to be careful". The info block already said "operator
--    error is not a root cause", which tells somebody what NOT to do without showing what to
--    do instead. It now carries a worked chain end to end - observation, three whys, whys 4
--    and 5 deliberately left blank, root cause, why it was not detected sooner - and then
--    shows that same example producing three DIFFERENT actions, which is the distinction
--    Part 2 of FSQM-009 exists to draw.
--
--    The example is a sanitizer-concentration finding rather than an invented one, so it
--    reads as something that could have happened here.
--
-- PLAIN TEXT, NO MARKDOWN. Info blocks render through three paths - whitespace-pre-wrap on
-- screen, newline-to-<br/> in the PDF blank, and a python-docx run in the Word blank - and
-- none of them parses **bold**, so a marker would render literally. All eight info blocks on
-- this form were checked and none uses one. Newlines DO survive all three; the .docx path was
-- verified in the generated XML, where the paragraph breaks come through as <w:br/>.
--
-- No revision bump and no history snapshot: FRM-007 is still draft, has never been issued and
-- has zero entries. The guard fails loudly if any of that has changed.
--
-- Written with jsonb_set on the two info fields' own keys, with the section and field indices
-- looked up BY ID rather than hardcoded, so a later re-section of this form cannot make the
-- migration write into the wrong place if it is ever replayed. No field is added or removed.

begin;

do $$
declare
  r record;
begin
  select d.status, d.revision,
         (select count(*) from public.sop_document_responses p
           where p.document_id = d.id)                                                as entries,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f)                   as fields,
         (select count(*) from jsonb_array_elements(d.content->'form_schema'->'sections') s,
                               jsonb_array_elements(s->'fields') f
           where f->>'type' = 'info' and f->>'text' like '%**%')                      as md_bold
    into r
    from public.sop_documents d where d.sop_number = 'FRM-007';

  if r is null then
    raise exception 'FRM-007 does not exist.';
  end if;
  if r.status <> 'draft' or r.revision <> 'New' then
    raise exception 'FRM-007 is % at revision % - it has been issued, so this needs a revision bump. Stop and re-derive.',
      r.status, r.revision;
  end if;
  if r.entries <> 0 then
    raise exception 'FRM-007 has % entries - re-derive so the change is deliberate.', r.entries;
  end if;
  if r.fields <> 54 then
    raise exception 'FRM-007 has % fields, expected the 54 seeded by 20260902000002.', r.fields;
  end if;
  if r.md_bold <> 0 then
    raise exception '% info block(s) already carry ** markers, which render literally.', r.md_bold;
  end if;
end $$;

do $$
declare
  si int; fi int;
begin
  -- Section 1 info block: expand the acronym above the trigger list.
  select (so - 1)::int, (fo - 1)::int into si, fi
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality s(s, so),
         jsonb_array_elements(s->'fields') with ordinality x(f, fo)
   where d.sop_number = 'FRM-007' and f->>'id' = 'threshold_info';
  if si is null then raise exception 'FRM-007 has no threshold_info field.'; end if;

  update public.sop_documents
     set content = jsonb_set(
           jsonb_set(content,
                     array['form_schema','sections',si::text,'fields',fi::text,'text'],
                     $t1$"CAPA stands for Corrective and Preventive Action. One CAPA covers one thing that went wrong, from start to finish: what was done straight away to make it safe (the correction), what was done so it does not happen again (the corrective action), what was done so the same cause cannot bite somewhere it has not yet (the preventive action), and the check that those actually worked.\n\nFSQM-009 Part 3. A CAPA is opened for: product already released or requiring hold, rework, downgrade or destruction; any critical-limit or CCP deviation; a critical complaint or one alleging illness, injury, foreign material or an undeclared allergen; any repeat within twelve months; any audit, certification body or regulatory finding; any inspection finding not corrected on the spot; any withdrawal or recall including a test; a presumptive positive or adverse environmental trend; a glass or brittle plastic breakage where product or a food-contact surface was exposed; or anything the SQF Practitioner judges to warrant one.\n\nA routine non-conformance corrected on the spot is recorded on the form that found it and does not open a CAPA. When in doubt, open one."$t1$::jsonb),
           array['form_schema','sections',si::text,'fields',fi::text,'label'],
           $t2$"What a CAPA is, and when to open one"$t2$::jsonb)
   where sop_number = 'FRM-007' and status = 'draft';

  -- Section 4 info block: add the worked Five Whys example.
  select (so - 1)::int, (fo - 1)::int into si, fi
    from public.sop_documents d,
         jsonb_array_elements(d.content->'form_schema'->'sections') with ordinality s(s, so),
         jsonb_array_elements(s->'fields') with ordinality x(f, fo)
   where d.sop_number = 'FRM-007' and f->>'id' = 'investigation_info';
  if si is null then raise exception 'FRM-007 has no investigation_info field.'; end if;

  update public.sop_documents
     set content = jsonb_set(content,
           array['form_schema','sections',si::text,'fields',fi::text,'text'],
           $t3$"\"Operator error\" and \"training issue\" are not root causes — they are where an investigation stopped. If an operator made an error, ask why the process let that error reach product undetected.\n\nAnswer both questions: why the control failed, and why it was not detected sooner. The second is usually where the real corrective action lies.\n\nHOW THE FIVE WHYS TABLE IS USED. Start from what you wrote in Section 2 and ask why that happened; the answer goes in Why 1. Then ask why THAT happened, and so on. Each row answers the row above it, not the original problem. Five is a rule of thumb, not a target — stop when you reach a cause the site can actually change.\n\nWORKED EXAMPLE. Observed: the pre-operation check found the sanitizer at the depositor reading below the required concentration.\nWhy 1 — the solution had been in the bucket since the previous shift.\nWhy 2 — it is mixed once a day at start-up and not re-made during the shift.\nWhy 3 — the SSOP sets a mixing frequency but gives no trigger for re-making it.\nWhy 4 and 5 — left blank; Why 3 is already something the site can change.\nRoot cause: the SSOP says when to mix sanitizer but not when to re-make it, so a solution that degrades during the shift stays in use until the next day.\nNot detected sooner because: strips are only used at pre-op, so nothing checks concentration mid-shift.\n\nNotice where that leads, because the three are different and only the first is about today. The correction is to dump and re-make the bucket. The corrective action is to give the SSOP a re-make trigger. The preventive action is to make the same change to the other machines' SSOPs, which share the gap.\n\nA weak investigation would have stopped at Why 1 and written \"remind staff to check the sanitizer\". That closes the CAPA and changes nothing, and the finding comes back."$t3$::jsonb)
   where sop_number = 'FRM-007' and status = 'draft';
end $$;

do $$
declare
  r record;
begin
  select
    (select count(*) from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007')                                                 as fields,
    (select f->>'text' from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007' and f->>'id' = 'threshold_info')                 as thr,
    (select f->>'label' from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007' and f->>'id' = 'threshold_info')                 as thr_label,
    (select f->>'text' from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007' and f->>'id' = 'investigation_info')             as inv,
    (select count(*) from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007' and f->>'type' = 'info'
        and f->>'text' like '%**%')                                                   as md_bold,
    (select count(*) from public.sop_documents d,
           jsonb_array_elements(d.content->'form_schema'->'sections') s,
           jsonb_array_elements(s->'fields') f
      where d.sop_number = 'FRM-007' and f->>'type' = 'grid'
        and not (f->'rows' ? 'mode'))                                                 as modeless,
    (select revision from public.sop_documents where sop_number = 'FRM-007')          as rev
  into r;

  if r.fields <> 54 then
    raise exception 'FRM-007 now has % fields, expected 54 - this migration adds none.', r.fields;
  end if;
  if r.rev <> 'New' then
    raise exception 'FRM-007 revision changed to %.', r.rev;
  end if;
  -- the acronym must be expanded, and expanded FIRST
  if r.thr not like 'CAPA stands for Corrective and Preventive Action.%' then
    raise exception 'The acronym is not expanded at the top of the first info block.';
  end if;
  if r.thr not like '%the correction%' then
    raise exception 'The first info block does not name the correction.';
  end if;
  if r.thr not like '%the corrective action%' then
    raise exception 'The first info block does not name the corrective action.';
  end if;
  if r.thr not like '%the preventive action%' then
    raise exception 'The first info block does not name the preventive action.';
  end if;
  if r.thr_label <> 'What a CAPA is, and when to open one' then
    raise exception 'The first info block label is %.', r.thr_label;
  end if;
  -- the trigger list it now sits above must still be there
  if r.thr not like '%FSQM-009 Part 3. A CAPA is opened for:%' then
    raise exception 'The trigger list was lost from the first info block.';
  end if;
  -- the worked example, and the point it makes
  if r.inv not like '%WORKED EXAMPLE.%' then
    raise exception 'The worked Five Whys example is missing.';
  end if;
  if r.inv not like '%Why 4 and 5%' then
    raise exception 'The example does not show a chain stopping short of five.';
  end if;
  if r.inv not like '%Root cause:%' then
    raise exception 'The example does not state a root cause.';
  end if;
  if r.inv not like '%Not detected sooner because:%' then
    raise exception 'The example does not answer the second question.';
  end if;
  if r.inv not like '%only the first is about today%' then
    raise exception 'The example does not draw the correction/corrective/preventive distinction.';
  end if;
  if r.inv not like '%are not root causes%' then
    raise exception 'The original "operator error is not a root cause" guidance was lost.';
  end if;
  -- markdown would render literally through all three output paths
  if r.md_bold <> 0 then
    raise exception '% info block(s) carry ** markers, which render literally on screen and on paper.',
      r.md_bold;
  end if;
  if r.modeless <> 0 then
    raise exception '% grid(s) lost rows.mode.', r.modeless;
  end if;
end $$;

commit;
