-- Renumber controlled FORMS to the process-stage convention (<FRM>-<NNN>, block = stage).
-- See DOCUMENT_REGISTER.md. Each row:
--   * sop_number       -> new canonical FRM-NNN
--   * legacy_sop_number-> the prior identifier that was embedded in the title (null if none)
--   * title            -> cleaned (old code + trailing "(RNM)" author tag removed)
-- Id-keyed and idempotent-ish (safe to run once). Scope: type = 'form' only. SOPs (currently
-- SQF-clause numbered), FSQM, policy, and training (TR-NN) are intentionally left untouched.

-- 000-099  Food Safety System
update public.sop_documents set sop_number='FRM-001', legacy_sop_number='FRM002',   title='Management Review Record'                              where id='a6824238-964d-4f4b-b885-ef315e64b208';
update public.sop_documents set sop_number='FRM-002', legacy_sop_number='AB-006-1', title='Customer Complaint Report'                             where id='cab6ee67-e61c-4902-8bef-d4aab13864c9';
update public.sop_documents set sop_number='FRM-003', legacy_sop_number=null,        title='Customer Complaint Log'                                where id='0be4e0d8-9f3f-4313-8e4e-8a21cd5c73c7';

-- 100-199  Sales / New Product Development
update public.sop_documents set sop_number='FRM-101', legacy_sop_number=null, title='Product Request & Concept Form'                                where id='e3fc8589-94cf-4f00-9c90-09349426a99f';
update public.sop_documents set sop_number='FRM-102', legacy_sop_number=null, title='Customer & Internal Approval Record'                           where id='fb7af21f-0225-4999-97c2-72160c707792';

-- 200-299  Sourcing & Supplier Approval
update public.sop_documents set sop_number='FRM-201', legacy_sop_number=null, title='Approved Supplier Register'                                     where id='86879e12-0e61-49ba-8ff6-d4bcae8ce543';
update public.sop_documents set sop_number='FRM-202', legacy_sop_number=null, title='Supplier Approval & Evaluation Record'                          where id='3f584465-761a-445b-aa21-84ed2ea25d96';
update public.sop_documents set sop_number='FRM-203', legacy_sop_number=null, title='Vendor & Supplier Questionnaire'                                where id='d3b65462-6b37-45ce-aa39-a5498fa918f2';
update public.sop_documents set sop_number='FRM-204', legacy_sop_number=null, title='Annual Supplier Performance Evaluation Checklist'               where id='4e47d112-f120-4e0c-bff8-241009cc5bf2';
update public.sop_documents set sop_number='FRM-205', legacy_sop_number=null, title='Supplier Non-Conformance & Corrective Action Report (SCAR)'     where id='db429fce-f783-422f-8258-08b27f399fd1';

-- 300-399  Receiving & Incoming Inspection
update public.sop_documents set sop_number='FRM-301', legacy_sop_number='FRM-046-1', title='Incoming Material Receiving & Inspection Log'            where id='9973bd6d-6500-4bb1-8e5c-7e1fff53b222';

-- 500-599  Production & Batching
update public.sop_documents set sop_number='FRM-501', legacy_sop_number=null, title='Formula Sheet & Batch Data'                                     where id='54f97a1b-8d3d-4b6b-98ce-5184aaf7d91e';
update public.sop_documents set sop_number='FRM-502', legacy_sop_number=null, title='First Production Run Report & QC Results'                       where id='8e92cc45-e6cc-4105-bba7-ba53ab0546b9';

-- 600-699  Packaging & Labeling
update public.sop_documents set sop_number='FRM-601', legacy_sop_number=null, title='Label Review & Approval Form'                                   where id='0a1b9e92-8857-49b4-ac8f-20ec9fa9f105';
update public.sop_documents set sop_number='FRM-602', legacy_sop_number=null, title='Approved Label Register'                                         where id='4fef25ac-e20d-47fd-9a8f-3262d870c507';
update public.sop_documents set sop_number='FRM-603', legacy_sop_number=null, title='Label Change Control Log'                                        where id='cde6c2f9-657c-47f6-8561-9263ab61967d';

-- 700-799  QC / Testing / Hold & Release
update public.sop_documents set sop_number='FRM-701', legacy_sop_number=null, title='QA Product & Material Release Log'                               where id='cf6e9497-9a1c-4893-81ae-a79547eb9220';
update public.sop_documents set sop_number='FRM-702', legacy_sop_number=null, title='Non-Conforming Material Hold & Tagging Record'                  where id='7717b881-1d6a-4bc7-9b54-41a8e3d1472c';

-- 900-949  Sanitation & GMP
update public.sop_documents set sop_number='FRM-901', legacy_sop_number='FRM006',  title='Master Sanitation Schedule'                                where id='df81e3da-134d-462b-87a0-4a2b3282747f';
update public.sop_documents set sop_number='FRM-902', legacy_sop_number=null,      title='Sanitation Verification Log'                               where id='ae02682d-06f3-465e-aa58-0325b81b21f5';
update public.sop_documents set sop_number='FRM-903', legacy_sop_number='FRM004',  title='GMP Pre-Operation Inspection'                              where id='96b9eed2-3665-4857-a81c-b839d4f83f9d';
update public.sop_documents set sop_number='FRM-904', legacy_sop_number='FRM005',  title='GMP Daily Operation Check'                                 where id='62680171-bf04-4a4f-a403-0648833ac088';
update public.sop_documents set sop_number='FRM-905', legacy_sop_number='FRM002',  title='Visitor Sign-In Log'                                       where id='f2ecc943-ccba-4c50-8eb0-7727611c236d';
update public.sop_documents set sop_number='FRM-906', legacy_sop_number='FRM002A', title='Visitor GMP Acknowledgement'                               where id='7e50e482-0f81-4d35-9b8c-6f97eda25209';
update public.sop_documents set sop_number='FRM-907', legacy_sop_number='FRM003',  title='Glass & Brittle Plastic Register'                          where id='1a328ec9-9102-4f59-82c1-4ffce171a1c6';
update public.sop_documents set sop_number='FRM-908', legacy_sop_number=null,      title='Glass Breakage Incident Report'                            where id='3b5db556-f331-41a4-b7d1-b40d25be55e9';

-- 950-999  HR / Training / Admin / Records
-- (sqf_reference for the Training Matrix is being set in-app to 2.9.1.1, 2.9.2.1 — left out here
--  so this migration doesn't overwrite it.)
update public.sop_documents set sop_number='FRM-951', legacy_sop_number=null, title='Training Matrix' where id='41764b7d-fab5-4b1c-bf63-5441f5fe6dca';
update public.sop_documents set sop_number='FRM-952', legacy_sop_number=null, title='Training Competency Verification Record'                        where id='09fe8a5c-a51c-41d8-8c1e-1a79ebcc1eee';
update public.sop_documents set sop_number='FRM-953', legacy_sop_number=null, title='Training Sign-In Sheet'                                         where id='7d7d4142-9a83-4ace-a2b0-faff6803de46';
