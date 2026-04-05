---
phase: quick
plan: 260405-nr2
subsystem: backend/frontend
tags: [fit-models, table-formatting, results]
key-files:
  created: []
  modified:
    - backend/prompts/report_system.py
    - backend/api/autolab.py
    - backend/api/fitting.py
    - frontend/src/components/AutoLab.tsx
decisions:
  - "Use unicode escape sequences for special chars in model_name strings"
  - "snake_case fallbacks use `or` chaining on dict.get() calls"
metrics:
  duration: "3min"
  completed: "2026-04-05"
---

# Quick Task 260405-nr2: Fix results table and add fractional/gaussian models

Results table builder fixed to use plus-minus sign, .3g chi-squared rounding, P-value threshold, and snake_case GOF fallbacks. Fractional and gaussian fit models added across all 4 files.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Fix build_results_table_html formatting | 2b8d094 | report_system.py: +/- to plus-minus, .3g chi2, < 0.001 pval, column headers, snake_case fallbacks |
| 2 | Add fractional + gaussian models | 9d40eef | autolab.py models dict + SYSTEM_PROMPT + tool desc, fitting.py elif chain, AutoLab.tsx dropdowns |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed additional +/- in rounded fallback (line 31)**
- **Found during:** Task 1
- **Issue:** Plan only mentioned line 32 for +/- fix, but line 31 also had `+/-` in the `rounded` default value
- **Fix:** Changed both occurrences using replace_all
- **Files modified:** backend/prompts/report_system.py
- **Commit:** 2b8d094

## Verification

- `build_results_table_html` produces table with plus-minus sign, no +/-, correct chi2 formatting, P-value threshold
- snake_case fallbacks work for `reduced_chi_squared` and `p_value` keys
- `tool_fit_data` succeeds for both `fractional` and `gaussian` models
- TypeScript changes are additive entries to existing Record/array literals (worktree lacks node_modules for tsc check)

## Known Stubs

None.
