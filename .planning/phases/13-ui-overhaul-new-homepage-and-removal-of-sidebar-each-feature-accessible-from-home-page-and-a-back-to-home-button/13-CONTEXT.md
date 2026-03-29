# Phase 13: UI Overhaul — Homepage, Sidebar Removal, Dark Theme - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the left navigation sidebar entirely. Replace with a homepage-centric layout: intro section describing the site, a prominent AutoLab hero button (flagship feature), then a grid of other tool cards. Each feature page gets a back-to-home button in the header. Switch the entire site to a dark theme with a cohesive color scheme. The right AI assistant panel stays unchanged.

</domain>

<decisions>
## Implementation Decisions

### Homepage Layout
- **D-01:** Homepage structure (top to bottom): (1) Intro paragraph summarizing what Tau-LY offers, (2) Large hero button/card for AutoLab as the flagship feature, (3) Grid of remaining tool cards below.
- **D-02:** The intro paragraph goes in `frontend/src/components/Home.tsx`. Claude writes the initial intro text — concise summary of what the site offers for physics/engineering students and researchers.
- **D-03:** AutoLab hero card should be visually prominent — larger than other cards, with a clear call-to-action. It's the primary feature users should notice first.

### Sidebar Removal
- **D-04:** Delete the left NavSidebar component entirely from `App.tsx`. Remove all `.nav-sidebar*` CSS classes from `global.css`.
- **D-05:** Main content area expands to full width (no 200px sidebar offset). Layout simplifies to: header → full-width content → footer.

### Navigation
- **D-06:** Back button in header bar on every feature page: `← Home | Tau-LY — {Tool Name}`. Always visible, returns to homepage.
- **D-07:** Header displays current tool name when on a feature page. On the homepage, just show `Tau-LY Lab Tools`.
- **D-08:** Clicking the Tau-LY logo also returns home (Link to `/`).

### Dark Theme
- **D-09:** Switch the site to a dark theme. Pick a color scheme that works well with the existing blue accent colors and doesn't clash with Plotly chart rendering or the AI chat panel.
- **D-10:** Use the existing CSS custom property architecture from Phase 2 (`[data-theme="dark"]` tokens). Set dark as the default and only theme for now.

### AI Assistant Panel
- **D-11:** Keep the floating "Ask AI" button and right-side chat panel as-is. No changes to `Sidebar.tsx` in this phase.

### Claude's Discretion
- Intro paragraph text content (Claude writes it)
- Dark theme color palette selection (must be cohesive with blues, work with charts)
- Tool card visual design updates for dark theme
- Hero AutoLab card design and CTA styling
- Header back button styling and layout
- Footer updates if needed for dark theme
- Transition animations for back button / page navigation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Homepage and Navigation
- `frontend/src/components/Home.tsx` — Current homepage, tool card grid (no intro section yet, no AutoLab card)
- `frontend/src/App.tsx` — NavSidebar component (lines 40-70), route definitions, header, layout structure
- `frontend/src/components/Sidebar.tsx` — AI assistant right panel (keep as-is)

### Styling
- `frontend/src/styles/global.css` — All styles including `.nav-sidebar*`, `.header`, `.tool-card`, `.home-container`, theme tokens
- Phase 2 token system: `[data-theme="dark"]` and `[data-theme="light"]` CSS custom properties already exist

### Context
- `frontend/src/context/AnalysisContext.tsx` — `setCurrentTool` used by homepage cards

### Phase 14 dependency
- `.planning/phases/14-report-and-autolab-merge-unified-page-for-full-report-or-analysis-only-mode-plus-fix-pdf-export/14-CONTEXT.md` — Report merges into AutoLab in Phase 14, so no separate Report card needed on homepage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CSS custom property architecture from Phase 2 — `[data-theme="dark"]` tokens already defined with ~32 color variables
- Tool card component pattern in Home.tsx — `tools` array with title, desc, path, emoji, color
- `useAnalysis` hook for `setCurrentTool` on card click

### Established Patterns
- All styling in single `global.css` file (no CSS modules)
- CSS custom properties for theming (Phase 2)
- React Router `<Link>` for navigation
- Inline styles mixed with class-based styles across components

### Integration Points
- `App.tsx` layout structure needs NavSidebar removal and header modification
- `global.css` needs sidebar CSS removal and dark theme defaults
- `Home.tsx` needs intro section and AutoLab hero card added
- Every feature page benefits from header showing tool name + back button (handled in App.tsx header)

</code_context>

<specifics>
## Specific Ideas

- User wants a concise intro paragraph — not a wall of text, just enough to communicate what the site does
- AutoLab is the flagship — should be the most visually prominent element after the intro
- Dark theme should feel modern and professional, not just "dark mode slapped on"
- The homepage should feel like a product landing page, not just a tool directory

</specifics>

<deferred>
## Deferred Ideas

- Light/dark theme toggle — only dark theme for now (Phase 7 had toggle planned but deferred)
- Report card on homepage — not needed since Phase 14 merges Report into AutoLab

</deferred>

---

*Phase: 13-ui-overhaul*
*Context gathered: 2026-03-29*
