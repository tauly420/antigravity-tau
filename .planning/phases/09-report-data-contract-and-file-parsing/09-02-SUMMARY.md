---
phase: 09-report-data-contract-and-file-parsing
plan: 02
subsystem: ui, api
tags: [pymupdf, python-docx, react, file-upload, pdf-parsing]

requires:
  - phase: 08-pdf-infrastructure-spike
    provides: Report blueprint and /report route
provides:
  - PDF text extraction via PyMuPDF
  - DOCX text extraction via python-docx
  - POST /api/report/upload-instructions endpoint
  - uploadInstructionFile() frontend API function
  - Upload dropzone + editable textarea on ReportBeta.tsx
  - 8 unit tests for file parsing and endpoint
affects: [10-ai-report-generation]

tech-stack:
  added: [PyMuPDF, python-docx]
  patterns: [file upload with text extraction and user review]

key-files:
  created:
    - backend/utils/file_parser.py
    - backend/tests/test_file_parser.py
  modified:
    - requirements.txt
    - backend/api/report.py
    - frontend/src/services/api.ts
    - frontend/src/components/ReportBeta.tsx

key-decisions:
  - "PyMuPDF for PDF extraction (validated in Phase 9 research)"
  - "python-docx for DOCX extraction"
  - "10MB file size limit for instruction files"
  - "Warning for scanned/empty PDFs instead of error"

patterns-established:
  - "File upload pattern: dropzone UI -> FormData -> backend extraction -> editable textarea"

requirements-completed: [CTX-01]

duration: 8min
completed: 2026-03-25
---

# Phase 09 Plan 02: File Upload and Text Extraction Summary

**PDF/DOCX upload with PyMuPDF/python-docx extraction, drag-and-drop dropzone, and editable textarea on /report page**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25
- **Completed:** 2026-03-25
- **Tasks:** 3 (2 auto + 1 human checkpoint)
- **Files modified:** 6

## Accomplishments
- PDF text extraction via PyMuPDF and DOCX via python-docx
- Upload endpoint with validation (file type, size) and scanned PDF warning
- Drag-and-drop + click-to-browse dropzone with keyboard accessibility
- Editable textarea for reviewing/editing extracted text
- User approved visual flow on /report page

## Task Commits

1. **Task 1: File parser, endpoint, tests, API function** - `7d74c8f` (feat)
2. **Task 2: Upload dropzone and textarea UI** - `cb9b802` (feat)
3. **Task 3: Human verification checkpoint** - approved by user

## Files Created/Modified
- `backend/utils/file_parser.py` - extract_pdf_text() and extract_docx_text()
- `backend/api/report.py` - POST /api/report/upload-instructions endpoint
- `backend/tests/test_file_parser.py` - 8 unit tests
- `requirements.txt` - Added PyMuPDF and python-docx
- `frontend/src/services/api.ts` - uploadInstructionFile() function
- `frontend/src/components/ReportBeta.tsx` - Upload dropzone + textarea UI

## Decisions Made
- AirPlay Receiver blocks port 5000 on macOS — used port 5001 for local testing

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
- macOS AirPlay Receiver occupies port 5000; temporarily used port 5001 for testing

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extracted instruction text ready for Phase 10 AI report generation
- Upload UI integrates cleanly into existing /report page layout

---
*Phase: 09-report-data-contract-and-file-parsing*
*Completed: 2026-03-25*
