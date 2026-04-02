---
phase: 14
slug: report-and-autolab-merge-unified-page-for-full-report-or-analysis-only-mode-plus-fix-pdf-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) |
| **Config file** | None — pytest defaults |
| **Quick run command** | `cd backend && python -m pytest tests/ -x --tb=short` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x --tb=short`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | D-07 | integration | `cd backend && python -m pytest tests/test_pdf_render.py -x` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | D-09 | integration | `cd backend && python -m pytest tests/test_results_pdf.py -x` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | D-10 | manual | `grep -r "jspdf\|jsPDF" frontend/src/` returns nothing | N/A | ⬜ pending |
| 14-02-02 | 02 | 1 | D-02 | manual | `grep -r "'/report'" frontend/src/` returns nothing | N/A | ⬜ pending |
| 14-03-01 | 03 | 2 | D-01 | manual | Visual inspection of progressive flow | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_results_pdf.py` — stubs for results-only PDF endpoint (D-09)
- [ ] Update `tests/test_pdf_export.py` if current tests reference old endpoint shapes

*Existing infrastructure covers most phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progressive flow renders correctly | D-01 | Visual UI layout | Load /autolab, run analysis, verify report section appears below results |
| Expand/collapse transition | D-03 | Visual animation | Click "Generate Full Lab Report" button, verify smooth expand |
| Context form pre-fill | D-04 | Visual + data check | Run analysis, expand report, verify experiment title pre-filled |
| PDF output quality | D-08 | Visual quality | Export PDF, check formatting, fonts, layout, math rendering |
| Free Fall demo end-to-end | D-12 | Full user flow | Load Free Fall example, run analysis, generate report, export PDF |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
