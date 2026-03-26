---
phase: 10
slug: ai-content-generation-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend), vitest not configured — manual verification for frontend |
| **Config file** | `backend/tests/` directory (existing pytest setup) |
| **Quick run command** | `cd backend && python -m pytest tests/test_report_generate.py -v` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_report_generate.py -v`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | CTX-02 | unit | `pytest tests/test_report_generate.py::test_context_form_fields` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | CTX-03 | unit | `pytest tests/test_report_generate.py::test_follow_up_questions` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | RPT-01 | unit | `pytest tests/test_report_generate.py::test_theory_section` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | RPT-02 | unit | `pytest tests/test_report_generate.py::test_method_discussion_conclusions` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 1 | RPT-04 | unit | `pytest tests/test_report_generate.py::test_latex_katex_compatible` | ❌ W0 | ⬜ pending |
| 10-02-04 | 02 | 1 | RPT-05 | unit | `pytest tests/test_report_generate.py::test_parameter_values_in_sections` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | CTX-02 | manual | Browser: fill context form, verify data sent | N/A | ⬜ pending |
| 10-03-02 | 03 | 2 | CTX-03 | manual | Browser: verify follow-up questions appear inline | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_report_generate.py` — stubs for CTX-02, CTX-03, RPT-01, RPT-02, RPT-04, RPT-05
- [ ] Test fixtures for mock AutoLab results and context form data

*Existing pytest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Context form renders and submits | CTX-02 | Frontend UI interaction | Fill all fields, click Generate, verify payload in Network tab |
| Follow-up questions appear inline | CTX-03 | Frontend UI rendering | Trigger generation with minimal context, verify questions render as form fields |
| LaTeX renders in KaTeX preview | RPT-04 | Visual rendering check | Generate sections, verify equations render correctly in browser |
| Hebrew/English language toggle | D-01 | Locale-dependent rendering | Toggle language, generate, verify output language matches selection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
