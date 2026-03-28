# Phase 12: Integration and Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 12-integration-and-polish
**Areas discussed:** Data pre-loading UX, Edge case handling

---

## Data Pre-loading UX

### Navigation from AutoLab to Report

| Option | Description | Selected |
|--------|-------------|----------|
| Button in AutoLab results | A 'Generate Report' button appears at the bottom of AutoLab results. Clicking navigates to /report with all data pre-loaded via AnalysisContext. | ✓ |
| Auto-redirect option | After AutoLab completes, a prompt asks 'Generate a lab report?' — Yes navigates, No stays. | |
| Both paths available | Button always visible + report page can pull from latest results if user navigates manually. | |

**User's choice:** Button in AutoLab results
**Notes:** None

### Pre-fill Behavior on Arrival

| Option | Description | Selected |
|--------|-------------|----------|
| Skip to generation | All AutoLab data pre-loaded, context form auto-filled where possible, jump to Generate button. | ✓ |
| Show form, pre-filled | Full report page shown with context form visible but pre-populated. | |
| Minimal form | Only show fields AutoLab can't infer. | |

**User's choice:** Skip to generation — but fill whatever possible with AutoLab context, let user fill more
**Notes:** User clarified: pre-fill everything AutoLab can provide, leave rest for user to optionally fill

### Standalone Report Page

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, full standalone | Report page works independently with file upload + instructions + context form. | |
| AutoLab required | Report page requires AutoLab results. | |
| Full AutoLab in report | Report page includes all AutoLab features for standalone analysis. | ✓ |

**User's choice:** Report page should include ALL AutoLab features for standalone use
**Notes:** User stated: "The report page, if not accessed from AutoLab, should include all AutoLab features to allow users to perform the analysis through the report page."

### Component Reuse Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Import AutoLab component | Embed actual AutoLab.tsx inside report page. DRY but coupled. | |
| Separate implementation | Report-specific analysis section calling same backend APIs, own UI. | ✓ |
| You decide | Claude picks best approach. | |

**User's choice:** Separate implementation
**Notes:** None

### Data Integration Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Everything AutoLab produces | All data including AI summary and formula evaluation. | |
| Core analysis only | Fit parameters, plots, goodness-of-fit. Skip AI summary and formula eval. | ✓ |
| You decide | Claude picks what's appropriate. | |

**User's choice:** Core analysis only
**Notes:** None

---

## Edge Case Handling

### Partial Analysis Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Generate with available data | Report generates using what succeeded. Missing sections noted with subtle warning. | ✓ |
| Block until complete | Require complete analysis before generating. | |
| Generate + flag gaps | Generate with visible placeholders in PDF for missing data. | |

**User's choice:** Generate with available data
**Notes:** None

### AI Generation Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Retry + manual fallback | Error with Retry button. After 2 failures, offer manual mode. | |
| Retry only | Error with Retry button. No manual fallback. | |
| Silent retry + error | Auto-retry once silently. If still fails, show clear error. | ✓ |

**User's choice:** Silent retry + error
**Notes:** None

---

## Claude's Discretion

- Button placement and styling within AutoLab results
- Report page analysis section layout and flow
- Pre-fill mapping logic
- Warning message styling for partial analyses

## Deferred Ideas

None — discussion stayed within phase scope
