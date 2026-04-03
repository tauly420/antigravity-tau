# Phase 15: AutoLab Fixes and Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 15-autolab-fixes-and-polish
**Areas discussed:** Known bugs, UX flow polish, Visual refinements, PDF output quality

---

## Known Bugs / Issues

| Option | Description | Selected |
|--------|-------------|----------|
| Analysis flow errors | Upload/analysis/results pipeline has errors or fails in certain cases | |
| Report section bugs | The expand-to-report flow, section editor, or AI generation has issues | |
| Navigation / routing | Back button, homepage links, or route transitions broken or janky | |
| Example dataset issues | Free Fall demo doesn't work correctly or doesn't showcase the full flow | |

**User's choice:** PDF export doesn't work, status code 500 error (free-text response)
**Notes:** Both results-only PDF and full report PDF return 500. Only tested on Railway deployment.

### Follow-up: Where does the 500 occur?

| Option | Description | Selected |
|--------|-------------|----------|
| Both exports fail | Results-only PDF and full report PDF both return 500 | ✓ |
| Results-only fails | Only the quick results PDF export returns 500 | |
| Full report fails | Only the full lab report PDF export returns 500 | |
| Not sure | Haven't tested both separately | |

### Follow-up: Local or Railway?

| Option | Description | Selected |
|--------|-------------|----------|
| Locally | 500 error when running on localhost | |
| Railway only | Works locally but fails on Railway deployment | |
| Both | Fails in both local and deployed environments | |
| Not sure | Only tested in one environment | ✓ |

**Notes:** User only tests on Railway, doesn't run locally.

---

## UX Flow Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Loading feedback | Unclear what's happening during analysis | |
| Results presentation | How results appear after analysis | |
| Report expansion | Transition from analysis to report section feels clunky | |
| Error handling | Errors aren't shown clearly enough | |

**User's choice:** Workflow is good — main issue is button/input CSS inconsistency across pages (redirected to Visual Refinements)
**Notes:** No UX flow issues — the progression works well.

---

## Visual Refinements

### Button/Input Standard

| Option | Description | Selected |
|--------|-------------|----------|
| AutoLab's style | Use AutoLab page's button/input styling | |
| Homepage's style | Use the homepage card/button styling | |
| Pick the best | Claude reviews all pages and picks the most polished style | ✓ |
| New unified style | Design fresh button/input styles | |

### Other Visual Issues

| Option | Description | Selected |
|--------|-------------|----------|
| Spacing / alignment | Inconsistent padding, margins, or alignment | |
| Typography | Font sizes, weights, heading styles inconsistent | |
| Dark theme gaps | Some elements still have light backgrounds or wrong contrast | |
| Looks good otherwise | Buttons/inputs are the main issue | ✓ |

---

## PDF Output Quality

| Option | Description | Selected |
|--------|-------------|----------|
| Hebrew RTL rendering | Hebrew text flows correctly right-to-left | |
| Plot quality | Plots should look sharp in PDF | |
| Academic formatting | Proper margins, section numbering, figure captions | |
| Just make it work | Fix the 500 first, quality later | ✓ |

**Notes:** User cannot evaluate PDF quality until the 500 error is fixed. Quality improvements deferred.

---

## Claude's Discretion

- Which existing button/input style to standardize on
- CSS consolidation approach
- PDF 500 debugging strategy

## Deferred Ideas

- **AutoLab UI overhaul** — Structured workflow input (upload → columns → fit model → parameters → formula → comparison → one-shot execution). User wants this as Phase 16+.
- **Remove old workflow pages** — After AutoLab absorbs all functionality. Phase 17.
- **PDF quality polish** — After 500 fix. Phase 18.
