# Training Decks

Tooling + source content for the SQF training PowerPoint decks. See `../DECK_FORMAT_CONTRACT.md`
for the full importer contract and `CLAUDE_DESIGN_BRIEF.md` for the external-design brief.

## What's in git vs. what isn't

**Tracked (source of truth — regenerates everything):**

- `generate.mjs` + `assets.mjs` — code generator (`node generate.mjs content/module-NN.xx.json` → `dist/`)
- `inject-notes.mjs` — stamps authored narration into any deck's speaker notes
- `translate-deck.mjs` — produces a Spanish copy of a designed deck (per-paragraph swap)
- `content/*.json` — per-module slide text, narration, quiz (the editable inputs)
- `CLAUDE_DESIGN_BRIEF.md`, this README

**Gitignored (binary, reproducible, or large):**

- `dist/` — generator output (`.pptx` + `.quiz.csv`). Always rebuildable from `content/` + the scripts.
- `incoming/` — externally designed decks (Claude Design exports) dropped here before import.

`.pptx` is opaque binary that bloats history and doesn't diff, so decks are never committed — only
the text inputs that rebuild them.

## ⚠ Back up `incoming/` separately

The Claude Design exports in `incoming/` are the **one artifact not reproducible from this repo**.
The generator can rebuild the flat-illustration deck from `content/`, but **not** the
photography-driven Claude Design version — that lives only in your Claude Design session and the
files here. If you wipe `incoming/`, those decks must be re-exported from Claude Design.

Keep a backup of the approved exports outside the repo (cloud drive, etc.). Current Module 1 exports:
`SQF_Module_1.pptx` (EN), `SQF_Module_1.es.pptx` (ES), `SQF_Module_1.notes.pptx` (notes-injected).
