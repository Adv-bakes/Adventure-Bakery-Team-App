# Scoring disagreements — SQF Ed 9 Gap Assessment

**Internal record. Not sent to the consultant.**
Raised 2026-08-31 · remediation task INT-12 · found by INT-3 (the Compliant-row sweep)

## Why this is a record and not a letter

Four rows in the delivered assessment are scored **Compliant** while the evidence recorded on
the same row describes a gap. Asking the consultant to re-score now would be a billable
re-review of a document we are in the middle of superseding anyway.

The decision is to **remediate the underlying gaps regardless of the score, and raise these
four rows at the close-out review**, when the consultant returns to assess the completed
work. At that point they are looking at the file again as part of the engagement, and each
row can be re-scored against what is by then a rebuilt document rather than the one they
originally saw.

**What matters for certification is that the gaps are fixed, not that the spreadsheet was
corrected.** This register exists so that no one later reads a Compliant score and concludes
there was nothing to do.

Every quotation below is copied verbatim from `RumCakeFactory_SQF_Gap Assessment_Ed 9.xlsx`,
columns B (requirement), C (response) and D (evidence).

---

## 1. Clause 2.1.1.1 — Food safety policy · **remediated**

The requirement lists six parts. Parts v and vi require the policy to be signed by the senior
site manager, displayed in prominent positions, and communicated to all site personnel in the
languages they understand.

> Evidence: "The written Food Safety Policy complies with 2.1.1. **i-iv** requirements."

The evidence claims four of six parts on a row scored Compliant. FSQM-002 as assessed had no
signature block, no display provision and no language provision.

**Status:** closed. FSQM-002 v2 (2026-08-31) adds all three, and the policy is now bilingual.
Task INT-11. Issue under INT-7.

*Also on this row: the effective date is recorded as "October 28, 20225".*

## 2. Clause 2.3.4.6 — Supplier audits based on risk · ⚠️ **no task covers this**

> Evidence: "Adventure Bakery has not done a complete evaluation of the suppliers to determine
> whether audits need to be performed."

The clause requires supplier audits to be based on risk as determined in 2.3.4.2. The evidence
states the determination has not been made.

**Status: open, and not carried by any remediation task.** No task in the plan cites 2.3.4.
Deliverable D-11 (Approved Supplier Program gaps) was never broken into tasks. Because the row
is scored Compliant, this gap is currently invisible to the plan — it would be closed out with
nothing done.

## 3. Clause 2.4.3.15 — Verification of CCP monitoring · ⚠️ **no task covers this**

> Evidence: "Verification procedures have all the required elements, although **some of the
> CCPs are not appropriate**."

If some CCPs are not appropriate, the verification of those CCPs cannot be effective.

**Status: open, and not carried by any remediation task.** The HACCP rebuild (tasks 14.1–14.13)
covers 2.4.3.2 through .14, .16 and .17, and INT-13 covers .3, .4 and .5 — **.15 is skipped**.
The rebuild will very likely fix the substance, since it re-derives the CCPs from scratch, but
nothing in the plan is accountable for this clause.

**The most valuable thing in this whole register is the question we should ask:** *which* CCPs
did the consultant consider inappropriate, and why? That answer feeds D-14 directly, and is
worth having whatever the row is eventually scored.

## 4. Clause 2.4.3.17 — Regulatory methodology · **covered**

> Evidence: "Although the Food Safety Plan has not been developed following the applicable US
> regulatory requirements (21 CFR 117 - Preventive Controls for Human Foods Rule), Adventure
> Bakery might fall under the rule exemption."
>
> Recommendation on the same row: "Ensure that Adventure Bakery falls under the exemption ...
> The organization should have an exemption letter from the FDA."

A row scored Compliant on an exemption described as unconfirmed, with a recommendation to
obtain evidence that does not exist. The site holds no FDA exemption letter.

**Status:** carried by task **14.12** (Team sign-off, annual review schedule, 21 CFR 117
decision), clauses "2.4.3.14, .17".

---

## To raise at the close-out review

1. Re-score these four rows against the rebuilt documents.
2. Ask which CCPs were considered inappropriate under 2.4.3.15 — needed for D-14 regardless.
3. Confirm the 21 CFR 117 exemption position, and whether an FDA letter is required.

## File-quality issues to mention at the same time

- A global find-and-replace has corrupted the quoted standard text: "Organizational" became
  "Adventure Bakeryal" in about eight places, and "point" became "piont" throughout — the
  requirement text at 2.4.3.15 quoted above reads "critical control pionts". The file misquotes
  Edition 9.
- 2.2.3.1 and 11.5.3.3 have no Primary Response recorded.
- FRM-204 is cited for two different documents, and that collision is used as evidence for
  2.8.1.6. Being fixed at our end.
- The clause labels for 2.2 and 2.3 are stored as floats (2.2000000000000002, 2.2999999999999998).
