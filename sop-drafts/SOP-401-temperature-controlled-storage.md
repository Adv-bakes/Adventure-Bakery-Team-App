# SOP-401 — Temperature-Controlled Storage

**Not the controlled copy.** The controlled copy is the `SOP-401` row in `sop_documents`;
this file is the readable version of it. **It is generated** from the same JSON the
migration writes, by `scripts/generate-fsqm-draft.py`, so the two cannot drift. Edit the
body through a migration and re-run the script; never edit this file directly.

| | |
|---|---|
| Number | `SOP-401` |
| Type | `sop` |
| Category | Storage & Inventory |
| Status | draft — seven OPEN BEFORE ISSUE items, not approved, not in force |
| Revision | New |
| Effective | *(draft)* |
| SQF reference | `11.6.2.1, 11.6.2.2, 11.6.2.3, 11.6.2.4, 2.5.2.1` |
| Record | **FRM-401** Temperature Monitoring Review (draft) |
| Monitoring | The Team App checks every in-service unit every 15 minutes and records the response — built first, in `20260908000001`/`2` |
| Excursion path | **FSQM-018** Non-Conforming Product and Equipment on **FRM-702**; CAPA under **FSQM-009** |
| Unit condition | **FRM-913**'s existing `11.6.2 Cold Storage` line — reused rather than duplicated |
| Built by | `20260908000003` (seed) · `20260908000004` (FRM-401) |

---

## Purpose

This procedure defines how Adventure Bakery's temperature-controlled storage is monitored, what temperature each unit must hold, what is done when a unit goes out of specification, and how all of that is recorded. It satisfies SQF Food Safety Code: Food Manufacturing, Edition 9, element 11.6.2 Cold Storage, Freezing and Chilling of Foods.

## Scope

The site's walk-in refrigerator and walk-in freezer, and the ambient sensor in the production area.

It covers the temperature of those units and the condition of the units themselves. It does not cover the receipt and acceptance of incoming materials, stock rotation, segregation or shelf life; it does not cover the temperature of product in transit after it leaves the site, which is arranged by the customer's carrier; and it does not cover the calibration of the site's other measuring devices, which are handled under their own operating procedures.

## Definitions

Temperature-controlled storage: a walk-in refrigerator or freezer used to hold food, ingredients or packaging at a controlled temperature.

Limit: the temperature a unit must hold. A reading exactly at the limit passes; a reading beyond it fails.

Sensor: the wireless temperature sensor inside a unit, which reports to the Team App continuously and forms the temperature record.

Alert: a notification raised automatically by the Team App when a unit's readings breach its limit, when a sensor stops reporting, or when a sensor battery is low.

Excursion: a period during which a unit was outside its limit.

Out of service: a state recorded in the Team App for a storage unit that holds no food. An out-of-service unit's readings are not judged against its limit and raise no alert.

## Responsibility

SQF Practitioner — sets and changes the temperature limits; decides the disposition of any product affected by an excursion; places units in and out of service; carries out the monthly review and signs FRM-401.
Quality Team — assembles the records an excursion investigation reads, and places affected product on Hold.
Production staff — respond to an alert when it arrives, correct what they can, and record what they found and what they did.
Admin — maintains the alert recipient list so that alerts reach someone who can act on them.
Management team — provides the resources to repair or replace a unit that cannot hold its limit.

## Procedure

**1. Units and their state**

  The site has three temperature sensors. Two are in storage units that are judged against a limit; the third monitors the production area and is not a storage unit.

  - Walk-In Refrigerator (sensor d88b4c010010b5da) — holds butter, liquid eggs and other refrigerated ingredients. In service.
  - Walk-In Freezer (sensor d88b4c010010b513) — out of service. It holds no product and may be switched off. See Part 7 before any food is placed in it.
  - Bakery Floor (sensor d88b4c010010b70a) — ambient monitoring of the production area. It is not a storage unit, no temperature limit applies to it, and it raises no alert.

  The current state of every unit, its limit and who its alerts go to are held in the Team App under Compliance → Temperature Monitoring. That page is the controlled record of those settings; this procedure states them so that a reader on paper knows what they should be.

  A temperature reading for each in-service unit shall be readable without entering the unit, so that a unit can be checked without opening the door.

**2. Limits**

  - Walk-In Refrigerator: at or below 41 °F.
  - Walk-In Freezer, while in service: at or below 10 °F.

  A reading exactly at the limit passes; a reading beyond it fails. 41 °F is the temperature at or below which time/temperature control for safety foods must be held. The refrigerator has never exceeded it in the logged history, so the limit reflects what the unit actually does rather than setting a target it will breach on an ordinary day.

  Limits are changed only by the SQF Practitioner, in the Team App. A limit change takes effect immediately for all subsequent readings and is not applied backwards.

**3. Monitoring — the alert is the check**

  Each sensor reports continuously, roughly hourly, and every reading is retained. The Team App examines those readings every fifteen minutes and raises an alert in any of three cases:

  - Out of range — the two most recent readings from an in-service unit are both beyond its limit. Two readings, not one, so that a door held open while ingredients are carried out does not raise an alert.
  - No data — nothing has been logged for the unit for more than six hours.
  - Low battery — the sensor reports a low battery, which is how a unit stops being monitored.

  This automated check is the monitoring check required by SQF 11.6.2.3, and its frequency is every fifteen minutes. There is no separate daily manual temperature round: with continuous logging and an automatic check, a once-a-day reading would add work and detect less. What the site does instead is verify monthly that the system worked — Part 6 and FRM-401.

  An alert is sent by email to the recipients recorded against the unit and appears on the Temperature Monitoring page. An alert that nobody has responded to is re-sent every twenty-four hours until it is acknowledged.

**4. Responding to an out-of-range alert**

  - Go to the unit. Check that the door is shut and sealing, that nothing is blocking the airflow or piled against the evaporator, and that the unit is running.
  - Take a reading with the probe thermometer and compare it to what the sensor is reporting.
  - Correct what you can — close the door, move what is blocking the airflow, restart the unit.
  - If the unit cannot be brought back within its limit, tell the SQF Practitioner immediately and move the product to another unit that can hold it.
  - Acknowledge the alert in the Team App, saying what you found and what you did.

  The acknowledgment is the corrective action record that SQF 11.6.2.3 requires. It is written once and cannot be edited afterwards, so write what actually happened, including the time and the probe reading.

  The SQF Practitioner decides what happens to any product that was in the unit. Product whose safety or quality is in doubt is placed on Hold under FSQM-018 Non-Conforming Product and Equipment and recorded on FRM-702; it is not released or used until that hold is dispositioned. A corrective and preventive action is raised under FSQM-009 where one of its Part 3 triggers is met — a repeat excursion on the same unit being the usual one.

**5. Responding to a no-data or low-battery alert**

  A sensor that has stopped reporting does not mean the unit is fine. It means nobody knows, and the unit is unmonitored until it reports again. Logging stopped three times in the first ten weeks of monitoring — once for more than three days — and nobody noticed, which is why absence of data raises an alert of its own.

  - Check that the sensor has power and replace the battery if it is low.
  - Until logging resumes, read each affected in-service unit at the start and at the end of each production day and record those readings on FRM-401.
  - If logging cannot be restored the same day, tell the SQF Practitioner.
  - Acknowledge the alert in the Team App with what was done.

**6. Monthly review and device accuracy**

  Once a month the SQF Practitioner reviews the previous month on FRM-401 and signs it. This is the verification activity required by SQF 2.5.2.1: the alert does the monitoring, and this confirms the monitoring worked.

  - Confirm that each in-service unit held its limit for the month, and record the minimum, maximum and average from the Temperature Monitoring page.
  - Confirm that every alert raised in the month was acknowledged, and that the action recorded was appropriate.
  - Confirm that there were no unexplained gaps in logging.
  - Compare the probe thermometer against each in-service unit's sensor, both reading the same location at the same time, and record both values.

  The probe thermometer is the reference. If the two agree within ±2 °F, record a pass. If they differ by more, the sensor is treated as suspect: record the difference, tell the SQF Practitioner, and arrange for the sensor to be replaced or the reference re-checked before the next month's review. Readings taken while a sensor is suspect are confirmed with the probe.

  When the site writes a single calibration program covering all its measuring devices, this accuracy check transfers into it and this Part will be revised to point there.

**7. Out of service, and return to service**

  A storage unit that holds no food may be placed out of service so that it is not alerted on, and may then be switched off. This is a recorded decision, not simply switching a unit off.

  - Only the SQF Practitioner places a unit in or out of service, in the Team App, recording the reason.
  - While a unit is out of service its readings are not judged against its limit and no alert is raised for it.
  - No food of any kind may be stored in an out-of-service unit.

  Before a unit is returned to service and any food is placed in it, all of the following shall be true: it has been cleaned and sanitized; it has been inspected and found in good repair, with door seals intact; its sensor is reporting; and it has held at or below its limit continuously for twenty-four hours.

  - The SQF Practitioner records the return to service on FRM-401, including the twenty-four hour hold and the date food was first placed in the unit.

**8. Condition, capacity and drainage of the units**

  SQF 11.6.2 asks more of cold storage than a temperature. The units themselves shall be capable of holding the site's maximum expected volume at the required temperature, be constructed so that they can be cleaned and maintained, and drain their defrost and condensate water to the site's drainage system rather than onto the floor or onto stored product.

  - These are confirmed at issue of this procedure and re-inspected monthly on FRM-913 under its 11.6.2 Cold Storage line, which is where facility condition is already recorded.
  - A defect found in a unit's condition, capacity or drainage is raised as a corrective and preventive action under FSQM-009 and repaired.

  The monthly facility inspection carries this, rather than a second inspection of its own, so that a defect in a walk-in is found and closed the same way as a defect anywhere else in the plant.

## Form References

FRM-401 Temperature Monitoring Review; FRM-702 Non-Conforming Material Hold & Tagging Record; FRM-913 Facility & Equipment Inspection

## Records

FRM-401 Temperature Monitoring Review — one per month, carrying the month's temperature summary per unit, the alerts raised and how they were closed, the probe-against-sensor accuracy check, any manual readings taken while a sensor was down, any change of service state, and the SQF Practitioner's signature.
Temperature readings — the continuous per-sensor record held in the Team App, which is the temperature record required by 11.6.2.3. It is retained in full and is exportable to PDF and spreadsheet from the Temperature Monitoring page.
Temperature alert log — the record of every alert raised, what it was, when it opened and closed, who responded and what they did. Held in the Team App and not editable after the response is recorded.
FRM-702 Non-Conforming Material Hold & Tagging Record — where product affected by an excursion is held.
FRM-913 Facility & Equipment Inspection — where the units' condition, capacity and drainage are re-inspected.
Retention: two years, or the shelf life of any product affected by an excursion plus twelve months, whichever is longer. This matches the retention set by FSQM-009 Part 10, so an excursion, a hold arising from it and any investigation that follows are retained on the same basis.

## Governing Reference

SQF Food Safety Code: Food Manufacturing, Edition 9 — 11.6.2 Cold Storage, Freezing and Chilling of Foods: 11.6.2.1 performance and capacity, 11.6.2.2 construction and cleanability, 11.6.2.3 monitoring, frequency of checks, corrective action out of specification, and records, 11.6.2.4 drainage of defrost and condensate water.
SQF Food Safety Code: Food Manufacturing, Edition 9 — 2.5.2.1 Verification of monitoring activities, which the monthly review on FRM-401 performs.
FSQM-018 Non-Conforming Product and Equipment — where product affected by an excursion is held and dispositioned.
FSQM-009 Corrective and Preventive Action (CAPA) Program — where an excursion or a facility defect meets one of its Part 3 triggers.

## Revision History

Rev New — written 2026-09-08 against SQF Food Safety Code: Food Manufacturing, Edition 9, element 11.6.2 Cold Storage. DRAFT. Not approved, not in force.

WHY IT EXISTS. Three sensors have logged temperatures continuously since 2026-06-24 and the Team App has displayed them since, but no document in the register cited 11.6.2 at all. The data was being collected and nobody had written down what "good" meant, what to do when it wasn't, or that anyone had looked. Of the four obligations in 11.6.2.3 the sensors satisfied one — records kept.

THE ALERT IS THE CHECK, AND IT WAS BUILT FIRST. 11.6.2.3 wants a stated frequency of checks and a corrective action for readings out of specification. With three to four staff, the answer was not another daily clipboard round. The Team App now examines every in-service unit every fifteen minutes, emails whoever is on the unit's recipient list, and records what the responder did. That alerting was built and proven before this procedure was written, deliberately: FSQM-018 spent months citing a "Positive Release Procedure" that existed nowhere, and a procedure describing an alert that had not been built would have repeated exactly that mistake.

ABSENCE OF DATA IS ALERTED, WHICH IS THE REAL LESSON FROM THE FIRST TEN WEEKS. Logging stopped three times, the longest gap three days and two hours, and nobody noticed. A dead sensor reads as perfect compliance, so an alert that fired only on a bad reading would have been silent through every one of those gaps. Part 5 exists because of them.

WHY THE MONTHLY REVIEW IS MONTHLY. Once the system watches continuously, the human job is no longer observation — it is verification under 2.5.2.1 that the monitoring worked. A monthly review of an alert log is defensible and is likely to actually happen; a weekly one, on top of an automated check, is work that adds nothing and gets skipped.

WHY 41 °F. The refrigerator has never exceeded 41 °F in the logged history and reached exactly 41 only once. A tighter limit would ship already breached, and a limit that fails on an ordinary day teaches staff to ignore alerts.

OUT OF SERVICE IS A STATE, NOT A GAP. The freezer holds no product since the vegan burger line was discontinued and may be switched off. Rather than leaving it silently unmonitored or alerting on an empty unit, Part 7 makes it a recorded decision with stated conditions for coming back — including holding at limit for twenty-four hours before food goes in. The procedure survives that decision going either way.

CONDITION AND DRAINAGE REUSE AN EXISTING RECORD. 11.6.2.1, .2 and .4 are one-time confirmations plus ongoing re-inspection, and FRM-913 already inspects facility condition monthly under an 11.6.2 Cold Storage line. Part 8 uses it rather than creating a second inspection, so a defect in a walk-in is found and closed the same way as a defect anywhere else in the plant.

OPEN BEFORE ISSUE — seven things that must be done on the floor before this procedure is approved. None can be closed by writing:

1. Probe the refrigerator at several points and move the sensor to the warmest part of the room, which is where 11.6.2.3 requires monitoring equipment to sit. Record where it was placed.

2. Confirm that a temperature reading can be seen without entering each in-service unit, and name that display in Part 1. 11.6.2.3 requires the measurement device to be easily readable and accessible.

3. Trace the defrost and condensate drain on both units to the site's drainage system and confirm it does not discharge onto the floor or onto stored product (11.6.2.4).

4. Walk both units for condition, cleanability and capacity and photograph them (11.6.2.1, 11.6.2.2). Capacity means the maximum volume the site actually expects to hold, not the volume held today.

5. Obtain the YoLink sensor's stated accuracy and the probe thermometer's make and accuracy. Part 6's ±2 °F tolerance is written to be reasonable but has not been checked against either device's specification; confirm it, and change it if the devices cannot support it.

6. Confirm the freezer's intended state and the date the vegan burger line was discontinued. That date is also owed to the D-35 scope determination and to four shelf-life records that still read "Frozen, 18 months".

7. Establish what caused the three logging gaps, so that Part 5 addresses the real failure mode rather than assuming a flat battery.

ALSO NOTED, NOT FIXED HERE. The Temperature Monitoring page's Avg Humidity column always reads 0 because the sensors do not report humidity; and sop-drafts/scope-determination-temperature-controlled-distribution.md still describes the freezer as "in daily use", which is no longer true.
