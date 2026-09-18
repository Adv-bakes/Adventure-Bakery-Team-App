-- D-11: SOP-2.3.4 v4 - emergency receipt from a non-approved supplier (2.3.4.4) and material
-- from sites under common ownership (2.3.4.5).
--
-- D-11 is "Approved Supplier Program Gaps" and closes three Minor findings. The third, 2.3.4.3, was
-- closed on 2026-09-09 when FRM-301 became an active fillable record (it has submitted entries).
-- This revision closes the other two.
--
-- 2.3.4.4 - the emergency route. Recorded on FRM-301, deliberately NOT on a new form: the receiving
-- log already has an "Approved Supplier & COA/LOG/COC (Y/N)" pass/fail column and a Comments / Hold
-- Status column, and its Verify Documentation instruction already says an unlisted supplier needs
-- authorisation before acceptance. What was missing was the procedure that instruction points at.
-- FRM-301's schema is untouched, so it is not revised.
--
-- The route carries one line that matters more than the others: AN EMERGENCY RECEIPT DOES NOT
-- APPROVE THE SUPPLIER. Without it the route is a side door.
--
-- 2.3.4.5 - common ownership. The owner confirmed 2026-09-18 there is NO other site. The rule is
-- stated anyway, as prose, because the clause asks for the provision and a "not applicable" with
-- no rule behind it gives an auditor nothing to test the day a second site appears.
--
-- Role: the new text says SQF Practitioner. FSQM-004 records QA Manager / Quality Leader as the
-- site's shorthand for that post; the existing responsibility line keeps its wording and is only
-- extended, not renamed.
--
-- APPENDED, NOT INSERTED: the new steps follow the existing body, so every existing procedure index
-- is unchanged and the v2 contract-services paragraph stays at index 14. sqf_reference stays
-- 2.3.4, which already covers .4 and .5.
--
-- Issued as v4, active, GJM, 2026-09-18 - the same way v2 and v3 were. The history trigger
-- snapshots v3.

begin;

do $guard$
declare c jsonb; st text; rev text;
begin
  select content, status, revision into c, st, rev
    from public.sop_documents where sop_number = 'SOP-2.3.4';
  if (st, rev) is distinct from ('active', 'v3') then
    raise exception 'SOP-2.3.4 is %/% - expected active/v3.', st, rev;
  end if;
  if jsonb_array_length(c->'procedure') <> 15 then
    raise exception 'SOP-2.3.4 procedure is % lines, expected 15.', jsonb_array_length(c->'procedure');
  end if;
  if c->'procedure'->>14 not like '%FRM-206 Contract Services Register%' then
    raise exception 'procedure[14] is not the v2 contract-services paragraph.';
  end if;
  if (c->'procedure')::text ilike '%emergency%' or (c->'procedure')::text ilike '%common ownership%' then
    raise exception 'SOP-2.3.4 already carries an emergency or common-ownership provision.';
  end if;
  if c->>'form_references' not like 'FRM-203 - Vendor & Supplier Questionnaire%'
     or c->>'records' not like '• FRM-203 Vendor & Supplier Questionnaire (completed and signed)%' then
    raise exception 'form_references / records are not the v3 text this replaces.';
  end if;
  -- every document the new text names must exist and be in force
  if (select count(*) from public.sop_documents
       where sop_number in ('FRM-202','FRM-301','FRM-702','FSQM-018','SOP-2.3.2') and status = 'active') <> 5 then
    raise exception 'one of FRM-202, FRM-301, FRM-702, FSQM-018, SOP-2.3.2 is not active.';
  end if;
  -- the FRM-301 columns the route relies on must still be there
  if not exists (select 1 from public.sop_documents d,
                   jsonb_array_elements(d.content->'form_schema'->'sections') s,
                   jsonb_array_elements(s->'fields') f,
                   jsonb_array_elements(f->'columns') col
                  where d.sop_number = 'FRM-301' and col->>'id' = 'approved_supplier_coa_log_coc')
     or not exists (select 1 from public.sop_documents d,
                   jsonb_array_elements(d.content->'form_schema'->'sections') s,
                   jsonb_array_elements(s->'fields') f,
                   jsonb_array_elements(f->'columns') col
                  where d.sop_number = 'FRM-301' and col->>'id' = 'comments_hold_status') then
    raise exception 'FRM-301 no longer has the Approved Supplier or Comments column the route records on.';
  end if;
end $guard$;

update public.sop_documents
   set content = content || jsonb_build_object(
         'procedure',       (content->'procedure') || $p$["Material from a supplier that is not approved is received only in an emergency, and only once the SQF Practitioner has authorised it.", "• An emergency is a supply failure that would otherwise stop or delay production: an approved supplier out of stock or unable to deliver in time, or a delivery rejected at receipt with no approved replacement available. Price, convenience and product trials are not emergencies — a supplier wanted for those is approved on FRM-202 first.", "• The SQF Practitioner authorises the receipt before the material is accepted, for the quantity needed to cover the shortfall and no more.", "• The delivery is recorded on FRM-301 like any other, with the Approved Supplier & COA/LOG/COC column marked N and the Comments recording EMERGENCY – NON-APPROVED SUPPLIER, who authorised it, and the result of the receiving inspection.", "• The receiving inspection is completed and recorded before the material is used: identity against the purchase order, the label and its allergen declaration against the material specification, packaging integrity, lot code and best-by date, and temperature where the material is chilled. Any COA, LOG or COC the supplier can provide is attached to the FRM-301 entry.", "• Material that fails, or whose inspection has not been recorded, is not used. Failed material is segregated, tagged HOLD – DO NOT USE on FRM-702 and dispositioned under FSQM-018.", "• An emergency receipt does not approve the supplier. If the supplier is to be used again it is approved on FRM-202 before the next order; otherwise it is not used again.", "Material from another site under the same ownership as Adventure Bakery is treated exactly as material from any other supplier.", "> Adventure Bakery has no other site today: no site under common ownership supplies it with ingredients, packaging or part-made product. The rule is stated so that shared ownership is never taken as a substitute for approval if one ever does. Such a site is approved on FRM-202, its materials are held to the specifications SOP-2.3.2 requires, and each delivery is received and inspected on FRM-301 like any other (SQF 2.3.4.5)."]$p$::jsonb,
         'scope',           (content->>'scope') || $s$ It also governs the emergency receipt of material from a supplier that is not approved, and material supplied by any site under the same ownership as Adventure Bakery.$s$,
         'responsibility',  (content->>'responsibility') || $r$
The SQF Practitioner authorises any receipt of material from a supplier that is not approved. Production staff receiving it complete and record the receiving inspection on FRM-301 before the material is used.$r$,
         'form_references', $fr$FRM-202 - Supplier Approval & Evaluation Record (approving a supplier, including one first used in an emergency)
FRM-203 - Vendor & Supplier Questionnaire
REP-201 - Approved Supplier Register (a report projected from FRM-202 entries; nothing is filled in on it)
FRM-301 - Incoming Material Receiving & Inspection Log (every delivery, including emergency receipts)
FRM-702 - Non-Conforming Material Hold & Tagging Record (material that fails its receiving inspection)
FSQM-018 - Non-Conforming Product and Equipment (disposition of held material)
FRM-206 - Contract Services Register (contract service providers, SQF 2.3.2.8)$fr$::text,
         'records',         $rec$• FRM-202 Supplier Approval & Evaluation Record
• FRM-203 Vendor & Supplier Questionnaire (completed and signed)
• REP-201 Approved Supplier Register
• FRM-301 entries for emergency receipts — Approved Supplier column N, the authorisation and the inspection result in Comments
• Purchase Orders with supplier-verification checkbox
Review Frequency
Supplier list and documentation reviewed annually by QA Manager / Owner.$rec$::text,
         'revision_history', (content->>'revision_history') || E'\n\n' || $rh$v4 — 2026-09-18 — Emergency receipt from a non-approved supplier, and material from sites under common ownership, under D-11.

Two Minor findings against this procedure. 2.3.4.4: receipt from a non-approved supplier is acceptable only in an emergency and only after a receiving inspection is conducted and recorded — there was no route for it, so the procedure's "whenever possible" left the exception undefined. 2.3.4.5: material from another site under the same corporate ownership is held to the same specification, approval and receiving requirements as any supplier — there was no provision.

THE EMERGENCY ROUTE IS RECORDED ON FRM-301, NOT A NEW FORM. The receiving log already carries an Approved Supplier column and a Comments / Hold Status column, and its own instructions already say an unlisted supplier needs authorisation before acceptance. What was missing was the procedure those instructions point at: what counts as an emergency, who authorises, what the inspection covers, and that the material is not used until the inspection is recorded. A separate emergency-receipt form would be a second account of one delivery.

AN EMERGENCY RECEIPT DOES NOT APPROVE THE SUPPLIER. Without that line the route becomes a side door: one emergency order and a supplier is in use indefinitely without ever having been approved.

THERE IS NO OTHER SITE. The owner confirmed on 2026-09-18 that no site under common ownership supplies Adventure Bakery. The rule is stated anyway, because 2.3.4.5 asks for the provision rather than the circumstance, and because shared ownership is exactly the relationship in which approval gets skipped.

FRM-202, FRM-301, FRM-702 and FSQM-018 are added to the form references now that the body names them. The existing body, the Supplier Status list and the contract services paragraph are unchanged.$rh$),
       revision       = 'v4',
       effective_date = date '2026-09-18',
       approved_by    = 'GJM'
 where sop_number = 'SOP-2.3.4';

do $verify$
declare r record; p jsonb;
begin
  select status, revision, effective_date, approved_by, sqf_reference, content into r
    from public.sop_documents where sop_number = 'SOP-2.3.4';
  p := r.content->'procedure';
  if (r.status, r.revision, r.approved_by, r.effective_date) is distinct from
     ('active', 'v4', 'GJM', date '2026-09-18') then
    raise exception 'SOP-2.3.4 did not issue as v4: %/%/%/%.', r.status, r.revision, r.approved_by, r.effective_date;
  end if;
  if r.sqf_reference <> '2.3.4' then raise exception 'sqf_reference changed.'; end if;
  if jsonb_array_length(p) <> 24 then
    raise exception 'procedure is % lines, expected 24.', jsonb_array_length(p);
  end if;
  -- the existing body is untouched
  if p->>14 not like '%FRM-206 Contract Services Register%' or p->>13 not like '%Rejected%' then
    raise exception 'the append displaced the existing procedure.';
  end if;
  -- 2.3.4.4: the four limbs the clause turns on
  if p->>15 not like '%only in an emergency%' or p->>15 not like '%SQF Practitioner has authorised%'
     or p::text not like '%recorded before the material is used%'
     or p::text not like '%does not approve the supplier%' then
    raise exception '2.3.4.4 route is incomplete.';
  end if;
  -- 2.3.4.5: rule as a numbered step, the no-site statement as prose
  if p->>22 like '> %' or p->>22 not like '%same ownership%' or p->>23 not like '> %'
     or p->>23 not like '%no other site today%' then
    raise exception '2.3.4.5 provision is missing or mis-formed.';
  end if;
  if r.content->>'form_references' not like '%FRM-301%' or r.content->>'form_references' not like '%FRM-202%'
     or r.content->>'form_references' not like '%FRM-702%' or r.content->>'form_references' not like '%FRM-206%'
     or r.content->>'records' not like '%emergency receipts%'
     or r.content->>'records' not like '%Purchase Orders with supplier-verification checkbox%' then
    raise exception 'form_references or records incomplete.';
  end if;
  if r.content->>'revision_history' not like '%v3 — 2026-09-16%' or r.content->>'revision_history' not like '%v4 — 2026-09-18%' then
    raise exception 'revision history lost v3 or lacks v4.';
  end if;
  raise notice 'D-11: SOP-2.3.4 v4 issued - emergency route and common-ownership rule, % procedure lines.',
    jsonb_array_length(p);
end $verify$;

commit;
