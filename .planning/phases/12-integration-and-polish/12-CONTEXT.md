# Phase 12: Integration and Polish - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can generate a report directly from completed AutoLab results in one click via a button in AutoLab results. The report page also works standalone with its own full AutoLab-equivalent analysis capabilities — users can upload data, run analysis, and generate a report all from the /report page without visiting AutoLab first. This phase bridges AutoLab and the report builder, removes the BETA badge, and handles edge cases for production readiness.

</domain>

<decisions>
## Implementation Decisions

### AutoLab → Report Navigation
- **D-01:** A "Generate Report" button appears at the bottom of AutoLab results after a successful analysis. Clicking navigates to /report with all analysis data pre-loaded via AnalysisContext.
- **D-02:** When arriving from AutoLab, context form fields are pre-filled with whatever AutoLab can provide (experiment title, data context). Remaining fields (partner name, student ID, course) are left for the user to fill. User lands ready to hit "Generate Report" but can add more context.

### Report Page Standalone Mode
- **D-03:** When accessed directly (not from AutoLab), the report page includes all AutoLab features — file upload, instructions input, run analysis — so users can perform the full analysis through the report page without visiting AutoLab separately.
- **D-04:** This is a separate implementation calling the same backend APIs, NOT an import of AutoLab.tsx. Report page has its own analysis UI tailored to the report flow. This gives full control over UX and avoids coupling.
- **D-05:** AutoLab remains fully self-sufficient as its own page. The report page integrates AutoLab's capabilities, not the other way around.

### Data Integration Scope
- **D-06:** Core analysis data flows into the report: fit parameters + uncertainties, chi²/R²/P-value goodness-of-fit stats, n-sigma comparison, fit plot, residuals plot, and parsed data. AutoLab's AI summary and formula evaluation are NOT piped into the report — the AI generates its own discussion and interpretation.

### Edge Case Handling
- **D-07:** Partial analysis (e.g., fit succeeds but n-sigma fails): report generates using whatever data is available. Missing sections noted with a subtle warning ("N-sigma comparison not available — skipped in report"). User can still export.
- **D-08:** AI generation failure: auto-retry once silently. If still fails, show a clear error message with what went wrong. User can try again or go back. No manual fallback.

### UI Polish
- **D-09:** Remove BETA badge from the report page nav item (deferred from Phase 9 D-13).

### Claude's Discretion
- Button placement and styling within AutoLab results
- Report page analysis section layout and flow
- Pre-fill mapping logic (which AutoLab fields map to which context form fields)
- Warning message styling for partial analyses

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AutoLab (source of analysis data)
- `frontend/src/components/AutoLab.tsx` — Full AutoLab UI, results display, API calls
- `frontend/src/context/AnalysisContext.tsx` — Shared state: `autolabResults`, `plotImages`
- `backend/api/autolab.py` — Backend orchestrator, tool functions, POST /api/autolab/run
- `frontend/src/services/api.ts` — All API call definitions including autolab and report endpoints

### Report Page (target for integration)
- `frontend/src/components/ReportBeta.tsx` — Current report page, uses `autolabResults` from context
- `frontend/src/components/report/SectionAccordion.tsx` — Section editor component
- `frontend/src/components/report/TitlePageForm.tsx` — Title page form component
- `frontend/src/components/report/PlotThumbnail.tsx` — Plot display in report editor
- `backend/api/report.py` — Report backend endpoints (generate, export-pdf, upload-instructions, analyze-context)

### Data Contract
- `frontend/src/services/api.ts` — `ReportAnalysisData` interface and `normalizeAnalysisData` function
- `frontend/src/utils/format.ts` — `roundWithUncertainty()` for parameter display

### Navigation
- `frontend/src/App.tsx` — Route definitions and nav bar (BETA badge location)

### Prior Phase Context
- `.planning/phases/09-report-data-contract-and-file-parsing/09-CONTEXT.md` — Data contract decisions
- `.planning/phases/10-ai-content-generation-pipeline/10-CONTEXT.md` — AI generation decisions
- `.planning/phases/11-preview-editing-and-pdf-assembly/11-CONTEXT.md` — Preview/edit/PDF decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnalysisContext` already carries `autolabResults` and `plotImages` — navigation from AutoLab to /report can pass data through this context
- `normalizeAnalysisData()` in api.ts already transforms raw AutoLab results into the report contract shape
- `generateReport()`, `exportReportPdf()`, `analyzeReportContext()` API functions already exist in api.ts
- `SectionAccordion`, `TitlePageForm`, `PlotThumbnail` components already built in Phase 11
- `roundWithUncertainty()` utility for parameter formatting

### Established Patterns
- AutoLab uses `POST /api/autolab/run` with multipart form data (file + instructions JSON)
- Report uses `POST /api/report/generate` with JSON body (analysis data + context + sections config)
- React state management via `useState` + `useContext` (no external state library)
- All API calls go through `frontend/src/services/api.ts`

### Integration Points
- AutoLab results → AnalysisContext → Report page (existing path, needs "Generate Report" button trigger)
- Report page standalone mode needs its own file upload + analysis run UI calling `/api/autolab/run`
- Nav bar in `App.tsx` needs BETA badge removal
- `useNavigate()` from react-router-dom for AutoLab → /report navigation

</code_context>

<specifics>
## Specific Ideas

- User emphasized: report page should integrate ALL of AutoLab's features for standalone use, not be dependent on AutoLab
- User emphasized: AutoLab must also stand on its own — the two pages complement each other
- Current integration described as "very partial and poor" — goal is to bring it to "the highest level"
- The report page's standalone analysis is a SEPARATE implementation, not a component reuse — gives full UI control

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-integration-and-polish*
*Context gathered: 2026-03-28*
