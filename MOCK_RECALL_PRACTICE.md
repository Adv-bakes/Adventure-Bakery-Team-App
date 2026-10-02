# Mock Recall Practice Run - with test data

A rehearsal of a recall in the Team Portal, using made-up records that are loaded before the run and
removed after it. Use it to train someone, or to check the Traceability page and the recall record
(FRM-012) still work after a change.

> **This is practice, not the annual mock recall.** SQF 2.6.3.2 and FSQM-023 require a mock recall
> every year on **real** product and **real** lots, and that record is kept. The record made in this
> practice run is deleted at the end.

There are two roles. One person can do both.

| Role | Does | Needs |
|---|---|---|
| **Technical person** | Loads the test data (Part 1) and removes it (Part 3) | Access to the Supabase SQL editor for the Team Portal database |
| **Anyone on the team** | Runs the practice recall in the Team Portal (Part 2) | A Team Portal login (staff, admin or owner) |

Allow about 30 minutes for Part 2. Load, run and remove the data on the same day.

---

## The story

A supplier phones: **soybean oil, lot TEST-SO-1001, is being recalled.** You have to find which of
our lots used it, who collected them, and what is still on site.

Everything in the test data is marked so it cannot be mistaken for a real record:

- every product, customer and supplier name starts with **TEST**;
- supplier lots start with **TEST-**;
- our lot codes are **9901** and **9902** (no real lot code can end in a day above 366);
- each record shows `_test_batch: RECALL-TEST` under "Unmapped answers" when opened.

The test data contains deliberate problems, so the run shows how the trace deals with them:

| Built-in problem | Where | What the trace should do |
|---|---|---|
| A lot typed differently on two records | "test so 1001" and "TEST-SO-1001" | Treat them as the same lot |
| Two products sharing one lot code | 9901 is both TEST Rum Cake Original and TEST Coconut Rum Cake | Show them as two separate lots |
| A supplier lot never logged at receiving | Baking powder, lot TEST-BP-5001 | Report "no receipt" |
| An ingredient with no lot written down | Pan release spray | Report "no supplier lot recorded" |
| Quantities that cannot be added up | 80 units and 3 cases | Report it, and leave the adding to you |
| No retention sample or release for a lot | 9901 Coconut and 9902 | Report each |
| Records started but never submitted | One lot record, one dispatch, the retention sample, the release | Include them, marked as drafts |
| A customer with no contact on the list | TEST Gift Basket Co | Report it |

---

## Part 1 - Load the test data (technical person)

1. Open the Supabase dashboard for the Team Portal project and go to **SQL Editor**.
2. Open [`scripts/recall-test-data/insert.sql`](scripts/recall-test-data/insert.sql), copy all of it,
   paste it into a new query and press **Run**.
3. Check it worked. Run this; it should return **12**:

   ```sql
   select count(*) from public.sop_document_responses where data->>'_test_batch' = 'RECALL-TEST';
   ```

4. Tell the person doing Part 2 that the data is in.

What the script puts in (12 records):

| Form | Records | What |
|---|---|---|
| FRM-301 Receiving | 2 submitted | Six supplier lots received |
| FRM-520 Production Lot Record | 2 submitted, 1 draft | Lots 9901 (two products) and 9902 |
| FRM-801 Dispatch | 2 submitted, 1 draft | Two customers |
| FRM-703 Retention | 1 draft | A sample for 9901 Original |
| FRM-701 Release | 1 draft | A release for 9901 Original |
| FRM-702 Hold | 1 submitted | A hold on the oil lot, tag TEST-H-001 |
| FRM-011 Contact list | 1 submitted | One customer contact, two crisis-team members, SQFI, the certification body, FDA, FDACS |

Things to know:

- **"Recall test data is already there"** means an earlier run was not cleaned up. Do Part 3, then
  start again.
- **It is not a migration.** Never copy these files into `supabase/migrations/`.
- **Do not submit the test retention or release records.** They are drafts on purpose: a submitted
  one would tick off the weekly retention and release review reminders.
- While the data is in, the test records show in **Form Records** and in each form's Entries list.
- The records are created under Richard Mercer's account (the id is written in `insert.sql`).

---

## Part 2 - Run the practice recall (anyone)

### A. Trace the lot

1. In the Team Portal, open **Compliance > Traceability**.
2. Leave **An ingredient or packaging lot** selected.
3. Type `TEST-SO-1001` and press **Trace**.

You should see:

| Check | Expected |
|---|---|
| Finished lots | **3**: 9901 TEST Rum Cake Original, 9901 TEST Coconut Rum Cake, 9902 TEST Rum Cake Original |
| Lot 9902 | Marked "draft - not submitted" |
| The oil line on each lot | Highlighted, "the lot traced" |
| Receipts | Found for every supplier lot except the baking powder |
| Where it went | TEST Island Treats LLC and TEST Gift Basket Co |
| Holds | TEST-H-001 |
| Contacts | Ana Test for TEST Island Treats; no contact for TEST Gift Basket Co; SQFI, the certification body, FDA and FDACS listed |
| Amber "What the records do not show" | **Nine lines**, listed below |

The nine amber lines:

- 9901 TEST Rum Cake Original: no supplier lot recorded for Pan release spray.
- 9901 TEST Rum Cake Original: no FRM-301 receipt for 1 of 5 supplier lots - Baking powder (TEST-BP-5001).
- 9901 TEST Rum Cake Original: the dispatched quantities cannot be added up (80 units, 3 cases).
- 9901 TEST Coconut Rum Cake: no retention sample on FRM-703.
- 9901 TEST Coconut Rum Cake: no release record on FRM-701.
- 9902 TEST Rum Cake Original: no retention sample on FRM-703.
- 9902 TEST Rum Cake Original: no release record on FRM-701.
- 4 records in this trace are drafts that were never submitted.
- No contact for TEST Gift Basket Co on the contact list (FRM-011).

Neither lot 9901 card should say "same lot code, different product name".

4. Click two or three of the gold record links. Each opens the source record in a new tab.
5. Press **Download PDF** and open the file. It should carry the same lots, gaps and contacts.

### B. Start the mock recall record

6. At the bottom of the trace, press **Start a mock recall record**. FRM-012 opens.

You should see, in the **Recall workspace** at the top:

- a grey banner: **MOCK RECALL - a test. Do not notify customers, authorities or SQFI**;
- the **trace clock** running against 4 hours;
- **no** 24-hour notice clock (that is for real events);
- eight steps, with "Decide" and "Recover" greyed out as not part of a mock recall.

And in the form below: the material, its lot and supplier, the products, lot codes 9901 and 9902,
both customers, and the three tables already filled from the trace.

### C. Work the steps

Each step has a **Go to section N** link. The step ticks itself when the record holds what it needs.

| Step | What to do | Where |
|---|---|---|
| 1. Hold what is still on site | Write `TEST - 1 jug in the dry store, 4 units of 9901 on the rack`. Nothing is tagged in a mock recall. | Section 1, "Product and materials still on site" |
| 2. Trace the lots | Write a **Reason** in section 1 (for example `TEST - supplier recalled soybean oil lot TEST-SO-1001`). Check a few trace lines against the linked records. Then set **Trace completed** to Now. The clock stops and turns green. Set "Within 4 hours" to Yes. | Sections 1, 2 and 4 |
| 3. Decide with the brand owner | Not part of a mock recall. | - |
| 4. Check the contacts | Open the link under "Contact list (FRM-011)" and look the list over. Choose **Checked - current**. Contact nobody. | Section 4 |
| 5. Recover the product | Not part of a mock recall. | - |
| 6. Reconcile each lot | For each of the three lines, fill **Still on site**, **Disposed of** and **Unaccounted for**. The trace leaves these blank on purpose: they are counts only a person can make. For practice, write `4 units`, `0` and `0`. | Section 3, Reconciliation |
| 7. Record the gaps | Copy the amber gaps into **Gaps found**, in your own words. | Section 4 |
| 8. Close | In a real run, the person who did it signs, then Senior Site Management signs. **For practice, do not sign and do not submit.** | Section 6 |

7. Press **Save Draft**. Reload the page and check everything you entered is still there.
8. In the workspace, open **Trace the lots from the records** and press **Put this trace into the
   record**. Confirm the replace, then press **Undo**. Your reconciliation numbers should come back.

### D. Optional - see what a real event looks like

9. Go back to **Compliance > Traceability**, trace `TEST-SO-1001` again and press
   **Start a recall record**.
10. Check the banner is **red**, and the **24-hour written notice** clock shows a deadline.
11. Write a Reason, then open the trace in the workspace. Each contact with an email address now has
    an **envelope**. Click the one beside Ana Test: your mail app opens with the Reason as the text.
    **Close the email without sending it.**
12. Save Draft. Do not submit.

### E. Finish

13. Tell the technical person you are done, so the test data can be removed.

If something did not match this guide, note what you did, what you expected and what you saw, and
pass it to whoever maintains the Team Portal.

---

## Part 3 - Remove the test data (technical person)

1. In the Supabase **SQL Editor**, open
   [`scripts/recall-test-data/delete.sql`](scripts/recall-test-data/delete.sql), copy all of it, paste
   it into a new query and press **Run**.
2. Check it worked. Run this; it should return **0**:

   ```sql
   select count(*) from public.sop_document_responses where data->>'_test_batch' = 'RECALL-TEST';
   ```

What the script removes:

- the 12 test records;
- every FRM-012 record started from them - recognised by a product starting with "TEST" or a
  material lot starting with "TEST-".

It removes nothing else. A real FRM-012 record is not touched, because no real product or supplier
lot starts with TEST.

---

## If something looks wrong

| What you see | What it means |
|---|---|
| A red box: "The trace cannot run: a form it reads has changed" | A field was renamed or removed on one of the forms the trace reads. The box names it. The trace engine's field map (`TRACE_FORMS` in `src/lib/lotTrace.ts`) needs updating, and the test data may need rebuilding. Trace by hand from the records until it is fixed. |
| "No finished lot found" for TEST-SO-1001 | The test data is not loaded. Do Part 1. |
| A test lot still shows after Part 3 | Press **Refresh records** on the Traceability page, or reload. |
| "A record cannot be started from here yet" | FRM-012 is missing a field the trace fills. The message lists it. |

The test data was built for the form layouts of 2 October 2026. How the trace and the recall record
work is described in `CLAUDE.md`, under "Lot Trace & Recall Workspace".
