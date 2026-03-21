---
phase: 01-security-hardening
plan: 02
subsystem: api
tags: [security, eval-removal, ode, integration, safe-eval, sympy, flask]

# Dependency graph
requires:
  - phase: 01-security-hardening/plan-01
    provides: safe_eval module (safe_build_ode_func, safe_build_1d_func, safe_build_multi_func, safe_build_condition_func)
provides:
  - ODE endpoint using safe expression parsing (zero eval calls)
  - Integration endpoint using safe expression parsing (zero eval calls)
  - Endpoint-level integration tests (16 tests)
affects: [04-ai-ode, 05-ai-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [safe_eval import pattern for Flask blueprints, ValueError catch for input validation]

key-files:
  created: [backend/tests/test_endpoints.py]
  modified: [backend/api/ode.py, backend/api/integrate.py]

key-decisions:
  - "Reuse safe_build_ode_func for energy expressions (same t,y variable space) with [0] scalar extraction"
  - "Monte Carlo integration wraps safe_build_multi_func with sample unpacking lambda"

patterns-established:
  - "safe_eval import: all Flask blueprints using user math expressions must import from utils.safe_eval"
  - "ValueError catch pattern: except ValueError for validation errors (400), except Exception for parse errors (400)"

requirements-completed: [SEC-01, SEC-02]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 01 Plan 02: Eval Replacement Summary

**Replaced all 6 eval() calls in ODE and Integration endpoints with safe_eval functions, verified by 16 endpoint integration tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T13:26:11Z
- **Completed:** 2026-03-21T13:29:22Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Eliminated all eval() calls from backend/api/ode.py (2 calls: ODE function + energy expression)
- Eliminated all eval() calls from backend/api/integrate.py (4 calls: 1D, nquad, Monte Carlo function, Monte Carlo condition)
- Added 16 endpoint integration tests covering both correctness and security rejection
- Full test suite passes: 40 tests (24 safe_eval unit + 16 endpoint integration)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace eval() in ode.py** - `315963f` (fix)
2. **Task 2: Replace eval() in integrate.py** - `2022e0c` (fix)
3. **Task 3: Add endpoint integration tests** - `f3bc04a` (test)

## Files Created/Modified
- `backend/api/ode.py` - Replaced _SAFE_NS dict and _build_ode_func with safe_build_ode_func import; energy expression also safe
- `backend/api/integrate.py` - Replaced 4 eval() calls with safe_build_1d_func, safe_build_multi_func, safe_build_condition_func
- `backend/tests/test_endpoints.py` - 16 Flask test client tests: 8 ODE (pendulum, Lorenz, harmonic oscillator, energy, 4 malicious), 8 Integration (polynomial, trig, exponential, 2D, 4 malicious)

## Decisions Made
- Used safe_build_ode_func for energy expressions since they share the same t,y variable namespace; extract scalar via [0] index
- Monte Carlo integration wraps safe_build_multi_func result with a lambda for sample array unpacking rather than creating a new safe_eval function

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired.

## Next Phase Readiness
- SEC-01 and SEC-02 are complete: zero eval() calls remain in ODE and Integration endpoints
- Phase 01 (security hardening) is fully complete
- Ready for Phase 02 (theme/UI work) or any subsequent phases

## Self-Check: PASSED

All 3 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 01-security-hardening*
*Completed: 2026-03-21*
