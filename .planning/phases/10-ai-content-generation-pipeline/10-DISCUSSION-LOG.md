# Phase 10: AI Content Generation Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 10-ai-content-generation-pipeline
**Areas discussed:** AI generation language, Context form design, Gap-filling interaction, Section content depth

---

## AI Generation Language

| Option | Description | Selected |
|--------|-------------|----------|
| Hebrew body | AI writes all prose in Hebrew, LaTeX in English. Matches Israeli academic standard. | |
| English body | AI writes everything in English. Simpler but doesn't match target format. | |
| User chooses per report | Language toggle (Hebrew/English) on context form. AI generates in selected language. | ✓ |

**User's choice:** User chooses per report
**Notes:** None

### Follow-up: Default language

| Option | Description | Selected |
|--------|-------------|----------|
| Hebrew | Default to Hebrew since project targets Israeli academic format. | ✓ |
| English | Default to English. | |

**User's choice:** Hebrew

### Follow-up: System prompt language

| Option | Description | Selected |
|--------|-------------|----------|
| English prompt always | System prompt in English, output language controlled by directive. | ✓ |
| Match output language | System prompt matches selected output language. | |

**User's choice:** English prompt always

---

## Context Form Design

### Form + file relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Complementary | Both coexist, AI merges both inputs. Neither required. | ✓ |
| File first, form fills gaps | File uploaded first, AI pre-fills form. | |
| Either/or | User picks one path. | |

**User's choice:** Complementary

### Form fields

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | Title, subject area, equipment, free-text notes. AI infers the rest. | ✓ |
| Structured | More fields: procedure summary, theory hints, expected results. | |
| Just free text | Single textarea. | |

**User's choice:** Minimal

### Form layout

| Option | Description | Selected |
|--------|-------------|----------|
| Same page, below upload | Context form below upload zone on ReportBeta.tsx. Single scrollable page. | ✓ |
| Wizard steps | Step-by-step guided flow. | |

**User's choice:** Same page, below upload

---

## Gap-Filling Interaction

### Follow-up question UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on report page | Questions displayed inline after clicking Generate. Mini form, not chat. | ✓ |
| Chat-style dialog | Questions in a chat panel. | |
| Skip -- AI guesses | AI never asks, fills gaps with assumptions. | |

**User's choice:** Inline on report page

### Skip option

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with warning | "Generate anyway" button. AI warns which context was missing. | ✓ |
| No, must answer | Questions required before generation. | |

**User's choice:** Yes, with warning

---

## Section Content Depth

### Academic level

| Option | Description | Selected |
|--------|-------------|----------|
| Intro physics lab | University Physics 1/2 level. Matches existing AutoLab examples. | ✓ |
| Advanced lab | Upper-level undergraduate with derivations and deeper analysis. | |
| You decide | Claude picks based on experiment complexity. | |

**User's choice:** Intro physics lab

### Theory section depth

| Option | Description | Selected |
|--------|-------------|----------|
| Key formulas only | State relevant laws and equations, no derivations. | ✓ (modified) |
| Brief derivations | Include 2-3 step derivations where relevant. | |
| You decide | Claude determines based on experiment. | |

**User's choice:** Key formulas only, plus user-requested formulas. Derivations only if user specifically asks.
**Notes:** User specified that theory should include key formulas by default plus any formulas the user states should be there. Derivations are included only if the user specifically asks for them.

### Generation approach

| Option | Description | Selected |
|--------|-------------|----------|
| All at once | Single API call returns all sections as structured JSON. | ✓ |
| Section by section | Separate calls per section. | |
| All at once, regenerate individually | First call returns all, then individual regeneration. | |

**User's choice:** All at once

---

## Claude's Discretion

- AI model selection (cost vs quality)
- System prompt wording and section generation instructions
- JSON response schema
- Follow-up question count and phrasing
- Input merging strategy
- Error handling for malformed AI output

## Deferred Ideas

None
