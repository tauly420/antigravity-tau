# Roadmap: Tau-LY

## Overview

This milestone transforms Tau-LY from a functional but visually rough tool into a polished dark-themed science dashboard. The work begins with critical security fixes (removing eval() from solver backends), then builds a CSS custom property token system, migrates ~413 inline styles across 16 components in four focused batches, and finishes with FOUC-free theme toggling. Plotly charts keep their current white-background styling as the user prefers this format. Every phase after security inherits from the token system, so each migration batch immediately renders in dark mode.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security Hardening** - Replace eval() with sympify+lambdify in ODE and Integration backends
- [ ] **Phase 2: Theme Token System** - Create CSS custom property architecture with dark/light token sets
- [ ] **Phase 3: Style Migration - Core Layout** - Migrate inline styles in App, Home, Sidebar, Workflow
- [ ] **Phase 4: Style Migration - Analysis Tools** - Migrate inline styles in AutoLab, GraphFitting, FormulaCalculator, NSigmaCalculator, DataPreview
- [ ] **Phase 5: Style Migration - Math and Science Tools** - Migrate inline styles in StatisticsCalculator, ConstantsReference, FourierAnalysis, MatrixCalculator
- [ ] **Phase 6: Style Migration - Solver Tools** - Migrate inline styles in ODESolver, NumericalIntegrator, UnitConverter
- [ ] **Phase 7: Theme Toggle and Polish** - FOUC-free theme switching with persistent preference

## Phase Details

### Phase 1: Security Hardening
**Goal**: User-supplied mathematical expressions are evaluated safely without arbitrary code execution
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. ODE solver accepts the same mathematical expressions as before (sin, cos, exp, etc.) and produces identical numerical results
  2. Integration solver accepts the same mathematical expressions as before and produces identical numerical results
  3. Malicious input (e.g., `__import__('os').system('rm -rf /')`) is rejected with a clear error message instead of executing
  4. All existing example problems on ODE and Integration pages still work correctly
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Safe expression evaluation module (TDD: tests + safe_eval.py with validate, ODE, integration builders)
- [ ] 01-02-PLAN.md — Replace eval() in ODE and Integration endpoints with safe_eval functions + endpoint tests

### Phase 2: Theme Token System
**Goal**: App has a complete CSS custom property architecture that enables dark/light theming across all components
**Depends on**: Phase 1
**Requirements**: THEME-01
**Success Criteria** (what must be TRUE):
  1. A root-level CSS file defines custom properties for all color categories (backgrounds, text, borders, accents, surfaces, shadows)
  2. Dark and light token sets exist via `[data-theme="dark"]` and `[data-theme="light"]` selectors
  3. The App root element applies the dark theme by default and all existing hardcoded colors in CSS files use the new tokens
  4. A documented token naming convention exists (e.g., `--color-bg-primary`, `--color-text-primary`) that subsequent phases follow
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Style Migration - Core Layout
**Goal**: Core layout components use CSS variables instead of inline styles, rendering correctly in dark theme
**Depends on**: Phase 2
**Requirements**: THEME-02 (partial: App, Home, Sidebar, Workflow -- ~108 inline styles)
**Success Criteria** (what must be TRUE):
  1. App.tsx, Home.tsx, Sidebar.tsx, and Workflow.tsx have zero inline `style={{}}` declarations that set colors, backgrounds, or borders
  2. The app shell (header, sidebar, main content area) renders with correct dark theme colors
  3. Navigation between tools works visually -- active/hover states use theme tokens
  4. Workflow component displays all step indicators and status colors using theme variables
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Style Migration - Analysis Tools
**Goal**: Primary analysis components use CSS variables instead of inline styles, rendering correctly in dark theme
**Depends on**: Phase 3
**Requirements**: THEME-02 (partial: AutoLab, GraphFitting, FormulaCalculator, NSigmaCalculator, DataPreview -- ~145 inline styles)
**Success Criteria** (what must be TRUE):
  1. AutoLab.tsx, GraphFitting.tsx, FormulaCalculator.tsx, NSigmaCalculator.tsx, and DataPreview.tsx have zero inline `style={{}}` declarations that set colors, backgrounds, or borders
  2. AutoLab results display (summary box, parameter tables, n-sigma indicators) uses theme tokens and is readable in dark mode
  3. Graph fitting controls and result displays render correctly in dark theme
  4. N-sigma color coding (green/orange/red) remains visually distinct against dark backgrounds
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Style Migration - Math and Science Tools
**Goal**: Math and science tool components use CSS variables instead of inline styles, rendering correctly in dark theme
**Depends on**: Phase 3
**Requirements**: THEME-02 (partial: StatisticsCalculator, ConstantsReference, FourierAnalysis, MatrixCalculator -- ~143 inline styles)
**Success Criteria** (what must be TRUE):
  1. StatisticsCalculator.tsx, ConstantsReference.tsx, FourierAnalysis.tsx, and MatrixCalculator.tsx have zero inline `style={{}}` declarations that set colors, backgrounds, or borders
  2. Statistical result tables and distribution displays are readable in dark mode
  3. Constants reference cards/tables render with proper contrast in dark theme
  4. Matrix input grids and result displays use theme tokens
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Style Migration - Solver Tools
**Goal**: Solver tool components use CSS variables instead of inline styles, rendering correctly in dark theme
**Depends on**: Phase 3
**Requirements**: THEME-02 (partial: ODESolver, NumericalIntegrator, UnitConverter -- ~50 inline styles)
**Success Criteria** (what must be TRUE):
  1. ODESolver.tsx, NumericalIntegrator.tsx, and UnitConverter.tsx have zero inline `style={{}}` declarations that set colors, backgrounds, or borders
  2. ODE solver equation input, method selection, and solution display are readable in dark mode
  3. Integration calculator input and result areas render with proper contrast
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Theme Toggle and Polish
**Goal**: Users can switch between dark and light themes without visual glitches
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6
**Requirements**: THEME-04
**Success Criteria** (what must be TRUE):
  1. A visible theme toggle control exists in the app UI (header or settings area)
  2. Switching themes applies instantly to all styled components without page reload
  3. Theme preference persists across browser sessions (localStorage)
  4. No flash of unstyled content (FOUC) on initial page load -- the correct theme renders before first paint
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
Note: Phases 4, 5, 6 can run in parallel after Phase 3.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 0/2 | Planning complete | - |
| 2. Theme Token System | 0/TBD | Not started | - |
| 3. Style Migration - Core Layout | 0/TBD | Not started | - |
| 4. Style Migration - Analysis Tools | 0/TBD | Not started | - |
| 5. Style Migration - Math and Science Tools | 0/TBD | Not started | - |
| 6. Style Migration - Solver Tools | 0/TBD | Not started | - |
| 7. Theme Toggle and Polish | 0/TBD | Not started | - |
