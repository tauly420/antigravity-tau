# Phase 2: Theme Token System - Research

**Researched:** 2026-03-21
**Domain:** CSS custom properties, dark/light theming, design token architecture
**Confidence:** HIGH

## Summary

This phase creates a CSS custom property architecture that enables dark and light theming across the entire application. The existing codebase already uses 27 CSS custom properties in `:root` for colors, shadows, radii, and transitions -- this is the foundation to extend. The work involves: (1) designing a complete token naming convention that covers all color categories, (2) creating `[data-theme="dark"]` and `[data-theme="light"]` selectors with full token sets, (3) replacing all hardcoded color values in `global.css` with token references, and (4) applying `data-theme="dark"` to the root element by default.

The current `global.css` has approximately 40 hardcoded color references (hex values, rgba values, gradients) outside of `:root` token definitions that must be converted to use CSS custom properties. The file is 882 lines and is the single CSS file for the project -- no CSS modules or component-scoped styles exist.

**Primary recommendation:** Extend the existing flat token naming pattern (`--bg`, `--surface`, `--text`) with a minimal semantic hierarchy for the new layered surface system (e.g., `--surface-elevated`), add dark-mode-specific tokens for gradients and glows, then replace all hardcoded colors in `global.css` with `var()` references. Keep the `:root` block as the light theme (backward compatible), add `[data-theme="dark"]` with the scientific instrument palette, and set `data-theme="dark"` on the app root div.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Scientific instrument panel style -- deep navy-charcoal backgrounds, subtle violet-gray borders, soft white text. Like an oscilloscope or lab equipment dashboard.
- **D-02:** Dark palette anchors: background `#1a1a2e`, surface `#16213e`, border `#2a2a4a`, text `#e0e0e8`, muted text `#8888aa`
- **D-03:** Subtle glow effects on interactive elements (hover/focus only) -- faint colored box-shadow like a dim LED indicator, not neon or pronounced
- **D-04:** Header gradient darkened in dark mode (same red hues but deeper: `#7f0000` to `#b71c1c`) to blend with dark theme rather than jarring contrast
- **D-05:** Layered surfaces with 2-3 depth levels: page bg to card to elevated panel, each slightly lighter to create instrument-panel visual hierarchy

### Claude's Discretion
- Token naming convention details (flat vs semantic hierarchy)
- Exact accent color adjustments for dark mode contrast
- Light theme token values (current `:root` values are the starting point)
- Shadow values for dark mode
- Transition/animation timing

### Deferred Ideas (OUT OF SCOPE)
- Push Phase 1 commits to GitHub -- not a Phase 2 task
- Inline style migration (413 inline `style={{}}` declarations) -- that is Phases 3-6
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| THEME-01 | App has a dark science dashboard theme using CSS custom properties | Full token architecture, dark palette from D-02, hardcoded color inventory, `data-theme` attribute strategy, naming convention |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | Native CSS | Design token system | Zero-dependency, browser-native, already in use in this project |

### Supporting
No additional libraries needed. This phase is pure CSS work within the existing `global.css` file.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS custom properties | CSS-in-JS (styled-components) | Project explicitly uses single global.css -- no framework migration |
| CSS custom properties | Tailwind CSS | Out of scope per REQUIREMENTS.md "Out of Scope" table |
| Manual token file | Style Dictionary / design-tokens package | Overkill for a single-file CSS architecture; adds build complexity |

## Architecture Patterns

### Recommended Token File Structure
The project uses a single `global.css` file. All token work happens there. Structure within the file:

```
frontend/src/styles/global.css
  |- :root { ... }                    /* Light theme tokens (default values) */
  |- [data-theme="light"] { ... }     /* Explicit light theme (mirrors :root) */
  |- [data-theme="dark"] { ... }      /* Dark theme overrides */
  |- /* Component styles below use var() references only */
```

### Pattern 1: Token Naming Convention
**What:** Flat naming with minimal semantic extension, consistent with existing codebase patterns.
**When to use:** All new tokens defined in this phase.

The existing codebase uses flat names: `--bg`, `--surface`, `--text`, `--border`, `--primary`, `--accent`. This convention should be preserved and extended rather than replaced with a deeply nested hierarchy.

**Recommended naming scheme:**

```css
/* === Existing tokens (keep as-is) === */
--primary          /* Brand red */
--primary-dark     /* Darker brand red */
--primary-light    /* Lighter brand red */
--accent           /* Blue accent */
--accent-light     /* Lighter blue accent */
--success          /* Green for success states */
--warning          /* Orange for warnings */
--danger           /* Red for errors */
--bg               /* Page background */
--surface          /* Card/panel background */
--surface-alt      /* Alternate surface (table headers, form fields) */
--text             /* Primary text */
--text-secondary   /* Secondary text */
--text-muted       /* Muted/disabled text */
--border           /* Standard border */
--border-light     /* Subtle border */
--shadow-sm/md/lg  /* Shadow levels */
--radius/radius-sm /* Border radii */
--transition       /* Standard transition */

/* === New tokens for layered surfaces (D-05) === */
--surface-elevated /* Elevated panel (3rd depth level) */

/* === New tokens for semantic color contexts === */
--header-bg        /* Header gradient start */
--header-bg-end    /* Header gradient end */
--header-shadow    /* Header box-shadow color */

/* === New tokens for status backgrounds (result boxes) === */
--success-bg       /* Success result background */
--success-bg-end   /* Success result gradient end */
--success-border   /* Success result border */
--warning-bg       /* Warning result background */
--warning-bg-end   /* Warning result gradient end */
--warning-border   /* Warning result border */
--danger-bg        /* Error background */
--danger-bg-end    /* Error gradient end */
--danger-border    /* Error border */
--info-bg          /* Info/instructions background */
--info-bg-end      /* Info gradient end */
--info-text        /* Info text color */

/* === New tokens for interactive states === */
--primary-hover-bg    /* Primary color hover tint */
--primary-focus-ring  /* Focus ring color */
--primary-glow        /* Subtle glow on hover (D-03) */
--accent-glow         /* Accent glow on hover */

/* === New tokens for misc hardcoded values === */
--overlay-light    /* Semi-transparent white overlay */
--overlay-dark     /* Semi-transparent black overlay */
--code-bg          /* Inline code background */
```

### Pattern 2: data-theme Attribute Strategy
**What:** Use `data-theme` attribute on the outermost app div to control theme.
**When to use:** Theme switching (Phase 7 adds toggle; Phase 2 sets dark as default).

```tsx
// In App.tsx, the root div gets the attribute:
<div className="app-container" data-theme="dark" style={{ display: 'flex' }}>
```

The CSS selectors are:
```css
:root {
  /* Light theme values -- serves as fallback and light theme */
}

[data-theme="dark"] {
  /* Dark theme overrides -- only color tokens, not layout */
}
```

**Why `data-theme` on a div, not on `:root`/`<html>`:** The project renders inside a React-managed div. Putting it on the app-container div means React controls it (via state in Phase 7). For Phase 2, it is hardcoded as `"dark"`.

**Alternative considered:** Putting `data-theme` on `<html>` via `document.documentElement.dataset.theme`. This works too and has the benefit of applying to `body` styles. However, since `body` styles use `var(--bg)` and `var(--text)` which will be overridden by the attribute selector regardless of where it sits (CSS custom properties cascade downward), either approach works. The div approach keeps everything in React's render tree.

**Recommendation:** Use `[data-theme="dark"]` on the app-container div in `App.tsx`. CSS custom properties defined on this div will cascade to all children. For the `body` background, add a one-line JS effect or rely on the body still reading `:root` tokens (which remain light-theme). Since the app-container fills the viewport (`min-height: 100vh`), the body background is not visible. Verify during implementation.

### Pattern 3: Gradient and Shadow Tokenization
**What:** Tokenize gradient color stops and shadow colors, not entire gradient/shadow declarations.
**When to use:** Any hardcoded gradient or box-shadow in `global.css`.

```css
/* DO: Tokenize the color values */
.header {
  background: linear-gradient(135deg, var(--header-bg) 0%, var(--header-bg-end) 100%);
  box-shadow: 0 4px 20px var(--header-shadow);
}

/* DON'T: Tokenize the entire gradient declaration */
.header {
  background: var(--header-gradient); /* Hard to override individual stops */
}
```

Tokenizing color stops keeps the gradient structure in the component CSS while allowing theme-specific colors.

### Anti-Patterns to Avoid
- **Tokenizing layout values:** Only colors, shadows, and borders change between themes. Do not tokenize padding, margins, font-sizes, or layout properties.
- **Deep nesting in token names:** Avoid `--color-bg-surface-elevated-hover`. The project's existing flat convention works. Maximum 2-3 segments.
- **Duplicating entire selectors:** The `[data-theme="dark"]` block should ONLY contain custom property overrides, not re-declare component rules.
- **Using `!important` in theme tokens:** Custom properties cascade naturally. `!important` is never needed on token definitions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color contrast checking | Manual eyeballing of dark theme colors | Browser DevTools contrast checker or online WCAG contrast tool | User decisions (D-02) provide anchor colors but accents need verification against dark backgrounds |
| Token documentation | Separate markdown doc listing all tokens | CSS comments in `global.css` organized by category | Single source of truth, stays in sync with code |

**Key insight:** This phase is pure CSS. No libraries, no build tools, no runtime code beyond a single `data-theme="dark"` attribute. The complexity is in comprehensive coverage and correct color values, not in tooling.

## Common Pitfalls

### Pitfall 1: Missing Hardcoded Colors in global.css
**What goes wrong:** After tokenization, some elements still show light-theme colors in dark mode because a hardcoded hex/rgba was missed.
**Why it happens:** The file has ~40 hardcoded color references scattered across 880 lines. Easy to miss one.
**How to avoid:** Use the complete inventory below. After implementation, visually scan every page in dark mode.
**Warning signs:** Any hex value (`#xxx`) or `rgba()` call outside of `:root` / `[data-theme]` blocks.

### Pitfall 2: rgba() with Hardcoded RGB Components
**What goes wrong:** Patterns like `rgba(198, 40, 40, 0.12)` (primary red with opacity) cannot use `var(--primary)` directly because CSS custom properties don't decompose hex into RGB channels.
**Why it happens:** CSS `rgba()` needs separate R, G, B values, not a hex string.
**How to avoid:** Two approaches:
1. **Modern CSS `color-mix()`:** `color-mix(in srgb, var(--primary) 12%, transparent)` -- works in all modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+).
2. **Separate RGB channel tokens:** Define `--primary-rgb: 198, 40, 40` alongside `--primary: #c62828`, then use `rgba(var(--primary-rgb), 0.12)`.
3. **Direct alpha hex tokens:** Define themed tokens like `--primary-hover-bg` with the pre-computed semi-transparent value.

**Recommendation:** Use approach 3 (direct themed tokens) for the ~8 rgba occurrences. This is the simplest, most compatible, and each token gets its own dark-mode value. The rgba patterns in this codebase are always used for specific UI states (hover tint, focus ring, shadow), so named tokens like `--primary-hover-bg`, `--primary-focus-ring`, `--primary-shadow` are semantically clear.

### Pitfall 3: Body Background Bleed
**What goes wrong:** The `body` element still shows the light background color because `data-theme` is on a child div, not on `<html>`.
**Why it happens:** `body { background: var(--bg); }` reads `--bg` from `:root`, which is light theme.
**How to avoid:** Either (a) also set `data-theme="dark"` on `<html>` element via a `useEffect` in App.tsx, or (b) set `body { background: #1a1a2e; }` directly and let the token override it inside the app container. Approach (a) is cleaner -- a one-line `useEffect` that sets `document.documentElement.dataset.theme = 'dark'`.
**Warning signs:** Flash of white background on page load.

### Pitfall 4: Specificity Conflicts with !important
**What goes wrong:** Several existing rules use `!important` on colors (e.g., `.btn-primary`, `.btn-secondary`, `.stepper-btn`). If these rules use hardcoded colors with `!important`, switching to `var()` tokens might not cascade correctly if the `!important` is removed.
**Why it happens:** The existing codebase uses `!important` to override generic button styles.
**How to avoid:** Keep the `!important` where it exists but replace the hardcoded values with `var()` references. The `!important` is about specificity between component rules, not about theming.
**Warning signs:** Buttons or steppers losing their styled appearance after tokenization.

### Pitfall 5: Forgetting the Light Theme Explicit Selector
**What goes wrong:** Phase 7 adds a theme toggle. If only `:root` defines light theme and `[data-theme="dark"]` defines dark, toggling to `[data-theme="light"]` would use `:root` values. But if some tokens are only defined in `[data-theme="dark"]` (new tokens that don't exist in `:root`), the light theme would have undefined tokens.
**Why it happens:** New tokens added for dark mode (e.g., `--primary-glow`) might not have a `:root` fallback.
**How to avoid:** Every token defined in `[data-theme="dark"]` MUST also exist in `:root`. The `:root` block serves as both the light theme AND the fallback. Optionally, add `[data-theme="light"]` that mirrors `:root` for explicitness, but it is not strictly required if `:root` is complete.
**Warning signs:** Missing token warnings in browser DevTools when switching themes.

## Code Examples

### Complete Token Architecture (Recommended)

```css
/* ======= LIGHT THEME (default / fallback) ======= */
:root {
    /* --- Brand --- */
    --primary: #c62828;
    --primary-dark: #8e0000;
    --primary-light: #ff5f52;
    --accent: #1565c0;
    --accent-light: #5e92f3;

    /* --- Semantic status --- */
    --success: #2e7d32;
    --warning: #f57c00;
    --danger: #d32f2f;

    /* --- Backgrounds --- */
    --bg: #f5f5f7;
    --surface: #ffffff;
    --surface-alt: #fafafa;
    --surface-elevated: #ffffff;

    /* --- Text --- */
    --text: #1a1a2e;
    --text-secondary: #5a5a7a;
    --text-muted: #9e9e9e;

    /* --- Borders --- */
    --border: #e0e0e5;
    --border-light: #f0f0f5;

    /* --- Header --- */
    --header-bg: #b71c1c;
    --header-bg-mid: #c62828;
    --header-bg-mid2: #d32f2f;
    --header-bg-end: #e53935;
    --header-shadow: rgba(183, 28, 28, 0.3);

    /* --- Interactive states --- */
    --primary-hover-bg: rgba(198, 40, 40, 0.04);
    --primary-hover-border: rgba(198, 40, 40, 0.3);
    --primary-focus-ring: rgba(198, 40, 40, 0.12);
    --primary-shadow: rgba(198, 40, 40, 0.25);
    --primary-shadow-hover: rgba(198, 40, 40, 0.35);
    --accent-shadow: rgba(21, 101, 192, 0.25);
    --accent-shadow-hover: rgba(21, 101, 192, 0.35);
    --accent-shadow-strong: rgba(21, 101, 192, 0.4);
    --accent-shadow-stronger: rgba(21, 101, 192, 0.5);
    --resize-handle-hover: rgba(21, 101, 192, 0.25);
    --table-row-hover: rgba(198, 40, 40, 0.02);

    /* --- Status backgrounds --- */
    --success-bg: #e8f5e9;
    --success-bg-end: #c8e6c9;
    --success-border: #a5d6a7;
    --warning-bg: #fff3e0;
    --warning-bg-end: #ffe0b2;
    --warning-border: #ffcc80;
    --danger-bg: #ffebee;
    --danger-bg-end: #ffcdd2;
    --danger-border: #ef9a9a;
    --info-bg: #e3f2fd;
    --info-bg-end: #bbdefb;
    --info-text: #1a237e;

    /* --- Overlays / misc --- */
    --overlay-light: rgba(255, 255, 255, 0.6);
    --overlay-subtle: rgba(0, 0, 0, 0.08);
    --stepper-active-overlay: rgba(255, 255, 255, 0.25);
    --popup-bg: #ffffff;
    --popup-shadow: 0 8px 32px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
    --close-btn-color: #999;
    --close-btn-hover: #333;
    --footer-text: rgba(255, 255, 255, 0.7);

    /* --- Shadows --- */
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
    --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);

    /* --- Layout (theme-invariant) --- */
    --radius: 12px;
    --radius-sm: 8px;
    --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ======= DARK THEME ======= */
[data-theme="dark"] {
    /* --- Brand (adjusted for dark backgrounds) --- */
    --primary: #e53935;
    --primary-dark: #b71c1c;
    --primary-light: #ff6f60;
    --accent: #42a5f5;
    --accent-light: #80d6ff;

    /* --- Semantic status (brighter on dark) --- */
    --success: #66bb6a;
    --warning: #ffa726;
    --danger: #ef5350;

    /* --- Backgrounds (D-02 anchors) --- */
    --bg: #1a1a2e;
    --surface: #16213e;
    --surface-alt: #1e2a4a;
    --surface-elevated: #243356;

    /* --- Text (D-02 anchors) --- */
    --text: #e0e0e8;
    --text-secondary: #a0a0b8;
    --text-muted: #8888aa;

    /* --- Borders (D-02 anchor) --- */
    --border: #2a2a4a;
    --border-light: #222244;

    /* --- Header (D-04: darker red gradient) --- */
    --header-bg: #7f0000;
    --header-bg-mid: #8e0000;
    --header-bg-mid2: #a01010;
    --header-bg-end: #b71c1c;
    --header-shadow: rgba(127, 0, 0, 0.4);

    /* --- Interactive states (D-03: subtle glow) --- */
    --primary-hover-bg: rgba(229, 57, 53, 0.08);
    --primary-hover-border: rgba(229, 57, 53, 0.4);
    --primary-focus-ring: rgba(229, 57, 53, 0.2);
    --primary-shadow: rgba(229, 57, 53, 0.3);
    --primary-shadow-hover: rgba(229, 57, 53, 0.45);
    --accent-shadow: rgba(66, 165, 245, 0.3);
    --accent-shadow-hover: rgba(66, 165, 245, 0.45);
    --accent-shadow-strong: rgba(66, 165, 245, 0.4);
    --accent-shadow-stronger: rgba(66, 165, 245, 0.55);
    --resize-handle-hover: rgba(66, 165, 245, 0.3);
    --table-row-hover: rgba(229, 57, 53, 0.04);

    /* --- Status backgrounds (darkened versions) --- */
    --success-bg: rgba(46, 125, 50, 0.15);
    --success-bg-end: rgba(46, 125, 50, 0.1);
    --success-border: rgba(102, 187, 106, 0.3);
    --warning-bg: rgba(245, 124, 0, 0.15);
    --warning-bg-end: rgba(245, 124, 0, 0.1);
    --warning-border: rgba(255, 167, 38, 0.3);
    --danger-bg: rgba(211, 47, 47, 0.15);
    --danger-bg-end: rgba(211, 47, 47, 0.1);
    --danger-border: rgba(239, 83, 80, 0.3);
    --info-bg: rgba(21, 101, 192, 0.15);
    --info-bg-end: rgba(21, 101, 192, 0.1);
    --info-text: #90caf9;

    /* --- Overlays / misc --- */
    --overlay-light: rgba(255, 255, 255, 0.08);
    --overlay-subtle: rgba(255, 255, 255, 0.06);
    --stepper-active-overlay: rgba(255, 255, 255, 0.15);
    --popup-bg: #1e2a4a;
    --popup-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
    --close-btn-color: #8888aa;
    --close-btn-hover: #e0e0e8;
    --footer-text: rgba(224, 224, 232, 0.6);

    /* --- Shadows (darker, more dramatic) --- */
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.15);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15);
    --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.35), 0 4px 10px rgba(0, 0, 0, 0.2);
}
```

### Hardcoded Color Replacement Example

Before:
```css
.header {
    background: linear-gradient(135deg, #b71c1c 0%, #c62828 40%, #d32f2f 70%, #e53935 100%);
    box-shadow: 0 4px 20px rgba(183, 28, 28, 0.3);
}
```

After:
```css
.header {
    background: linear-gradient(135deg, var(--header-bg) 0%, var(--header-bg-mid) 40%, var(--header-bg-mid2) 70%, var(--header-bg-end) 100%);
    box-shadow: 0 4px 20px var(--header-shadow);
}
```

### App.tsx Root Element Change

```tsx
// Before:
<div className="app-container" style={{ display: 'flex' }}>

// After:
<div className="app-container" data-theme="dark" style={{ display: 'flex' }}>
```

Plus a `useEffect` for body coverage:
```tsx
import { useEffect } from 'react';

function App() {
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
    }, []);
    // ... rest of component
}
```

## Hardcoded Color Inventory (global.css)

Complete list of hardcoded colors OUTSIDE `:root` that need tokenization:

| Line(s) | Current Value | Proposed Token | Context |
|---------|--------------|----------------|---------|
| 49 | `#b71c1c`, `#c62828`, `#d32f2f`, `#e53935` | `--header-bg`, `--header-bg-mid`, `--header-bg-mid2`, `--header-bg-end` | Header gradient |
| 55 | `rgba(183, 28, 28, 0.3)` | `--header-shadow` | Header box-shadow |
| 68 | `rgba(0, 0, 0, 0.3)` | Keep as-is (black shadow on icon, theme-invariant) | Header icon drop-shadow |
| 101 | `rgba(198, 40, 40, 0.04)` | `--primary-hover-bg` | Nav link hover bg |
| 102 | `rgba(198, 40, 40, 0.3)` | `--primary-hover-border` | Nav link hover border |
| 215 | `rgba(198, 40, 40, 0.12)` | `--primary-focus-ring` | Input focus ring |
| 250 | `rgba(198, 40, 40, 0.25)` | `--primary-shadow` | Button box-shadow |
| 255 | `rgba(198, 40, 40, 0.35)` | `--primary-shadow-hover` | Button hover shadow |
| 283 | `rgba(21, 101, 192, 0.25)` | `--accent-shadow` | Accent button shadow |
| 287 | `rgba(21, 101, 192, 0.35)` | `--accent-shadow-hover` | Accent button hover shadow |
| 312-313 | `#e8f5e9`, `#c8e6c9`, `#a5d6a7` | `--success-bg`, `--success-bg-end`, `--success-border` | Success result box |
| 317-318 | `#fff3e0`, `#ffe0b2`, `#ffcc80` | `--warning-bg`, `--warning-bg-end`, `--warning-border` | Warning result box |
| 322, 327 | `#ffebee`, `#ffcdd2`, `#ef9a9a` | `--danger-bg`, `--danger-bg-end`, `--danger-border` | Error message |
| 333 | `#e3f2fd`, `#bbdefb` | `--info-bg`, `--info-bg-end` | Instructions box bg |
| 339 | `#1a237e` | `--info-text` | Instructions text color |
| 347 | `rgba(255, 255, 255, 0.6)` | `--overlay-light` | Instructions code bg |
| 394 | `rgba(198, 40, 40, 0.2)` | `--primary-shadow` (reuse) | Stepper active shadow |
| 398, 400 | `#e8f5e9`, `#a5d6a7` | `--success-bg`, `--success-border` (reuse) | Stepper done state |
| 413 | `rgba(0, 0, 0, 0.08)` | `--overlay-subtle` | Stepper number bg |
| 418 | `rgba(255, 255, 255, 0.25)` | `--stepper-active-overlay` | Active stepper number bg |
| 472 | `#e8f5e9`, `#c8e6c9` | `--success-bg`, `--success-bg-end` (reuse) | Prefilled banner |
| 530 | `rgba(198, 40, 40, 0.02)` | `--table-row-hover` | Table row hover |
| 585 | `rgba(21, 101, 192, 0.4)` | `--accent-shadow-strong` | Sidebar toggle shadow |
| 595 | `rgba(21, 101, 192, 0.5)` | `--accent-shadow-stronger` | Sidebar toggle hover shadow |
| 620 | `white` | `--popup-bg` | AI popup background |
| 623 | `rgba(0,0,0,0.16)`, `rgba(0,0,0,0.08)` | `--popup-shadow` | AI popup shadow |
| 637 | `#999` | `--close-btn-color` | Popup close button |
| 643 | `#333` | `--close-btn-hover` | Popup close hover |
| 654 | `rgba(0, 0, 0, 0.08)` | Reuse `--shadow-md` or keep inline (sidebar specific) | Sidebar panel shadow |
| 676 | `rgba(21, 101, 192, 0.25)` | `--resize-handle-hover` | Resize handle hover |
| 804 | `rgba(198, 40, 40, 0.2)` | `--primary-shadow` (reuse) | Workflow num active shadow |
| 815 | `rgba(255, 255, 255, 0.7)` | `--footer-text` | Footer text color |

**Total:** ~40 hardcoded color references to replace.
**Reuse count:** Several tokens serve multiple selectors (success-bg, primary-shadow), reducing unique token count to ~35 new tokens.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate CSS files per theme | CSS custom properties with `data-theme` attribute | ~2020+ mainstream | Single file, instant switching, no FOUC |
| SASS variables for theming | CSS custom properties (runtime switchable) | CSS custom properties became universal ~2019 | No build step needed for theme switching |
| `prefers-color-scheme` media query only | `data-theme` attribute (user-controllable) + optional media query fallback | Convention solidified ~2021 | User choice overrides OS preference |
| Full `rgba()` decomposition tokens | `color-mix()` for opacity variants | Chrome 111 / Safari 16.2 (2023) | Simpler than RGB channel tokens |

**Note on `color-mix()`:** While modern browsers support it, this project uses direct themed tokens (approach 3 from Pitfall 2) which is more explicit and compatible with all browsers. No need for `color-mix()`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no test infrastructure exists |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| THEME-01a | Root-level CSS defines custom properties for all color categories | manual-only | Visual inspection: open browser DevTools, verify all tokens present in `:root` and `[data-theme="dark"]` | N/A |
| THEME-01b | Dark and light token sets exist via `[data-theme]` selectors | manual-only | Inspect computed styles with DevTools; toggle `data-theme` attribute between `dark` and `light` | N/A |
| THEME-01c | App root applies dark theme by default; all CSS hardcoded colors use tokens | manual-only | Open app, verify dark theme renders; grep `global.css` for remaining hardcoded hex/rgba outside `:root`/`[data-theme]` blocks | N/A |
| THEME-01d | Documented token naming convention | manual-only | Verify CSS comments in `global.css` document token categories | N/A |

**Justification for manual-only:** This phase is purely CSS visual theming. No unit-testable logic exists. Validation is: (1) grep for remaining hardcoded colors, (2) visual inspection of all pages in dark mode. A grep command can serve as a smoke check:

```bash
# Verify no hardcoded colors remain outside token definition blocks
grep -n '#[0-9a-fA-F]\{3,8\}\b' frontend/src/styles/global.css | grep -v ':root' | grep -v 'data-theme'
```

### Sampling Rate
- **Per task commit:** Visual check of affected component + grep for hardcoded colors
- **Per wave merge:** Navigate all pages in dark mode, verify no visual artifacts
- **Phase gate:** All pages visually correct in dark mode; zero hardcoded colors outside token blocks

### Wave 0 Gaps
None -- no test infrastructure needed for CSS-only theming work. Validation is grep + visual inspection.

## Open Questions

1. **Body background coverage**
   - What we know: `body { background: var(--bg) }` reads from `:root`. If `data-theme="dark"` is on the app-container div, `:root` still has light `--bg`.
   - What's unclear: Whether the app-container div fully covers the viewport in all states (loading, error boundaries, etc.)
   - Recommendation: Add `document.documentElement.setAttribute('data-theme', 'dark')` via useEffect in App.tsx as belt-and-suspenders. This ensures both `body` and all children get dark tokens.

2. **Exact dark-mode accent/primary values**
   - What we know: D-02 provides anchor colors for bg/surface/border/text. D-07 says accent adjustments are Claude's discretion.
   - What's unclear: Exact WCAG contrast ratios for proposed accent colors against dark backgrounds.
   - Recommendation: Use proposed values from Code Examples section above. Verify contrast during implementation with browser DevTools. Primary `#e53935` on `#16213e` surface gives ~5.2:1 contrast (meets AA). Accent `#42a5f5` on `#16213e` gives ~4.8:1 (meets AA for large text, close for normal).

## Sources

### Primary (HIGH confidence)
- `frontend/src/styles/global.css` -- full file read, complete hardcoded color inventory
- `frontend/src/App.tsx` -- root element structure, inline styles noted
- `.planning/phases/02-theme-token-system/02-CONTEXT.md` -- user decisions D-01 through D-07
- `.planning/REQUIREMENTS.md` -- THEME-01 requirement definition

### Secondary (MEDIUM confidence)
- CSS custom properties and `data-theme` attribute pattern -- well-established web standard, verified by direct knowledge of CSS specification behavior
- WCAG contrast ratio estimates -- approximate calculations, should be verified with tooling during implementation

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- pure CSS, no libraries, well-understood technology
- Architecture: HIGH -- extending existing pattern already in the codebase, `data-theme` is the standard approach
- Pitfalls: HIGH -- derived from direct analysis of the actual `global.css` file and its specific patterns
- Color values: MEDIUM -- dark palette anchors are user-locked (D-02), but accent/status color adjustments are estimates that need contrast verification

**Research date:** 2026-03-21
**Valid until:** Indefinite -- CSS custom properties are a stable web standard; project-specific findings are tied to the current codebase state
