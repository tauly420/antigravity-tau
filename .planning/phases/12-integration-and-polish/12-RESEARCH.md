# Phase 12: Integration and Polish - Research

**Researched:** 2026-03-28
**Domain:** React SPA integration (AutoLab -> Report page bridging, standalone analysis mode, edge case handling)
**Confidence:** HIGH

## Summary

Phase 12 bridges the AutoLab analysis page and the Report page into a seamless end-to-end workflow. The codebase is already well-prepared: `AnalysisContext` carries `autolabResults` and `plotImages` between pages, `normalizeAnalysisData()` transforms raw results into the report contract, and all report API functions exist in `api.ts`. The Report page (`ReportBeta.tsx`, 1252 lines) already has an embedded analysis section with file upload, instructions, theoretical value inputs, and calls to `/api/autolab/run`.

The primary work is: (1) adding a "Generate Report" button to `AutoLab.tsx` after the inline AI chat panel that navigates to `/report`, (2) improving the Report page's standalone analysis UX to match the UI spec, (3) pre-filling context form fields when arriving from AutoLab, (4) handling partial analyses with warning banners, (5) implementing silent retry for AI generation failures, and (6) removing the BETA badge from the nav.

**Primary recommendation:** This is a UI integration phase with no new libraries or backend changes. All required APIs and data contracts already exist. Focus on React state management through `AnalysisContext` and `useNavigate` for the AutoLab-to-Report bridge, and on conditional rendering for the two entry modes (from AutoLab vs standalone).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** A "Generate Report" button appears at the bottom of AutoLab results after a successful analysis. Clicking navigates to /report with all analysis data pre-loaded via AnalysisContext.
- **D-02:** When arriving from AutoLab, context form fields are pre-filled with whatever AutoLab can provide (experiment title, data context). Remaining fields (partner name, student ID, course) are left for the user to fill. User lands ready to hit "Generate Report" but can add more context.
- **D-03:** When accessed directly (not from AutoLab), the report page includes all AutoLab features -- file upload, instructions input, run analysis -- so users can perform the full analysis through the report page without visiting AutoLab separately.
- **D-04:** This is a separate implementation calling the same backend APIs, NOT an import of AutoLab.tsx. Report page has its own analysis UI tailored to the report flow. This gives full control over UX and avoids coupling.
- **D-05:** AutoLab remains fully self-sufficient as its own page. The report page integrates AutoLab's capabilities, not the other way around.
- **D-06:** Core analysis data flows into the report: fit parameters + uncertainties, chi-squared/R-squared/P-value goodness-of-fit stats, n-sigma comparison, fit plot, residuals plot, and parsed data. AutoLab's AI summary and formula evaluation are NOT piped into the report -- the AI generates its own discussion and interpretation.
- **D-07:** Partial analysis (e.g., fit succeeds but n-sigma fails): report generates using whatever data is available. Missing sections noted with a subtle warning ("N-sigma comparison not available -- skipped in report"). User can still export.
- **D-08:** AI generation failure: auto-retry once silently. If still fails, show a clear error message with what went wrong. User can try again or go back. No manual fallback.
- **D-09:** Remove BETA badge from the report page nav item (deferred from Phase 9 D-13).

### Claude's Discretion
- Button placement and styling within AutoLab results
- Report page analysis section layout and flow
- Pre-fill mapping logic (which AutoLab fields map to which context form fields)
- Warning message styling for partial analyses

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-04 | User can trigger report generation directly from completed AutoLab results with one click | AnalysisContext already carries `autolabResults` and `plotImages`; `useNavigate('/report')` from react-router-dom handles navigation; button placement defined in UI-SPEC (after AI chat panel) |
</phase_requirements>

## Standard Stack

No new libraries needed. All work uses existing project dependencies.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.0 | UI rendering | Project standard |
| react-router-dom | ^7.6.0 | `useNavigate` for AutoLab -> Report navigation | Already used for all routing |
| axios | ^1.7.0 | API calls (via `api.ts`) | Project standard for HTTP |
| plotly.js-dist-min | ^3.4.0 | Fit/residuals plot rendering | Already used in both AutoLab and Report |

### Alternatives Considered
None -- no new dependencies needed for this phase.

## Architecture Patterns

### Recommended Approach

This phase modifies two existing files and one nav config. No new files needed.

```
frontend/src/
  components/
    AutoLab.tsx          # ADD "Generate Report" button at bottom of results
    ReportBeta.tsx       # IMPROVE standalone analysis, add pre-fill logic, add warnings
  context/
    AnalysisContext.tsx   # NO CHANGES (already has autolabResults, plotImages)
  services/
    api.ts               # NO CHANGES (all APIs exist)
  App.tsx                # REMOVE BETA badge from NAV_ITEMS
```

### Pattern 1: Context-Based Page-to-Page Data Transfer

**What:** AutoLab stores results in `AnalysisContext`, navigates to `/report`, Report page reads from context.
**When to use:** When two sibling routes need to share ephemeral analysis data.
**Example:**
```typescript
// In AutoLab.tsx -- button click handler
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
const { autolabResults, plotImages } = useAnalysis();

const handleGenerateReport = () => {
    // autolabResults already stored during analysis run (line ~314)
    // plotImages already captured via Plotly.toImage
    navigate('/report');
};
```

**Key insight:** `setAutolabResults()` is already called at line ~314 of AutoLab.tsx when analysis completes. No additional data storage is needed -- the button just navigates.

### Pattern 2: Conditional Rendering Based on Context State

**What:** Report page detects whether it has analysis data (from AutoLab or standalone run) and shows different UI accordingly.
**When to use:** When a page has two entry modes.
**Example:**
```typescript
// In ReportBeta.tsx
const { autolabResults } = useAnalysis();
const hasAnalysisData = !!autolabResults;

// Show standalone analysis section only when no data is loaded
{!hasAnalysisData && (
    <div>/* Standalone analysis section */</div>
)}

// Show "Analysis loaded" confirmation when data exists
{hasAnalysisData && (
    <div>/* Green confirmation + warning banners for partial data */</div>
)}
```

### Pattern 3: Silent Retry for AI Failures

**What:** Wrap AI generation call in a retry loop (max 1 retry) before showing error to user.
**When to use:** For expensive AI calls that occasionally fail due to transient issues.
**Example:**
```typescript
const doGenerateWithRetry = async (answersList) => {
    setGenerationPhase('generating');
    setGenerationError(null);
    try {
        const result = await generateReport(payload);
        if (result.error) throw new Error(result.error);
        setGeneratedSections(result.sections);
        setGenerationPhase('complete');
    } catch (firstErr) {
        // Silent retry once
        try {
            const result = await generateReport(payload);
            if (result.error) throw new Error(result.error);
            setGeneratedSections(result.sections);
            setGenerationPhase('complete');
        } catch (retryErr) {
            setGenerationError(retryErr instanceof Error ? retryErr.message : 'Report generation failed. Please try again.');
            setGenerationPhase('error');
        }
    }
};
```

### Pattern 4: Pre-fill Mapping from AutoLab Data

**What:** Extract experiment context from AutoLab results to pre-populate the context form.
**When to use:** When navigating from AutoLab to Report.
**Example:**
```typescript
// In ReportBeta.tsx useEffect, when autolabResults changes
useEffect(() => {
    if (autolabResults && !contextFormTouched) {
        const instructions = (autolabResults as any).instructions || '';
        const filename = (autolabResults as any).filename || '';
        // Derive title from filename (strip extension)
        const title = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
        setContextForm(prev => ({
            ...prev,
            title: prev.title || title,
            notes: prev.notes || instructions,
        }));
    }
}, [autolabResults]);
```

**Key insight:** AutoLab already stores `instructions` and `filename` in `autolabResults` (see AutoLab.tsx line ~327). These are the best sources for pre-filling experiment title and notes.

### Anti-Patterns to Avoid
- **Importing AutoLab.tsx into ReportBeta.tsx:** D-04 explicitly forbids this. The report page has its own analysis UI.
- **Using localStorage/sessionStorage for data transfer:** The project is stateless by design. AnalysisContext is the correct mechanism.
- **Blocking on partial analysis:** D-07 says partial data is fine -- never prevent the user from proceeding.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page navigation | Custom routing logic | `useNavigate('/report')` from react-router-dom | Standard React Router pattern |
| Cross-page state | URL params or localStorage | `AnalysisContext` (already exists) | Project convention, already carries autolabResults |
| Data normalization | New transform function | `normalizeAnalysisData()` already in ReportBeta.tsx | Already handles snake_case -> camelCase conversion |
| Plot image capture | Manual canvas manipulation | `Plotly.toImage()` (already implemented) | Already working in both AutoLab and Report |

**Key insight:** Almost everything needed for this phase already exists in the codebase. The work is wiring, not building.

## Common Pitfalls

### Pitfall 1: AutoLab Results Shape Mismatch
**What goes wrong:** AutoLab stores results with `state.fit` structure, but Report expects normalized camelCase via `normalizeAnalysisData()`.
**Why it happens:** AutoLab's `setAutolabResults()` at line ~314 stores a subset of `data.state` with snake_case keys. The Report page's `normalizeAnalysisData()` expects to find keys at `raw.state.fit` OR `raw.fit`.
**How to avoid:** Verify that the shape stored by AutoLab matches what `normalizeAnalysisData()` can handle. Currently AutoLab stores `{ fit: {...}, formula, nsigma, instructions, filename }` (no `state` wrapper), while the Report page's normalizer checks `raw.state ?? raw` -- so it handles both shapes.
**Warning signs:** Report page shows "no analysis data" despite AutoLab having run.

### Pitfall 2: Plot Images Not Captured Before Navigation
**What goes wrong:** User clicks "Generate Report" immediately after analysis, but `Plotly.toImage()` hasn't completed yet -- `plotImages` is `{ fit: null, residuals: null }`.
**Why it happens:** Plot capture is async and triggered by useEffect after `autolabResults` state update. If the user clicks the button very fast, the capture may not have completed.
**How to avoid:** Either (a) check `plotImages.fit` before enabling the button, or (b) the Report page already has its own plot capture logic (lines 159-177) that will capture from its own rendered plots as a fallback.
**Warning signs:** PDF export has missing plots.

### Pitfall 3: Context Form Overwrite on Re-navigation
**What goes wrong:** User fills context form on Report page, goes back to AutoLab, re-runs analysis, navigates again -- their form entries are lost.
**Why it happens:** Pre-fill logic overwrites form state on every `autolabResults` change.
**How to avoid:** Track whether the user has manually edited the form (a `contextFormTouched` flag) and skip pre-fill if true.
**Warning signs:** User complaints about lost form data.

### Pitfall 4: BETA Badge in Nav Sidebar (Collapsed State)
**What goes wrong:** Removing the badge from the data but forgetting the collapsed nav tooltip.
**Why it happens:** The nav sidebar renders badges only when not collapsed (line 61 of App.tsx: `{!collapsed && ...}`). The badge is already hidden in collapsed mode, so removal is just deleting `badge: 'BETA'` from the NAV_ITEMS entry.
**How to avoid:** Single change at line 38 of App.tsx.
**Warning signs:** Badge still appearing somewhere.

### Pitfall 5: Embedded Analysis Section Visibility Logic
**What goes wrong:** Report page shows both the standalone analysis section AND the "analysis loaded" confirmation when coming from AutoLab.
**Why it happens:** The current ReportBeta.tsx always shows the embedded analysis section (line 478+). It needs conditional logic based on whether `autolabResults` is already populated.
**How to avoid:** Gate the standalone analysis section with `!autolabResults` check. Show a compact "Analysis loaded" confirmation when data exists from AutoLab.
**Warning signs:** Confusing UI with duplicate analysis options.

## Code Examples

### Adding "Generate Report" Button to AutoLab.tsx

The button goes after the inline AI chat panel (after line ~1173), before the closing `</div>` of the results section.

```typescript
// Source: AutoLab.tsx, inside the {hasResults && (...)} block, after the chat panel
// Needs: import { useNavigate } from 'react-router-dom'; at top of file

const navigate = useNavigate(); // Add near other hooks

// After the AI chat panel closing </div> (around line 1173):
<button
    onClick={() => navigate('/report')}
    style={{
        width: '100%',
        marginTop: '24px',
        background: 'linear-gradient(135deg, var(--primary, #1565c0) 0%, #1976d2 100%)',
        color: 'white',
        fontSize: '1rem',
        fontWeight: 600,
        padding: '16px 32px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(21, 101, 192, 0.3)',
    }}
>
    Generate Report
</button>
```

### Detecting Entry Mode in ReportBeta.tsx

```typescript
// Determine if we arrived with data from AutoLab
const hasPreloadedData = !!autolabResults;

// In the JSX:
{!hasPreloadedData && !analysisState && (
    /* Show standalone analysis section */
)}
{(hasPreloadedData || analysisState) && (
    /* Show "Analysis data loaded" confirmation + any warnings */
)}
```

### Partial Analysis Warning Detection

```typescript
// Check which analysis steps are available
const analysisData = autolabResults || analysisState;
const hasFit = !!(analysisData as any)?.fit || !!(analysisData as any)?.state?.fit;
const hasNsigma = !!(analysisData as any)?.nsigma || !!(analysisData as any)?.state?.nsigma;
const hasFormula = !!(analysisData as any)?.formula || !!(analysisData as any)?.state?.formula;

const warnings: string[] = [];
if (!hasFit) warnings.push('Fit analysis incomplete -- parameter table and fit plots will not appear in the report.');
if (!hasNsigma) warnings.push('N-sigma comparison not available -- this section will be skipped in the report.');
```

### BETA Badge Removal in App.tsx

```typescript
// Line 38 of App.tsx -- change from:
{ path: '/report', label: 'Report', icon: '📄', highlight: true, badge: 'BETA' },
// To:
{ path: '/report', label: 'Report', icon: '📄', highlight: true },
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Report page was standalone only | Phase 12 adds AutoLab integration | This phase | Users get one-click report from AutoLab |
| Analysis section always visible on report | Conditional: hidden when data pre-loaded | This phase | Cleaner UX for AutoLab users |
| No retry on AI failure | Silent single retry | This phase | Better reliability for generation |

## Open Questions

1. **Pre-fill experiment title derivation**
   - What we know: AutoLab stores `filename` (e.g., "hookes_law.xlsx") and `instructions` text
   - What's unclear: Whether filename-to-title conversion (strip extension, replace underscores) is good enough or if AI should extract a title from instructions
   - Recommendation: Start with simple filename cleaning; iterate if users find it unhelpful

2. **Analysis data persistence across page refreshes**
   - What we know: AnalysisContext is in-memory React state -- lost on refresh
   - What's unclear: Whether users will refresh the report page and lose their data
   - Recommendation: This is a known project constraint (stateless design, no localStorage). Accept it for now -- it matches all other tools' behavior.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend only -- no frontend test framework configured) |
| Config file | `backend/tests/conftest.py` |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-04 | Generate Report button navigates to /report with data | manual | Manual browser test: run AutoLab analysis, click Generate Report, verify report page loads with data | N/A (no frontend test framework) |
| UI-04 | End-to-end: AutoLab -> Report -> generate -> PDF | manual | Manual browser test: full workflow with example dataset | N/A |
| D-07 | Partial analysis shows warning banners | manual | Manual: run analysis that produces only fit (no n-sigma), check warnings | N/A |
| D-08 | AI generation retry on failure | manual | Manual: temporarily break API, verify retry behavior | N/A |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q` (verify no backend regressions)
- **Per wave merge:** Full pytest suite + manual browser test of both flows
- **Phase gate:** Full E2E manual test of both flows (AutoLab->Report and standalone)

### Wave 0 Gaps
- No frontend test infrastructure exists (no vitest, no jest, no @testing-library). This is a project-wide gap, not specific to this phase.
- All UI-04 validation is manual browser testing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | Yes | v25.8.1 | -- |
| npm | Package management | Yes | 11.11.0 | -- |
| Python 3 | Backend tests | Yes | 3.14.3 | -- |

No missing dependencies. This phase is purely frontend code changes with no new external dependencies.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `AutoLab.tsx` (1184 lines), `ReportBeta.tsx` (1252 lines), `AnalysisContext.tsx` (54 lines), `App.tsx` (129 lines), `api.ts` (310 lines)
- `12-CONTEXT.md` -- locked decisions from user discussion
- `12-UI-SPEC.md` -- visual and interaction contracts

### Secondary (MEDIUM confidence)
- react-router-dom `useNavigate` API -- stable, well-documented pattern used throughout project

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing dependencies
- Architecture: HIGH -- patterns directly observed in codebase, straightforward wiring
- Pitfalls: HIGH -- identified from actual code analysis of data shapes and timing issues

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- no external library changes expected)
