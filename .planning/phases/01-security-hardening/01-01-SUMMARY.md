---
phase: 01-security-hardening
plan: 01
subsystem: testing
tags: [sympy, numpy, security, eval-replacement, safe-parsing, pytest, tdd]

# Dependency graph
requires: []
provides:
  - "safe_eval.py module with validate_math_input, safe_build_ode_func, safe_build_1d_func, safe_build_multi_func, safe_build_condition_func"
  - "Test suite for safe expression evaluation (24 tests)"
  - "pytest test infrastructure in backend/tests/"
affects: [01-security-hardening]

# Tech tracking
tech-stack:
  added: [pytest]
  patterns: [regex-validation-before-sympify, IndexedBase-for-array-indexing, symbol-substitution-for-lambdify]

key-files:
  created:
    - backend/utils/safe_eval.py
    - backend/tests/__init__.py
    - backend/tests/test_safe_eval.py
  modified:
    - requirements.txt

key-decisions:
  - "Two-layer validation: regex forbidden patterns + allowed chars BEFORE sympify to prevent RCE"
  - "IndexedBase('y') for ODE array indexing with symbol substitution before lambdify"
  - "Separate validation function for condition expressions (allows < > = ! characters)"

patterns-established:
  - "TDD workflow: RED (failing tests) -> GREEN (implementation) for security-critical code"
  - "Input validation pattern: _FORBIDDEN_PATTERNS blacklist + _ALLOWED_CHARS whitelist"
  - "sympify + lambdify pattern: validate -> sympify(expr, locals=local_dict) -> lambdify(syms, parsed, modules='numpy')"

requirements-completed: [SEC-01, SEC-02]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 01 Plan 01: Safe Expression Evaluation Summary

**Safe math parsing module (sympify+lambdify) with regex pre-validation, replacing eval() for ODE/Integration backends -- 24 tests covering all 8 ODE presets and security rejection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T13:21:00Z
- **Completed:** 2026-03-21T13:23:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created safe_eval.py with 5 public functions for secure math expression parsing
- Regex-based input validation blocks RCE vectors (dunder, import, eval, exec, os, sys, etc.)
- All 8 ODE presets from ODESolver.tsx parse and evaluate correctly through safe parsing
- 24 unit tests covering security rejection, ODE functions, integration functions, and conditions

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up test infrastructure and write failing tests** - `1b96599` (test)
2. **Task 2: Implement safe_eval.py to make all tests pass** - `ff389aa` (feat)

_TDD: Task 1 = RED phase, Task 2 = GREEN phase_

## Files Created/Modified
- `backend/utils/safe_eval.py` - Safe expression validation and parsing (5 public functions)
- `backend/tests/__init__.py` - Test package init
- `backend/tests/test_safe_eval.py` - 24 unit tests for safe_eval
- `requirements.txt` - Added pytest>=7.0.0

## Decisions Made
- Two-layer security (regex + sympify) because sympify alone calls eval() internally
- IndexedBase for ODE y[i] indexing, substituted to plain symbols before lambdify
- Separate _validate_math_input_with_comparisons for condition expressions needing < > = !

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- No .venv existed; created virtual environment and installed all dependencies (Rule 3 - blocking, resolved inline)

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functions are fully implemented and tested.

## Next Phase Readiness
- safe_eval.py ready for Plan 02 to import into ode.py and integrate.py
- All 5 public functions exported and tested
- pytest infrastructure ready for additional test files

## Self-Check: PASSED

- FOUND: backend/utils/safe_eval.py
- FOUND: backend/tests/__init__.py
- FOUND: backend/tests/test_safe_eval.py
- FOUND: commit 1b96599
- FOUND: commit ff389aa

---
*Phase: 01-security-hardening*
*Completed: 2026-03-21*
