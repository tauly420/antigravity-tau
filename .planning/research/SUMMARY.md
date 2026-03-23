# Project Research Summary

**Project:** Tau-LY — AI-Powered Academic Lab Report Generation
**Domain:** Hebrew RTL academic PDF generation with AI content synthesis
**Researched:** 2026-03-23
**Confidence:** MEDIUM

## Executive Summary

Tau-LY v2.0 adds an AI-driven lab report generator on top of the existing AutoLab analysis pipeline. The product is a document generation system with three hard constraints that distinguish it from typical "export to PDF" features: Hebrew right-to-left body text, inline LaTeX math equations that must remain LTR within RTL paragraphs, and publication-quality academic formatting. No client-side PDF library handles this constraint set. The only viable approach is server-side HTML-to-PDF generation using WeasyPrint, which leverages the Pango text engine (via FriBidi) for Unicode BiDi and renders KaTeX's HTML/CSS output directly as vector equations. The existing jsPDF export (`exportPdf.ts`) is fundamentally incompatible with Hebrew and cannot be extended for this purpose.

The recommended workflow is a four-step pipeline: (1) context collection — users upload their lab instruction PDF/Word and provide metadata; (2) AI section generation — the backend calls OpenAI with `response_format: json_object` to produce Theory, Method, Discussion, and Conclusions sections; (3) user review and editing of each section in-app before export; and (4) server-side PDF rendering via WeasyPrint. The mandatory review step is not optional UX polish — it is the primary defense against AI physics hallucination. The key workflow bridge is `AnalysisContext.autolabResults`, which already carries all fit parameters, statistics, and comparison results needed to seed the report. No new shared state is required.

The highest-risk technical component is the WeasyPrint deployment on Railway. WeasyPrint requires system-level C libraries (pango, cairo, gdk-pixbuf) that must be added to `nixpacks.toml`, and the interaction between KaTeX's deeply nested span CSS output and WeasyPrint's CSS subset is fragile for complex equations. This must be validated as the very first task — before AI content generation or any UI work. If WeasyPrint cannot render Hebrew RTL with inline KaTeX equations correctly on Railway, the PDF engine choice must be reconsidered early, not after three phases of development.

---

## Key Findings

### Recommended Stack

The existing stack (React 19, Flask, SymPy, NumPy, OpenAI SDK, KaTeX) requires no changes. New dependencies are scoped entirely to the report feature. On the backend: **WeasyPrint >=62.0** for PDF generation, **PyMuPDF >=1.24.0** for PDF instruction file parsing, **python-docx >=1.1.0** for Word instruction files, and **matplotlib >=3.8.0** for publication-quality plot images (OO API only — not pyplot — for Flask thread safety). Jinja2 is already installed as a Flask transitive dependency. On the frontend, the research explicitly recommends against TipTap for the initial milestone (see Pitfall 6 below) in favor of simpler textarea-based section editing. DOMPurify is still recommended for sanitizing AI-generated HTML before preview rendering.

Infrastructure changes are required in `nixpacks.toml`: add `pango`, `cairo`, `gdk-pixbuf`, and `gobject-introspection` to the nixPkgs array. Font files (Noto Sans Hebrew, KaTeX WOFF2 fonts) must be bundled locally in `backend/templates/fonts/` — WeasyPrint cannot fetch fonts from CDNs at render time.

**Core technologies:**
- **WeasyPrint >=62.0**: HTML/CSS to PDF — the only Python engine with CSS3 RTL, BiDi, and embedded font support; Pango/FriBidi handles Hebrew natively
- **PyMuPDF >=1.24.0**: PDF instruction file parsing — fastest Python text extractor, encoding-aware Hebrew support, no system deps beyond MuPDF (bundled)
- **python-docx >=1.1.0**: Word instruction file parsing — mature, handles Hebrew Unicode, pure Python, no system deps
- **matplotlib >=3.8.0** (OO API): Report plot image generation — thread-safe for Flask, print-quality DPI, no pyplot global state
- **OpenAI SDK** (already installed): AI section generation — direct SDK calls reusing existing patterns from AutoLab, structured JSON output mode
- **Jinja2** (already installed): HTML report templating — zero install cost
- **Noto Sans Hebrew** (font bundle, not pip): Must be bundled locally; WeasyPrint cannot fetch from Google Fonts at render time

### Expected Features

**Must have (table stakes) — v2.0 MVP:**
- Standard Israeli physics lab report sections in order: Title Page, Objective, Theory, Method, Results, Discussion, Conclusions (section names in Hebrew)
- Server-side PDF generation with Hebrew RTL body text and LTR inline math equations on A4 with proper margins
- AI-generated Theory, Method, Discussion, and Conclusions sections from uploaded instructions + AutoLab context
- Structured Results section auto-populated from AutoLab: fit parameter table with uncertainties, chi-squared/R²/P-value, embedded fit and residuals plots with figure captions
- In-app section preview with editable text areas per section — not optional; mandatory review step before export
- Instruction file upload and parsing (PDF and DOCX), with extracted text shown to user for confirmation before AI uses it
- Student metadata title page (name, ID, course, experiment title, date) via simple form fields
- Proper sig-fig uncertainty formatting reusing existing `roundWithUncertainty()` from `format.ts`
- N-sigma comparison statement where applicable

**Should have (competitive differentiators):**
- AI-generated Discussion that references actual computed values (not generic boilerplate)
- Per-section AI regeneration button in the review UI
- Per-section "AI Generated — Please Review" badge that clears on user edit or explicit confirmation
- One-click "Generate Report" button entry from AutoLab results (no re-entering analysis data)
- Structured context form with free-text fallback when no instruction file is uploaded

**Defer to v2.1+:**
- AI-driven conversational gap-filling questions (structured form is sufficient for MVP)
- Data table in report body (most TAs don't require it for undergrad labs)
- Bibliography/references section (AI citation hallucination risk, low value)
- LaTeX source export (Hebrew LaTeX toolchain is painful; Israeli students primarily use PDF)
- Saved/persistent report drafts (contradicts stateless architecture; requires auth)
- Multiple report templates (one well-designed template beats several mediocre ones)

### Architecture Approach

The report feature is a self-contained module that reads from `AnalysisContext.autolabResults` but writes nothing back to shared state. All in-progress report state lives in component-local state within `ReportBuilder.tsx`. The backend adds a new `report_bp` blueprint (`backend/api/report.py`) with four endpoints: `parse-instructions`, `generate-sections`, `regenerate-section`, and `generate-pdf`. Utility concerns are separated into `backend/utils/doc_parser.py` (PDF/Word extraction) and `backend/utils/plot_export.py` (matplotlib figures). The HTML template and all bundled fonts live in `backend/templates/report/`. The critical integration point is a `ReportAnalysisData` TypeScript interface and a Python normalization layer that translates AutoLab's variable-shape output into a guaranteed-shape contract the report generator can depend on without defensive null-checking throughout.

**Major components:**
1. **ReportBuilder.tsx** — context collection UI: instruction file upload, free-text input, metadata form, triggers AI section generation; reads `autolabResults` from AnalysisContext
2. **ReportPreview.tsx** — renders all sections with in-browser KaTeX, wraps each in SectionEditor for per-section editing
3. **SectionEditor.tsx** — plain textarea with markdown input and live KaTeX preview panel (explicitly NOT a rich text editor)
4. **report_bp** (Flask blueprint) — four endpoints: parse instructions, generate sections, regenerate section, generate PDF
5. **doc_parser.py** — PyMuPDF + python-docx extraction, language detection (Hebrew char density), returns text with user-confirmation before AI use
6. **plot_export.py** — matplotlib OO API figure generation returning base64 PNG strings, thread-safe
7. **report.html + report.css + fonts/** — Jinja2 template with `<html dir="rtl">`, equation islands as `<span dir="ltr" style="unicode-bidi: embed;">`, bundled Noto Sans Hebrew and KaTeX fonts

### Critical Pitfalls

1. **Hebrew RTL + LTR math mixing breaks in PDF** — parentheses flip direction, punctuation migrates across equation boundaries, variable names get reordered. Prevention: every KaTeX-rendered equation wrapped in explicit `<span dir="ltr" style="unicode-bidi: embed; direction: ltr;">`. Prototype with a real sentence like "the spring constant was found to be $k = 49.8 \pm 0.5$ N/m" in the first 2-3 days — not after building the pipeline.

2. **AI hallucinates wrong physics equations in Theory sections** — fluent, professionally-formatted LaTeX with incorrect physics that students submit without scrutinizing. Prevention: mandatory in-app review with visible "AI Generated" badges; constrain AI system prompt to describe the actual fit model used and explicitly prohibit citing specific papers or textbooks.

3. **WeasyPrint fails on Railway deployment** — system library names in nixpacks.toml may not match Railway's nixpkgs version, breaking the entire PDF feature before a line of report UI is written. Prevention: test `python -c "import weasyprint"` on Railway as the absolute first infrastructure step.

4. **KaTeX CSS rendering breaks in WeasyPrint for complex equations** — fractions misalign, superscripts overlap, `\chi^2` and integrals fail because WeasyPrint implements a CSS subset, not a full browser engine. Prevention: build an equation test suite (10+ types: fractions, `\pm`, Greek letters, `\text{}`, multi-line) through the full pipeline in Phase 1. Fallback: pre-render equations as SVG via KaTeX CLI and embed as `<img>`.

5. **AutoLab result shape is undocumented and variable** — missing pipeline steps produce `None`, parameter counts vary by fit model, `AnalysisContext` uses `any` types throughout. Prevention: define `ReportAnalysisData` TypeScript interface and a normalization layer as the first task in Phase 2. This is the integration contract; skipping it means debugging shape issues across every subsequent phase.

6. **Rich text editor complexity** — adopting TipTap or Slate for section editing introduces RTL cursor bugs, LaTeX equation editing (unsolved problem), internal format-to-template conversion issues, and a 200KB+ bundle increase. Prevention: use plain textarea with markdown per section and a read-only KaTeX preview. Explicitly defer WYSIWYG editing.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: PDF Infrastructure Spike
**Rationale:** WeasyPrint on Railway is the single highest-risk unknown and a hard blocker for the entire feature. Validating it first costs 1-2 days if successful; discovering it fails in Phase 4 costs weeks of rework.
**Delivers:** Working WeasyPrint on Railway with nixpkgs system libs; proof-of-concept PDF containing a Hebrew paragraph with inline `$k = 49.8 \pm 0.5$ N/m` equation; equation test suite (10+ types) showing what KaTeX CSS WeasyPrint handles; bundled Noto Sans Hebrew + KaTeX fonts resolving correctly
**Addresses:** Server-side PDF with Hebrew RTL (table stakes); Pitfalls 1 (RTL+math), 3 (KaTeX CSS), 4 (Railway deployment)
**Avoids:** Building three phases of features on an unvalidated PDF engine

### Phase 2: Report Data Contract and File Parsing
**Rationale:** The data contract must exist before any feature touches AutoLab results. File parsing is fully independent of AI generation and can be tested with real Hebrew university PDFs immediately.
**Delivers:** `ReportAnalysisData` TypeScript interface + Python normalization layer with unit tests for all edge cases (partial analysis, custom fits, missing sections); `doc_parser.py` with `parse-instructions` endpoint; extracted text preview UI where user confirms before AI sees it
**Uses:** PyMuPDF, python-docx
**Implements:** Report data contract (blocks all downstream work); `parse-instructions` endpoint
**Avoids:** Pitfall 5 (AutoLab result shape fragility), Pitfall 3 (PDF/Word parsing silent failures)

### Phase 3: AI Content Generation Pipeline
**Rationale:** With the data contract established, AI generation is built against a known input shape. Section generation can be parallelized. The system prompt for Hebrew academic physics writing needs careful iteration.
**Delivers:** `generate-sections` and `regenerate-section` endpoints; ReportBuilder.tsx context collection form (metadata + free-text input); AI generation for all report sections with structured JSON output; basic ReportPreview.tsx showing raw section content with "AI Generated — Please Review" badges
**Uses:** Direct OpenAI SDK with `response_format: json_object`; existing `OPENAI_API_KEY`
**Implements:** Pattern 3 (structured AI output); uploaded text goes in user message, never system prompt (security)
**Avoids:** Pitfall 2 (AI hallucination via mandatory review), prompt injection via uploaded PDF

### Phase 4: Preview, Section Editing, and PDF Assembly
**Rationale:** Preview and PDF rendering both depend on real AI content (Phase 3) and validated PDF infrastructure (Phase 1). Section editing uses textarea — no rich text editor.
**Delivers:** SectionEditor.tsx (textarea + live KaTeX preview); full ReportPreview.tsx with per-section editing; `generate-pdf` endpoint with Jinja2 template, matplotlib plot embedding, A4 layout with academic formatting (figure captions, numbered sections, parameter tables); WeasyPrint HTML→PDF final assembly
**Uses:** WeasyPrint, matplotlib OO API, Jinja2, bundled fonts
**Implements:** Pattern 1 (multi-step pipeline with review gate); Pattern 2 (Hebrew RTL with embedded LTR math); Pattern 4 (thread-safe plot generation)
**Avoids:** Pitfall 6 (rich text editor complexity); anti-pattern (one mega API call); anti-pattern (client-side PDF)

### Phase 5: Integration, Polish, and Edge Cases
**Rationale:** Final integration connects the report feature to the existing AutoLab page. Edge case handling is deferred until the happy path is confirmed working.
**Delivers:** "Generate Report" button in AutoLab.tsx; `/report` route in App.tsx; per-section progress indicators ("Generating theoretical background..."); graceful handling of missing sections (partial analyses); cross-platform PDF font validation (Windows, macOS, mobile); error handling for scanned PDFs, oversized files, token limit exceeded, WeasyPrint timeout; Hebrew input field `dir="rtl"` on all text inputs
**Implements:** Full integration checklist from ARCHITECTURE.md
**Avoids:** UX pitfalls (no progress indicator, forced file upload, Hebrew text in LTR inputs)

### Phase Ordering Rationale

- Phase 1 must come first because WeasyPrint deployment is rated LOW confidence and is a hard dependency for the entire PDF-generation feature. A late discovery of failure would require pivoting the PDF strategy entirely.
- Phase 2 before Phase 3 because AI section generation depends on a defined input contract. Without the normalization layer, every AI generation call is at risk of crashing on edge-case AutoLab result shapes.
- Phase 3 before Phase 4 because the preview UI needs real AI content to be useful; testing with hardcoded placeholder text hides actual formatting and content issues.
- Phase 5 last because integration hooks and edge cases are polish that does not block the core workflow.

### Research Flags

Phases likely needing prototype spikes or deeper investigation during planning:
- **Phase 1:** WeasyPrint + KaTeX + Hebrew RTL is an undocumented combination. No prior art found. Must be empirically tested, not assumed to work based on documentation.
- **Phase 2:** Real Hebrew university PDFs from Technion/HUJI/TAU should be tested with doc_parser.py as soon as it exists. Encoding edge cases in legacy PDFs cannot be predicted without real test data.
- **Phase 3:** Hebrew academic AI prompt design requires iteration. First-pass output should be reviewed by a physics-literate Hebrew speaker before declaring the prompts production-ready.

Phases with standard patterns (lower research risk):
- **Phase 4 (matplotlib, Jinja2, font bundling):** All well-documented. OO API for matplotlib and WeasyPrint `base_url` font resolution are established patterns.
- **Phase 5 (route integration, error handling):** Standard Flask blueprint registration and React Router patterns. No novel technical challenges.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Library choices (WeasyPrint, PyMuPDF, python-docx, matplotlib) are well-motivated. Specific versions marked with * need verification via `pip index versions` or `npm view`. nixpacks system library names for WeasyPrint are LOW confidence specifically — must be tested on Railway before any report work. |
| Features | MEDIUM | Israeli university lab report section conventions are from training data; specific university requirements may vary. BiDi requirements are HIGH confidence (Unicode standard). The scope decision to use textarea over TipTap for MVP is a deliberate judgment call, not a gap. |
| Architecture | MEDIUM-HIGH | Based on direct codebase analysis of existing AutoLab patterns. Data flow, component boundaries, and integration points are concrete. The normalization layer recommendation is specifically motivated by inspecting `AnalysisContext.tsx` and `autolab.py`. |
| Pitfalls | MEDIUM-HIGH | RTL/BiDi pitfalls are grounded in Unicode spec. WeasyPrint CSS subset limitations are documented but KaTeX-specific interaction needs empirical validation. AI hallucination risk is well-documented across LLM research. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **WeasyPrint nixpacks deployment:** Exact system package names need verification on Railway. Test `python -c "import weasyprint"` before any report feature work begins.
- **KaTeX CSS in WeasyPrint:** Which specific KaTeX CSS features fail in WeasyPrint is not documented. The Phase 1 equation test suite exists to map this boundary.
- **Hebrew PDF extraction quality:** Real university lab instruction PDFs may use non-Unicode fonts or legacy encodings. Quality cannot be guaranteed until tested with actual files from Technion/HUJI/TAU.
- **OpenAI Hebrew academic output quality:** AI-generated Hebrew lab report text needs review by a physics-literate Hebrew speaker. First-pass prompts will require iteration.
- **TipTap RTL for future milestone:** If richer editing is needed post-MVP, TipTap v2.6+ RTL behavior should be re-researched. Training data covers through v2.4.
- **Noto Sans Hebrew font license:** Expected to be OFL (open source), but should be confirmed before production deployment.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `backend/api/autolab.py` — AutoLab result shapes, tool function patterns, existing OpenAI SDK usage
- Codebase: `frontend/src/context/AnalysisContext.tsx` — shared state bridge, `autolabResults` structure
- Codebase: `frontend/src/utils/exportPdf.ts` — confirmed jsPDF limitations via direct inspection
- Codebase: `frontend/src/components/AutoLab.tsx` — 1,141 lines; confirmed god-component; report must be separate
- Unicode Standard UAX #9 — Bidirectional Algorithm specification
- CSS W3C specification — `direction`, `unicode-bidi`, `unicode-bidi: isolate` semantics

### Secondary (MEDIUM confidence)
- WeasyPrint documentation (https://weasyprint.org/) — CSS3 support level, Pango/FriBidi text rendering
- PyMuPDF documentation (https://pymupdf.readthedocs.io/) — text extraction API, Hebrew encoding
- python-docx documentation (https://python-docx.readthedocs.io/) — paragraph and table extraction
- OpenAI API (https://platform.openai.com/docs/) — `response_format: json_object` structured output
- KaTeX documentation (https://katex.org/) — HTML output structure, font dependencies
- Israeli university lab report conventions — Technion, HUJI, TAU (training data; conventions are stable but not verified against current course requirements)

### Tertiary (LOW confidence)
- nixpacks system package names for WeasyPrint C library dependencies — inferred, must be verified on Railway
- WeasyPrint + KaTeX CSS compatibility — inferred from WeasyPrint CSS support documentation; specific interaction untested
- TipTap >=2.6.0 RTL behavior — training data covers through v2.4; newer versions may differ

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
