# Phase 9: Report Data Contract and File Parsing - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Normalize AutoLab analysis results into a guaranteed-shape `ReportAnalysisData` contract (TypeScript interface + Python normalization), and build PDF/DOCX lab instruction file upload with text extraction and user confirmation UI on the /report page. This phase delivers the data foundation that Phase 10 (AI generation) and Phase 11 (preview/edit/PDF) build on.

</domain>

<decisions>
## Implementation Decisions

### Instruction File Upload Flow
- **D-01:** Upload lives on the `/report` page as part of the report builder flow. ReportBeta.tsx is the shell.
- **D-02:** Extracted text appears in an editable textarea for user confirmation/editing before it is sent to AI. Handles OCR errors, irrelevant sections, or encoding issues.
- **D-03:** Single file upload only (one PDF or DOCX at a time). User can re-upload to replace.
- **D-04:** Scanned PDFs with no extractable text show a warning message ("No text found -- this may be a scanned/image PDF") and fall back to manual text entry in the textarea. No OCR attempted.
- **D-05:** Upload supports both drag-and-drop dropzone and click-to-browse button. Follow similar style to AutoLab file upload.

### Data Contract Shape
- **D-06:** `ReportAnalysisData` uses optional sections with null for partial analyses. All fields present in the interface, but formula/nsigma/etc. are nullable. Downstream code checks presence and skips missing sections.
- **D-07:** Both frontend (TypeScript interface) and backend (Python normalization function) implement the contract. TypeScript defines the shape for frontend consumption; Python ensures any AutoLab result dict maps to the guaranteed shape before sending to AI.
- **D-08:** Contract includes raw data arrays (x, y, errors) plus fit curve points. Enables Phase 11 to re-render plots as images for PDF embedding without re-running the analysis.

### Results Assembly Format
- **D-09:** Reuse existing `roundWithUncertainty()` from `frontend/src/utils/format.ts` for parameter display. Same 2-sig-fig uncertainty rounding already used in AutoLab results. Academic reports use the same convention.
- **D-10:** Normalization layer outputs parameter values as LaTeX-ready strings (e.g., `$k = 49.8 \pm 0.5$ N/m`). KaTeX rendering is already proven from Phase 8.
- **D-11:** Goodness-of-fit stats (chi²/dof, R², P-value) stored as structured numeric objects: `{ chiSquaredReduced: number, rSquared: number, pValue: number }`. Downstream phases decide formatting.

### Report Page Evolution
- **D-12:** ReportBeta.tsx gains the instruction file upload zone and extracted text textarea in this phase. No report preview or section editor yet -- that's Phase 11.
- **D-13:** Beta badge stays on the /report page. Remove in Phase 12 when full flow is integrated.
- **D-14:** Test PDF button from Phase 8 stays as a permanent debug tool.

### Claude's Discretion
- Internal file size limits for instruction uploads (reasonable default, aligned with existing 50MB app limit)
- Exact textarea sizing and placeholder text for extracted content
- Python normalization function naming and location within `backend/api/report.py` or a new utils module
- TypeScript interface file location (co-located with ReportBeta.tsx or in a shared types file)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements
- `.planning/REQUIREMENTS.md` -- CTX-01 (file upload) and RPT-03 (results assembly) requirement definitions
- `.planning/ROADMAP.md` -- Phase 9 success criteria (4 criteria)

### Phase 8 foundation
- `.planning/phases/08-pdf-infrastructure-spike/08-CONTEXT.md` -- Prior decisions on blueprint structure (D-03), equation rendering, font bundling
- `backend/api/report.py` -- Existing report blueprint (report_bp) with test-pdf endpoint
- `backend/utils/pdf_renderer.py` -- Phase 8 PDF rendering module

### AutoLab result shape (source of truth for normalization)
- `backend/api/autolab.py` -- `_run_orchestrator()` return shape: `{ steps, state: { parsed, fit, formula, nsigma }, fit_data }`
- `frontend/src/context/AnalysisContext.tsx` -- `autolabResults` state slot (currently typed as `any`)
- `frontend/src/components/AutoLab.tsx` -- How results are consumed and displayed in the frontend

### Existing utilities to reuse
- `frontend/src/utils/format.ts` -- `roundWithUncertainty()` function for parameter formatting
- `frontend/src/services/api.ts` -- All API calls centralized here; new upload endpoint goes here

### Deployment configuration
- `nixpacks.toml` -- May need PyMuPDF/python-docx system dependencies
- `requirements.txt` -- Add PyMuPDF (`pymupdf`) and `python-docx` packages

### Codebase analysis
- `.planning/codebase/STRUCTURE.md` -- Where to add new code (blueprint pattern, component pattern)
- `.planning/codebase/CONVENTIONS.md` -- Naming conventions, API patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/report.py` (report_bp) -- Phase 8 blueprint, already registered at `/api/report/*`. Add file parsing endpoints here.
- `frontend/src/components/ReportBeta.tsx` -- Stub /report page with test PDF button. Evolve with upload UI.
- `frontend/src/utils/format.ts` -- `roundWithUncertainty(value, uncertainty)` returns `{ rounded, unrounded }`. Reuse for parameter LaTeX strings.
- `frontend/src/services/api.ts` -- Centralized API layer. Add `uploadInstructionFile()` and any normalization endpoints.
- `frontend/src/context/AnalysisContext.tsx` -- `autolabResults` already passes AutoLab data cross-page. Report page can read it.

### Established Patterns
- Flask blueprints: one file per domain in `backend/api/`, registered with `/api/{module}` prefix
- File uploads: `multipart/form-data` POST (already used by AutoLab for data file uploads)
- Error responses: `{ "error": "message" }` with 400/500 status
- Frontend API: typed async functions in `api.ts` using Axios
- Component state: `useState` hooks, no external state management

### Integration Points
- `backend/app.py` -- report_bp already registered; may need additional config for PyMuPDF
- `requirements.txt` -- Add `pymupdf` and `python-docx`
- `nixpacks.toml` -- Verify PyMuPDF system dependencies (MuPDF libs)
- `frontend/src/App.tsx` -- `/report` route already exists pointing to ReportBeta

</code_context>

<specifics>
## Specific Ideas

- PyMuPDF for PDF text extraction and python-docx for DOCX parsing (decided during v2.0 planning, recorded in STATE.md)
- The upload dropzone should follow a similar visual style to AutoLab's existing file upload area for consistency
- Extracted text textarea should be large enough to show meaningful content without excessive scrolling

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 09-report-data-contract-and-file-parsing*
*Context gathered: 2026-03-24*
