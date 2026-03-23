# Phase 8: PDF Infrastructure Spike - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that WeasyPrint can generate a Hebrew RTL PDF with inline English math equations (rendered via KaTeX) on Railway deployment. This is a risk spike — prove the technology stack works before building features on top of it. Deliverables: a test endpoint, bundled fonts, KaTeX rendering pipeline, equation test suite, and confirmed Railway deployment.

</domain>

<decisions>
## Implementation Decisions

### Spike code permanence
- **D-01:** Claude's Discretion on throwaway vs foundation balance — write clean code where practical, but don't over-engineer for a spike. Core rendering logic should be reusable by Phase 11 if it works well.
- **D-02:** Keep `/api/report/test-pdf` as a permanent debug endpoint — useful for diagnosing rendering issues on Railway production. Can be gated behind a dev flag later.
- **D-03:** New module at `backend/api/report.py` as a Flask blueprint registered at `/api/report/*`, following the existing codebase convention (like `autolab.py`, `fitting.py`).

### Equation test coverage
- **D-04:** Target intro physics level — mechanics, waves, optics, basic E&M. Matches existing AutoLab examples (Hooke's Law, Oscillation, Free Fall).
- **D-05:** Special attention to `\text{}` inside math mode — expressions like `$k = 49.8 \pm 0.5 \text{ N/m}$` are a known rendering risk when adjacent to Hebrew RTL text.
- **D-06:** Equations are always English/Latin notation; Hebrew appears only in surrounding paragraph text. This is the Israeli academic standard.
- **D-07:** Rendering correctness verified by visual inspection of a generated test PDF. No automated pixel-comparison or text-extraction tests at this stage.

### Claude's Discretion
- PDF visual style (margins, font sizes, page layout) — no user preferences yet; use reasonable academic defaults
- Railway fallback strategy if WeasyPrint + KaTeX CSS fails — determine during implementation
- Font bundling approach (repo-committed vs build-time download)
- KaTeX rendering method (HTML/CSS vs SVG) — pick what works with WeasyPrint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements
- `.planning/REQUIREMENTS.md` — PDF-01 and PDF-02 requirement definitions
- `.planning/ROADMAP.md` — Phase 8 success criteria (4 criteria)

### Deployment configuration
- `nixpacks.toml` — Current Railway build config (needs WeasyPrint system lib additions)
- `requirements.txt` — Python dependencies (needs WeasyPrint addition)

### Existing related code
- `backend/app.py` — Flask app factory where new `report_bp` blueprint must be registered
- `frontend/src/utils/latex.ts` — Existing KaTeX usage in frontend (reference for expression patterns)

### Codebase analysis
- `.planning/codebase/STACK.md` — Full tech stack reference
- `.planning/codebase/STRUCTURE.md` — Where to add new code (blueprint pattern documented)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `katex` ^0.16.0 already in frontend dependencies — expression patterns in `frontend/src/utils/latex.ts` can inform the backend test suite
- Flask blueprint pattern well-established — `backend/api/*.py` all follow the same structure
- `backend/app.py` has centralized blueprint registration and error handlers (404, 413, 500)

### Established Patterns
- One blueprint file per feature domain in `backend/api/`
- All blueprints registered in `backend/app.py` with `/api/{module}` prefix
- Error handling: `try/except` returning `jsonify({"error": str(e)}), 500`
- File responses: no existing pattern for binary file downloads (this will be new)

### Integration Points
- `backend/app.py` — register `report_bp` blueprint
- `nixpacks.toml` — add WeasyPrint system dependencies (pango, cairo, gdk-pixbuf, etc.)
- `requirements.txt` — add `weasyprint` package
- Font files need to be committed to repo or downloaded at build time

</code_context>

<specifics>
## Specific Ideas

- The `\text{}` in math mode edge case (e.g., `$k = 49.8 \pm 0.5 \text{ N/m}$`) is the user's primary rendering concern — make this a prominent test case
- Intro physics expressions to test: spring constant with units, period formula, gravitational acceleration, chi-squared/dof, R-squared, plus-minus uncertainties, fractions, Greek letters, superscripts, integrals, text-in-math

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-pdf-infrastructure-spike*
*Context gathered: 2026-03-23*
