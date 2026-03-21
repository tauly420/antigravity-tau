---
phase: 1
slug: security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
test_names_aligned: true
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (needs install — not in requirements.txt currently) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cd backend && python -m pytest tests/test_safe_eval.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_safe_eval.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-00-01 | 00 | 0 | SEC-01, SEC-02 | setup | `pip install pytest` | -- W0 | pending |
| 01-00-02 | 00 | 0 | SEC-01 | unit | `python -m pytest tests/test_safe_eval.py::test_simple_pendulum tests/test_safe_eval.py::test_damped_oscillator tests/test_safe_eval.py::test_lotka_volterra tests/test_safe_eval.py::test_lorenz tests/test_safe_eval.py::test_4component_orbit tests/test_safe_eval.py::test_projectile_drag tests/test_safe_eval.py::test_van_der_pol tests/test_safe_eval.py::test_double_pendulum -x` | -- W0 | pending |
| 01-00-03 | 00 | 0 | SEC-01 | unit | `python -m pytest tests/test_safe_eval.py::test_rejects_dunder_access tests/test_safe_eval.py::test_rejects_import tests/test_safe_eval.py::test_rejects_eval tests/test_safe_eval.py::test_rejects_exec tests/test_safe_eval.py::test_rejects_open tests/test_safe_eval.py::test_rejects_os -x` | -- W0 | pending |
| 01-00-04 | 00 | 0 | SEC-01 | unit | `python -m pytest tests/test_safe_eval.py::test_accepts_math_expr tests/test_safe_eval.py::test_accepts_array_indexing -x` | -- W0 | pending |
| 01-00-05 | 00 | 0 | SEC-02 | unit | `python -m pytest tests/test_safe_eval.py::test_1d_polynomial tests/test_safe_eval.py::test_1d_trig tests/test_safe_eval.py::test_1d_exponential -x` | -- W0 | pending |
| 01-00-06 | 00 | 0 | SEC-02 | unit | `python -m pytest tests/test_safe_eval.py::test_multi_2d tests/test_safe_eval.py::test_multi_3d -x` | -- W0 | pending |
| 01-00-07 | 00 | 0 | SEC-02 | unit | `python -m pytest tests/test_safe_eval.py::test_rejects_empty tests/test_safe_eval.py::test_rejects_disallowed_chars -x` | -- W0 | pending |
| 01-00-08 | 00 | 0 | SEC-02 | unit | `python -m pytest tests/test_safe_eval.py::test_condition_circle -x` | -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_safe_eval.py` — stubs for SEC-01 and SEC-02 (safe parsing + malicious rejection)
- [ ] `backend/tests/conftest.py` — Flask test client fixture if integration tests needed
- [ ] pytest install: `pip install pytest` and add to `requirements.txt`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing ODE example pages render correctly | SEC-01 | Visual verification of plots | Load each ODE preset in browser, verify solution plot matches expected shape |
| Existing integration example pages render correctly | SEC-02 | Visual verification of results | Run example integrations in browser, verify numerical results match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
