-- FRM-903 (GMP Pre-Operation Inspection) — author the fillable schema.
--
-- Why: FRM-903 is the record SOP-11.7.3 step 2 names for the start-of-shift glass dial cover /
-- MIG thermometer check required by SQF 11.7.3.4. Before this migration FRM-903 was a shell —
-- content held only an `attachments` key, there was no form_schema, and it had zero entries, so
-- the one fixed frequency in the SQF code had nowhere to be recorded. 20260715000001 points the
-- SOP here; this makes the form real.
--
-- SCOPE WARNING — READ THIS:
--   FRM-903's sqf_reference is '11.2.5.7, 11.7.3.4'. This schema covers 11.7.3.4 ONLY (the glass
--   dial cover / MIG thermometer check). It does NOT contain pre-operation SANITATION inspection
--   content for 11.2.5.7, because that checklist doesn't exist anywhere in the DB to model from
--   and inventing one would recreate exactly the SOP-says-X-form-does-Y problem this work is
--   fixing. Before treating FRM-903 as complete, either:
--     (a) add the 11.2.5.7 pre-op sanitation section to this schema, or
--     (b) drop 11.2.5.7 from FRM-903.sqf_reference and retitle it to match what it actually does
--         (e.g. "Pre-Operation Glass & Brittle Plastic Check"), moving 11.2.5.7 to its own form.
--   Left as-is, the form's title and clause reference over-promise against its content.
--
-- REVIEW BEFORE RUNNING:
--   * `shift` options are ['1st Shift','2nd Shift','3rd Shift'] — an assumption. Set your real
--     shift names, or drop the field if you run a single shift.
--   * The grid is seeded with the glass dial-cover items actually present in the FRM-907 register
--     ("Pan scrubber dials", "Oven controls and door glass", both Processing Room). A third row
--     for "MIG thermometers" is included because 11.7.3.4 names them explicitly, but NO MIG
--     thermometer appears in your register — if you don't use any, delete that row and record the
--     fact that they're not in use; if you do, add them to FRM-907 as well.
--   * Rows are `deletable: true` (matching FRM-907), so items can be renamed/removed over time and
--     "Add Item" can append. This also makes the grid's columns click-sortable.
--   * Status stays 'draft'. Activating FRM-903/907/908 is an approval decision, not a migration.
--
-- Mechanics: content is jsonb and this MERGES (||), preserving the existing `attachments` key.
-- FRM-903 is status='draft', so this does not fire sop_documents_snapshot (trigger is WHEN
-- old.status='active') — correct, there's no approved revision to snapshot yet.

begin;

update public.sop_documents set
  content = content || jsonb_build_object('form_schema', $json$
{
  "schemaVersion": 1,
  "settings": {
    "instanceTitleTemplate": "{inspection_date} — {shift}"
  },
  "sections": [
    {
      "id": "purpose_scope",
      "title": "Purpose & Scope",
      "fields": [
        {
          "id": "purpose_scope_info",
          "type": "info",
          "label": "Purpose & Scope",
          "text": "Start-of-shift inspection of glass instrument dial covers on processing equipment and MIG thermometers, to confirm they have not been damaged (SQF 11.7.3.4). Complete this check before operations begin, every shift.\n\nItems listed here are drawn from the Glass & Brittle Plastic Register (FRM-907). Any damage or breakage must follow the breakage response in SOP-11.7.3 — isolate, clean, inspect, and clear the area before resuming — and be recorded on FRM-908 (Glass Breakage Incident Report)."
        }
      ]
    },
    {
      "id": "shift_details",
      "title": "Shift Details",
      "fields": [
        {
          "id": "inspection_date",
          "type": "date",
          "label": "Date",
          "width": "third",
          "required": true,
          "defaultToday": true,
          "showInList": true
        },
        {
          "id": "shift",
          "type": "select",
          "label": "Shift",
          "width": "third",
          "required": true,
          "showInList": true,
          "options": ["1st Shift", "2nd Shift", "3rd Shift"]
        },
        {
          "id": "checked_by",
          "type": "signature",
          "role": "filler",
          "label": "Checked By",
          "width": "third",
          "required": true,
          "statement": "I confirm I inspected each item listed below at the start of this shift."
        }
      ]
    },
    {
      "id": "dial_cover_check",
      "title": "Glass Dial Covers & MIG Thermometers",
      "fields": [
        {
          "id": "dial_cover_note",
          "type": "info",
          "label": "Inspection Note",
          "text": "Mark each item Undamaged: Y (intact), N (damaged/broken), or N/A (not in use this shift). Any \"N\" requires an entry in Action Taken and a Glass Breakage Incident Report (FRM-908)."
        },
        {
          "id": "dial_covers",
          "type": "grid",
          "label": "Glass Dial Covers & MIG Thermometers",
          "rows": {
            "mode": "fixed",
            "labelHeader": "Location",
            "deletable": true,
            "addLabel": "Add Item",
            "labels": ["Processing Room", "Processing Room", "Processing Room"],
            "defaultValues": [
              { "item": "Pan scrubber dials" },
              { "item": "Oven controls and door glass" },
              { "item": "MIG thermometers" }
            ]
          },
          "columns": [
            { "id": "item", "type": "text", "label": "Item", "width": 2 },
            { "id": "undamaged", "type": "pass_fail", "label": "Undamaged (Y/N)", "required": true, "width": 1 },
            { "id": "comments", "type": "text", "label": "Condition / Comments", "width": 2 },
            { "id": "action", "type": "text", "label": "Action Taken", "width": 2 }
          ]
        }
      ]
    },
    {
      "id": "review",
      "title": "Review",
      "fields": [
        {
          "id": "reviewed_by",
          "type": "signature",
          "role": "verifier",
          "label": "Reviewed by",
          "width": "half"
        },
        {
          "id": "review_date",
          "type": "date",
          "label": "Date",
          "width": "half"
        },
        {
          "id": "records_maintained_note",
          "type": "info",
          "label": "Records Maintained Note",
          "text": "Records are maintained for a minimum of 2 years (SOP-11.7.3)."
        }
      ]
    }
  ]
}
$json$::jsonb)
where id = '96b9eed2-3665-4857-a81c-b839d4f83f9d';

commit;
