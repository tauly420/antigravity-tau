---
phase: 08-pdf-infrastructure-spike
plan: 01
subsystem: infra
tags: [weasyprint, katex, pdf, hebrew-rtl, fonts, flask-blueprint]

# Dependency graph
requires: []
provides:
  - WeasyPrint PDF generation pipeline (LaTeX-to-HTML + HTML-to-PDF)
  - KaTeX rendering with bundled fonts (no CDN)
  - Hebrew RTL + LTR math mixed-direction layout
  - GET /api/report/test-pdf endpoint
  - 6 automated tests for PDF pipeline
affects: [08-02-PLAN, phase-09, report-page]

# Tech tracking
tech-stack:
  added: [weasyprint>=68.0, markdown-katex>=202406.1035, katex-cli]
  patterns: [WeasyPrint with inlined CSS and base_url for font resolution, KaTeX subprocess fallback, regex-based math delimiter processing]

key-files:
  created:
    - backend/utils/pdf_renderer.py
    - backend/api/report.py
    - backend/templates/report_base.html
    - backend/templates/report_styles.css
    - backend/tests/test_pdf_render.py
    - backend/tests/conftest.py
    - backend/fonts/NotoSansHebrew-Regular.ttf
    - backend/fonts/NotoSansHebrew-Bold.ttf
    - backend/fonts/katex-fonts/ (20 woff2 files)
  modified:
    - requirements.txt
    - nixpacks.toml
    - backend/app.py

key-decisions:
  - "Simple string template substitution instead of Jinja2 dependency for HTML template rendering"
  - "KaTeX subprocess fallback (npx katex) when markdown_katex fails"
  - "CSS inlined in HTML rather than linked externally for WeasyPrint reliability"

patterns-established:
  - "PDF rendering: inlined CSS + base_url pointing to backend/ for font resolution"
  - "Test marker: requires_weasyprint for graceful skip when system libs unavailable"
  - "Report blueprint pattern: /api/report/* for all PDF endpoints"

requirements-completed: [PDF-01, PDF-02]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 08 Plan 01: PDF Infrastructure Spike Summary

**WeasyPrint PDF pipeline with KaTeX math rendering, Noto Sans Hebrew fonts, and test endpoint returning valid Hebrew+LaTeX PDF**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T20:10:07Z
- **Completed:** 2026-03-23T20:16:21Z
- **Tasks:** 3
- **Files modified:** 28

## Accomplishments
- Complete PDF rendering pipeline: LaTeX math to HTML via KaTeX, HTML to PDF via WeasyPrint
- Hebrew RTL body text with inline LTR math expressions working in generated PDFs
- All fonts bundled in repo (Noto Sans Hebrew + 20 KaTeX woff2 fonts) -- no CDN fetches
- nixpacks.toml configured with all WeasyPrint system dependencies for Railway deployment
- GET /api/report/test-pdf returns a valid 21KB+ PDF with Hebrew text and math
- 6 automated tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, bundle fonts, update nixpacks** - `18eb3f1` (chore)
2. **Task 2: Create rendering pipeline and HTML/CSS templates** - `f4aa3fa` (feat)
3. **Task 3: Flask blueprint, app registration, and test scaffold** - `7855d9b` (feat)

## Files Created/Modified
- `backend/utils/pdf_renderer.py` - Core rendering pipeline: render_latex_for_pdf, process_text_with_math, generate_pdf, generate_test_pdf
- `backend/api/report.py` - Flask blueprint with /test-pdf GET endpoint
- `backend/templates/report_base.html` - Jinja2-style HTML template with RTL Hebrew layout
- `backend/templates/report_styles.css` - 1259 lines: Hebrew fonts + 20 KaTeX font-face + full KaTeX CSS rules + A4 page layout
- `backend/tests/test_pdf_render.py` - 6 tests covering PDF generation, KaTeX rendering, endpoint
- `backend/tests/conftest.py` - Shared fixtures: app, client, requires_weasyprint marker
- `backend/app.py` - Added report_bp registration
- `requirements.txt` - Added weasyprint and markdown-katex
- `nixpacks.toml` - Added pango, cairo, gdk-pixbuf, glib, etc. for WeasyPrint + npm install -g katex
- `backend/fonts/` - Noto Sans Hebrew Regular+Bold TTF + 20 KaTeX woff2 fonts

## Decisions Made
- Used simple string replacement for HTML template instead of adding Jinja2 dependency (WeasyPrint only needs the final HTML string)
- KaTeX subprocess fallback via `npx katex` when markdown_katex import fails -- provides resilience
- CSS is inlined in the HTML document rather than linked externally, which is more reliable with WeasyPrint's base_url resolution

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- WeasyPrint import initially failed on macOS due to missing gobject/pango system libraries. Resolved by installing via `brew install pango cairo gdk-pixbuf libffi gobject-introspection`. This is expected on dev machines and is handled by nixpacks on Railway.

## User Setup Required

None - no external service configuration required. WeasyPrint system dependencies are handled by nixpacks.toml on Railway. On macOS dev machines, `brew install pango cairo gdk-pixbuf libffi gobject-introspection` is needed.

## Known Stubs

None - all functionality is fully wired and producing real output.

## Next Phase Readiness
- PDF infrastructure validated: WeasyPrint generates valid PDFs with Hebrew RTL + KaTeX math
- Ready for Plan 02: Railway deployment validation (the key risk test)
- Nixpacks configuration complete but untested on Railway -- that is Plan 02's purpose

---
*Phase: 08-pdf-infrastructure-spike*
*Completed: 2026-03-23*
