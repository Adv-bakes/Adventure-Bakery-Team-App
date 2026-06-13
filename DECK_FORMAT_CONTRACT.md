# Deck Format Contract — SQF Training Modules

How the app's PowerPoint importer (`src/components/team/PptxImportDialog.tsx`) actually consumes
a training deck, derived from the importer source. Authoring content to this contract guarantees
it imports cleanly. Validated against the Module 1 pilot (see `training-decks/`).

## Import pipeline (what happens to your files)

1. Admin opens **Compliance → SOPs Library** and clicks **Add Module** on a category header
   (or the global **Import from PowerPoint** button), picks the `.pptx` and optionally a `.quiz.csv`.
2. The browser reads **speaker notes** out of the .pptx (`src/lib/pptxNotes.ts`) and parses the quiz CSV
   (`parseQuizCsv` in `src/lib/training.ts`) *before* anything is written — a malformed CSV aborts the import.
3. The deck is uploaded and the `convert-pptx` edge function renders **one PNG per slide via CloudConvert
   (96 DPI)**. Only pixels survive: on-slide text is never machine-read, and the .pptx itself is deleted
   after conversion.
4. Narration: each slide's speaker notes become that slide's narration. Slides with **empty notes** get
   AI narration (Gemini vision over the slide image) as a fallback.
5. Quiz: the CSV questions are saved verbatim. If no CSV is supplied, AI drafts
   `clamp(ceil(slides/2), 5, 15)` questions from the narrations instead.
6. The module lands as a **draft** `sop_documents` row — invisible to employees until status is set to active.

## Content policy (applies to slide text, narration, and quiz)

**Never name customers, retailers, or branded products** in anything a trainee sees or hears.
The generator fails the build if a forbidden name appears anywhere in the content JSON.

| Instead of | Write |
|---|---|
| Publix | "a major grocery retailer" / "our retail customer" |
| Bahama Rum Cakes | "our rum cakes" |
| Marini Brothers Bahama Burgers | "our plant-based burgers" |
| Botta Biscotti | "our biscotti" |

Generic scheme/regulator names (GFSI, BRCGS, FSSC 22000, FDA, OSHA) are fine. Keep the
vocabulary consistent across all modules so quizzes and narration reinforce the same phrases.

## Visual style — every content slide carries a visual

Slides are diagram-first, not bullet lists. The generator template provides the layout
(textured background with soft palette blobs, amber top bar, Cambria title, accent underline,
italic lead-in line, footer), diagrams as white cards with soft shadows, and **generated flat
illustrations** (SVG in `training-decks/assets.mjs`, rasterized to PNG at build time by
`@resvg/resvg-js`) — no stock photos, so zero licensing/attribution risk and a consistent
style across all 24 decks.

**Industrial imagery rule:** this is a B2B contract-manufacturer industrial bakery. Imagery
must read industrial — production line/conveyor, workers in **bouffant caps/hairnets + aprons**,
shipping truck/boxes, QA clipboards. Never storefronts, chef hats, or retail-shop scenes.

Spot illustrations available via the slide-level `"art"` prop (rendered as a right column;
the diagram area narrows automatically): `conveyor` (title motif, automatic), `workers`,
`truck`, `clipboardMagnifier`, `ribbonMedal`, `auditor`. Panel/card icons: `burger`, `wheat`,
`egg`, `milk` (split-panel `icons[]`), `iconChat`, `iconTruck`, `iconPeople`, `iconHand`
(cards `icons[]`). Add new illustrations in `assets.mjs` following the same palette constants.

Diagram types, specified per slide as `"visual": { "type": ..., ...props }` plus an optional
one-line `"lead"`:

| Type | Use for | Key props |
|---|---|---|
| `cards` | numbered learning objectives / key points | `items[]` |
| `badge` | acronym breakdowns (S·Q·F) | `letters[]`, `words[]`, `caption` |
| `hierarchy` | umbrella standard → schemes | `top`, `children[]`, `highlight`, `caption` |
| `flow` | cause→effect chains | `steps[]`, `highlight`, `caption` |
| `cycle` | rotating stations / repeating loops | `steps[4]`, `center` |
| `weekStrip` | daily-habit messages | `days[]?`, `caption` |
| `workers` | culture / shared-ownership (hairnet figures) | `chip` |
| `stopSign` | stop-the-line authority | `label`, `lines[]` (last line renders green) |
| `split` | two-sided comparisons (allergen-free vs shared building) | `left/right{header,items,color}`, `chip` |
| `bubbles` | auditor questions / quotes | `items[]` |
| `checklist` | summaries | `items[]`, `next` (chip) |

A slide without a recognized `visual` falls back to plain `intro`/`bullets`/`body` text — use
that only when nothing fits. The JSON schema can grow an `image` field later if real photos
are ever wanted (none used today, by design).

## (a) Slide body text

- Rendered to a PNG image only — **never parsed as text**. It must be legible as an image:
  16:9 layout (10 × 5.625 in → 960 × 540 px), body text ≥ ~16 pt, high-contrast colors.
- Use safe fonts only (Calibri body, Cambria headers) — CloudConvert substitutes anything exotic.
- **Do not use hidden slides** — CloudConvert renders them, so they would appear in the module.
- No animations/transitions (only the final state of the slide renders).

## (b) Narration

- Lives in each slide's **speaker notes** (the body placeholder — plain text; formatting is discarded,
  paragraphs join with newlines). Slide-number/header/footer placeholders are ignored.
- Wording should be *similar but not identical* to the on-slide text (it is read aloud by TTS in the viewer).
- Length guide: **35–120 words per slide** (~15–50 s spoken at TTS pace). The viewer's minimum-dwell gate is
  `max(8, ceil(words / 3))` seconds per slide (`computeSlideDuration`, `src/lib/training.ts`).
- A slide with empty notes silently falls back to AI narration — leave notes empty only when that's intended.

## (c) Quiz

Hand-authored quiz ships as a **sidecar CSV** (`<deck-name>.quiz.csv`) selected in the import dialog
("Quiz CSV (optional)"). When provided, it replaces AI quiz generation entirely. Exact format
(`parseQuizCsv`, also accepted by the paste-CSV box in the HR Training quiz settings drawer):

```csv
#,Question,Hint,Option A,Option B,Option C,Option D,Correct Answer,Rationale
1,What does SQF stand for?,,Standard Quality Food,Safe Quality Food,...,B,SQF = Safe Quality Food.
```

- Header row is **required**; column names must match: `Question`, `Hint`, `Option A`… (any count ≥ 1),
  `Correct Answer`, `Rationale`. The `#` column is ignored (order = row order).
- `Correct Answer` is a **letter** (A/B/C/…) matching the option position.
- True/false questions: put True/False in Option A/B and leave C/D **empty** — empty options are dropped.
  ⚠ Because empty options are dropped, don't leave a *gap* (e.g. empty B with a filled C) — letters shift.
- Standard CSV quoting: wrap fields containing commas/quotes/newlines in `"…"`, double inner quotes.
- Author a `Hint` for every question (a nudge toward the concept, not the answer) and a `Rationale`
  for the answer key — the generator warns on empty hints. Strip ✓ marks and "Rationale:" prefixes
  from authored text; the answer letter and rationale column carry that information.
- Editable afterward in the drawer's Quiz Editor (hints, rationale, reorder, acknowledgment text).

## (d) Module metadata

| Field | Where it comes from |
|---|---|
| Title | Typed in the import dialog (prefilled from filename: `.pptx` stripped, `-`/`_` → spaces) |
| Category / training category | Which **Add Module** button launched the dialog (per-category buttons pass both) |
| Status | Always `draft`; activate in the SOPs Library detail drawer |
| Passing score | Defaults **80%** — SQF modules use **75%** (pass ≥ 6/8): set in the quiz settings after import |
| SOP #, revision, effective date, SQF reference, approved by | Set afterward in the SOPs Library detail drawer |
| Sign-off / acknowledgment | Configure in the Quiz Editor (`content.acknowledgment`); the paper sign-off sheet is a separate deliverable, not part of the import |

## Authoring workflow (Modules 2–12, EN + ES)

**Slide count is content-driven, not fixed.** Size each module to teach its material well — use as
many slides as it needs (fewer or more; Module 1 happened to be 12). The content JSON is the
canonical slide list. The only hard rule: the **design deck's slide count and order must match the
content JSON's narration list**, because `inject-notes.mjs` maps narration to slides by position and
aborts on a mismatch. So pick the count when authoring content, then lock that count in the module's
Claude Design brief. If a designer proposes a better breakdown, update the content JSON to match
before injecting notes.

1. Write a content JSON in `training-decks/content/` (schema = `module-01.en.json`: `slides[]` with
   `title` + `lead` + `visual` (see table above; or fallback `intro`/`bullets`/`body`) + `notes`,
   optional `kind:"title"`, `accent:"green"`; `quiz[]` with `question`, `options[]`, 0-based `correct`,
   `rationale`, optional `hint`). Spanish = sibling file (`module-NN.es.json`), same structure.
2. `node training-decks/generate.mjs training-decks/content/module-NN.xx.json` → emits
   `dist/<name>.pptx` + `dist/<name>.quiz.csv`, enforces the content policy (no customer/product
   names), prints per-slide narration word counts/dwell times, and round-trip-verifies that the
   notes are readable where the importer looks for them.
3. Import both files via the SOPs Library; set passing score to 75%; review; activate.

### Externally designed decks (Claude Design, Canva, agencies)

A deck designed outside the generator works with the importer as long as it keeps the module's
slide count/order and the content policy (see `training-decks/CLAUDE_DESIGN_BRIEF.md` for a
ready-made Claude Design brief). Before importing, stamp the authored narration into its
speaker notes:

```
node training-decks/inject-notes.mjs <designed-deck.pptx> training-decks/content/module-NN.xx.json
```

The script maps narration to slides by position (aborts on a count mismatch), creates the
notes parts/notes master if the export has none, overwrites any existing notes, and
round-trip-verifies the result. The quiz CSV is design-independent — use the generator's.
Drop external exports in `training-decks/incoming/` (gitignored).

**Spanish copies** reuse the EN designed deck — no second design session:

```
node training-decks/translate-deck.mjs --extract <en-deck.pptx>                      # dump strings skeleton
node training-decks/translate-deck.mjs <en-deck.pptx> module-NN.es.strings.json -o <es-deck.pptx>
node training-decks/inject-notes.mjs <es-deck.pptx> training-decks/content/module-NN.es.json
```

The strings file maps every EN paragraph to ES (`null` = keep as-is: brand names, SQF/GFSI,
glyphs). The translator fails on unmatched paragraphs so nothing ships half-translated.
Spanish runs ~15–25% longer — after import, check renders for text/box overflow and shorten
the ES string where a layout breaks (slide 9 needed this in Module 1). ES imports as its own
module row (title suffix "(ES)"); quiz/narration come from `module-NN.es.json`. Human
bilingual proofread before audit-facing use.
