# SOP-605 — Operating the Flow Wrapper (S350X Rotary Pillow Packer)

| | |
|---|---|
| **Document No.** | SOP-605 *(proposed — Packaging & Labeling block; SOP-601/602 wrappers, SOP-603/604 coders)* |
| **Title** | Operating the Flow Wrapper (S350X Rotary Pillow Packer) |
| **Type** | sop |
| **Revision** | Draft A |
| **Effective Date** | *(pending approval)* |
| **Approved By** | *(pending)* |
| **SQF Reference** | 2.3.2.6, 11.7.3.1 |
| **Category** | Job-Specific Operations |

*Machine: S350X (350X) rotary pillow packing machine — a horizontal **flow wrapper** (film-down). It
folds food-grade film into a tube around the product, makes a **mid (fin) seal**, then a **rotary
end-seal that seals and cuts** each pack. A color-mark "magic eye" registers the cut; two PID controls
set the mid-seal and end-seal temperatures; speed/bag length/cut position are set on the HMI.*

---

## Purpose

To run the flow wrapper safely and produce a **well-sealed, correctly-cut pillow pack** on the baked
product.

**Two things drive the rules below.** The **mid-seal heater and the end-seal/cutter are hot** (the
cutter runs around 120 °C) and the **sealing wheels, cutter, push-finger chain and conveyor are moving
parts** — both burn or catch. And the **film wraps the baked product directly**, so the film must be
food-grade and film/cutter debris kept off the product.

## Scope

Packaging staff loading film, setting up, running, and clearing the S350X to wrap finished product.

Electrical work, drive/cutter/bearing lubrication, cutter or belt replacement, and factory
parameter/system setup are **Maintenance / the commissioning technician** — not operators. **Operators
don't open the electrical cabinet.**

## Responsibility

- **Operators** — set up and run as written; check seals and cut registration; stop and report bad
  seals, film on the hot parts, or faults.
- **Supervisor** — trains and signs off operators; approves the setup for the run; takes the machine
  out of service on a fault.
- **Maintenance / commissioning technician** — electrical, lubrication, cutter/belt wear, temperature
  and system settings, and repairs, with the **power off**.

## Procedure

### Before you start

**Don't operate this machine unless the Supervisor has trained and signed you off.**

- The **worktable, conveyor, and end-seal knives are clear** of foreign matter and tools, and **no one
  is inside the machine's working area**.
- The **film is the approved food-grade film** (it touches the baked product directly), loaded on the
  correct route through the bag maker, mid-seal, and end-seal.
- Guards/covers are in place and the **emergency stop (mushroom)** works.

**Hot parts and moving parts:** never touch the sealing wheels, sealing die, cutter, or push-finger
chain while the machine runs; **never reach inside without switching the power off.**

### 1. Set up the product

- Set the **bag maker width and height** to the product **+5 mm**.
- On the **HMI**, set the **packing speed, bag length, and cut position**.
- Choose the cut mode: **Track cut** for film **with color marks**, or **Set-length cut** for plain
  film. For color-mark film, aim the **magic eye** at the color mark.

### 2. Set the seal temperatures

Set the **mid-seal** and **end-seal** PID temperatures for the film and speed. **Target: no leaks and
no burnt/crimped seals** — too hot burns/crimples the seal, too cold leaves it loose or open.

### 3. Test packs — verify before you run

Inch or run slow and check the first packs:

- **Mid-seal** tight with clear lines; **end-seal** complete; the **cut is clean** and lands on the
  color mark
- The **product is centered** in the pack and **not caught by the cutter**

Adjust **cut position / push-finger / knife speed / temperature** as needed. **The Supervisor approves
the setup.** Don't run production until seals and cut are right.

### 4. Run and monitor

Press **start (green)**. Through the run, **check the seal and the cut** on packs periodically. A pack
with a **loose, open, or burnt seal, or an off/torn cut, is a reject** — set it aside.

The film touches the baked product directly, so **film scraps or cutter debris are foreign matter** —
if a fragment could have reached a baked product, **segregate the affected packs** and tell the
Supervisor.

### 5. Stop and per-shift clean

- **Normal stop:** red **stop** (parks the knife level). **Emergency:** the **mushroom E-stop** (press
  **reset** to restart).
- **Per shift, power OFF:** wipe the table and surfaces with a clean damp cloth; **blow film scraps**
  off the feeding, mid-seal, and end-seal mechanisms with **compressed air**; brush film off the
  **end-seal knife**. (Lubrication and electrical are Maintenance — see the manual's monthly/biannual
  list.)

## If something goes wrong

| Problem | What to do |
|---------|-----------|
| Cut deviates from the color mark | Use **Track cut** mode; check/adjust the magic eye; check the film isn't slipping (tension/brake). |
| Cutter cuts onto the product | Re-sync the push-finger, set the cutter-seat height to half the product height, or slow the packing speed. |
| Burnt / crimped seal | Temperature too high or speed too low — lower temp / raise speed; check the film. |
| Loose or missed seal | Temperature too low or speed too high — raise temp / lower speed. |
| Film on the hot seals/cutter | Stop; clear it (power off / cool as needed). Film on hot parts is a fire risk and a foreign-matter source. |
| Smoke, burning smell, or flame | **E-stop, cut power, and follow the fire procedure.** |

## Form References

- Batch / settings record for the product (film, speed, bag length, cut position, mid/end-seal temperatures)

## Records

Film, speed, and seal/temperature settings and the **seal/package check** for the run are recorded on
the **batch record**. Operator training sign-off is held in the training record. All retained per the
record retention policy.

## Governing Reference

- SQF Food Safety Code: Food Manufacturing, Edition 9 — **2.3.2.6** (packaging in direct food contact
  certified/approved for the use), **11.7.3.1** (equipment free of potential contaminants; parts not
  deteriorated)
- US Brother — *350X (S350X) Rotary Pillow Packing Machine / Flowpack Instruction Manual*
- OSHA **29 CFR 1910.147** — Control of Hazardous Energy (power off before servicing) · **1910.212**
  machine guarding

## Film is a direct food-contact material

The wrapping film **touches the baked product directly**, so it is a food-contact material:

- Only the **approved food-grade film** may be used — film **certified/approved for direct food
  contact**, with the supplier's **letter of guarantee or certificate of conformance on file** (**SQF
  2.3.2.6**). Don't substitute an unapproved film.
- Because the film contacts the product, **film scraps and cutter debris are a foreign-matter hazard on
  the baked product** — keep the seals and cutter clear, and hold/segregate product if a fragment could
  have reached it (**SQF 11.7.3.1**; section 4).

## Revision History

| Rev | Date | Description | Approved By |
|-----|------|-------------|-------------|
| Draft A | 2026-07-26 | Initial draft from the US Brother 350X (S350X) Rotary Pillow Packing Machine / Flowpack Instruction Manual; one page for floor use. Written as a flow-wrapping process: load approved food-grade film on the correct route, set bag-maker width/height (product +5 mm) and HMI speed/bag-length/cut-position, choose Track-cut (color-mark) or Set-length cut, set mid- and end-seal PID temps (no leak / no burnt crimple), test packs and verify seals + cut registration with Supervisor approval, monitor and reject bad seals/cuts, per-shift clean (power off; compressed air + brush off film scraps). Hot seal/cutter (~120 °C) and moving-parts (sealing wheels, cutter, push-finger chain) safety and E-stop called out. Electrical/lubrication/cutter-belt/system setup left to Maintenance. Film confirmed as direct food contact — food-grade film required. Vendor (US Brother) named. | — |
