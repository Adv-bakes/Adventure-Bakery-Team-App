-- FRM-901 Master Sanitation Schedule: add a fillable daily-confirmation form schema.
-- One response per production day; the equipment register (rows) carries each machine
-- and its SSOP/log, with a Clean & sanitized / Not used today status per machine.
-- Additive to the existing active record (Word/PDF attachments left in place). The
-- form_schema change is a snapshot-watched field, so this UPDATE records a history row.

update public.sop_documents
set content = coalesce(content, '{}'::jsonb) || jsonb_build_object('form_schema', '{"schemaVersion":1,"settings":{"deletable":false,"allowMultipleDrafts":true,"requireVerification":false,"attachmentsEnabled":true,"instanceTitleTemplate":"{log_date} — Daily sanitation confirmation"},"sections":[{"id":"entry","fields":[{"id":"log_date","type":"date","label":"Production date","required":true,"defaultToday":true,"width":"third","showInList":true},{"id":"product_run","type":"text","label":"Product / batch run","width":"half","showInList":true,"help":"What was produced today (leave blank if no production)"}]},{"id":"equipment","title":"Equipment — Cleaned & Sanitized","description":"For each machine used in today''s production, confirm it was verified clean and sanitized per its SSOP, or mark \"Not used today\". Add or remove equipment as the line changes.","fields":[{"id":"equipment_status","type":"grid","label":"Equipment","columns":[{"id":"status","label":"Status","type":"select","required":true,"options":["Clean & sanitized","Not used today"],"width":2},{"id":"notes","label":"Notes","type":"text","width":3}],"rows":{"mode":"fixed","deletable":true,"labelHeader":"Equipment","labels":["Hobart V-1401 Mixer — SOP-901 / FRM-909","Kook-E-King Depositor — SOP-902 / FRM-910","Beldos 275 Depositor — SOP-903 / FRM-911","Smipack S560NA Shrink Wrapper — SOP-601","Groen TDB Kettle — SOP-904 / FRM-912"],"addLabel":"Add equipment"}}]},{"id":"sign","title":"Confirmation","fields":[{"id":"confirmed_by","type":"signature","role":"filler","label":"Verified by","required":true,"statement":"I confirm the equipment used in today''s production was verified clean and sanitized per its SSOP, and recorded on its cleaning log.","width":"half"}]}]}'::jsonb)
where sop_number = 'FRM-901'
  and (content -> 'form_schema') is null;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260726000008', 'frm901_master_sanitation_form_schema')
on conflict (version) do nothing;
