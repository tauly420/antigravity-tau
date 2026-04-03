# Phase 15: AutoLab Fixes and Polish - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the PDF export 500 error on Railway (both results-only and full report exports) and standardize button/input styling across all pages for visual consistency. This is a targeted fix-and-polish phase — the larger AutoLab UI overhaul is Phase 16+.

</domain>

<decisions>
## Implementation Decisions

### PDF Export 500 Fix
- **D-01:** Both PDF export types (results-only and full lab report) return 500 on Railway. Debug and fix the root cause — likely WeasyPrint system dependency, font path, or template issue on the Railway/nixpacks deployment.
- **D-02:** User tests on Railway only (no local testing). Fix must be validated on Railway deployment.
- **D-03:** PDF quality improvements deferred — user cannot evaluate output until the 500 is fixed. Fix the error first, quality comes in a later phase.

### Button/Input Consistency
- **D-04:** Buttons and input boxes have inconsistent CSS across different pages. Standardize to a single style across the entire site.
- **D-05:** Claude reviews all pages and picks the most polished existing button/input style to standardize on (no new design needed — pick the best of what exists).

### Claude's Discretion
- Which existing button/input style to standardize on (after reviewing all pages)
- Implementation approach for CSS consolidation (shared classes vs CSS custom properties)
- Debugging strategy for the PDF 500 error

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PDF Pipeline (500 error investigation)
- `backend/api/report.py` — Report API endpoints including /export-pdf
- `backend/utils/pdf_renderer.py` — WeasyPrint pipeline: assemble_report_html(), generate_pdf()
- `backend/templates/report_base.html` — HTML template for PDF
- `backend/templates/report_styles.css` — CSS for PDF styling
- `nixpacks.toml` — Railway deployment config with system packages

### Button/Input Styling
- `frontend/src/styles/global.css` — All styles including button and input classes
- `frontend/src/components/AutoLab.tsx` — AutoLab page buttons/inputs
- `frontend/src/components/GraphFitting.tsx` — Graph fitting page buttons/inputs
- `frontend/src/components/Home.tsx` — Homepage buttons/cards
- `frontend/src/components/FormulaCalculator.tsx` — Formula calculator inputs
- `frontend/src/components/ODESolver.tsx` — ODE solver inputs

### Prior Phase Context
- `.planning/phases/14-report-and-autolab-merge-unified-page-for-full-report-or-analysis-only-mode-plus-fix-pdf-export/14-CONTEXT.md` — Phase 14 decisions on PDF and merged flow
- `.planning/phases/08-pdf-infrastructure-spike/08-CONTEXT.md` — Original WeasyPrint setup decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CSS custom property architecture from Phase 2 — dark theme tokens already defined
- `generate_pdf()` in pdf_renderer.py — existing WeasyPrint pipeline
- Multiple button/input patterns across pages — need to audit and pick best one

### Established Patterns
- All styling in single `global.css` (no CSS modules)
- CSS custom properties for theming
- Flask blueprints for API endpoints
- nixpacks.toml for Railway deployment config

### Integration Points
- PDF endpoints called from `frontend/src/services/api.ts` (exportResultsPdf, exportReportPdf)
- Button/input styles used inline and via classes across all component files
- nixpacks.toml may need system package additions for WeasyPrint

</code_context>

<specifics>
## Specific Ideas

- PDF 500 is the primary blocker — user literally cannot see PDF output until this is fixed
- Button/input inconsistency is a visual quality issue across the whole site, not just AutoLab
- User wants to keep the workflow flow as-is — it works well, just needs visual consistency

</specifics>

<deferred>
## Deferred Ideas

### AutoLab UI Overhaul (Phase 16+)
- Rebuild AutoLab input as structured workflow: upload → sheet/column picker with auto-naming → axis labels → fit model selection (add fractional + 2 more models) → parameter constraints (e.g., set b=0 in ax+b) → formula input with AI parsing help → theoretical value comparison → execute all in one shot
- Report generation becomes the next stage after analysis (context form, AI generation, PDF export)
- Goal: AutoLab absorbs all lab workflow functionality in a single progressive flow
- After confirming AutoLab covers everything, remove old standalone pages (GraphFitting, FormulaCalculator, NSigmaCalculator, etc.)

### PDF Quality Polish (Phase 18)
- Formatting, layout, font rendering, Hebrew RTL quality — deferred until user can see output

</deferred>

---

*Phase: 15-autolab-fixes-and-polish*
*Context gathered: 2026-04-03*
