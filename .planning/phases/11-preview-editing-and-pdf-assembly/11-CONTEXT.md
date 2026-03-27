# Phase 11: Preview, Editing, and PDF Assembly - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

User can preview each AI-generated report section in-app with rendered LaTeX, edit any section in a textarea with live KaTeX preview, fill in title page information, and export the complete report as a publication-quality A4 PDF with Hebrew RTL support, embedded plots, and academic formatting. Multiple PDF templates are available.

</domain>

<decisions>
## Implementation Decisions

### Section Editor UX
- **D-01:** Accordion-based section layout. Each section (Theory, Method, Discussion, Conclusions, Results) is a collapsible card. Click to expand shows rendered KaTeX preview + Edit button.
- **D-02:** Editing replaces preview with side-by-side layout: textarea on left, live KaTeX-rendered preview on right. Real-time update as user types.
- **D-03:** "AI Generated -- Please Review" badge appears on each AI-generated section. Badge clears as soon as the user modifies the text in that section. Simple signal that user has reviewed.

### PDF Layout & Styling
- **D-04:** Default template is Israeli university lab report style: title page with university-style header, numbered sections in Hebrew (1. תאוריה, 2. שיטת מדידה...), A4, 2.5cm margins, Noto Sans Hebrew body, equations inline.
- **D-05:** Three PDF templates available: Israeli lab report (default), Minimal clean, LaTeX-inspired academic. User selects via dropdown on the report page near the Export button.
- **D-06:** Page breaks handled automatically by WeasyPrint with smart breaking. No forced page breaks per section -- short sections can share pages.

### Plot Embedding
- **D-07:** Plots exported from frontend using Plotly.toImage() as PNG/SVG. Base64 images sent to backend for PDF embedding. Plots look exactly like what the user sees in AutoLab.
- **D-08:** Plot thumbnails shown inline in the report editor (in the Results section accordion). Numbered figure captions displayed. User sees exactly what goes into the PDF before exporting.

### Title Page Form
- **D-09:** Claude's Discretion on title page form design. Standard fields: name, student ID, lab partner, course name, experiment title, date. Hebrew labels by default, follows language toggle.

### Claude's Discretion
- Title page form field layout and placement on report page
- PDF header/footer content and styling
- Font sizes and spacing within PDF templates
- Parameter table formatting in PDF (reuse existing roundWithUncertainty conventions)
- Figure caption numbering format
- How to handle missing plots or partial analyses gracefully
- Template-specific CSS organization (one file per template vs conditional blocks)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements
- `.planning/REQUIREMENTS.md` -- UI-01, UI-02, UI-03 requirement definitions
- `.planning/ROADMAP.md` -- Phase 11 success criteria (5 criteria)

### Phase 8 foundation (PDF rendering)
- `.planning/phases/08-pdf-infrastructure-spike/08-CONTEXT.md` -- Decisions on equation rendering, Hebrew RTL + English math standard (D-06), spike code reusability (D-01)
- `backend/utils/pdf_renderer.py` -- Existing WeasyPrint rendering pipeline
- `backend/templates/report_base.html` -- Existing HTML template for PDF
- `backend/templates/report_styles.css` -- Existing CSS for PDF styling

### Phase 9 foundation (data contract)
- `.planning/phases/09-report-data-contract-and-file-parsing/09-CONTEXT.md` -- ReportAnalysisData contract shape, report page evolution decisions
- `frontend/src/types/report.ts` -- TypeScript interface for report analysis data

### Phase 10 foundation (AI generation)
- `.planning/phases/10-ai-content-generation-pipeline/10-CONTEXT.md` -- AI generation decisions, language toggle, section JSON structure
- `frontend/src/components/ReportBeta.tsx` -- Current report page with context form, generation flow
- `backend/api/report.py` -- Report blueprint with generate and analyze-context endpoints
- `frontend/src/services/api.ts` -- API functions for report generation

### Existing utilities
- `frontend/src/utils/format.ts` -- roundWithUncertainty() for parameter formatting
- `frontend/src/utils/latex.ts` -- KaTeX rendering helpers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/utils/pdf_renderer.py` -- WeasyPrint pipeline with KaTeX CSS rendering, Hebrew font bundling. Foundation for PDF generation.
- `backend/templates/report_base.html` + `report_styles.css` -- HTML/CSS template from Phase 8 spike. Needs extension for full report layout but structure is reusable.
- `frontend/src/utils/format.ts` -- `roundWithUncertainty()` for parameter table formatting in both preview and PDF.
- `frontend/src/utils/latex.ts` -- KaTeX rendering helper for live preview in editor.
- `frontend/src/context/AnalysisContext.tsx` -- `autolabResults` carries fit data and plot state from AutoLab.

### Established Patterns
- Single-page scroll layout for ReportBeta.tsx (Phase 9/10 convention)
- Flask blueprint at `/api/report/*` for all report endpoints
- CSS custom properties for theming (Phase 2 token system)
- Plotly.js for all interactive charts (used across AutoLab, GraphFitting)

### Integration Points
- ReportBeta.tsx receives `autolabResults` via AnalysisContext -- source for plot data and fit parameters
- `backend/api/report.py` needs new `/export-pdf` endpoint that calls `pdf_renderer`
- Plotly.toImage() available in frontend for plot capture
- Jinja2 (or string templates per Phase 8 D-01) for PDF HTML assembly

</code_context>

<specifics>
## Specific Ideas

- User wants the PDF to look like what Israeli physics students actually submit -- numbered Hebrew sections, standard academic margins, not overly formal
- Multiple templates give flexibility without overcomplicating the default flow
- Plot previews in editor are important -- user wants to verify what goes into the PDF

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 11-preview-editing-and-pdf-assembly*
*Context gathered: 2026-03-27*
