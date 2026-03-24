---
phase: 9
slug: report-data-contract-and-file-parsing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / manual verification (frontend) |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | RPT-03 | unit | `python -m pytest tests/test_normalization.py` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | RPT-03 | unit | `python -m pytest tests/test_normalization.py` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | CTX-01 | unit | `python -m pytest tests/test_file_parsing.py` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 1 | CTX-01 | integration | `python -m pytest tests/test_file_parsing.py` | ❌ W0 | ⬜ pending |
| 09-02-03 | 02 | 1 | CTX-01 | manual | N/A (UI upload flow) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_normalization.py` — stubs for RPT-03 (ReportAnalysisData normalization)
- [ ] `backend/tests/test_file_parsing.py` — stubs for CTX-01 (PDF/DOCX text extraction)
- [ ] `backend/tests/conftest.py` — shared fixtures (sample AutoLab results, test PDF/DOCX files)

*Existing infrastructure may partially cover; create stubs as needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop upload works | CTX-01 | Browser drag-drop API not testable in pytest | Upload a PDF via drag-drop on /report page, verify text appears in textarea |
| Scanned PDF warning shown | CTX-01 | Requires visual verification of warning UI | Upload a scanned/image PDF, verify "No text found" warning appears |
| Extracted text is editable | CTX-01 | Requires UI interaction testing | Upload a DOCX, edit text in textarea, verify changes persist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
