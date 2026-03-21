# Requirements: Tau-LY

**Defined:** 2026-03-20
**Core Value:** AutoLab -- upload a data file, describe what you want in plain language, and get a complete physics analysis with minimal friction.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Security

- [x] **SEC-01**: User input in ODE solver is evaluated safely via sympify+lambdify instead of eval()
- [x] **SEC-02**: User input in Integration solver is evaluated safely via sympify+lambdify instead of eval()

### Theme

- [x] **THEME-01**: App has a dark science dashboard theme using CSS custom properties
- [ ] **THEME-02**: All inline style declarations (~420) are migrated to CSS variable references
- [ ] **THEME-04**: Theme toggle does not cause flash of unstyled content (FOUC)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Navigation

- **NAV-01**: Top tab bar replaces current tool switching mechanism
- **NAV-02**: Tool discovery is intuitive with clear labels and grouping

### AutoLab UX

- **ALAB-01**: AutoLab results layout reduces vertical scrolling
- **ALAB-02**: Key analysis info (parameters, fit quality) is surfaced prominently
- **ALAB-03**: AutoLab.tsx is decomposed into modular sub-components (<300 lines each)

### Reports

- **RPT-01**: User can export analysis as formatted PDF with plots, parameter tables, and LaTeX math
- **RPT-02**: User can export analysis as LaTeX source (.tex + figure PNGs as .zip)

### AI Solvers

- **AI-01**: AI assists ODE solver setup (equation construction from physics description)
- **AI-02**: AI recommends ODE solver method and explains tradeoffs
- **AI-03**: AI interprets ODE solution results in physics context
- **AI-04**: AI assists Integration page with same capabilities as ODE

### Security (Deferred)

- **SEC-03**: Flask debug=True is disabled in production deployment
- **SEC-04**: AI output is sanitized with DOMPurify before rendering via dangerouslySetInnerHTML

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile-native app | Web-first tool; responsive improvements only |
| User accounts / authentication | Stateless tool, no login needed |
| Real-time collaboration | Single-user analysis tool |
| Database / persistent storage | Analyses are ephemeral by design |
| Component library adoption (MUI, Mantine) | Dark theme achievable with CSS custom properties; avoids heavy dependency |
| New analysis tool types | User hasn't decided on specifics; revisit in future milestone |
| Plotly dark theme (THEME-03) | User prefers white-background Plotly charts for readability |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1: Security Hardening | Complete |
| SEC-02 | Phase 1: Security Hardening | Complete |
| THEME-01 | Phase 2: Theme Token System | Complete |
| THEME-02 | Phase 3 + 4 + 5 + 6: Style Migration (split by component group) | Pending |
| THEME-04 | Phase 7: Theme Toggle and Polish | Pending |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-21 after roadmap revision (removed THEME-03, moved to Out of Scope)*
