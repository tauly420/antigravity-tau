---
phase: 15-autolab-fixes-and-polish
plan: 02
subsystem: ui
tags: [css, buttons, react, styling]

# Dependency graph
requires:
  - phase: 13-ui-overhaul
    provides: global.css button classes (btn-primary, btn-secondary, btn-accent)
provides:
  - Standardized button styling across all 9 tool pages
  - New .btn-sm CSS size modifier class
affects: [any future component that adds buttons]

# Tech tracking
tech-stack:
  added: []
  patterns: [btn-primary/btn-secondary/btn-accent for all buttons, btn-sm for compact buttons, conditional className for toggle states]

key-files:
  created: []
  modified:
    - frontend/src/styles/global.css
    - frontend/src/components/MatrixCalculator.tsx
    - frontend/src/components/FormulaCalculator.tsx
    - frontend/src/components/NSigmaCalculator.tsx
    - frontend/src/components/NumericalIntegrator.tsx
    - frontend/src/components/UnitConverter.tsx
    - frontend/src/components/GraphFitting.tsx
    - frontend/src/components/StatisticsCalculator.tsx
    - frontend/src/components/FourierAnalysis.tsx
    - frontend/src/components/Workflow.tsx

key-decisions:
  - "btn-primary added explicitly even where base button selector already provides gradient -- makes intent clear and future-proof"
  - "Toggle buttons use conditional className (btn-primary vs btn-secondary) instead of inline style switching"
  - "Sidebar.tsx intentionally excluded -- uses different button styles for chat UI context"

patterns-established:
  - "All action buttons use btn-primary class"
  - "All toggle/category buttons use conditional btn-primary (active) / btn-secondary (inactive)"
  - "Small buttons use btn-sm modifier alongside btn-primary or btn-secondary"
  - "Layout-only inline styles (marginTop, flex, width) are kept; styling props (background, color, border) are removed"

requirements-completed: [FIX-02]

# Metrics
duration: 6min
completed: 2026-04-04
---

# Phase 15 Plan 02: Standardize Button Styling Summary

**Added .btn-sm CSS class and replaced all non-standard button classes and inline button styles across 9 component pages with standard btn-primary/btn-secondary/btn-accent classes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-04T07:57:55Z
- **Completed:** 2026-04-04T08:04:13Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added `.btn-sm` size modifier class to global.css for compact button sizing
- Eliminated all non-standard button class names (primary-btn, small-btn) from codebase
- Replaced hardcoded inline background/color styles on buttons with standard CSS classes across UnitConverter, StatisticsCalculator, Workflow
- Standardized toggle/category buttons to use conditional btn-primary/btn-secondary className pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add btn-sm and fix MatrixCalculator, FormulaCalculator, NSigmaCalculator, NumericalIntegrator** - `76bed65` (fix)
2. **Task 2: Fix UnitConverter, GraphFitting, StatisticsCalculator, FourierAnalysis, Workflow** - pending commit

## Files Created/Modified
- `frontend/src/styles/global.css` - Added .btn-sm size modifier class
- `frontend/src/components/MatrixCalculator.tsx` - Replaced primary-btn with btn-primary, small-btn with btn-secondary btn-sm
- `frontend/src/components/FormulaCalculator.tsx` - Added btn-primary to Evaluate button
- `frontend/src/components/NSigmaCalculator.tsx` - Added btn-primary to Calculate button
- `frontend/src/components/NumericalIntegrator.tsx` - Added btn-primary to Integrate button
- `frontend/src/components/UnitConverter.tsx` - Replaced inline white/color styles with btn-primary/btn-secondary btn-sm on category toggles
- `frontend/src/components/GraphFitting.tsx` - Added btn-primary to Fit button
- `frontend/src/components/StatisticsCalculator.tsx` - Replaced all inline-styled buttons with btn-primary/btn-secondary/btn-accent/btn-sm classes
- `frontend/src/components/FourierAnalysis.tsx` - Replaced inline fontSize/padding with btn-sm class
- `frontend/src/components/Workflow.tsx` - Replaced hardcoded language toggle styles with btn-primary/btn-secondary btn-sm

## Decisions Made
- Added btn-primary explicitly to buttons that already get primary gradient from base selector -- makes intent clear and prevents regressions if base selector changes
- Used btn-accent for "Try Example" in StatisticsCalculator to differentiate secondary actions
- Kept layout-only inline styles (marginTop, flex, width) while removing all styling properties (background, color, border, fontSize, padding)
- Sidebar.tsx was intentionally NOT modified per Research Pitfall 5

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all button classes are wired to existing CSS definitions in global.css.

## Next Phase Readiness
- All button styling is now consistent across all pages
- Any new pages/components should follow the established pattern: btn-primary for actions, btn-secondary for inactive toggles, btn-accent for secondary actions, btn-sm for compact sizing

---
*Phase: 15-autolab-fixes-and-polish*
*Completed: 2026-04-04*
