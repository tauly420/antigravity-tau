# Phase 14: Report and AutoLab Merge - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Merge the separate AutoLab and Report pages into a single unified progressive flow at `/autolab`. Users upload data, run analysis, and see results. From there, they can either stop (analysis-only) or expand into full lab report generation — context form, AI section generation, section editing, title page, and PDF export. The `/report` route is removed entirely. PDF export (WeasyPrint) 500 error on Railway must be debugged and fixed, plus PDF output quality improved.

</domain>

<decisions>
## Implementation Decisions

### Unified Page Structure
- **D-01:** Single progressive flow at `/autolab`. Upload → Analysis Results → [optional] Generate Full Report section. Everything on one scrolling page.
- **D-02:** `/report` route removed entirely. `ReportBeta.tsx` deleted. All report functionality merged into the AutoLab page.
- **D-03:** After analysis completes, a prominent "Generate Full Lab Report" expand button appears below results. Clicking it reveals the report generation section (context form, AI generation, section editor, title page form, PDF export).

### Analysis-to-Report Transition
- **D-04:** Context form fields pre-filled from analysis where available (experiment title from filename/instructions, analysis data auto-loaded). User just adds personal info (name, ID, partner, course) and hits generate.
- **D-05:** Optional lab instruction file upload (PDF/DOCX) available in the report section — AI uses extracted text as additional context for generating theory/method sections. Already built in Phase 9.
- **D-06:** Analysis results data (fit parameters, uncertainties, chi²/R²/P-value, n-sigma, plots) automatically flows into report generation — no re-entry needed.

### PDF Export
- **D-07:** Fix the WeasyPrint 500 error on Railway deployment. Debug the actual error, fix whatever's broken (likely system dependency, font path, or template issue).
- **D-08:** Improve PDF output quality — better formatting, layout, font rendering. Not just "make it work" but "make it good."
- **D-09:** Two PDF export tiers: (1) Results-only PDF — just analysis results + plots, no AI-generated sections, for users who don't want a full report. (2) Full lab report PDF — complete academic report with AI sections, title page, etc.
- **D-10:** Remove jsPDF client-side export entirely. All PDF generation goes through WeasyPrint backend.

### Features: What Stays, What Goes
- **D-11:** AutoLab's inline AI chat (post-analysis assistant) removed from this page. Will move to sidebar/global chat in Phase 13's UI overhaul.
- **D-12:** Keep only the Free Fall example dataset (remove Hooke's Law and Oscillation). Extend the Free Fall example to demo the full flow including report generation with pre-filled context form details and lab instructions.
- **D-13:** All existing report features survive in the merged page: section accordion editor with KaTeX preview, title page form, template selector (israeli/minimal/academic), language toggle (Hebrew/English), AI follow-up questions.

### Claude's Discretion
- Layout and visual design of the expand/collapse transition between analysis and report sections
- How the two PDF export options (results-only vs full report) are presented (buttons, dropdown, etc.)
- Pre-fill mapping logic (which analysis fields map to which context form fields)
- How to structure the merged component code (single large component vs sub-components)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AutoLab (primary page being extended)
- `frontend/src/components/AutoLab.tsx` — Current AutoLab page (~1210 lines), will absorb report functionality
- `backend/api/autolab.py` — Backend orchestrator, POST /api/autolab/run
- `frontend/src/services/api.ts` — All API calls including autolab and report endpoints

### Report (being merged into AutoLab then deleted)
- `frontend/src/components/ReportBeta.tsx` — Current report page (~1340 lines), features to extract before deletion
- `frontend/src/components/report/SectionAccordion.tsx` — Section editor component (keep)
- `frontend/src/components/report/TitlePageForm.tsx` — Title page form component (keep)
- `frontend/src/components/report/PlotThumbnail.tsx` — Plot display component (keep)

### PDF Pipeline (needs debugging)
- `backend/api/report.py` — Report API endpoints including /export-pdf (500 error here)
- `backend/utils/pdf_renderer.py` — WeasyPrint pipeline: assemble_report_html(), process_text_with_math(), generate_pdf()
- `backend/templates/report_base.html` — HTML template for PDF
- `backend/templates/report_styles.css` — CSS for PDF styling
- `nixpacks.toml` — Railway deployment config with system packages (pango, cairo, etc.)

### Shared State
- `frontend/src/context/AnalysisContext.tsx` — Global state for autolabResults and plotImages
- `frontend/src/App.tsx` — Route definitions (needs /report removal)

### Prior Phase Context
- `.planning/phases/08-pdf-infrastructure-spike/08-CONTEXT.md` — PDF rendering decisions
- `.planning/phases/11-preview-editing-and-pdf-assembly/11-CONTEXT.md` — Section editor, PDF template decisions
- `.planning/phases/12-integration-and-polish/12-CONTEXT.md` — Integration decisions (being superseded by this merge)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SectionAccordion`, `TitlePageForm`, `PlotThumbnail` components — built in Phase 11, can be imported directly into the merged AutoLab page
- `normalizeAnalysisData()` in api.ts — transforms AutoLab results into report contract shape
- `generateReport()`, `exportReportPdf()`, `analyzeReportContext()`, `uploadInstructionFile()` API functions — already exist in api.ts
- `roundWithUncertainty()` in format.ts — parameter formatting
- `process_text_with_math()` and `assemble_report_html()` in pdf_renderer.py — full PDF assembly pipeline

### Established Patterns
- React state via useState + useContext (no external state library)
- Flask blueprints at /api/{module}/* for all endpoints
- Plotly.toImage() for plot capture as base64 PNG
- Accordion-based collapsible sections in report editor

### Integration Points
- AutoLab.tsx needs report section added below existing results
- Report sub-components (SectionAccordion, TitlePageForm, PlotThumbnail) imported as-is
- `/api/report/*` endpoints stay — only the frontend route changes
- App.tsx route table needs /report removed

</code_context>

<specifics>
## Specific Ideas

- User wants a progressive flow: analysis is the primary feature, full report is an optional continuation
- Results-only PDF export gives quick value to users who just want plots + parameters without writing a full report
- Free Fall example should be a complete end-to-end demo showcasing the full product capability
- The inline AI chat moves out (Phase 13) — keep the page focused on analysis + report

</specifics>

<deferred>
## Deferred Ideas

- Inline AI chat → moves to sidebar/global chat in Phase 13 UI overhaul
- Additional example datasets beyond Free Fall — can be added later if needed

</deferred>

---

*Phase: 14-report-and-autolab-merge*
*Context gathered: 2026-03-29*
