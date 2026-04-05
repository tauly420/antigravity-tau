---
phase: 16-docx-export-with-math-rendering
plan: 01
subsystem: api
tags: [docx, python-docx, latex2mathml, omml, xslt, rtl, math-rendering]

requires:
  - phase: 08-pdf-infrastructure-spike
    provides: PDF renderer pattern (assemble_report_html, generate_pdf)
provides:
  - DOCX generation pipeline with OMML math equations
  - Two Flask endpoints for full and results-only DOCX export
  - MML2OMML.XSL bundled for MathML-to-OMML conversion
affects: [16-02, frontend-docx-buttons]

tech-stack:
  added: [latex2mathml>=3.77.0, lxml>=4.9.0]
  patterns: [latex-to-omml-via-xslt, python-docx-rtl-bidi]

key-files:
  created:
    - backend/utils/docx_renderer.py
    - backend/utils/MML2OMML.XSL
    - backend/tests/test_docx_renderer.py
  modified:
    - backend/api/report.py
    - requirements.txt

key-decisions:
  - "Used MML2OMML.XSL from Microsoft Word installation (mathml2omml.xsl) for reliable XSLT transform"
  - "Empty LaTeX raises exception (latex2mathml NoAvailableTokensError) - adjusted test from invalid-command to empty-string"
  - "Named endpoint function export_results_docx_endpoint to avoid collision with imported generate_results_docx"

patterns-established:
  - "DOCX math: LaTeX -> latex2mathml -> MathML -> XSLT(MML2OMML.XSL) -> OMML element appended to paragraph"
  - "RTL in DOCX: w:bidi on paragraph pPr, w:rtl on run rPr, w:cs font for complex script"

requirements-completed: [DOCX-01, DOCX-02, DOCX-03, DOCX-04]

duration: 7min
completed: 2026-04-05
---

# Phase 16 Plan 01: DOCX Backend Pipeline Summary

**DOCX generation with OMML math equations via latex2mathml + MML2OMML.XSL XSLT, Hebrew RTL bidi support, and two Flask export endpoints**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-05T12:17:36Z
- **Completed:** 2026-04-05T12:24:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Complete DOCX renderer with latex_to_omml converting LaTeX to editable Word equations
- Full report and results-only DOCX generation with parameter tables, plots, and RTL Hebrew
- 8 TDD tests covering OMML conversion, RTL bidi, plot embedding, and full document generation
- Two new Flask endpoints mirroring the existing PDF export endpoints

## Task Commits

1. **Task 1: Install deps, bundle XSL, create docx_renderer.py with tests** - `4ca066c` (feat - TDD)
2. **Task 2: Add export-docx and export-results-docx endpoints** - `c7f8180` (feat)

## Files Created/Modified
- `backend/utils/docx_renderer.py` - DOCX generation pipeline (latex_to_omml, generate_docx, generate_results_docx, RTL helpers)
- `backend/utils/MML2OMML.XSL` - Microsoft XSLT stylesheet for MathML-to-OMML conversion (4468 lines)
- `backend/tests/test_docx_renderer.py` - 8 unit tests for DOCX renderer
- `backend/api/report.py` - Added /export-docx and /export-results-docx endpoints
- `requirements.txt` - Added latex2mathml>=3.77.0 and lxml>=4.9.0

## Decisions Made
- Used MML2OMML.XSL sourced from local Microsoft Word installation (mathml2omml.xsl) since GitHub downloads were unavailable
- Adjusted fallback test to use empty string (raises NoAvailableTokensError) since latex2mathml silently handles invalid commands
- Used `generate_docx_report` alias for import to avoid name collision with endpoint function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] XSL file download failed, used local Word copy**
- **Found during:** Task 1 (bundling MML2OMML.XSL)
- **Issue:** All GitHub URLs for MML2OMML.XSL returned 404
- **Fix:** Copied from local Microsoft Word installation at /Applications/Microsoft Word.app/Contents/Resources/mathml2omml.xsl
- **Files modified:** backend/utils/MML2OMML.XSL
- **Verification:** XSLT loads and transforms MathML to OMML correctly, all tests pass

**2. [Rule 1 - Bug] Invalid LaTeX test used wrong input**
- **Found during:** Task 1 (TDD RED-GREEN)
- **Issue:** latex2mathml silently handles `\invalidcommand{}` without raising, test expected exception
- **Fix:** Changed test to use empty string which correctly raises NoAvailableTokensError
- **Files modified:** backend/tests/test_docx_renderer.py
- **Verification:** Test passes with correct exception behavior

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing test `test_missing_student_name_returns_400` in test_pdf_export.py fails (returns 200 instead of 400) - not caused by this plan's changes, out of scope

## Known Stubs
None - all functions are fully implemented and tested.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DOCX backend pipeline complete, ready for frontend integration (Plan 16-02)
- Endpoints accept same data shape as PDF counterparts (minus template field)

---
*Phase: 16-docx-export-with-math-rendering*
*Completed: 2026-04-05*
