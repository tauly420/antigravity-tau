# Phase 13: UI Overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 13-ui-overhaul
**Areas discussed:** Homepage layout & cards, Navigation after sidebar removal, AI assistant panel

---

## Homepage Layout & Cards

**User's direct input (not from options):**
- Intro page with concise summary of the website and what it offers
- Big button for AutoLab (flagship feature)
- Rest of the features below
- Dark theme — pick a color scheme that doesn't mess things up
- Claude writes the intro paragraph

**Notes:** User provided this directly rather than selecting from presented options. Clear vision: landing page feel with AutoLab prominently featured.

---

## Navigation After Sidebar Removal

| Option | Description | Selected |
|--------|-------------|----------|
| Back button in header | ← Home button in top header bar, always visible | ✓ |
| Breadcrumb trail | Home > Tool breadcrumb at top | |
| Logo click only | Minimalist, less discoverable | |

**User's choice:** Back button in header

### Follow-up: Tool name in header

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show tool name | Header: ← Home | Tau-LY — AutoLab | ✓ |
| No, just logo + back | Minimal header, title in page content | |

**User's choice:** Yes, show tool name

---

## AI Assistant Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is (floating button) | 🤖 Ask AI button stays, slides open chat panel | ✓ |
| Move toggle to header | AI button in header bar | |
| Remove entirely | No AI chat surface | |

**User's choice:** Keep as-is (floating button)

---

## Claude's Discretion

- Intro paragraph text
- Dark theme color palette
- Tool card visual design for dark theme
- AutoLab hero card design
- Header back button styling

## Deferred Ideas

- Light/dark theme toggle (Phase 7)
- Report homepage card (Phase 14 merges into AutoLab)
