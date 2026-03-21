# Phase 2: Theme Token System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 02-theme-token-system
**Areas discussed:** Dark theme aesthetic

---

## Dark theme aesthetic

### Q1: What dark theme style?

| Option | Description | Selected |
|--------|-------------|----------|
| Scientific instrument (Recommended) | Dark charcoal/navy backgrounds, subtle borders, muted glow accents — like an oscilloscope or lab equipment panel | ✓ |
| IDE / developer dark | Neutral dark grays like VS Code or GitHub dark. Clean, professional, familiar | |
| Deep black (OLED) | True black backgrounds with high contrast. Dramatic look | |

**User's choice:** Scientific instrument
**Notes:** None

### Q2: Glow/accent effect prominence?

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle glow (Recommended) | Faint colored box-shadow on hover/focus only. Like a dim LED indicator | ✓ |
| No glow effects | Pure color changes on hover/focus, no box-shadow glow | |
| Pronounced glow | Visible neon-like glow on interactive elements | |

**User's choice:** Subtle glow
**Notes:** User also noted: "also push phase 1 to github"

### Q3: Header treatment in dark mode?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep red gradient | Same bold red gradient as light mode | |
| Darken the gradient (Recommended) | Same red hues but deeper/darker to blend with dark theme | ✓ |
| Replace with dark surface | Header becomes dark surface, red accent only on logo/active elements | |

**User's choice:** Darken the gradient
**Notes:** None

### Q4: Surface depth variation?

| Option | Description | Selected |
|--------|-------------|----------|
| Layered surfaces (Recommended) | 2-3 surface levels creating depth like instrument panel layers | ✓ |
| Flat / minimal layers | Just bg + one surface color, cards distinguished by borders only | |

**User's choice:** Layered surfaces
**Notes:** None

## Areas not discussed (user opted out)

- Brand accent in dark mode — deferred to Claude's discretion
- Token naming convention — deferred to Claude's discretion

## Claude's Discretion

- Token naming convention (flat vs semantic)
- Exact accent color values for dark mode
- Light theme token refinements
- Shadow and transition values

## Deferred Ideas

- Push Phase 1 to GitHub (user request during discussion, not a Phase 2 item)
