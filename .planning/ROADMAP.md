# Roadmap: Tau-LY

## Milestones

- ~~**v1.0 Theme and Security**~~ - Phases 1-7 (deferred -- security phases complete, theme migration deferred)
- **v2.0 AI-Powered Academic Lab Report Export** - Phases 8-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 Theme and Security (Phases 1-7) -- Security complete, theme deferred</summary>

- [x] **Phase 1: Security Hardening** - Replace eval() with sympify+lambdify in ODE and Integration backends
- [x] **Phase 2: Theme Token System** - Create CSS custom property architecture with dark/light token sets
- [ ] **Phase 3: Style Migration - Core Layout** - Migrate inline styles in App, Home, Sidebar, Workflow (DEFERRED)
- [ ] **Phase 4: Style Migration - Analysis Tools** - Migrate inline styles in AutoLab, GraphFitting, FormulaCalculator, NSigmaCalculator, DataPreview (DEFERRED)
- [ ] **Phase 5: Style Migration - Math and Science Tools** - Migrate inline styles in StatisticsCalculator, ConstantsReference, FourierAnalysis, MatrixCalculator (DEFERRED)
- [ ] **Phase 6: Style Migration - Solver Tools** - Migrate inline styles in ODESolver, NumericalIntegrator, UnitConverter (DEFERRED)
- [ ] **Phase 7: Theme Toggle and Polish** - FOUC-free theme switching with persistent preference (DEFERRED)

### Phase 1: Security Hardening
**Goal**: User-supplied mathematical expressions are evaluated safely without arbitrary code execution
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. ODE solver accepts the same mathematical expressions as before (sin, cos, exp, etc.) and produces identical numerical results
  2. Integration solver accepts the same mathematical expressions as before and produces identical numerical results
  3. Malicious input (e.g., `__import__('os').system('rm -rf /')`) is rejected with a clear error message instead of executing
  4. All existing example problems on ODE and Integration pages still work correctly
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md -- Safe expression evaluation module (TDD: tests + safe_eval.py with validate, ODE, integration builders)
- [x] 01-02-PLAN.md -- Replace eval() in ODE and Integration endpoints with safe_eval functions + endpoint tests

### Phase 2: Theme Token System
**Goal**: App has a complete CSS custom property architecture that enables dark/light theming across all components
**Depends on**: Phase 1
**Requirements**: THEME-01
**Success Criteria** (what must be TRUE):
  1. A root-level CSS file defines custom properties for all color categories (backgrounds, text, borders, accents, surfaces, shadows)
  2. Dark and light token sets exist via `[data-theme="dark"]` and `[data-theme="light"]` selectors
  3. The App root element applies the dark theme by default and all existing hardcoded colors in CSS files use the new tokens
  4. A documented token naming convention exists (e.g., `--color-bg-primary`, `--color-text-primary`) that subsequent phases follow
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md -- Define complete token architecture: extend :root with ~32 new tokens, add [data-theme="dark"] block with scientific instrument palette
- [x] 02-02-PLAN.md -- Replace ~40 hardcoded colors in global.css with var() references, wire data-theme="dark" in App.tsx, visual verification

### Phase 3: Style Migration - Core Layout (DEFERRED)
### Phase 4: Style Migration - Analysis Tools (DEFERRED)
### Phase 5: Style Migration - Math and Science Tools (DEFERRED)
### Phase 6: Style Migration - Solver Tools (DEFERRED)
### Phase 7: Theme Toggle and Polish (DEFERRED)

</details>

## v2.0 AI-Powered Academic Lab Report Export

**Milestone Goal:** Generate publication-ready academic lab reports from AutoLab analysis results, with AI-written theoretical background and discussion, Hebrew RTL support, and in-app preview/editing.

- [ ] **Phase 8: PDF Infrastructure Spike** - Validate WeasyPrint + Hebrew RTL + KaTeX rendering on Railway deployment
- [ ] **Phase 9: Report Data Contract and File Parsing** - Define AutoLab result normalization and build PDF/DOCX instruction file parsing
- [ ] **Phase 10: AI Content Generation Pipeline** - AI generates all report sections from experiment context and analysis results
- [ ] **Phase 11: Preview, Editing, and PDF Assembly** - In-app section editor, WeasyPrint PDF with Jinja2 template, embedded plots
- [ ] **Phase 12: Integration and Polish** - AutoLab entry point, /report route, end-to-end flow

## Phase Details

### Phase 8: PDF Infrastructure Spike
**Goal**: The backend can generate a Hebrew RTL PDF with inline English math equations on Railway
**Depends on**: Nothing (first v2.0 phase; independent of v1.0 deferred phases)
**Requirements**: PDF-01, PDF-02
**Success Criteria** (what must be TRUE):
  1. A test endpoint returns a downloadable A4 PDF containing a Hebrew paragraph with an inline LaTeX equation (e.g., "the spring constant was found to be k = 49.8 +/- 0.5 N/m") rendered correctly -- Hebrew flows right-to-left, equation reads left-to-right
  2. An equation test suite of 10+ LaTeX expression types (fractions, Greek letters, superscripts, +/-, chi-squared, integrals, text-in-math) renders correctly in the PDF via KaTeX HTML output through WeasyPrint
  3. The PDF renders with bundled Noto Sans Hebrew font and bundled KaTeX fonts (no external CDN fetches at render time)
  4. WeasyPrint imports and generates PDFs successfully on Railway deployment (nixpacks system libraries configured correctly)
**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md -- Dependencies, fonts, rendering pipeline (pdf_renderer.py + CSS/HTML templates), Flask blueprint, test scaffold
- [x] 08-02-PLAN.md -- Full 12-expression equation test suite with bidi edge cases, visual verification checkpoint

### Phase 9: Report Data Contract and File Parsing
**Goal**: AutoLab results are normalized into a guaranteed-shape contract, and users can upload lab instruction files for context extraction
**Depends on**: Phase 8
**Requirements**: CTX-01, RPT-03
**Success Criteria** (what must be TRUE):
  1. A `ReportAnalysisData` TypeScript interface and corresponding Python normalization layer translate any AutoLab result shape (partial analyses, custom fits, missing steps) into a guaranteed contract without defensive null-checking downstream
  2. User can upload a PDF lab instruction file and see the extracted text displayed in the UI for confirmation before it is sent to AI
  3. User can upload a DOCX lab instruction file and see the extracted text displayed in the UI for confirmation before it is sent to AI
  4. The Results section data is assembled from AutoLab analysis: fit parameters with uncertainties, chi-squared/R-squared/P-value, n-sigma comparison -- all formatted using existing `roundWithUncertainty()` conventions
**Plans:** 2 plans

Plans:
- [x] 09-01-PLAN.md -- ReportAnalysisData TypeScript interface + Python normalizer with tests (RPT-03)
- [x] 09-02-PLAN.md -- File parser utils, upload endpoint, upload UI on ReportBeta.tsx (CTX-01)

### Phase 10: AI Content Generation Pipeline
**Goal**: AI generates all report sections (theory, method, discussion, conclusions) from experiment context and AutoLab results
**Depends on**: Phase 9
**Requirements**: CTX-02, CTX-03, RPT-01, RPT-02, RPT-04, RPT-05
**Success Criteria** (what must be TRUE):
  1. User can fill in a context form (title, subject, equipment, procedure notes) alongside or instead of uploading an instruction file, and this context seeds the AI generation
  2. AI identifies missing context from available inputs and asks 1-3 targeted follow-up questions before generating sections
  3. AI generates a theoretical background section with relevant physics theory and LaTeX equations grounded in the actual experiment context (not generic boilerplate)
  4. AI generates measurement method, discussion (referencing actual computed values and error sources), and conclusions sections -- all returned as structured JSON with per-section content
  5. Each generated section contains LaTeX equations in KaTeX-compatible format and references actual parameter values from the AutoLab analysis
**Plans:** 3 plans

Plans:
- [ ] 10-01-PLAN.md -- Backend AI pipeline: prompt builders, /analyze-context and /generate endpoints, mocked test suite
- [ ] 10-02-PLAN.md -- Frontend context form, language toggle, Generate Report button, API functions
- [ ] 10-03-PLAN.md -- Wire generation flow: follow-up questions UI, loading/success/error states, visual verification

### Phase 11: Preview, Editing, and PDF Assembly
**Goal**: User can preview, edit, and export a complete academic lab report as a publication-quality PDF
**Depends on**: Phase 8, Phase 10
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. User can fill in title page information (name, ID, partner, course, experiment title, date) via a form, and this information appears on the PDF title page
  2. User can preview each report section in-app with rendered LaTeX equations before exporting
  3. User can edit any AI-generated section text in a textarea and see a live KaTeX preview of changes, with an "AI Generated -- Please Review" badge that clears on edit
  4. Exported PDF has academic formatting: numbered sections with Hebrew headers, embedded fit and residuals plots with numbered figure captions, parameter table, A4 layout with proper margins
  5. Fit and residuals plots from AutoLab analysis are embedded in the PDF as publication-quality images with figure captions
**Plans**: TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD
- [ ] 11-03: TBD

### Phase 12: Integration and Polish
**Goal**: Users can generate a report directly from completed AutoLab results in one click
**Depends on**: Phase 11
**Requirements**: UI-04
**Success Criteria** (what must be TRUE):
  1. A "Generate Report" button appears on the AutoLab results page after a successful analysis
  2. Clicking the button navigates to the report builder with all AutoLab analysis data pre-loaded (no re-entering data)
  3. The full workflow (AutoLab analysis -> Generate Report -> context form -> AI generation -> preview/edit -> PDF download) works end-to-end without errors
  4. Graceful handling of edge cases: partial analyses (missing fit or n-sigma), scanned PDFs that yield no text, oversized uploads, and AI generation failures show clear error messages
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10 -> 11 -> 12
Note: Phase 11 depends on both Phase 8 and Phase 10.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security Hardening | v1.0 | 2/2 | Complete | 2026-03-20 |
| 2. Theme Token System | v1.0 | 2/2 | Complete | 2026-03-21 |
| 3-7. Style Migration + Toggle | v1.0 | 0/TBD | Deferred | - |
| 8. PDF Infrastructure Spike | v2.0 | 2/2 | Complete | - |
| 9. Report Data Contract and File Parsing | v2.0 | 0/2 | Planning | - |
| 10. AI Content Generation Pipeline | v2.0 | 0/3 | Planned | - |
| 11. Preview, Editing, and PDF Assembly | v2.0 | 0/TBD | Not started | - |
| 12. Integration and Polish | v2.0 | 0/TBD | Not started | - |
