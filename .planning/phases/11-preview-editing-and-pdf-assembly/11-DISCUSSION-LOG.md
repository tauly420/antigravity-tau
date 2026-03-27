# Phase 11: Preview, Editing, and PDF Assembly - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 11-preview-editing-and-pdf-assembly
**Areas discussed:** Section editor UX, PDF layout & styling, Plot embedding

---

## Section Editor UX

| Option | Description | Selected |
|--------|-------------|----------|
| Accordion sections | Collapsible cards per section, expand to preview + edit | ✓ |
| Tab-based sections | Horizontal tabs, one section at a time | |
| All sections visible | Vertical document layout, edit buttons inline | |

**User's choice:** Accordion sections
**Notes:** None

### Live KaTeX Preview Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side | Textarea left, preview right, real-time update | ✓ |
| Below textarea | Textarea top, preview underneath | |
| Toggle button | Switch between edit and preview modes | |

**User's choice:** Side-by-side
**Notes:** None

### AI Generated Badge

| Option | Description | Selected |
|--------|-------------|----------|
| Clears on any edit | Badge disappears when user modifies text | ✓ |
| Clears on explicit confirm | Badge stays until user clicks Reviewed checkmark | |
| Always visible | Badge stays permanently for academic integrity | |

**User's choice:** Clears on any edit
**Notes:** None

---

## PDF Layout & Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Israeli university lab report | Title page, numbered Hebrew sections, A4, 2.5cm margins, Noto Sans Hebrew | ✓ (default) |
| Minimal clean | Simple header, no heavy formatting | Available |
| LaTeX-inspired academic | Mimic LaTeX article class, abstract, references | Available |

**User's choice:** Generally option 1, but user should also be able to choose 2 or 3
**Notes:** Led to template selector discussion -- dropdown on report page decided

### Template Selector

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown on report page | Near Export button, Israeli default, other styles available | ✓ |
| During export dialog | Modal when clicking Export PDF | |

**User's choice:** Dropdown on report page
**Notes:** None

### Page Breaks

| Option | Description | Selected |
|--------|-------------|----------|
| Auto with smart breaks | WeasyPrint handles naturally, short sections can share pages | ✓ |
| Each section new page | Forced page break before every section | |
| You decide | Claude picks based on WeasyPrint behavior | |

**User's choice:** Auto with smart breaks
**Notes:** None

---

## Plot Embedding

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend Plotly export | Plotly.toImage() to PNG/SVG, send base64 to backend | ✓ |
| Server-side matplotlib | Backend re-renders from raw data, looks different | |
| You decide | Claude picks best approach | |

**User's choice:** Frontend Plotly export
**Notes:** None

### Plot Preview in Editor

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, inline thumbnails | Show plots in Results accordion with figure captions | ✓ |
| No, plots only in PDF | Simpler build, no preview verification | |

**User's choice:** Yes, inline thumbnails
**Notes:** None

---

## Claude's Discretion

- Title page form design (fields, layout, placement)
- PDF header/footer content and styling
- Font sizes and spacing within PDF templates
- Parameter table formatting
- Figure caption numbering format
- Template CSS organization

## Deferred Ideas

None
