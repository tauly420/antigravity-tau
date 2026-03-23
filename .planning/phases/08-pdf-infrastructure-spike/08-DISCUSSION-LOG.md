# Phase 8: PDF Infrastructure Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 08-pdf-infrastructure-spike
**Areas discussed:** Spike code permanence, Equation test coverage

---

## Spike Code Permanence

### Q1: Should the spike code become the foundation for Phase 11, or stay throwaway?

| Option | Description | Selected |
|--------|-------------|----------|
| Build as foundation (Recommended) | Write rendering pipeline as production-quality code that Phase 11 builds on | |
| Throwaway spike only | Minimal code to prove feasibility; Phase 11 rewrites from scratch | |
| You decide | Claude determines the right balance | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on foundation vs throwaway balance.

### Q2: Should the test endpoint stay permanently for debugging?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as debug endpoint (Recommended) | Keep /api/report/test-pdf permanently for diagnosing rendering issues on Railway | ✓ |
| Remove after spike | Temporary — remove once Phase 8 validates the approach | |
| You decide | Claude determines based on practicality | |

**User's choice:** Keep as debug endpoint
**Notes:** Useful for production debugging on Railway.

### Q3: Where should the PDF generation module live?

| Option | Description | Selected |
|--------|-------------|----------|
| backend/api/report.py (Recommended) | New blueprint following existing pattern, registers as /api/report/* | ✓ |
| backend/utils/pdf.py | Core rendering in utils/, thin blueprint wrapper | |
| You decide | Claude picks the structure | |

**User's choice:** backend/api/report.py
**Notes:** Consistent with existing codebase conventions.

---

## Equation Test Coverage

### Q1: What level of physics are the lab reports targeting?

| Option | Description | Selected |
|--------|-------------|----------|
| Intro physics (Recommended) | Mechanics, waves, optics, basic E&M — matches existing AutoLab examples | ✓ |
| Advanced undergrad | Adds quantum, stat mech, advanced E&M | |
| Both levels | Intro physics thoroughly, plus a few advanced expressions | |

**User's choice:** Intro physics
**Notes:** Matches existing AutoLab examples (Hooke's Law, Oscillation, Free Fall).

### Q2: Are there specific equation patterns that break or render poorly?

| Option | Description | Selected |
|--------|-------------|----------|
| Units with text in math | $k = 49.8 \pm 0.5 \text{ N/m}$ — mixing \text{} with math mode near Hebrew | ✓ |
| Plus-minus uncertainties | The ± symbol and uncertainty notation | |
| No specific issues | Cover the standard set | |
| Let me describe | Custom expressions | |

**User's choice:** Units with text in math
**Notes:** \text{} inside math mode adjacent to Hebrew RTL is a known rendering concern.

### Q3: Should the equation test suite include Hebrew text labels inside equations?

| Option | Description | Selected |
|--------|-------------|----------|
| No — equations are always English/Latin (Recommended) | Israeli academic standard: Latin math, Hebrew paragraphs | ✓ |
| Yes — some Hebrew in equations | Occasional Hebrew labels in subscripts | |
| You decide | Claude determines based on convention | |

**User's choice:** No — equations are always English/Latin
**Notes:** Israeli academic standard.

### Q4: How should the test suite verify rendering correctness?

| Option | Description | Selected |
|--------|-------------|----------|
| Visual inspection (Recommended) | Generate test PDF, visually inspect. Practical for a spike. | ✓ |
| Automated text extraction | PyMuPDF text extraction + assertions | |
| Both | Visual + basic automated smoke tests | |

**User's choice:** Visual inspection
**Notes:** Automated testing is overkill at spike stage.

---

## Claude's Discretion

- Spike code quality balance (throwaway vs foundation)
- PDF visual style (margins, font sizes, layout)
- Railway fallback strategy
- Font bundling approach
- KaTeX rendering method (HTML/CSS vs SVG)

## Deferred Ideas

None — discussion stayed within phase scope.
