# Plan 17-01 Summary: Structured Form UI + Direct API Pipeline

## What Changed
Replaced AutoLab's free-text instruction + AI orchestrator flow with a structured input form and direct backend API calls.

## Files Modified
- `frontend/src/components/AutoLab.tsx` — complete refactor

## Key Changes

### Removed
- `instructions` state variable and textarea (D-01)
- `StepResult` interface and step-based result derivation
- `steps`, `fitData`, `analysisState` state variables
- `handleRun` function that called `/api/autolab/run`
- "Auto (AI chooses)" option from model dropdown (D-05)

### Added
- Column picker dropdowns: X, Y, X-error, Y-error with auto-detect (D-03)
- Axis label text inputs alongside column pickers (D-04)
- Formula expression input for derived quantities (D-06)
- `handleRunAnalysis` calling direct APIs: `/api/fitting/fit`, `/api/formula/evaluate`, `/api/nsigma/calculate`, `/api/autolab/chat` (D-02)
- `autoDetectColumns()` heuristic: error/err/uncertainty/unc/delta/sigma columns → error slots, first two non-error → X/Y
- Full data re-parse before analysis (not limited to preview rows)
- Direct result state: `fitResult`, `formulaResult`, `nsigmaResult`, `summaryText`
- Analysis data state for plots: `analysisXData`, `analysisYData`, `analysisYErrors`, `analysisXErrors`

### Updated
- Model dropdown defaults to `'linear'` instead of `'auto'`
- Run button: disabled when `!file || !xCol || !yCol || !selectedModel`, label "Run Analysis"
- Header subtitle: "Automated Analysis — Upload, Configure, Get Results"
- All result rendering uses direct state (`fitResult.X`) instead of step-based (`fitStep.result.X`)
- Export pipeline builds normalized state from direct results
- Plot data wired to `analysisXData`/`analysisYData` + `fitResult.x_fit`/`fitResult.y_fit`
- ReportSection receives assembled analysis data from direct results

### Form Order (D-06)
Upload + sheet → DataPreview → Column Assignment → Axis Labels → Example Datasets → Fit Model → Formula Expression → Theoretical Value → Run Analysis

## Verification
- `tsc -b --noEmit` — zero errors
- `npm run build` — production build succeeds
