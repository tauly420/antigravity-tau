# Phase 17: AutoLab Structured Input - Research

**Researched:** 2026-04-06
**Domain:** React frontend refactor + backend API integration
**Confidence:** HIGH

## Summary

Phase 17 replaces AutoLab's free-text AI orchestrator with a structured input form that calls backend APIs directly. The existing codebase already has all three target endpoints (`/api/fitting/fit`, `/api/formula/evaluate`, `/api/nsigma/calculate`) fully operational with well-defined request/response contracts. The Lab Workflow page (`Workflow.tsx`) provides a complete reference implementation of the column picker, axis label inputs, model selector, and fit execution pattern -- this code can be adapted wholesale.

The main work is a frontend refactor of `AutoLab.tsx`: rip out the `handleRun` function (which POSTs to `/api/autolab/run` with multipart form), replace it with a sequential chain of direct API calls, and restructure the input section from instructions-textarea to a form with dropdowns. The results display, report expander, and export pipeline remain unchanged. A lightweight summary endpoint (or reuse of `/api/autolab/chat`) is needed for the AI-generated summary paragraph.

**Primary recommendation:** Refactor AutoLab.tsx in-place. Copy the column picker and fit-calling patterns from Workflow.tsx. Keep all results rendering code intact. Add a new `/api/autolab/summary` endpoint that takes fit/formula/nsigma results and returns a 3-5 sentence summary.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Remove free-text instructions box entirely. Structured form fields replace it. AI orchestrator (`/api/autolab/run`) no longer called for main analysis flow.
- **D-02:** Direct backend API calls replace OpenAI orchestration: fitting -> formula -> nsigma -> AI summary only.
- **D-03:** Dropdown selectors for X, Y, X-error, Y-error columns. Smart auto-detect defaults (columns with "error"/"err"/"uncertainty"/"unc" go to error slots). All columns from selected sheet in every dropdown.
- **D-04:** Axis label text inputs (X label, Y label) alongside column pickers.
- **D-05:** Model dropdown without "Auto (AI chooses)" option. Default to "linear". Custom expression when model = "custom". Fixed-params UI is Claude's discretion.
- **D-06:** All inputs shown upfront in single form (no step-by-step unlock). Order: upload+sheet -> column assignment -> axis labels -> model -> formula (optional) -> theoretical value (optional) -> Run Analysis button.
- **D-07:** Report context form (title, subject, equipment, notes) is post-analysis section. Appears below results after analysis completes.
- **D-08:** Example datasets must pre-fill structured form fields instead of free-text instructions.

### Claude's Discretion
- Whether to add "Plot title" input or derive from X/Y labels
- Fixed-params UI (keep/simplify/remove)
- Exact smart column auto-detection heuristic
- Summary AI endpoint implementation (new endpoint vs reuse `/api/autolab/chat`)
- Whether X-error dropdown defaults to "None" or tries auto-detect
- Visual styling consistent with Phase 15
- How to handle CSV files (no sheet selector needed)
- Error messaging when required fields not filled

### Deferred Ideas (OUT OF SCOPE)
- Remove Lab Workflow page (deferred to future phase)
- Parameter constraint inputs (e.g., set b=0 in ax+b) -- complex UI, defer
- Multi-dataset overlay on same plot
- Saving/loading analysis configurations
</user_constraints>

## API Endpoint Contracts (Exact Shapes)

### 1. POST /api/fitting/parse -- File Parsing
[VERIFIED: backend/api/fitting.py]

**Request:** `multipart/form-data` with fields:
- `file` (File) -- the uploaded data file
- `info_only` (string, optional) -- `"true"` to get only sheet/column metadata
- `sheet_name` (string, optional) -- which sheet to load
- `max_rows` (string, optional) -- limit rows for preview

**Response (info_only=true):**
```json
{
  "sheet_names": ["Sheet1", "Sheet2"],
  "sheets_info": { "Sheet1": ["col_a", "col_b"], "Sheet2": ["col_x"] }
}
```

**Response (data mode):**
```json
{
  "columns": ["Time_s", "Height_m", "Height_Error_m"],
  "rows": [{ "Time_s": 0.0, "Height_m": 0.00, "Height_Error_m": 0.10 }, ...],
  "sheet_names": ["Sheet1"],
  "row_count": 16
}
```

### 2. POST /api/fitting/fit -- Curve Fitting
[VERIFIED: backend/api/fitting.py]

**Request JSON:**
```json
{
  "x_data": [0.0, 0.1, 0.2, ...],
  "y_data": [0.0, 0.05, 0.19, ...],
  "y_errors": [0.10, 0.10, 0.12, ...],  // optional
  "model": "quadratic",                   // linear|quadratic|cubic|power|exponential|sinusoidal|fractional|gaussian|custom
  "custom_expr": "a*sin(b*x)+c",          // required when model="custom"
  "initial_guess": [1, 1, 0]              // optional, for custom models
}
```

**Response JSON:**
```json
{
  "parameters": [4.91, 0.02, 0.01],
  "uncertainties": [0.03, 0.01, 0.005],
  "parameter_names": ["a", "b", "c"],
  "r_squared": 0.9998,
  "chi_squared": 12.5,
  "reduced_chi_squared": 0.96,
  "p_value": 0.48,
  "dof": 13,
  "n_data": 16,
  "n_params": 3,
  "model_name": "y = ax^2 + bx + c",
  "x_fit": [0.0, 0.0075, ...],   // 200 points for smooth fit curve
  "y_fit": [0.01, 0.012, ...],
  "residuals": [0.01, -0.02, ...],
  "error": null
}
```

**Key notes:**
- `y_errors` is optional; when absent, chi-squared uses residual sum and P-value is null
- Zero uncertainties replaced with 10% of minimum nonzero uncertainty
- `x_fit`/`y_fit` contain 200 points for smooth plot rendering
- `residuals` is `y_data - y_predicted` (same length as input)

### 3. POST /api/formula/evaluate -- Formula Evaluation
[VERIFIED: backend/api/formula.py]

**Request JSON:**
```json
{
  "expression": "2*a",
  "is_latex": false,
  "variables": { "a": 4.91 },
  "uncertainties": { "a": 0.03 }
}
```

**Response JSON:**
```json
{
  "value": 9.82,
  "uncertainty": 0.06,
  "formatted": "9.82 +/- 0.06",
  "error": null
}
```

**Key notes:**
- Expression uses SymPy syntax (not LaTeX by default)
- `is_latex: true` triggers LaTeX-to-SymPy conversion
- Variables/uncertainties keys must match expression symbols exactly
- For AutoLab: variable names = fit parameter names from fit result

### 4. POST /api/nsigma/calculate -- N-Sigma Comparison
[VERIFIED: backend/api/nsigma.py]

**Request JSON:**
```json
{
  "value1": 9.82,
  "uncertainty1": 0.06,
  "value2": 9.81,
  "uncertainty2": 0.01
}
```

**Response JSON:**
```json
{
  "n_sigma": 0.164,
  "interpretation": "Consistent (< 1 sigma)",
  "error": null
}
```

**Key notes:**
- `value1`/`uncertainty1` = experimental (from formula evaluation or fit parameter)
- `value2`/`uncertainty2` = theoretical (from user input)
- The frontend TypeScript API wrapper in `api.ts` calls this via `calculateNSigma()`

### 5. POST /api/autolab/chat -- Summary Generation (reusable)
[VERIFIED: backend/api/autolab.py]

**Request JSON:**
```json
{
  "messages": [{ "role": "user", "content": "Summarize these analysis results in 3-5 sentences." }],
  "context": {
    "fit": { "model_name": "...", "parameter_names": [...], "parameters": [...], "uncertainties": [...], "reduced_chi_squared": 0.96, "p_value": 0.48, "r_squared": 0.9998 },
    "formula": { "expression": "2*a", "value": 9.82, "uncertainty": 0.06, "formatted": "9.82 +/- 0.06" },
    "nsigma": { "n_sigma": 0.164, "verdict": "Consistent", "theoretical_value": 9.81, "theoretical_uncertainty": 0.01 }
  }
}
```

**Response JSON:**
```json
{ "reply": "The quadratic fit yielded..." }
```

**Recommendation:** Reuse `/api/autolab/chat` for summary generation. Send a single message asking for a 3-5 sentence summary with the full context object. No new endpoint needed -- this is simpler and already works. [ASSUMED -- needs verification that response quality is acceptable]

## Current AutoLab.tsx Architecture
[VERIFIED: frontend/src/components/AutoLab.tsx]

### State Variables (current)
```typescript
// File management
file: File | null
previewData: { columns: string[]; rows: Record<string, any>[] } | null
sheetNames: string[]
selectedSheet: string

// Free-text inputs (TO BE REMOVED)
instructions: string

// Already-structured inputs (KEEP)
theoVal: string
theoUnc: string
selectedModel: string       // 'auto' | 'linear' | ... | 'custom'
customExpr: string
fixedParams: Record<string, string>

// Results
steps: StepResult[]         // orchestrator steps (TO BE REPLACED)
fitData: any                // (TO BE REPLACED with direct fit result)
analysisState: any          // (TO BE REPLACED)

// Report/export
reportExpanded: boolean
plotImages: { fit: string | null; residuals: string | null }
demoReportContext: { title, subject, equipment, notes, titlePage? } | null
```

### State Variables (NEW -- needed for structured form)
```typescript
// Column assignment (borrow from Workflow.tsx)
xCol: string
yCol: string
xErrCol: string             // default "None"
yErrCol: string             // default "None"
xLabel: string
yLabel: string

// Direct API results
fitResult: FitResult | null  // from /api/fitting/fit
formulaResult: { value: number; uncertainty: number; formatted: string } | null
nsigmaResult: { n_sigma: number; interpretation: string } | null
summaryText: string | null   // from /api/autolab/chat

// New optional inputs
formulaExpr: string          // e.g. "2*a"
```

### File Handling Flow (reusable as-is)
The current `handleFileChange` and `loadPreviewForSheet` functions already:
1. Detect Excel vs CSV
2. Call `parseFileInfo()` for multi-sheet Excel (gets sheet names + column names)
3. Call `parseFileData()` for actual data loading
4. Set `previewData`, `sheetNames`, `selectedSheet`

These can be reused. Only change: after loading data, auto-detect column assignments.

### EXAMPLE_DATASETS (current shape, needs updating)
```typescript
{
  label: 'Free Fall (Quadratic)',
  instructions: '...',           // TO BE REMOVED
  theoVal: '9.81',
  theoUnc: '0.01',
  columns: ['Time_s', 'Height_m', 'Height_Error_m', 'Time_Error_s'],
  rows: [...],
  reportContext: { title, subject, equipment, notes },
  titlePage: { studentName, studentId, ... },
}
```

**New shape needed:**
```typescript
{
  label: 'Free Fall (Quadratic)',
  // Structured form pre-fills:
  xCol: 'Time_s',
  yCol: 'Height_m',
  xErrCol: 'Time_Error_s',
  yErrCol: 'Height_Error_m',
  xLabel: 'Time [s]',
  yLabel: 'Height [m]',
  model: 'quadratic',
  formulaExpr: '2*a',           // optional
  theoVal: '9.81',
  theoUnc: '0.01',
  // Data:
  columns: [...],
  rows: [...],
  reportContext: { ... },
  titlePage: { ... },
}
```

## Workflow.tsx Patterns to Borrow
[VERIFIED: frontend/src/components/Workflow.tsx]

### Column Picker Pattern
```typescript
// Grid layout: 2x2 for columns, 3-col for labels
<div className="grid grid-2">
  <div className="form-group">
    <label>X column</label>
    <select value={xCol} onChange={e => { setXCol(e.target.value); if (!xLabel || xLabel === xCol) setXLabel(e.target.value); }}>
      <option value="">-- select --</option>
      {parsedData.columns.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  </div>
  // ... Y column, X error (with "None" option), Y error (with "None" option)
</div>
<div className="grid grid-3">
  // X label input, Y label input, Plot title input
</div>
```

**Key pattern:** When user changes X column, auto-update xLabel if it hasn't been manually edited.

### Fit Execution Pattern
```typescript
const xData = parsedData.rows.map(r => Number(r[xCol])).filter(v => !isNaN(v));
const yData = parsedData.rows.map(r => Number(r[yCol])).filter(v => !isNaN(v));
const yErrors = yErrCol !== 'None'
  ? parsedData.rows.map(r => Number(r[yErrCol])).filter(v => !isNaN(v))
  : undefined;

const payload: any = { x_data: xData, y_data: yData, model };
if (yErrors && yErrors.length === yData.length) payload.y_errors = yErrors;
if (model === 'custom') payload.custom_expr = customExpr;

const result = await api.fitData(payload);
```

### Pre-filled Formula Variables from Fit
```typescript
const fitPrefilled = (): Record<string, { value: number; uncertainty: number }> => {
  if (!fitResult) return {};
  const map: Record<string, { value: number; uncertainty: number }> = {};
  fitResult.parameter_names.forEach((name, i) => {
    map[name] = { value: fitResult.parameters[i], uncertainty: fitResult.uncertainties[i] };
  });
  return map;
};
```

This pattern is essential for the formula evaluation step -- variables and uncertainties come directly from fit parameter names/values.

## Analysis Pipeline (New Direct-Call Sequence)

```
handleRunAnalysis():
  1. Extract x_data, y_data, y_errors from parsedData using column selections
  2. POST /api/fitting/fit -> fitResult
  3. IF formulaExpr is provided:
     a. Build variables/uncertainties from fitResult.parameter_names + fitResult.parameters + fitResult.uncertainties
     b. POST /api/formula/evaluate -> formulaResult
  4. IF theoVal is provided:
     a. Determine value1/uncertainty1:
        - If formulaResult exists: use formulaResult.value / formulaResult.uncertainty
        - Else: could use a fit parameter directly (needs user to specify which)
     b. POST /api/nsigma/calculate -> nsigmaResult
  5. POST /api/autolab/chat with context -> summaryText
  6. Store all results, update AnalysisContext, trigger plot capture
```

### N-Sigma Value Source Problem
The current orchestrator figures out which value to compare (e.g., `2*a` for free fall). With direct calls, the pipeline needs to know:
- If formula is provided: compare `formulaResult.value +/- formulaResult.uncertainty` to theoretical
- If no formula: the user would need to specify which parameter to compare

**Recommendation:** When theoretical value is provided but no formula, compare `formulaResult` if available, otherwise show an error asking the user to provide a formula expression. This matches the physics workflow (you always derive the quantity before comparing). [ASSUMED]

## Results Display (Minimal Changes)

The current results rendering (parameter table, plots, chi-squared stats) already displays data from `fitStep.result`. In the new flow, `fitResult` has the exact same shape as `fitStep.result` -- it comes from the same endpoint. The rendering code needs only variable name changes:

| Current | New |
|---------|-----|
| `fitStep?.result?.parameters` | `fitResult?.parameters` |
| `fitStep?.result?.parameter_names` | `fitResult?.parameter_names` |
| `summaryStep?.message` | `summaryText` |
| `formulaStep?.result` | `formulaResult` |
| `nsigmaStep?.result` | `nsigmaResult` |
| `analysisState` (for normalize) | Build from fitResult/formulaResult/nsigmaResult |

## Report Flow (Minimal Changes)

Current report flow:
1. `ReportExpander` wraps `ReportSection`
2. `ReportSection` receives `analysisData` (normalized), `plotImages`, `initialTitle`, `instructions`, `demoContext`
3. User fills context form inside `ReportSection` (title, subject, equipment, notes)
4. Calls `/api/report/generate` then `/api/report/export-pdf` or `/api/report/export-docx`

**Changes needed:**
- `analysisData` must be built from new direct results (fitResult + formulaResult + nsigmaResult) and normalized via `normalizeAnalysisData()`
- `instructions` prop no longer has free-text; pass empty string or summary text
- Everything else stays the same

## Smart Column Auto-Detection Heuristic

**Recommendation for D-03:** [ASSUMED]

```typescript
function autoDetectColumns(columns: string[]): { xCol: string; yCol: string; xErrCol: string; yErrCol: string } {
  const errPattern = /error|err|uncertainty|unc|delta|sigma/i;
  const errorCols = columns.filter(c => errPattern.test(c));
  const dataCols = columns.filter(c => !errPattern.test(c));

  // X = first data column, Y = second data column
  const xCol = dataCols[0] || '';
  const yCol = dataCols[1] || '';

  // Try to match error columns to their data columns
  let yErrCol = 'None';
  let xErrCol = 'None';

  // Look for Y-error: column name containing Y column name + error indicator
  const yBase = yCol.replace(/[_\s-].*/, '').toLowerCase();
  const xBase = xCol.replace(/[_\s-].*/, '').toLowerCase();

  for (const ec of errorCols) {
    const ecLower = ec.toLowerCase();
    if (ecLower.includes(yBase)) yErrCol = ec;
    else if (ecLower.includes(xBase)) xErrCol = ec;
  }

  // Fallback: first error col = Y error, second = X error
  if (yErrCol === 'None' && errorCols.length >= 1) yErrCol = errorCols[0];
  if (xErrCol === 'None' && errorCols.length >= 2) xErrCol = errorCols[1];

  return { xCol, yCol, xErrCol, yErrCol };
}
```

## AnalysisContext Integration
[VERIFIED: frontend/src/context/AnalysisContext.tsx]

Current context stores:
- `autolabResults` -- set after analysis, used by Sidebar chat
- `plotImages` -- captured from Plotly after rendering

The `setAutolabResults` call in current `handleRun` builds:
```typescript
{
  fit: { model_name, parameter_names, parameters, uncertainties, reduced_chi_squared, p_value, r_squared },
  formula: ...,
  nsigma: ...,
  instructions: ...,
  filename: ...,
}
```

New flow builds the same shape from direct results. No context API changes needed.

## Common Pitfalls

### Pitfall 1: Formula Variable Name Mismatch
**What goes wrong:** Formula expression uses parameter name "A" but fit returned "a" (case matters in SymPy).
**How to avoid:** Show fit parameter names next to the formula input. Auto-suggest parameter names.
**Warning signs:** Formula evaluation returns "undefined symbol" error.

### Pitfall 2: NaN Filtering Mismatch
**What goes wrong:** `x_data` and `y_data` have different lengths after filtering NaN values.
**How to avoid:** Filter rows as pairs (if either x or y is NaN, skip the entire row). Workflow.tsx already does this wrong (filters independently). Fix this.
**Warning signs:** Backend returns "x_data and y_data must have the same length".

### Pitfall 3: Empty Error Column Data
**What goes wrong:** User selects a Y-error column that has non-numeric values or all zeros.
**How to avoid:** Backend already handles zero errors (replaces with 10% of min nonzero). But non-numeric data will cause `NaN` in the array. Filter NaN from error arrays too, in sync with data filtering.

### Pitfall 4: Report normalizeAnalysisData Shape Mismatch
**What goes wrong:** The normalize function expects `state.fit.parameter_names` (snake_case from orchestrator). Direct API result has the same key names, but wrapping may differ.
**How to avoid:** Build the `analysisState` object in the same shape the orchestrator returned:
```typescript
const analysisState = {
  fit: fitResult,  // already has parameter_names, parameters, etc.
  formula: formulaResult ? { expression: formulaExpr, ...formulaResult } : undefined,
  nsigma: nsigmaResult ? { ...nsigmaResult, theoretical_value: theoVal, theoretical_uncertainty: theoUnc } : undefined,
};
```

### Pitfall 5: Sheet Selector Shown for CSV
**What goes wrong:** Sheet selector appears for CSV files (which have no sheets).
**How to avoid:** Only show sheet selector when `sheetNames.length > 1`. Current code already does this correctly.

## Architecture Patterns

### Recommended Form Layout Structure
```
AutoLab.tsx (refactored)
|
|-- Upload Section
|   |-- File drop zone (reuse existing)
|   |-- Sheet selector (if multi-sheet Excel)
|   |-- DataPreview (reuse existing)
|
|-- Column Assignment Section (NEW)
|   |-- X column dropdown
|   |-- Y column dropdown
|   |-- X error dropdown (optional, default "None")
|   |-- Y error dropdown (optional, default "None")
|   |-- X label text input
|   |-- Y label text input
|
|-- Model Section (ADAPT from existing)
|   |-- Model dropdown (remove "Auto" option)
|   |-- Custom expression input (when model="custom")
|   |-- Fixed params UI (optional, Claude's discretion)
|
|-- Formula Section (NEW, optional)
|   |-- Formula expression input
|   |-- Helper text: "Use parameter names from fit (a, b, c...)"
|
|-- Theoretical Value Section (reuse existing)
|   |-- Value input
|   |-- Uncertainty input
|
|-- Run Analysis button
|
|-- Results Section (ADAPT)
|   |-- Summary box
|   |-- Parameter table
|   |-- Formula result (if applicable)
|   |-- N-sigma result (if applicable)
|   |-- Fit plot + Residuals plot
|
|-- Report Section (KEEP)
|   |-- ReportExpander > ReportSection
```

### Anti-Patterns to Avoid
- **Step-by-step unlock:** D-06 says all inputs shown upfront, not progressively unlocked like Workflow.tsx
- **Calling /api/autolab/run:** The orchestrator endpoint must NOT be called in the new flow
- **Removing ReportExpander/ReportSection:** These are kept intact per D-07

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column auto-detection | Complex NLP column matcher | Simple regex on error/uncertainty keywords | Covers 95% of physics lab data formats |
| Uncertainty propagation | Manual partial derivatives | `/api/formula/evaluate` endpoint | Already implements SymPy-based propagation |
| N-sigma calculation | Manual sqrt(u1^2 + u2^2) | `/api/nsigma/calculate` endpoint | Handles edge cases (zero uncertainty) |
| Summary generation | Template-based summary | `/api/autolab/chat` with context | AI writes better summaries than templates |
| Plot image capture | Canvas screenshot | Existing `Plotly.toImage()` pattern | Already implemented in current AutoLab |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reuse `/api/autolab/chat` for summary (no new endpoint) | API Contracts | LOW -- worst case, add a thin wrapper endpoint |
| A2 | When theoretical value given without formula, require formula expression | N-Sigma Value Source | MEDIUM -- user might want to compare a raw fit parameter |
| A3 | Smart auto-detect defaults X-error to "None" unless detected | Column Auto-Detection | LOW -- user can always change it |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vite + manual browser testing |
| Config file | `frontend/vite.config.ts` |
| Quick run command | `cd frontend && npm run build` (type-check) |
| Full suite command | `cd frontend && npm run build && cd ../backend && python -m pytest` (if tests exist) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| D-01 | Free-text box removed | manual | Visual inspection |
| D-02 | Direct API calls (no orchestrator) | manual | Network tab inspection |
| D-03 | Column dropdowns with all columns | manual | Load multi-column file, verify all appear |
| D-05 | No "Auto" in model dropdown | manual | Visual inspection |
| D-06 | All inputs shown upfront | manual | Visual inspection |
| D-07 | Report section post-analysis | manual | Run analysis, verify report section appears below |
| D-08 | Example datasets pre-fill form | manual | Click example, verify dropdowns populated |

### Wave 0 Gaps
- [ ] TypeScript build must pass: `cd frontend && npx tsc -b` -- verifies no type errors
- [ ] Backend endpoints already tested via existing usage -- no new backend tests needed

## Open Questions

1. **Formula expression for N-sigma without explicit formula**
   - What we know: Free Fall example derives `g = 2*a`. User provides `theoVal=9.81`.
   - What's unclear: Should we allow comparing a raw fit parameter to theoretical without a formula?
   - Recommendation: Require formula when theoretical value is given. Show hint like "e.g., 2*a to extract g from quadratic fit".

2. **Fixed parameters UI**
   - What we know: Current AutoLab has fixed-params inputs per model parameter. Workflow.tsx does not.
   - What's unclear: Whether to keep this UI in the structured form.
   - Recommendation: Keep it -- it's already built, costs nothing, and is useful. But it's Claude's discretion per CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- `backend/api/fitting.py` -- exact request/response shapes for parse and fit endpoints
- `backend/api/formula.py` -- exact request/response shapes for formula evaluation
- `backend/api/nsigma.py` -- exact request/response shapes for n-sigma calculation
- `backend/api/autolab.py` -- chat endpoint contract, orchestrator pattern (reference only)
- `frontend/src/services/api.ts` -- all TypeScript API wrapper signatures
- `frontend/src/components/AutoLab.tsx` -- current component state, file handling, results rendering
- `frontend/src/components/Workflow.tsx` -- column picker, model selector, fit calling patterns
- `frontend/src/context/AnalysisContext.tsx` -- shared state shape
- `frontend/src/components/report/ReportExpander.tsx` -- report toggle pattern
- `frontend/src/utils/normalize.ts` -- analysis data normalization for report pipeline

## Metadata

**Confidence breakdown:**
- API contracts: HIGH -- read directly from source code
- Architecture/refactor plan: HIGH -- all patterns exist in codebase already
- Pitfalls: HIGH -- identified from actual code reading
- Auto-detection heuristic: MEDIUM -- reasonable but untested against real data

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- internal refactor, no external dependencies)
