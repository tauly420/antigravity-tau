# Phase 2: Theme Token System - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a CSS custom property architecture with dark and light token sets. The app renders in dark theme by default. All existing hardcoded colors in CSS files are migrated to tokens. A documented naming convention is established for Phases 3-6 to follow. Inline style migration is NOT in scope (that's Phases 3-6).

</domain>

<decisions>
## Implementation Decisions

### Dark theme aesthetic
- **D-01:** Scientific instrument panel style — deep navy-charcoal backgrounds, subtle violet-gray borders, soft white text. Like an oscilloscope or lab equipment dashboard.
- **D-02:** Dark palette anchors: background `#1a1a2e`, surface `#16213e`, border `#2a2a4a`, text `#e0e0e8`, muted text `#8888aa`
- **D-03:** Subtle glow effects on interactive elements (hover/focus only) — faint colored box-shadow like a dim LED indicator, not neon or pronounced
- **D-04:** Header gradient darkened in dark mode (same red hues but deeper: `#7f0000` → `#b71c1c`) to blend with dark theme rather than jarring contrast
- **D-05:** Layered surfaces with 2-3 depth levels: page bg → card → elevated panel, each slightly lighter to create instrument-panel visual hierarchy

### Token naming convention
- **D-06:** Claude's Discretion — naming convention not explicitly discussed. Existing tokens use flat names (`--bg`, `--surface`, `--text`). Researcher and planner may extend with semantic hierarchy if needed for the layered surface system, but should stay consistent with existing patterns where possible.

### Brand accent handling
- **D-07:** Claude's Discretion — red primary kept in dark mode, adjusted for contrast. Blue accent (`--accent`) adjusted similarly. Exact values determined during implementation based on WCAG contrast requirements against dark backgrounds.

### Claude's Discretion
- Token naming convention details (flat vs semantic hierarchy)
- Exact accent color adjustments for dark mode contrast
- Light theme token values (current `:root` values are the starting point)
- Shadow values for dark mode
- Transition/animation timing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and in the following project files:

### Project requirements
- `.planning/REQUIREMENTS.md` — THEME-01 requirement definition
- `.planning/ROADMAP.md` — Phase 2 success criteria (4 criteria)

### Current styling
- `frontend/src/styles/global.css` — Current CSS with existing `:root` tokens and all class-based styles that need hardcoded color replacement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/styles/global.css` — Already has 27 CSS custom properties in `:root` (colors, shadows, radii, transitions). This is the file to extend with `[data-theme]` selectors.
- Existing token usage: `var(--bg)`, `var(--surface)`, `var(--text)`, `var(--border)`, etc. already used throughout class-based styles.

### Established Patterns
- Single `global.css` for all styles — no CSS modules, no styled-components, no Tailwind
- CSS custom properties already in use for design tokens
- Mix of token-based and hardcoded colors in the same file (e.g., header gradient uses hex literals)

### Integration Points
- `frontend/src/styles/global.css` is the only CSS file — all token definitions go here
- `frontend/src/App.tsx` renders the root element that needs `data-theme` attribute (6 inline styles to note, but migration is Phase 3)
- 413 inline `style={{}}` declarations across 16 `.tsx` files reference hardcoded colors — these are NOT migrated in this phase but the token names must be designed to support them

</code_context>

<specifics>
## Specific Ideas

- Scientific instrument aesthetic: think oscilloscope panels, lab equipment dashboards — professional, not gaming/neon
- Glow effects should feel like dim LED indicators, not sci-fi neon
- Header gradient stays red but muted in dark mode — brand continuity without visual clash
- Surface layering creates depth like physical instrument panel recesses

</specifics>

<deferred>
## Deferred Ideas

- Push Phase 1 commits to GitHub — noted, will handle after context creation (not a Phase 2 task)

</deferred>

---

*Phase: 02-theme-token-system*
*Context gathered: 2026-03-21*
