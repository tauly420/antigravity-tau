# Requirements: Tau-LY

**Defined:** 2026-03-20
**Core Value:** AutoLab -- upload a data file, describe what you want in plain language, and get a complete physics analysis with minimal friction.

## v1.0 Requirements (Complete)

### Security

- [x] **SEC-01**: User input in ODE solver is evaluated safely via sympify+lambdify instead of eval()
- [x] **SEC-02**: User input in Integration solver is evaluated safely via sympify+lambdify instead of eval()

### Theme

- [x] **THEME-01**: App has a dark science dashboard theme using CSS custom properties

## v2.0 Requirements

Requirements for AI-powered academic lab report export. Each maps to roadmap phases.

### PDF Infrastructure

- [x] **PDF-01**: User can download a publication-quality A4 PDF lab report with Hebrew RTL body text and English LTR math equations
- [x] **PDF-02**: PDF renders LaTeX equations (inline and display) correctly within Hebrew paragraphs

### Context Collection

- [ ] **CTX-01**: User can upload a lab instruction file (PDF or DOCX, Hebrew or English) as context for report generation
- [x] **CTX-02**: User can provide experiment context via a form (title, subject, equipment, procedure notes) alongside or instead of file upload
- [x] **CTX-03**: AI identifies missing context from available inputs and asks 1-3 targeted follow-up questions before generating the report

### AI Report Generation

- [x] **RPT-01**: AI generates a theoretical background section with relevant physics theory and LaTeX equations based on experiment context
- [x] **RPT-02**: AI generates a measurement method section describing equipment and procedure based on uploaded instructions and user context
- [ ] **RPT-03**: Results section is auto-populated from AutoLab analysis — fit parameters with uncertainties, chi-squared/R-squared/P-value, n-sigma comparison, and embedded fit + residuals plots with numbered captions
- [x] **RPT-04**: AI generates a discussion section interpreting the actual results, comparing to theory, and analyzing sources of error
- [x] **RPT-05**: AI generates a conclusions section summarizing the main findings and measured values

### Report UI

- [ ] **UI-01**: User can fill in title page information (name, ID, partner, course, experiment title, date) via a form
- [ ] **UI-02**: User can preview each report section in-app before exporting to PDF
- [ ] **UI-03**: User can edit any AI-generated section text before exporting to PDF
- [ ] **UI-04**: User can trigger report generation directly from completed AutoLab results with one click

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Theme (Deferred from v1.0)

- **THEME-02**: All inline style declarations (~420) are migrated to CSS variable references
- **THEME-04**: Theme toggle does not cause flash of unstyled content (FOUC)

### Navigation

- **NAV-01**: Top tab bar replaces current tool switching mechanism
- **NAV-02**: Tool discovery is intuitive with clear labels and grouping

### AutoLab UX

- **ALAB-01**: AutoLab results layout reduces vertical scrolling
- **ALAB-02**: Key analysis info (parameters, fit quality) is surfaced prominently
- **ALAB-03**: AutoLab.tsx is decomposed into modular sub-components (<300 lines each)

### Report Enhancements

- **FUT-01**: AI-generated objective section derived from instructions
- **FUT-02**: Data table included in results section (sample or full, user-configurable)
- **FUT-03**: Report quality scoring — AI rates the draft and suggests improvements
- **FUT-04**: Bibliography/references section with relevant textbook references
- **FUT-05**: Report generation from standalone tools (GraphFitting, etc.), not just AutoLab
- **FUT-06**: LaTeX source export alongside PDF
- **FUT-07**: Multiple report templates for different universities

### AI Solvers

- **AI-01**: AI assists ODE solver setup (equation construction from physics description)
- **AI-02**: AI recommends ODE solver method and explains tradeoffs
- **AI-03**: AI interprets ODE solution results in physics context
- **AI-04**: AI assists Integration page with same capabilities as ODE

### Security (Deferred)

- **SEC-03**: Flask debug=True is disabled in production deployment
- **SEC-04**: AI output is sanitized with DOMPurify before rendering via dangerouslySetInnerHTML

## Out of Scope

| Feature | Reason |
|---------|--------|
| WYSIWYG rich text editor | RTL rich text editing is extremely complex; textarea editing with preview is sufficient |
| Client-side PDF generation | jsPDF cannot handle Hebrew RTL or LaTeX math rendering |
| Multiple report templates | One well-designed Israeli academic template first; expand later |
| Full AI report without review | Academic integrity requires user review; always show preview |
| Real-time collaborative editing | Requires CRDT/OT infrastructure; way out of scope |
| Save/load report drafts | Requires persistence layer; contradicts stateless design |
| Plagiarism detection | External service dependency; not Tau-LY's job |
| Mobile-native app | Web-first tool; responsive improvements only |
| User accounts / authentication | Stateless tool, no login needed |
| Database / persistent storage | Analyses are ephemeral by design |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | v1.0 Phase 1: Security Hardening | Complete |
| SEC-02 | v1.0 Phase 1: Security Hardening | Complete |
| THEME-01 | v1.0 Phase 2: Theme Token System | Complete |
| PDF-01 | Phase 8: PDF Infrastructure Spike | Complete |
| PDF-02 | Phase 8: PDF Infrastructure Spike | Complete |
| CTX-01 | Phase 9: Report Data Contract and File Parsing | Pending |
| CTX-02 | Phase 10: AI Content Generation Pipeline | Complete |
| CTX-03 | Phase 10: AI Content Generation Pipeline | Complete |
| RPT-01 | Phase 10: AI Content Generation Pipeline | Complete |
| RPT-02 | Phase 10: AI Content Generation Pipeline | Complete |
| RPT-03 | Phase 9: Report Data Contract and File Parsing | Pending |
| RPT-04 | Phase 10: AI Content Generation Pipeline | Complete |
| RPT-05 | Phase 10: AI Content Generation Pipeline | Complete |
| UI-01 | Phase 11: Preview, Editing, and PDF Assembly | Pending |
| UI-02 | Phase 11: Preview, Editing, and PDF Assembly | Pending |
| UI-03 | Phase 11: Preview, Editing, and PDF Assembly | Pending |
| UI-04 | Phase 12: Integration and Polish | Pending |

**Coverage:**
- v2.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-23 after v2.0 roadmap creation*
