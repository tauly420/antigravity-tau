---
phase: 01-security-hardening
verified: 2026-03-21T14:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 1: Security Hardening Verification Report

**Phase Goal:** User-supplied mathematical expressions are evaluated safely without arbitrary code execution
**Verified:** 2026-03-21T14:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

The phase ROADMAP defines 4 Success Criteria. Plans 01-01 and 01-02 add 11 combined truths. All are assessed below using the ROADMAP criteria as the primary contract.

| #  | Truth                                                                                             | Status     | Evidence                                                                              |
|----|---------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------|
| 1  | ODE solver accepts same mathematical expressions (sin, cos, exp, etc.) and produces correct results | ✓ VERIFIED | 8 ODE preset tests pass: pendulum, damped oscillator, Lorenz, Lotka-Volterra, orbit, drag, Van der Pol, double pendulum |
| 2  | Integration solver accepts same expressions and produces correct results                          | ✓ VERIFIED | Endpoint tests: polynomial (0.333), trig sin(x) (2.0), exponential, 2D nquad (0.667) all pass |
| 3  | Malicious input is rejected with clear error instead of executing                                 | ✓ VERIFIED | 8 rejection tests pass (dunder, import, eval, exec, open, os — all return 400 or ValueError) |
| 4  | All existing example problems on ODE and Integration pages still work correctly                   | ✓ VERIFIED | 8 ODE preset expressions tested end-to-end via safe_build_ode_func + solve_ivp; Integration quad/nquad/Monte Carlo all produce correct results |
| 5  | Mathematical expressions parse and evaluate to correct numerical results                          | ✓ VERIFIED | 24 unit tests in test_safe_eval.py all pass; validated by running suite |
| 6  | ODE system expressions with y[0], y[1] indexing parse into callable f(t, y) -> np.array          | ✓ VERIFIED | IndexedBase('y') with symbol substitution before lambdify; all ODE tests pass |
| 7  | Integration expressions with x, y, z variables parse into callable functions                     | ✓ VERIFIED | safe_build_1d_func, safe_build_multi_func, safe_build_condition_func all tested |
| 8  | Malicious input is rejected with ValueError BEFORE reaching sympify                               | ✓ VERIFIED | _FORBIDDEN_PATTERNS + _ALLOWED_CHARS regex checks run before sympify call |
| 9  | Energy expression in ODE endpoint also uses safe parsing (not eval)                               | ✓ VERIFIED | ode.py uses safe_build_ode_func(energy_expr_str, num_components); energy rejection test passes |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact                             | Expected                                      | Status     | Details                                                                   |
|--------------------------------------|-----------------------------------------------|------------|---------------------------------------------------------------------------|
| `backend/utils/safe_eval.py`         | Safe expression validation and parsing module | ✓ VERIFIED | 165 lines; exports all 5 required functions; no eval() calls in code      |
| `backend/tests/test_safe_eval.py`    | Unit tests for all safe_eval functions        | ✓ VERIFIED | 191 lines; 24 tests covering security, ODE, integration, conditions       |
| `backend/api/ode.py`                 | ODE solver with safe expression evaluation    | ✓ VERIFIED | Imports safe_build_ode_func; no eval(); no _SAFE_NS; no _build_ode_func   |
| `backend/api/integrate.py`           | Integration solver with safe expression eval  | ✓ VERIFIED | Imports safe_build_1d_func, safe_build_multi_func, safe_build_condition_func; no eval() |
| `backend/tests/test_endpoints.py`    | Endpoint-level integration tests              | ✓ VERIFIED | 236 lines; 16 tests covering both correctness and security rejection       |
| `backend/tests/__init__.py`          | Test package init                             | ✓ VERIFIED | Exists (empty file, correct)                                              |

### Key Link Verification

| From                        | To                        | Via                                    | Status     | Details                                                                |
|-----------------------------|---------------------------|----------------------------------------|------------|------------------------------------------------------------------------|
| `backend/utils/safe_eval.py` | sympy                    | sympify + lambdify                     | ✓ WIRED    | `sympify(validated, locals=local_dict)` and `lambdify(..., modules='numpy')` both present |
| `backend/utils/safe_eval.py` | numpy                    | lambdify modules parameter             | ✓ WIRED    | All lambdify calls use `modules='numpy'`                               |
| `backend/api/ode.py`        | `backend/utils/safe_eval.py` | `from utils.safe_eval import safe_build_ode_func` | ✓ WIRED | Import present on line 10; safe_build_ode_func called in solve() and energy branch |
| `backend/api/integrate.py`  | `backend/utils/safe_eval.py` | `from utils.safe_eval import safe_build_1d_func, safe_build_multi_func, safe_build_condition_func` | ✓ WIRED | Import present on line 9; all three functions called at their respective eval sites |
| `backend/api/ode.py`        | `scipy.integrate.solve_ivp` | safe_build_ode_func result passed to solve_ivp | ✓ WIRED | `solve_ivp(f, t_span, y0, ...)` where f is returned by safe_build_ode_func |

### Requirements Coverage

| Requirement | Source Plans   | Description                                                         | Status      | Evidence                                                                 |
|-------------|----------------|---------------------------------------------------------------------|-------------|--------------------------------------------------------------------------|
| SEC-01      | 01-01, 01-02   | ODE solver input evaluated safely via sympify+lambdify instead of eval() | ✓ SATISFIED | ode.py: zero eval() calls; safe_build_ode_func imported and used; 8 ODE tests + 8 endpoint tests pass |
| SEC-02      | 01-01, 01-02   | Integration solver input evaluated safely via sympify+lambdify instead of eval() | ✓ SATISFIED | integrate.py: zero eval() calls at all 4 former eval sites; 3 safe_eval functions imported; 8 integration endpoint tests pass |

No orphaned requirements — REQUIREMENTS.md maps only SEC-01 and SEC-02 to Phase 1, both claimed by plans and both satisfied.

### Anti-Patterns Found

Grep for `eval(` in backend/api/ode.py and backend/api/integrate.py returns zero matches.

Grep for `eval(` in backend/utils/safe_eval.py returns two matches — both are in docstring/comment text explaining the security model, not executable code calls.

| File                              | Line | Pattern  | Severity | Impact |
|-----------------------------------|------|----------|----------|--------|
| `backend/utils/safe_eval.py` L4   | 4    | `eval()` in docstring comment | Info | Non-executable; explains why Layer 1 validation is needed |
| `backend/utils/safe_eval.py` L12  | 12   | `eval()` in WARNING comment   | Info | Non-executable; documents sympify internals |

No stub patterns found. No TODO/FIXME/placeholder comments. No empty implementations. No hardcoded empty data flowing to output.

### Human Verification Required

None. All automated checks pass. The security model (regex pre-validation before sympify) is testable programmatically and the test suite verifies both correctness and rejection. No visual, real-time, or external service behavior involved.

### Gaps Summary

No gaps. All must-haves are verified at all three levels (exists, substantive, wired). The full test suite of 40 tests passes (24 unit tests + 16 endpoint integration tests). Zero eval() calls remain in either API endpoint. Both SEC-01 and SEC-02 are satisfied with evidence.

---

## Test Run Evidence

Full pytest run: **40 passed in ~2s**

Tests cover:
- Security rejection: 10 unit tests (dunder, import, eval, exec, open, os, empty, disallowed chars, accept math, accept array indexing)
- ODE correctness: 8 unit tests (all 8 ODESolver.tsx presets: pendulum, damped oscillator, Lotka-Volterra, Lorenz, 4-component orbit, projectile drag, Van der Pol, double pendulum)
- Integration correctness: 6 unit tests (1D polynomial, trig, exponential; multi 2D, 3D; condition circle)
- ODE endpoint: 8 integration tests (pendulum, Lorenz, harmonic oscillator, 3 malicious rejections, energy safe, energy rejection)
- Integration endpoint: 8 integration tests (polynomial, trig, exponential, 5 rejections/malicious, multi 2D, multi rejections)

---

_Verified: 2026-03-21T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
