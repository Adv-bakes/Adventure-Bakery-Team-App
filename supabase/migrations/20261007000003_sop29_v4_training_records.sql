-- SOP-2.9 Training & Recordkeeping v3 -> v4 (D-24, SQF 2.9.2.3). Approved GJM, effective 2026-10-07.
--
-- The finding was that FRM-953 could not be assessed because it was not in the Team Portal. It is
-- there now, and FRM-952 and FRM-953 between them carry all six elements the clause lists. What
-- the procedure still got wrong:
--   - it never said who the trainer or provider is for training done in the app (element v);
--   - it gave the FRM-952 competency record to "Supervisors" and the filing to a "QA Admin". The
--     site has neither position, so nobody was responsible for the record.
-- Owner's decisions, 2026-10-07: FRM-952 is needed for CCP monitoring, operating each machine, and
-- receiving and release; the person who gave the training is the assessor. FRM-952 stays a record
-- of someone watched doing the task, never made from a quiz pass.
--
-- No form changes. ONE UPDATE, guarded on the md5 read from production on 2026-10-07.

begin;

do $guard$
declare h text; p jsonb;
begin
  select md5((content - 'attachments')::text), content->'procedure' into h, p
    from public.sop_documents where sop_number = 'SOP-2.9' and status = 'active' and revision = 'v3';
  if h is distinct from '8fc4090bdd263971dfc8f21a9991e9cd' then raise exception 'SOP-2.9 is not the v3 this migration was written against (md5 %).', h; end if;
  if jsonb_array_length(p) <> 7 or p->>3 not like '4. Assigned training is delivered%' or p->>4 not like '5. Instructor-led or on-the-floor training%'
     or p->>5 not like '6. The program covers at minimum%' or p->>6 not like '7. Training records are retained%' then
    raise exception 'SOP-2.9 steps are not in the order this migration expects.';
  end if;
end $guard$;

-- Steps 4, 6 and 7 are rewritten in place (6 and 7 become 7 and 8), then the new step 6 is inserted.
update public.sop_documents
   set content = jsonb_set(jsonb_set(
                   jsonb_insert(
                     jsonb_set(jsonb_set(jsonb_set(content,
                       '{procedure,3}', to_jsonb($t$4. Assigned training is delivered and completed electronically through the Adventure Bakery Team App. Each employee, contractor, and temporary staff member completes their assigned training while logged in under their individual username; the system records the participant’s identity, the module completed, the completion date, and the quiz/competency result. A separate sign-in sheet is not required for app-based training. For this training the training provider is Adventure Bakery: each module is prepared and approved under the SQF Practitioner, and its title and content are the description of the skill and of the training given. Passing the module’s quiz and, where the module asks for it, signing its acknowledgement is the verification for that module.$t$::text)),
                       '{procedure,5}', to_jsonb($t$7. The program covers at minimum the competencies below. REP-951 — Training Matrix records which positions require each one and tracks completion.
i. HACCP principles — for staff who develop and maintain the food safety plans.
ii. Monitoring and corrective action at critical control points — for every person who monitors a CCP and for their named backup.
iii. Personal hygiene — for all staff who handle food or food-contact surfaces, including contractors and temporary staff.
iv. Good Manufacturing Practices and work instructions — for all staff engaged in food handling, processing, and equipment. Each machine’s operating and sanitation SOP is the work instruction for that station.
v. Sampling and test methods — for staff who sample or test raw materials, packaging, work-in-progress, or finished product.
vi. Environmental monitoring — for staff who take environmental samples.
vii. Allergen management, food defense, and food fraud — for all relevant staff.
viii. Any task identified as critical to the effective implementation and maintenance of the SQF System, as listed in the Training Matrix.$t$::text)),
                       '{procedure,6}', to_jsonb($t$8. Training records are retained for a minimum of two (2) years.$t$::text)),
                     '{procedure,5}', to_jsonb($t$6. A quiz shows what a person knows, not that they can do the task. For the tasks below, the person who gave the training watches the trainee carry out the task and records the result on FRM-952 — Training Competency Verification Record. A person new to the task does not do it alone until that record shows them competent. One record may cover several tasks assessed on the same day.
i. Monitoring a critical control point — recording the bake and the seal — for each person who does it and for their backup.
ii. Operating each machine the person runs, against that machine’s operating SOP.
iii. Receiving deliveries (FRM-301) and releasing finished lots (FRM-701).$t$::text)),
                   '{responsibility}', to_jsonb($t$• SQF Practitioner: decides what training each position needs, oversees training content and frequency, reviews the Training Matrix (REP-951) for training not completed, and keeps the FRM-952 and FRM-953 records.
• Trainers: the person who gives instructor-led or on-the-floor training records it on FRM-953 and, for the tasks in step 6, verifies competency on FRM-952.
• All staff: complete their assigned training under their own log-in.$t$::text)),
                   '{revision_history}', to_jsonb(coalesce(content->>'revision_history', '') || $t$

v4, 2026-10-07 (SQF 2.9.2.3). Step 4 now says who the training provider is for training done in the app and what verifies it. A new step 6 names the tasks that need a competency record on FRM-952 - monitoring a critical control point, operating each machine, receiving and release - made by the person who gave the training; the old steps 6 and 7 become 7 and 8. Responsibility is rewritten on positions the site has: the earlier text gave the competency record to Supervisors and the filing to a QA Admin, and the site has neither.$t$)),
       revision = 'v4', approved_by = 'GJM', effective_date = date '2026-10-07'
 where sop_number = 'SOP-2.9' and status = 'active' and revision = 'v3';

do $verify$
declare c jsonb; n int;
begin
  select count(*) into n from public.sop_documents where sop_number = 'SOP-2.9';
  if n <> 1 then raise exception 'expected one SOP-2.9, found %.', n; end if;
  select content into c from public.sop_documents
   where sop_number = 'SOP-2.9' and status = 'active' and revision = 'v4' and approved_by = 'GJM' and effective_date = date '2026-10-07';
  if c is null then raise exception 'SOP-2.9 v4 is not active and stamped.'; end if;
  if jsonb_array_length(c->'procedure') <> 8 then raise exception 'SOP-2.9 should have 8 steps.'; end if;
  if c->'procedure'->>3 not like '%the training provider is Adventure Bakery%' or c->'procedure'->>4 not like '5. Instructor-led%'
     or c->'procedure'->>5 not like '6. A quiz shows what a person knows%' or c->'procedure'->>6 not like '7. The program covers at minimum%'
     or c->'procedure'->>6 not like '%viii. Any task identified as critical%' or c->'procedure'->>7 not like '8. Training records are retained%' then
    raise exception 'SOP-2.9 steps are not where they should be.';
  end if;
  if (c->'procedure')::text like '%captures the verification%' or c->>'responsibility' ~* '(Supervisors|QA Admin)' then
    raise exception 'old wording is still there.';
  end if;
  if (c->>'responsibility') || (c->'procedure')::text ~* '(Diana|Gabriela|Richard|Mercer)' then
    raise exception 'a controlled document names positions, not people.';
  end if;
  if not exists (select 1 from public.sop_document_history h join public.sop_documents d on d.id = h.document_id
                  where d.sop_number = 'SOP-2.9' and h.revision = 'v3') then
    raise exception 'the v3 snapshot was not written.';
  end if;
end $verify$;

commit;
