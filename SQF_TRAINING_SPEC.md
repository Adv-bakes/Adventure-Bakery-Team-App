# SQF Employee Training Curriculum — Build Specification & Handoff

> ⚠️ **Content policy update (2026-06-11):** the product/retailer names in this spec (including §5)
> are planning context only. Trainee-facing decks, narration, and quizzes must genericize them per
> `DECK_FORMAT_CONTRACT.md` ("a major grocery retailer", "our rum cakes", "our plant-based burgers");
> the generator in `training-decks/` enforces this. Slides are also diagram-first — see the contract's
> visual-layout catalog.

**Purpose of this document.** This is a handoff spec from a planning session (Claude chat) to the implementation session (Claude Code) where the PowerPoint importer/processor already lives. It captures all facility, regulatory, and curriculum decisions already made, defines the deliverable format, and includes a complete pilot module (Module 1\) to validate against the import pipeline before batch production.

**How to use this in Claude Code:** Read this file alongside the importer source code. Build Module 1 first as a pilot, run it through the actual import pipeline, fix any format mismatches, then derive a reusable generation script \+ a "deck format contract" before producing the remaining modules.

---

## 1\. Project Overview

A small industrial bakery is building employee training to support **SQF (Safe Quality Food) Food Safety Code, Edition 10** certification. The primary commercial driver is distributing **Bahama Rum Cakes** to the **Publix** grocery chain.

**Critical context — Publix supplier requirement:** Publix requires all suppliers of finished food to hold certification under a GFSI-benchmarked scheme. SQF *Fundamentals* does NOT satisfy this; the **SQF Food Safety Code (Level 2 / certification level)** is the minimum. Publix also reserves the right to audit supplier facilities directly, so floor employees must be able to answer auditor questions in person — not merely pass quizzes.

**Target learners:** Existing production employees performing preparation, mixing, baking, and packaging. **Employees rotate across all tasks**, so every employee takes every module (no role-specific tracks).

**Languages:** English and Spanish (each module produced in both).

**Delivery constraints (from the existing application):**

- Each module is a PowerPoint deck.  
- The app can auto-generate a quiz from the deck, but we supply a better hand-authored quiz.  
- The app supports **narration that is similar to, but not identical to, the on-slide text.** Narration lives in the slide's speaker notes and must be reworded, not copy-pasted from the slide.  
- Each module is sized to be completed in **\~30 minutes** (content \+ quiz).

---

## 2\. Facility & Product Profile

Three product lines produced in one facility on rotating staff:

| Product | Key facts | Food-safety implications |
| :---- | :---- | :---- |
| **Bahama Rum Cakes** | Actual rum used, kept **below the 2% finished-product limit**. Shelf-stable. The Publix product. | Rum is a controlled ingredient (receiving, storage, usage control, security). Almost certainly contains wheat, egg, milk — major allergens. |
| **Botta Biscotti** | Shelf-stable baked good. | Almost certainly contains wheat and egg; **likely tree nuts** — confirm. Allergen-bearing. |
| **Marini Brothers Bahama Burgers** | Meat alternative, **pea-protein** based. **Frozen.** Brand claim: **free of the top 9 allergens.** | This claim is the highest-risk item in the facility. Produced in a building that also runs wheat/egg/milk/(nut) products on shared, rotating staff. Frozen \= cold chain \+ environmental (Listeria) awareness. |

### Top-risk themes the training must drive home

1. **Protecting the top-9-allergen-free claim** on the Bahama Burger in a mixed-allergen facility with rotating staff. This is the dominant theme and is reinforced in nearly every module.  
2. **No SQF Practitioner is designated yet and the HACCP/food safety plan is not written.** Training and plan development run in parallel. The HACCP module is built around the CCPs the plan will almost certainly contain (baking kill step, metal detection, freezing/cold chain) and **must be reconciled against the final written plan before the audit.** Auditors verify that training matches documented procedures.  
3. **Edition 10 food-safety-culture emphasis:** auditors interview floor staff directly. Every module ends with a "What an auditor might ask you" segment.

⚠️ **Open items to confirm with the client before/while building** (do not block the pilot, but flag in output):

- Biscotti: tree nuts present? (changes allergen map)  
- Confirm exact allergen profile of rum cake and biscotti against actual recipes.  
- Is there environmental monitoring (Listeria) in place for the frozen line, or awareness-only at this stage?  
- Designate the SQF Practitioner (required before audit).

---

## 3\. Curriculum Map (12 modules × \~30 min)

All employees take all modules. Recommended sequence:

**Foundation**

1. **Why We're Doing This** — SQF, GFSI, the Publix opportunity, food-safety culture, every employee's authority to report/stop unsafe product. *(Full content in §5 — this is the pilot.)*  
2. **Personal Hygiene & GMPs** — handwashing, attire, jewelry, illness reporting, footwear/foot-bath sanitation, traffic flow between zones.

**Allergen Control (heart of the program)** 3\. **Allergens Part 1: Know the Risk** — top 9 allergens, the allergen map of our three products, why the Bahama Burger claim makes us different from a normal bakery. 4\. **Allergens Part 2: Protecting the Claim** — production sequencing/scheduling, color-coded tools, changeover cleaning \+ verification, label checks, what cross-contact looks like.

**Process Control** 5\. **HACCP Basics & Our CCPs** — hazard types, the baking kill step, monitoring, corrective action when a limit is missed. *(Reconcile to written plan before audit.)* 6\. **Foreign Material Control** — metal detection, sieves/magnets, glass & brittle-plastic policy, blade/knife control. 7\. **Cleaning & Sanitation** — SSOPs, chemical safety & storage, pre-op inspection, master sanitation schedule. 8\. **Receiving, Storage & Ingredients** — approved suppliers, lot tracking, FIFO, rum receiving/storage/usage controls.

**Product-Specific & Facility** 9\. **Frozen Product Handling** — cold chain for Bahama Burgers, freezer temp monitoring, environmental monitoring awareness (Listeria), no thaw/refreeze. 10\. **Packaging, Labeling & Traceability** — label verification (wrong label \= recall), lot/date coding, role in a mock recall. 11\. **Food Defense & Food Fraud** — site security, visitor control, reporting suspicious activity, ingredient integrity (Edition 10 requirement).

**Audit Readiness** 12\. **Records & Talking to Auditors** — "if it isn't written down it didn't happen," completing monitoring records, corrective actions, what Publix/SQF auditors ask on the floor, Publix's right to audit directly.

---

## 4\. Per-Module Deliverable Format

Each module ships as a package. **Confirm exact structures against the importer code and update this contract.**

1. **English deck** (`.pptx`)  
2. **Spanish deck** (`.pptx`) — full translation, same structure/slide count.  
3. **Narration script** — one entry per slide, stored in **speaker notes**. Worded *similarly but not identically* to slide text (the app expects this). Conversational, \~20–45 seconds of spoken material per slide.  
4. **Quiz** — 8 questions, hand-authored, mixing multiple-choice and scenario/judgment questions (not just slide recall). Provided with answer key \+ rationale. **Format to match what the importer/quiz-builder expects** (e.g., a marked quiz slide, a sidecar JSON/CSV, or speaker-note tags — to be determined from the code).  
5. **Training sign-off sheet** — name, date, module, score, employee signature, trainer signature. Auditors require documented evidence of training *effectiveness*, not just attendance.

### Suggested deck conventions (adjust to importer)

- **Slide title** \= learning point. **Body** \= concise on-slide text (the learner reads this).  
- **Speaker notes** \= the narration (reworded).  
- Open each module with a **Learning Objectives** slide; close content with a **"What an auditor might ask you"** slide before the quiz.  
- Keep a consistent visual template across all 12 modules (one generation script, shared theme) so the set looks like a single program.  
- Reuse the warm bakery palette from the existing test deck for brand continuity: dark warm brown `3B2F2F`, amber accent `C8873C`, cream `FFF8F0`, safe-green `4A7C59`. Safe fonts only (Calibri body, Cambria headers) for reliable rendering.

### Recommended generation approach (Claude Code)

- Build a **single parameterized generator** (pptxgenjs or python-pptx) that takes a module's structured content (JSON/markdown) and emits the deck \+ notes. This guarantees consistency across 24 decks and makes the Spanish version a content-swap, not a redesign.  
- **Pilot loop:** generate Module 1 → run through importer → confirm narration is picked up from notes and quiz is parsed → fix template → only then batch.  
- Produce a **"deck format contract"** doc derived from the importer so content can also be authored elsewhere (e.g., back in Claude chat) without seeing the code.

---

## 5\. PILOT — Module 1: "Why We're Doing This" (complete content)

This is the full content for the pilot deck. Slide text is what appears on the slide; Narration is what goes in speaker notes (reworded). Generate, import, and validate this before building Modules 2–12.

### Learning Objectives

- Explain what SQF certification is and why our bakery is pursuing it.  
- Connect certification to the Publix distribution opportunity.  
- Describe what "food safety culture" means and your personal role in it.  
- State your authority and responsibility to report and stop unsafe product.

---

**Slide 1 — Title** *Slide text:* Module 1 — Why We're Doing This. SQF Food Safety Training. *Narration:* Welcome to the first module of our food safety training program. Over the next half hour we'll cover what SQF certification is, why it matters to our bakery, and the part each of you plays in making it work. Let's get started.

**Slide 2 — Learning Objectives** *Slide text:* By the end of this module you will be able to: explain SQF and why we're pursuing it; connect it to the Publix opportunity; describe food safety culture and your role; and know your authority to stop unsafe product. *Narration:* Here's what you'll walk away with. Four things: what SQF is and why we chose it, how it connects to a big opportunity for the company, what we mean by food safety culture, and — importantly — the authority every one of you has to stop product that isn't safe.

**Slide 3 — What is SQF?** *Slide text:* SQF (Safe Quality Food) is an internationally recognized food safety certification. An independent auditor verifies that we make safe food the same way, every day, and that we can prove it. *Narration:* SQF stands for Safe Quality Food. It's a food safety standard recognized around the world. The key idea is that an outside expert — an auditor — comes in and checks that we produce safe food consistently, and that we have the records to back it up. It's not a one-time test; it's how we operate.

**Slide 4 — Why certification opens doors (GFSI)** *Slide text:* SQF is benchmarked by GFSI — the bar major retailers require. Earning it tells big customers our food is safe without each of them auditing us separately. *Narration:* SQF is recognized under something called GFSI, the Global Food Safety Initiative. Think of GFSI as the standard the big grocery chains trust. When we're SQF certified, retailers know our food meets that bar — which is what makes the next slide possible.

**Slide 5 — The Publix opportunity** *Slide text:* Our goal: sell Bahama Rum Cakes through Publix. Publix requires suppliers to hold a GFSI-recognized certification like SQF. No certification, no shelf space. *Narration:* Here's why this matters to all of us. We want to get our Bahama Rum Cakes onto Publix shelves. Publix won't buy from a supplier that isn't certified to a GFSI standard like SQF — it's a requirement, not a preference. So this certification is the doorway to a major customer and real growth for the company.

**Slide 6 — Publix may visit us directly** *Slide text:* Beyond the SQF auditor, Publix reserves the right to audit our facility themselves — sometimes unannounced. We stay ready every day, not just on audit day. *Narration:* One thing to know: it's not only the SQF auditor we prepare for. Publix can send their own people to inspect our facility, and that visit may be unannounced. That's exactly why we do things the right way every single day — so whenever someone walks in, we're ready.

**Slide 7 — What "food safety culture" means** *Slide text:* Food safety culture means doing the right thing even when no one is watching. It's the habits, choices, and speaking-up that keep our food safe — owned by everyone, not just the quality team. *Narration:* You'll hear the phrase "food safety culture" a lot. It simply means we all do the right thing even when nobody's looking. It's the daily habits, the small choices, and the willingness to speak up. Food safety isn't one department's job — it belongs to every person in this building.

**Slide 8 — Your role on a rotating team** *Slide text:* Because we rotate through prep, mixing, baking, and packaging, every one of us touches food safety everywhere. The standard you hold at one station, you hold at all of them. *Narration:* Since we all rotate across prep, mixing, baking, and packaging, no one gets to say "that's not my area" — every area is your area. The care you take at one station is the same care you bring to the next. That's what makes a rotating team strong: everyone knows the whole process.

**Slide 9 — You can stop the line** *Slide text:* If you see something unsafe — contamination, a wrong label, a possible allergen mix-up — you have the authority and responsibility to report it and stop product from moving. You will never be in trouble for raising a concern. *Narration:* This is the most important slide in the module. If you ever see something that isn't safe — contamination, the wrong label, a possible allergen mix-up — you have both the right and the duty to speak up and stop that product. You will never get in trouble for raising a concern. We would far rather pause and check than ship something we'll regret.

**Slide 10 — A preview of the allergen-free promise** *Slide text:* Our Bahama Burgers are made free of the top 9 allergens — in a building that also uses wheat, egg, and milk. Protecting that promise is a job we all share, and we'll dig into it soon. *Narration:* Here's a preview of something we'll spend real time on later. Our Bahama Burgers are made free of the top nine allergens — and yet the same building handles wheat, egg, and milk for our other products. Keeping those apart is one of the hardest and most important things we do, and every one of us is part of protecting that promise.

**Slide 11 — What an auditor might ask you** *Slide text:* Be ready to answer in your own words: "Why is the company getting SQF certified?" • "What would you do if you saw something unsafe?" • "Whose job is food safety here?" *Narration:* Remember, auditors talk to people on the floor — maybe you. You don't need a script. Just be ready to answer honestly in your own words: why we're getting certified, what you'd do if you saw something unsafe, and whose job food safety is. If you remember nothing else: it's everyone's job, and you can always stop the line.

**Slide 12 — Summary** *Slide text:* SQF proves we make safe food. It's our door to Publix. Culture means everyone owns food safety. You can always report and stop unsafe product. Next: Personal Hygiene & GMPs. *Narration:* Let's recap. SQF certification proves we make safe food consistently. It's our path to selling through Publix. Food safety culture means every one of us owns it. And you always have the power to report and stop unsafe product. Up next, we'll get practical with personal hygiene and good manufacturing practices. Nice work finishing Module 1\.

---

### Module 1 Quiz (8 questions)

*Author's note for the importer: mix of recall and scenario items. Correct answers marked with ✓ and rationale included for the answer key — strip rationale from the learner-facing version if the importer doesn't expect it.*

**Q1 (recall).** What does SQF stand for?

- A) Standard Quality Food  
- B) Safe Quality Food ✓  
- C) Sanitary Quality Facility  
- D) Secure Quality Formula *Rationale: SQF \= Safe Quality Food.*

**Q2 (recall).** Why is our bakery pursuing SQF certification?

- A) It's legally required to bake anything  
- B) It lets us distribute Bahama Rum Cakes to Publix ✓  
- C) It replaces the need for cleaning  
- D) It's only for export *Rationale: Publix requires a GFSI-recognized certification; SQF is our door to that account.*

**Q3 (recall).** SQF is recognized under which broader system that major retailers trust?

- A) FDA-only registration  
- B) GFSI ✓  
- C) OSHA  
- D) The rum import license *Rationale: GFSI benchmarks SQF; it's the bar retailers like Publix require.*

**Q4 (scenario).** Publix tells you they may inspect the facility without advance notice. What's the right mindset?

- A) Only clean up the day before a scheduled audit  
- B) Do things the right way every day so we're always ready ✓  
- C) Hide the frozen line during visits  
- D) Refuse Publix entry *Rationale: Publix reserves the right to audit, sometimes unannounced — daily readiness is the only safe posture.*

**Q5 (concept).** "Food safety culture" is best described as:

- A) A poster in the break room  
- B) Doing the right thing even when no one is watching, owned by everyone ✓  
- C) The quality manager's sole responsibility  
- D) A once-a-year event *Rationale: Culture is everyday shared ownership, not one person or one event.*

**Q6 (scenario).** You're rotating on packaging and notice cakes going into boxes with the wrong product label. What should you do?

- A) Keep going; labels aren't your station's problem  
- B) Wait until break to mention it  
- C) Stop the product and report it immediately ✓  
- D) Fix it quietly and tell no one *Rationale: A wrong label can trigger a recall; every employee has authority to stop and report. Reporting also creates the record.*

**Q7 (judgment).** True or false: If you raise a food safety concern that turns out to be a false alarm, you can get in trouble.

- A) True  
- B) False ✓ *Rationale: Employees are never penalized for raising concerns; speaking up is always the right call.*

**Q8 (scenario).** Our Bahama Burgers are made free of the top 9 allergens, but the building also handles wheat, egg, and milk. Why does this matter to you on a rotating team?

- A) It doesn't; only the burger team needs to care  
- B) Because cross-contact anywhere can break the allergen-free promise, and we all work every area ✓  
- C) Because allergens only matter in shipping  
- D) Because the rum cancels out allergens *Rationale: On rotating staff, everyone influences the allergen-free claim; protecting it is a shared, facility-wide job.*

---

### Module 1 Sign-Off Sheet (fields)

Module: 1 — Why We're Doing This • Employee name • Employee ID • Date completed • Quiz score (\_\_\_/8, pass ≥ 6\) • Language taken (EN/ES) • Employee signature • Trainer/verifier signature.

---

## 6\. Recommended Next Steps in Claude Code

1. Read the importer source \+ this spec. Document, in a new `DECK_FORMAT_CONTRACT.md`, exactly how the importer locates: (a) slide body text, (b) narration, (c) quiz items, (d) module metadata.  
2. Generate the **Module 1 English deck** from §5 using a parameterized generator script.  
3. Run it through the import pipeline. Verify narration is read from speaker notes and the quiz parses. Fix the template, not the content.  
4. Produce the **Spanish Module 1** via content swap; confirm it imports identically.  
5. Lock the template \+ contract. Then batch Modules 2–12 (EN \+ ES) from structured content files.  
6. Before any audit: reconcile Modules 5, 8, 9 (HACCP/CCPs, ingredient/rum control, frozen/cold chain) against the **written food safety plan** once the SQF Practitioner has authored it. Update decks so training matches documented procedures exactly.

*Regulatory facts in this spec (Publix GFSI requirement, SQF Fundamentals not GFSI-recognized, Publix's right to audit) were confirmed via current sources during planning. Re-verify against Publix's current supplier guide and the SQF Edition 10 code text before finalizing audit-facing claims.*  
