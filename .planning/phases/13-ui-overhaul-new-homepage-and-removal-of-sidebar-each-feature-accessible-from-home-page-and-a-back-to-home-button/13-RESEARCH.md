# Phase 13: UI Overhaul — Homepage, Sidebar Removal, Dark Theme - Research

**Researched:** 2026-03-29
**Domain:** React SPA layout restructuring, CSS theming, navigation architecture
**Confidence:** HIGH

## Summary

Phase 13 is a purely frontend phase involving three coordinated changes: (1) removing the left navigation sidebar, (2) restructuring the homepage with an intro section, hero AutoLab card, and tool grid, and (3) activating the dark theme as the default and only theme. All changes are scoped to `App.tsx`, `Home.tsx`, `global.css`, and `index.html`. No backend changes, no new dependencies.

The existing codebase already has a complete dark theme token set defined under `[data-theme="dark"]` in `global.css` (Phase 2 work), but this selector is never activated -- no element in the DOM has `data-theme="dark"` set. The light `:root` tokens are what currently render. To activate dark theme, `data-theme="dark"` must be set on the `<html>` element in `index.html`.

**Primary recommendation:** Execute as 2-3 small plans: (1) sidebar removal + layout fix + dark theme activation, (2) homepage restructure with intro + hero + grid, (3) polish pass for dark theme color coherence across all components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Homepage structure (top to bottom): (1) Intro paragraph summarizing what Tau-LY offers, (2) Large hero button/card for AutoLab as the flagship feature, (3) Grid of remaining tool cards below.
- **D-02:** The intro paragraph goes in `frontend/src/components/Home.tsx`. Claude writes the initial intro text -- concise summary of what the site offers for physics/engineering students and researchers.
- **D-03:** AutoLab hero card should be visually prominent -- larger than other cards, with a clear call-to-action. It's the primary feature users should notice first.
- **D-04:** Delete the left NavSidebar component entirely from `App.tsx`. Remove all `.nav-sidebar*` CSS classes from `global.css`.
- **D-05:** Main content area expands to full width (no 200px sidebar offset). Layout simplifies to: header -> full-width content -> footer.
- **D-06:** Back button in header bar on every feature page: `<- Home | Tau-LY -- {Tool Name}`. Always visible, returns to homepage.
- **D-07:** Header displays current tool name when on a feature page. On the homepage, just show `Tau-LY Lab Tools`.
- **D-08:** Clicking the Tau-LY logo also returns home (Link to `/`).
- **D-09:** Switch the site to a dark theme. Pick a color scheme that works well with the existing blue accent colors and doesn't clash with Plotly chart rendering or the AI chat panel.
- **D-10:** Use the existing CSS custom property architecture from Phase 2 (`[data-theme="dark"]` tokens). Set dark as the default and only theme for now.
- **D-11:** Keep the floating "Ask AI" button and right-side chat panel as-is. No changes to `Sidebar.tsx` in this phase.

### Claude's Discretion
- Intro paragraph text content (Claude writes it)
- Dark theme color palette selection (must be cohesive with blues, work with charts)
- Tool card visual design updates for dark theme
- Hero AutoLab card design and CTA styling
- Header back button styling and layout
- Footer updates if needed for dark theme
- Transition animations for back button / page navigation

### Deferred Ideas (OUT OF SCOPE)
- Light/dark theme toggle -- only dark theme for now (Phase 7 had toggle planned but deferred)
- Report card on homepage -- not needed since Phase 14 merges Report into AutoLab
</user_constraints>

## Architecture Patterns

### Current Layout Structure (App.tsx)
```
<div class="app-container" style="display: flex">
  <NavSidebar />                    <!-- DELETE -->
  <div style="flex: 1; ...">
    <header class="header">         <!-- MODIFY: add back button + tool name -->
      <Link to="/">Logo + "Tau-LY Lab Tools"</Link>
    </header>
    <main class="main-content">
      <Routes>...</Routes>
    </main>
    <footer class="footer">...</footer>
  </div>
  <Sidebar />                       <!-- KEEP AS-IS -->
</div>
```

### Target Layout Structure
```
<div class="app-container" style="display: flex; flex-direction: column">
  <header class="header">
    <!-- On homepage: -->
    <Link to="/">Logo + "Tau-LY Lab Tools"</Link>
    <!-- On feature pages: -->
    <Link to="/">Arrow + "Home"</Link> | <span>"Tau-LY -- {Tool Name}"</span>
  </header>
  <main class="main-content">
    <Routes>...</Routes>
  </main>
  <footer class="footer">...</footer>
  <Sidebar />                        <!-- stays fixed-position, unaffected -->
</div>
```

### Pattern 1: Route-Aware Header
**What:** Use `useLocation()` (already imported in App.tsx) to determine the current route, then look up tool name from a path-to-label map derived from `NAV_ITEMS`.
**When to use:** Header needs to show different content based on current route.
**Implementation:**
```typescript
const location = useLocation();
const isHome = location.pathname === '/';
const currentItem = NAV_ITEMS.find(item => item.path === location.pathname);
const toolName = currentItem?.label ?? '';
```

### Pattern 2: Dark Theme Activation via HTML Attribute
**What:** Set `data-theme="dark"` on `<html>` element in `index.html` to activate the existing dark token set.
**Why this works:** CSS selectors `[data-theme="dark"]` are already defined with ~60+ custom properties. Setting the attribute is all that's needed.
**Implementation:**
```html
<!-- frontend/index.html -->
<html lang="en" data-theme="dark">
```

### Pattern 3: Homepage Hero + Grid Layout
**What:** Three-section vertical layout in Home.tsx: intro text, hero AutoLab card, tool card grid.
**Implementation approach:**
```typescript
// Home.tsx structure
<div className="home-container">
  <section className="home-intro">
    <h2>Welcome to Tau-LY</h2>
    <p>...intro text...</p>
  </section>
  <Link to="/autolab" className="home-hero-card">
    <!-- Large AutoLab CTA -->
  </Link>
  <div className="home-tools-grid">
    {tools.map(tool => <ToolCard ... />)}
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Hardcoding tool names in the header:** Use the existing `NAV_ITEMS` array as the single source of truth for path-to-label mapping. Do not create a second mapping.
- **Using JavaScript to toggle theme:** The decision is dark-only. Set it statically in HTML, not via `useEffect` or state.
- **Removing Sidebar.tsx:** D-11 explicitly says keep the AI chat panel. Only the NavSidebar (left nav) is removed.
- **Inline styles for new layout elements:** Follow the project pattern of adding classes to `global.css`. New layout sections (hero card, intro) should use CSS classes with design tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route-to-label mapping | Manual switch statement | Derive from existing `NAV_ITEMS` array | Single source of truth, already maintained |
| Dark theme colors | New color palette from scratch | Existing `[data-theme="dark"]` tokens in global.css | Already designed in Phase 2, ~60 properties |
| Page transitions | Custom transition system | CSS `@keyframes fadeIn` already in global.css | Existing pattern, keep consistent |

## Common Pitfalls

### Pitfall 1: Plotly Charts in Dark Theme
**What goes wrong:** Plotly charts have their own theme/layout colors. If the site goes dark but Plotly keeps white backgrounds, charts look jarring.
**Why it happens:** Plotly chart backgrounds are set via `layout.paper_bgcolor` and `layout.plot_bgcolor` in component code, not via CSS custom properties.
**How to avoid:** After activating dark theme, audit Plotly chart rendering. The existing dark tokens for backgrounds (`--bg: #1a1a2e`, `--surface: #16213e`) should inform Plotly layout config. Components that render Plotly may need `paper_bgcolor` and `plot_bgcolor` updates. However, this may already work if charts use transparent backgrounds -- check during implementation.
**Warning signs:** White rectangles appearing inside dark page backgrounds.

### Pitfall 2: Inline Styles Override Theme Tokens
**What goes wrong:** Many components use inline `style={{}}` with hardcoded colors (e.g., `color: 'white'`, `background: '#1565c0'`). These do not respond to theme token changes.
**Why it happens:** The codebase has ~420 inline style declarations (noted in deferred THEME-02 requirement).
**How to avoid:** For Phase 13, focus on layout/structural changes. The dark theme tokens already handle most global elements. Inline color overrides on specific components may need spot fixes but a full migration is deferred (THEME-02).
**Warning signs:** Bright spots or inconsistent colors on specific components after switching to dark theme.

### Pitfall 3: Sidebar.tsx vs NavSidebar Confusion
**What goes wrong:** Accidentally modifying or removing `Sidebar.tsx` (AI chat panel) instead of the `NavSidebar` function in `App.tsx`.
**Why it happens:** Both are called "sidebar" in different contexts.
**How to avoid:** `NavSidebar` = inline function in App.tsx (lines 40-70) = DELETE. `Sidebar.tsx` = separate component file = KEEP.

### Pitfall 4: home-container Max Width
**What goes wrong:** After removing the sidebar, the homepage content stretches too wide on large screens.
**Why it happens:** `main-content` has `max-width: 1200px` which is fine, but `home-container` may need its own constraints for the hero card and intro to look good.
**How to avoid:** Test at various widths. The `max-width: 1200px` on `.main-content` should naturally constrain things.

### Pitfall 5: NAV_ITEMS Still Needed After Sidebar Removal
**What goes wrong:** Deleting `NAV_ITEMS` array along with the sidebar, then having no source for route-to-label mapping.
**Why it happens:** `NAV_ITEMS` powers the sidebar but is also needed for the header tool name display.
**How to avoid:** Keep `NAV_ITEMS` (or a derived version) as a route registry. It is also useful for the homepage tool grid.

## Code Examples

### Dark Theme Activation (index.html)
```html
<!-- Source: existing global.css [data-theme="dark"] selector -->
<html lang="en" data-theme="dark">
```

### Route-Aware Header (App.tsx)
```typescript
// Source: existing App.tsx patterns
function AppHeader() {
    const location = useLocation();
    const isHome = location.pathname === '/';
    const currentItem = NAV_ITEMS.find(item => item.path === location.pathname);

    return (
        <header className="header">
            {isHome ? (
                <Link to="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src="/tau-ly-icon.png" alt="Tau-LY" className="header-icon" />
                    <h1>Tau-LY Lab Tools</h1>
                </Link>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link to="/" className="header-back-btn">
                        &#8592; Home
                    </Link>
                    <span className="header-separator">|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src="/tau-ly-icon.png" alt="Tau-LY" className="header-icon" />
                        <h1>Tau-LY &mdash; {currentItem?.label ?? 'Tool'}</h1>
                    </div>
                </div>
            )}
        </header>
    );
}
```

### Simplified AppContent (App.tsx, after sidebar removal)
```typescript
function AppContent() {
    return (
        <div className="app-container">
            <AppHeader />
            <main className="main-content">
                <Routes>
                    {/* same routes */}
                </Routes>
            </main>
            <footer className="footer">...</footer>
            <Sidebar />
        </div>
    );
}
```

### Homepage Hero Card Pattern (Home.tsx)
```typescript
// AutoLab hero card -- visually larger than tool cards
<Link to="/autolab" onClick={() => setCurrentTool('AutoLab')} className="home-hero-link">
    <div className="home-hero-card">
        <div className="home-hero-icon"><!-- robot emoji or icon --></div>
        <div className="home-hero-content">
            <h2>AutoLab</h2>
            <p>Upload your data, describe what you need, and get a complete physics analysis.</p>
            <span className="home-hero-cta">Start Analysis &rarr;</span>
        </div>
    </div>
</Link>
```

## Detailed File Change Inventory

### Files to Modify
| File | Change Type | Scope |
|------|------------|-------|
| `frontend/index.html` | Add `data-theme="dark"` to `<html>` | 1 line |
| `frontend/src/App.tsx` | Remove NavSidebar, add route-aware header, simplify layout | ~50 lines changed |
| `frontend/src/components/Home.tsx` | Add intro section, hero AutoLab card, restructure grid | ~80 lines changed |
| `frontend/src/styles/global.css` | Remove `.nav-sidebar*` (~65 lines), add `.home-hero*`, `.home-intro`, `.header-back-btn` classes, adjust `.app-container` layout | ~100 lines changed |

### Files NOT to Touch
| File | Reason |
|------|--------|
| `frontend/src/components/Sidebar.tsx` | D-11: AI chat panel stays as-is |
| `backend/*` | No backend changes in this phase |
| Any component `.tsx` besides App.tsx and Home.tsx | Feature pages unchanged; back button handled in App.tsx header |

### CSS Classes to Remove (from global.css)
- `.nav-sidebar` (line 218-231)
- `.nav-sidebar--collapsed` (line 233-236)
- `.nav-sidebar__toggle` and hover (lines 238-253)
- `.nav-sidebar__links` (lines 255-260)
- `.nav-sidebar__link` and variants (lines 262-298)
- `.nav-sidebar__icon` (lines 300-305)
- `.nav-sidebar__label` (lines 307-310)
- `.nav-sidebar__badge` (lines 312-316)
- Responsive `.nav-sidebar` rules (lines 1073-1084)

### CSS Classes to Add
- `.home-intro` -- intro paragraph section styling
- `.home-hero-card` -- large AutoLab hero card
- `.home-hero-cta` -- call-to-action button/text styling
- `.header-back-btn` -- back-to-home link in header
- `.header-separator` -- pipe separator in header

## Dark Theme Color Assessment

The existing `[data-theme="dark"]` tokens (Phase 2) use:
- **Backgrounds:** Deep navy (`#1a1a2e`, `#16213e`, `#1e2a4a`, `#243356`)
- **Text:** Light gray/lavender (`#e8e8f0`, `#c0c0d4`, `#a8a8c0`)
- **Primary accent:** Teal (`#4dd0e1`) -- shifted from blue in light theme
- **Secondary accent:** Blue (`#42a5f5`) -- kept from light theme
- **Borders:** Dark purple-blue (`#2a2a4a`, `#222244`)

This palette is already cohesive and well-designed. The main accent colors (teal primary, blue secondary) work well with the existing blue brand identity. No need to redesign the color palette -- just activate it and do spot fixes.

**Potential issues to audit after activation:**
1. Plotly chart backgrounds (may need transparent or matching dark colors)
2. Tool card `borderLeft` colors set via inline styles in Home.tsx -- these use hardcoded hex values but are accent colors that should still pop on dark backgrounds
3. The `home-hero-card` needs new dark-theme-appropriate styling (gradient background with the teal/blue accent colors)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vite + TypeScript compiler |
| Config file | `frontend/tsconfig.app.json`, `frontend/vite.config.ts` |
| Quick run command | `cd frontend && npx tsc -b --noEmit` |
| Full suite command | `cd frontend && npm run build` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-04 | NavSidebar removed, no nav-sidebar CSS | smoke | `cd frontend && npm run build && ! grep -r "NavSidebar" src/App.tsx` | N/A |
| D-09/D-10 | Dark theme is default | smoke | `grep 'data-theme="dark"' frontend/index.html` | N/A |
| D-06/D-07 | Header shows back button on feature pages | manual-only | Visual verification | N/A |
| D-01/D-02/D-03 | Homepage has intro, hero, grid | manual-only | Visual verification | N/A |

### Sampling Rate
- **Per task commit:** `cd frontend && npx tsc -b --noEmit`
- **Per wave merge:** `cd frontend && npm run build`
- **Phase gate:** Full build green + visual inspection of homepage and feature pages

### Wave 0 Gaps
None -- no unit test infrastructure needed. This is a purely visual/layout phase. Validation is TypeScript compilation + build success + visual inspection.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). This phase is purely frontend code/CSS changes using existing React, TypeScript, and Vite toolchain.

## Open Questions

1. **Plotly chart dark theme compatibility**
   - What we know: Plotly charts have their own layout background colors; the dark theme tokens exist
   - What's unclear: Whether existing chart components use transparent backgrounds or hardcoded white
   - Recommendation: Audit after dark theme activation; fix as spot fixes if needed (likely in PlotWrapper.tsx or component-level Plotly layout configs)

2. **Inline style hardcoded colors**
   - What we know: ~420 inline style declarations exist (THEME-02, deferred)
   - What's unclear: How many will look wrong on dark backgrounds
   - Recommendation: The most visible ones (header, footer, cards) use CSS tokens already. Accept minor imperfections on deep feature pages; full migration is THEME-02 scope

## Sources

### Primary (HIGH confidence)
- `frontend/src/App.tsx` -- read directly, NavSidebar is inline function lines 40-70
- `frontend/src/components/Home.tsx` -- read directly, tool grid with no intro/hero
- `frontend/src/styles/global.css` -- read directly, full dark theme tokens at lines 91-168, nav-sidebar at lines 218-316
- `frontend/index.html` -- read directly, no `data-theme` attribute set
- `13-CONTEXT.md` -- all locked decisions D-01 through D-11

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, pure CSS + React changes
- Architecture: HIGH -- existing patterns well understood from code reading
- Pitfalls: HIGH -- known issues documented from direct code inspection
- Dark theme: HIGH -- tokens already exist and are comprehensive

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- no external dependency changes)
