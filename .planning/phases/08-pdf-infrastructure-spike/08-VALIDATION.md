---
phase: 8
slug: pdf-infrastructure-spike
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >=7.0.0 |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cd backend && python -m pytest tests/test_pdf_render.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_pdf_render.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | PDF-01 | integration | `cd backend && python -m pytest tests/test_pdf_render.py::test_generates_pdf_with_hebrew -x` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | PDF-01 | integration | `cd backend && python -m pytest tests/test_pdf_render.py::test_pdf_page_size -x` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | PDF-02 | unit | `cd backend && python -m pytest tests/test_pdf_render.py::test_katex_renders_all_expressions -x` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | PDF-02 | unit | `cd backend && python -m pytest tests/test_pdf_render.py::test_katex_html_structure -x` | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 1 | PDF-02 | integration | `cd backend && python -m pytest tests/test_pdf_render.py::test_weasyprint_no_katex_warnings -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_pdf_render.py` — stubs for PDF-01 and PDF-02 automated checks
- [ ] `backend/tests/conftest.py` — shared fixtures (skip if WeasyPrint system libs missing)
- [ ] Framework install: `pip install pytest weasyprint markdown-katex`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hebrew RTL text flows correctly right-to-left | PDF-01 | Visual layout correctness cannot be automated without pixel comparison | Open test PDF, verify Hebrew paragraph reads right-to-left |
| Inline math equations appear at correct position in Hebrew text | PDF-01 | Bidi placement requires visual verification | Verify math is inline within Hebrew sentence, not displaced |
| All 12 equation types render with correct math fonts | PDF-02 | Font rendering quality requires visual inspection | Open test PDF, compare each equation against reference |
| `\text{}` in math mode renders correctly near Hebrew | PDF-02 | Edge case per D-05, needs visual confirmation | Check units like "N/m" appear correctly within equations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
