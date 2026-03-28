---
phase: 11
slug: preview-editing-and-pdf-assembly
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend integration tests) |
| **Config file** | backend/tests/conftest.py |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | UI-01 | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_title_page_in_pdf -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | UI-02 | manual | Visual inspection of accordion expand with KaTeX | N/A | ⬜ pending |
| 11-01-03 | 01 | 1 | UI-03 | manual | Visual inspection of side-by-side editor | N/A | ⬜ pending |
| 11-02-01 | 02 | 1 | D-04 | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_israeli_template -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | D-05 | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_all_templates -x` | ❌ W0 | ⬜ pending |
| 11-02-03 | 02 | 2 | D-07 | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_plot_embedding -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_pdf_export.py` — stubs for UI-01, D-04, D-05, D-07
- [ ] Test fixtures: sample section content with LaTeX, sample base64 plot image, sample title page data
- [ ] Existing `test_pdf_render.py` and `test_report_generate.py` cover Phase 8/10 — no changes needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KaTeX live preview renders correctly in accordion | UI-02 | Visual rendering quality cannot be automated | Expand a section accordion, verify LaTeX equations render as formatted math |
| Side-by-side editor with live KaTeX preview | UI-03 | Interactive UI behavior requiring visual check | Click Edit on a section, type LaTeX, verify preview updates within 300ms |
| AI Generated badge clears on edit | UI-03 | DOM state change tied to user interaction | Open editor, verify badge visible, type a character, verify badge disappears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
