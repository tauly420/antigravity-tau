---
phase: 02-theme-token-system
plan: 02
subsystem: ui
tags: [css, custom-properties, dark-theme, theming, var-references]

# Dependency graph
requires:
  - "02-01: Complete CSS custom property token architecture with :root and [data-theme='dark'] blocks"
provides:
  - "All CSS component rules use var() token references instead of hardcoded hex/rgba values"
  - "App.tsx renders with data-theme='dark' on both html element and app-container div"
  - "Dark theme active by default with scientific instrument aesthetic"
affects: [03-core-component-migration, 04-analysis-component-migration, 05-interactive-component-migration, 06-layout-component-migration, 07-theme-toggle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "var() token references in all CSS component rules -- zero hardcoded colors"
    - "Dual data-theme attribute: useEffect on documentElement + attribute on app-container div"

key-files:
  created: []
  modified:
    - "frontend/src/styles/global.css"
    - "frontend/src/App.tsx"

key-decisions:
  - "Used dual data-theme approach (html element via useEffect + app-container div) to prevent body background bleed"
  - "Kept theme-invariant values as-is: header icon black drop-shadow, white header text"
  - "Reused tokens across multiple selectors (e.g., --success-bg for result boxes, stepper done state, and prefilled banner)"

patterns-established:
  - "All new CSS rules must use var(--token) references, never hardcoded colors"
  - "Theme-invariant values (black shadows, white-on-dark-bg text) may remain hardcoded with comment justification"

requirements-completed: [THEME-01]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 02 Plan 02: Hardcoded Color Replacement + Dark Theme Activation Summary

**All ~40 hardcoded hex/rgba colors in global.css component rules replaced with var() token references, dark theme wired as default via data-theme="dark" on html and app-container**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T18:13:14Z
- **Completed:** 2026-03-21T18:15:07Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- Replaced all ~40 hardcoded color values (hex, rgba) in CSS component rules with var() references to design tokens
- Wired dark theme as default in App.tsx with dual approach: useEffect sets data-theme on html element + data-theme attribute on app-container div
- TypeScript compiles cleanly with zero errors after changes
- var() usage count in global.css: 134 (tokens defined + references)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace all hardcoded colors in global.css with var() token references** - `e950ca2` (feat)
2. **Task 2: Wire dark theme default in App.tsx** - `86dab46` (feat)
3. **Task 3: Visual verification of dark theme** - checkpoint (awaiting human verification)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `frontend/src/styles/global.css` - All component CSS rules now use var() token references; header gradient, nav hover, input focus, button shadows, result boxes, stepper states, AI popup, sidebar, footer all tokenized
- `frontend/src/App.tsx` - Added useEffect for document.documentElement data-theme, added data-theme="dark" on app-container div, imported useEffect

## Decisions Made
- Used dual data-theme approach (html + div) per research doc Pitfall 3 recommendation to prevent body background bleed
- Kept header icon drop-shadow `rgba(0, 0, 0, 0.3)` as hardcoded -- theme-invariant black shadow
- Kept `color: white` on header text as hardcoded -- always white on red gradient
- Reused --primary-shadow for stepper active and workflow number active shadows (same visual intent)
- Used --overlay-subtle for sidebar panel shadow (semantically appropriate for subtle overlay effect)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all token references resolve to fully defined values in both light and dark theme sets.

## Next Phase Readiness
- CSS token architecture complete: all class-based styles use var() references
- Dark theme renders by default
- Ready for Phase 3-6 inline style migration (413 inline style declarations across 16 .tsx files)
- Awaiting human visual verification (Task 3 checkpoint) before marking phase complete

---
*Phase: 02-theme-token-system*
*Completed: 2026-03-21*
