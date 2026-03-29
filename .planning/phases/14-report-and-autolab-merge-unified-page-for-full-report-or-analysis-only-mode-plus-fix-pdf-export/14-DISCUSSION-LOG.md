# Phase 14: Report and AutoLab Merge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 14-report-and-autolab-merge
**Areas discussed:** Unified page structure, Analysis-only vs full report mode, PDF export fix, What stays/what goes

---

## Unified Page Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single progressive flow | One page at /autolab. Upload → analysis → optional report generation, all scrolling down | ✓ |
| Tabs within one page | Two tabs (Analysis / Lab Report) on one page | |
| Keep two routes, merge UX | Keep /autolab and /report separate but improve transition | |

**User's choice:** Single progressive flow
**Notes:** User emphasized: "the user should have an option to either stop at analysis or continue and generate a full report, which takes into context the analysis results and subject of experiment"

### Follow-up: /report route

| Option | Description | Selected |
|--------|-------------|----------|
| Remove /report entirely | Delete route and ReportBeta.tsx | ✓ |
| Redirect /report to /autolab | Keep as redirect for bookmarks | |
| Keep /report as alias | Two URLs, one component | |

**User's choice:** Remove /report entirely

---

## Analysis-only vs Full Report Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Expand button | "Generate Full Report" button expands report section below results | ✓ |
| Stepper/wizard | Step 1: Analyze, Step 2: Report with progress indicator | |
| Always visible sections | Report section always visible but grayed out until analysis completes | |

**User's choice:** Expand button

### Follow-up: Pre-fill behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fill what's available | Auto-fill from analysis, user adds personal info | ✓ |
| Blank form | Empty form, user fills everything | |
| Smart pre-fill with confirmation | Pre-fill + summary confirmation before generating | |

**User's choice:** Pre-fill what's available

### Follow-up: Instruction file upload

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional upload | Optional PDF/DOCX upload for AI context | ✓ |
| No, just analysis data + form | Skip instruction upload | |

**User's choice:** Yes, optional upload

---

## PDF Export Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Button does nothing | Frontend wiring issue | |
| Error message appears | Backend returns error | |
| Railway deployment issue | Works locally, fails on Railway | |
| Haven't tested it yet | Never fully tested | |

**User's choice:** 500 error on Railway when exporting PDF from the report page

### Follow-up: Fix scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the 500 error only | Just debug and fix | |
| Fix + improve quality | Fix error AND improve PDF formatting | ✓ |
| Fix + add fallback | Fix and add jsPDF fallback | |

**User's choice:** Fix + improve quality

---

## What Stays, What Goes

### Quick jsPDF export

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | Full WeasyPrint export replaces it | |
| Keep as 'Quick Export' | Lightweight alternative | |
| Replace with results-only WeasyPrint PDF | Results-only via WeasyPrint | |

**User's choice:** Remove jsPDF, but add a results-only PDF export via WeasyPrint for users who don't want a full report

### Inline AI chat

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it | Stays in analysis section | |
| Remove it | Drop entirely | |
| Move to sidebar (Phase 13) | Deferred to UI overhaul | ✓ |

**User's choice:** Move to sidebar (Phase 13)

### Example datasets

| Option | Description | Selected |
|--------|-------------|----------|
| Keep them | All three examples stay | |
| Remove them | No examples | |
| Move to help/demo section | Collapsible examples | |

**User's choice:** Keep only Free Fall. Extend it to demo the full flow including report generation with pre-filled details and instructions.

---

## Claude's Discretion

- Layout and visual design of expand/collapse transition
- How two PDF export options are presented
- Pre-fill mapping logic
- Component code structure (single vs sub-components)

## Deferred Ideas

- Inline AI chat → Phase 13 sidebar/global chat
- Additional example datasets beyond Free Fall
