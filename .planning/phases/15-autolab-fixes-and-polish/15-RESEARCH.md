# Phase 15: AutoLab Fixes and Polish - Research

**Researched:** 2026-04-03
**Domain:** PDF export debugging (WeasyPrint on Railway) + CSS consistency
**Confidence:** MEDIUM

## Summary

Phase 15 has two distinct work streams: (1) fixing the PDF export 500 error on Railway, and (2) standardizing button/input CSS across all pages. The PDF issue is the primary blocker -- the user cannot evaluate PDF output at all.

The PDF 500 error on Railway is most likely caused by one of three things: (a) WeasyPrint's system library dependencies not loading correctly in the Railway/nixpacks environment despite being listed in `nixpacks.toml`, (b) the KaTeX subprocess (`npx katex`) not being accessible from Python's execution context on Railway, or (c) Railway having silently migrated the project to Railpack, which ignores `nixpacks.toml` entirely and uses `RAILPACK_DEPLOY_APT_PACKAGES` for system dependencies instead. The debugging strategy must start with hitting `/api/report/test-pdf` on Railway to get the actual traceback, then fix based on the real error.

For button/input styling, an audit of all 16 components reveals three inconsistency patterns: (1) components using `btn-primary`/`btn-accent` classes (Workflow, GraphFitting, AutoLab, FourierAnalysis, ODESolver) -- these are the most polished, (2) components using bare `<button>` with no class and inline styles (FormulaCalculator, NSigmaCalculator, NumericalIntegrator), and (3) components using non-standard classes like `primary-btn`/`small-btn` (MatrixCalculator) and inline styles with hardcoded colors (UnitConverter, StatisticsCalculator). The standard `btn-primary`/`btn-accent`/`btn-secondary` classes in `global.css` are the cleanest implementation and should be adopted everywhere.

**Primary recommendation:** Debug the actual Railway error via the existing `/api/report/test-pdf` endpoint first. Then standardize all buttons to use `btn-primary`/`btn-accent`/`btn-secondary` CSS classes and remove all inline button/input styling overrides.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Both PDF export types (results-only and full lab report) return 500 on Railway. Debug and fix the root cause -- likely WeasyPrint system dependency, font path, or template issue on the Railway/nixpacks deployment.
- **D-02:** User tests on Railway only (no local testing). Fix must be validated on Railway deployment.
- **D-03:** PDF quality improvements deferred -- user cannot evaluate output until the 500 is fixed. Fix the error first, quality comes in a later phase.
- **D-04:** Buttons and input boxes have inconsistent CSS across different pages. Standardize to a single style across the entire site.
- **D-05:** Claude reviews all pages and picks the most polished existing button/input style to standardize on (no new design needed -- pick the best of what exists).

### Claude's Discretion
- Which existing button/input style to standardize on (after reviewing all pages)
- Implementation approach for CSS consolidation (shared classes vs CSS custom properties)
- Debugging strategy for the PDF 500 error

### Deferred Ideas (OUT OF SCOPE)
- AutoLab UI Overhaul (Phase 16+) -- structured workflow input, model selection, parameter constraints
- Remove old standalone pages (Phase 17) -- after AutoLab absorbs everything
- PDF Quality Polish (Phase 18) -- formatting, layout, font rendering, Hebrew RTL quality
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | PDF export returns 200 (not 500) on Railway for both results-only and full report | WeasyPrint debugging strategy, Railway deployment analysis, test-pdf endpoint |
| FIX-02 | Button/input styling is consistent across all pages | CSS audit of all 16 components, identification of standard pattern |
</phase_requirements>

## Architecture Patterns

### PDF Export Pipeline (Current)
```
Frontend (AutoLab.tsx / ReportSection.tsx)
  -> api.ts (exportResultsPdf / exportReportPdf)
  -> POST /api/report/export-results-pdf or /export-pdf
  -> report.py endpoint
  -> pdf_renderer.py: assemble_results_html() or assemble_report_html()
  -> pdf_renderer.py: process_text_with_math() [KaTeX rendering]
  -> pdf_renderer.py: generate_pdf() [WeasyPrint]
  -> Returns PDF bytes or 500 with traceback
```

### Debugging Strategy for Railway 500
```
Step 1: Hit /api/report/test-pdf on Railway deployment
        (already returns full traceback in JSON on error)
Step 2: Read traceback to identify root cause category:
  A) ImportError for weasyprint -> pip install issue
  B) "cannot load library 'libgobject'" -> system deps missing
  C) "Fontconfig error" -> fontconfig misconfigured
  D) "npx: command not found" or KaTeX error -> Node not in PATH
  E) Template file not found -> path resolution issue
Step 3: Fix based on actual error (see category-specific fixes below)
```

### Category-Specific Fixes

**Category A (ImportError):** WeasyPrint not installed. Check `requirements.txt` includes `weasyprint>=68.0` (it does). Verify `.venv` is activated in start command (it is).

**Category B (system lib missing):** The `nixpacks.toml` already lists pango, cairo, gdk-pixbuf, etc. If Railway migrated to Railpack, these are ignored. Fix: add `RAILPACK_DEPLOY_APT_PACKAGES` Railway env var with `libgobject-2.0-0 libcairo2 libpango-1.0-0 libgdk-pixbuf-2.0-0 libffi-dev libpango1.0-dev libcairo2-dev libgdk-pixbuf-2.0-dev gir1.2-pango-1.0`. Alternatively, check Railway service settings to confirm builder type (nixpacks vs railpack).

**Category C (Fontconfig):** Add `fontconfig` to deploy apt packages. Ensure fonts are accessible. The current `nixpacks.toml` includes `fontconfig` but the `GDK_PIXBUF_MODULE_FILE = ""` empty string might cause issues -- try removing it or setting it to the actual path.

**Category D (KaTeX/Node not in PATH):** The `render_latex_for_pdf()` function tries `npx katex` subprocess. On Railway, Node.js may not be in the Python process PATH. Fix options: (1) ensure `markdown_katex` Python package works (it's in requirements.txt), (2) add explicit PATH setting in the start command, (3) make the KaTeX fallback more robust.

**Category E (template not found):** The `BACKEND_DIR` and `TEMPLATES_DIR` paths are resolved via `__file__`. On Railway, the CWD is `backend/` (per start command). Verify `report_base.html` and `report_styles.css` exist in `backend/templates/`.

### Railway Builder Check (CRITICAL)
Railway deprecated nixpacks and new services use Railpack by default. **Existing services should still use nixpacks**, but if the service was recreated or if Railway auto-migrated, the `nixpacks.toml` config would be silently ignored. The planner must include a step to verify which builder the Railway service is using (visible in Railway dashboard under service settings).

### Button/Input Inconsistency Audit

| Component | Button Pattern | Input Pattern | Issues |
|-----------|---------------|---------------|--------|
| AutoLab.tsx | `btn-accent`, `btn-primary` | Standard | Clean |
| Workflow.tsx | `btn-primary`, `btn-accent` | Standard, some inline `style` | Minor inline overrides |
| GraphFitting.tsx | `btn-accent`, `btn-primary`, bare `<button>` | Standard with inline `style={{ flex: 1 }}` | Main action button has no class |
| FourierAnalysis.tsx | `btn-accent`, `btn-primary` with inline `style` overrides | Inline `style` on number inputs | Mixed |
| ODESolver.tsx | `btn-accent`, `btn-primary` | Standard | Clean |
| MatrixCalculator.tsx | `primary-btn`, `small-btn` (non-standard classes) | Inline `style={{ padding, fontSize }}` on selects | Non-standard classes, inline styles |
| FormulaCalculator.tsx | Bare `<button>` with inline style only | Standard | No CSS class on button |
| NSigmaCalculator.tsx | Bare `<button>` with inline style only | Standard | No CSS class, full-width inline style |
| NumericalIntegrator.tsx | Bare `<button>` no class | Inline `style={{ fontFamily }}` | No CSS class |
| UnitConverter.tsx | Inline styles with hardcoded `background: 'white'`, `color` | Standard | Hardcoded colors, ignores theme |
| StatisticsCalculator.tsx | Empty string or `btn-secondary` class, inline `style={{ flex: 1 }}` | Standard | Toggle pattern, minor |
| Sidebar.tsx | Inline styles (transparent bg, borders) | Custom `.sidebar-input` class | Intentionally different (chat UI) |
| Home.tsx | Card-based navigation, not standard buttons | N/A | Intentionally different |

### Recommended Standard: `btn-primary` / `btn-accent` / `btn-secondary`

The global.css already defines three well-designed button classes:

```css
/* Primary action (submit, calculate, run) */
.btn-primary {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
    color: white;
}

/* Secondary action (cancel, toggle inactive) */
.btn-secondary {
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1.5px solid var(--border);
}

/* Accent action (load example, demo) */
.btn-accent {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
    color: white;
}
```

The base `button` selector already handles padding, border-radius, font, transitions, and disabled state.

### CSS Fix Pattern

For each component, the fix is:
1. Add appropriate `className` (`btn-primary` for main actions, `btn-accent` for examples/secondary actions, `btn-secondary` for toggles/cancel)
2. Remove inline `style` overrides that conflict (background, color, border, padding, fontSize)
3. Keep layout-only inline styles (marginTop, width, flex) -- these are positioning, not styling
4. Remove non-standard classes (`primary-btn`, `small-btn`) -- replace with standard equivalents

For MatrixCalculator's `small-btn`, add a CSS class `.btn-sm` to global.css:
```css
.btn-sm {
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML-to-PDF | WeasyPrint (already used) | Handles CSS, fonts, RTL |
| LaTeX rendering for PDF | Custom parser | KaTeX via markdown_katex or npx (already used) | Math rendering is hard |
| Railway deployment debugging | Guessing at errors | Hit `/api/report/test-pdf` endpoint to get actual traceback | The endpoint already returns traceback on error |

## Common Pitfalls

### Pitfall 1: Railway Builder Mismatch
**What goes wrong:** The `nixpacks.toml` config is silently ignored because Railway migrated the service to Railpack.
**Why it happens:** Railway deprecated nixpacks and auto-migrates or defaults new services to Railpack.
**How to avoid:** Check Railway dashboard for builder type. If Railpack, system dependencies must be set via `RAILPACK_DEPLOY_APT_PACKAGES` environment variable instead of `nixpacks.toml`.
**Warning signs:** nixpacks.toml changes have no effect on deployment behavior.

### Pitfall 2: GDK_PIXBUF_MODULE_FILE Empty String
**What goes wrong:** The `nixpacks.toml` sets `GDK_PIXBUF_MODULE_FILE = ""` which may cause GdkPixbuf to fail to load image loaders.
**Why it happens:** Phase 14 added this as a "fix" but an empty string may not be the correct value. On nixpkgs, the actual path would be something like `/nix/store/.../lib/gdk-pixbuf-2.0/2.10.0/loaders.cache`.
**How to avoid:** Either remove this variable (let WeasyPrint find it automatically) or set it to the correct path on Railway.
**Warning signs:** Errors mentioning "Unrecognized image file format" or "GdkPixbuf" in traceback.

### Pitfall 3: KaTeX Subprocess Fails Silently on Railway
**What goes wrong:** `npx katex` subprocess call fails because Node.js is not in the Python process's PATH.
**Why it happens:** Railway start command activates `.venv` and runs Python, which may not inherit the full PATH including Node.js.
**How to avoid:** The current code has a fallback chain: `markdown_katex` Python package -> `npx katex` -> `<code>` fallback. Ensure `markdown_katex` is properly installed and working. If it works, the subprocess is never called.
**Warning signs:** All math expressions render as `<code class="katex-fallback">` instead of proper KaTeX HTML.

### Pitfall 4: Fixing Styles Breaks Theme Toggle
**What goes wrong:** Replacing inline styles with CSS classes works for light theme but breaks dark theme.
**Why it happens:** Inline styles like `background: 'white'` and `color: 'var(--text)'` are hardcoded. The CSS classes use CSS custom properties that respect theme.
**How to avoid:** When removing inline styles, verify both theme modes. The standard `btn-*` classes already use CSS variables and work with both themes.
**Warning signs:** Buttons looking wrong in dark mode after styling changes.

### Pitfall 5: Sidebar Buttons Are Intentionally Different
**What goes wrong:** Standardizing ALL buttons removes intentional visual differences in the sidebar chat UI.
**Why it happens:** The sidebar has transparent background buttons, close buttons, and file attach buttons that should NOT look like primary action buttons.
**How to avoid:** Skip Sidebar.tsx button styling. The sidebar uses chat-specific patterns (transparent bg, minimal borders) that are correct for that context.
**Warning signs:** Chat input area looking like a form instead of a messaging interface.

## Code Examples

### Debugging PDF on Railway

```bash
# Hit the test-pdf endpoint to get actual error traceback
curl -v https://YOUR-RAILWAY-URL/api/report/test-pdf 2>&1
```

The endpoint in `report.py` already returns the full traceback:
```python
except Exception as e:
    return {"error": str(e), "traceback": traceback.format_exc()}, 500
```

### Adding Railpack System Dependencies (if needed)

In Railway dashboard, add environment variable:
```
RAILPACK_DEPLOY_APT_PACKAGES=libgobject-2.0-0 libcairo2 libpango-1.0-0 libgdk-pixbuf-2.0-0 libffi-dev libpango1.0-dev fontconfig
```

### Button Standardization Example

Before (FormulaCalculator.tsx):
```tsx
<button onClick={handleEvaluate} disabled={loading || !expression.trim()} style={{ marginTop: '1.5rem' }}>
```

After:
```tsx
<button onClick={handleEvaluate} disabled={loading || !expression.trim()} className="btn-primary" style={{ marginTop: '1.5rem' }}>
```

Before (UnitConverter.tsx):
```tsx
<button
    style={{
        flex: 1,
        background: category === cat ? 'var(--primary)' : 'white',
        color: category === cat ? 'white' : 'var(--text)',
        borderColor: category === cat ? 'var(--primary)' : '#ddd',
        padding: '0.5rem',
        fontSize: '0.9rem'
    }}
>
```

After:
```tsx
<button
    className={category === cat ? 'btn-primary' : 'btn-secondary'}
    style={{ flex: 1 }}
>
```

Before (MatrixCalculator.tsx):
```tsx
<button className="small-btn" onClick={() => clearMatrix(which)}>Clear</button>
<button onClick={handleCalculate} className="primary-btn">
```

After:
```tsx
<button className="btn-secondary btn-sm" onClick={() => clearMatrix(which)}>Clear</button>
<button onClick={handleCalculate} className="btn-primary">
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 7.0+ (backend) |
| Config file | None (default pytest discovery) |
| Quick run command | `cd backend && python -m pytest tests/ -x` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | PDF export returns valid bytes | unit | `cd backend && python -c "from utils.pdf_renderer import generate_test_pdf; pdf = generate_test_pdf(); assert len(pdf) > 1000"` | N/A (inline) |
| FIX-01 | Both PDF endpoints respond | smoke | `curl -sf https://RAILWAY_URL/api/report/test-pdf > /dev/null` | N/A (manual on Railway) |
| FIX-02 | No non-standard button classes remain | grep | `grep -r 'primary-btn\|small-btn' frontend/src/components/` returns no results | N/A (grep check) |
| FIX-02 | No hardcoded button colors in inline styles | grep | `grep -rn "background.*white\|background.*#" frontend/src/components/*.tsx` on button elements | N/A (grep check) |

### Sampling Rate
- **Per task commit:** `cd backend && python -c "from utils.pdf_renderer import generate_test_pdf; pdf = generate_test_pdf(); print(f'OK: {len(pdf)} bytes')"`
- **Per wave merge:** Full test suite + manual Railway deploy check
- **Phase gate:** Both PDF exports return 200 on Railway; grep finds no non-standard button classes

### Wave 0 Gaps
- None -- existing test infrastructure covers local PDF validation; Railway testing is manual per D-02

## Open Questions

1. **What is the actual Railway error?**
   - What we know: Both PDF exports return 500 on Railway. Phase 14 added GDK_PIXBUF_MODULE_FILE and XDG_DATA_DIRS to nixpacks.toml but the error persists.
   - What's unclear: The exact traceback. Could be import error, system lib missing, font issue, KaTeX subprocess, or template path issue.
   - Recommendation: First task must hit `/api/report/test-pdf` on Railway and read the traceback. All fixes depend on this.

2. **Is Railway using nixpacks or railpack for this service?**
   - What we know: Existing services should still use nixpacks. But Railway deprecated nixpacks and defaults new services to railpack.
   - What's unclear: Whether this specific service has been migrated.
   - Recommendation: Check Railway dashboard. If railpack, nixpacks.toml is ignored and system deps must be set via RAILPACK_DEPLOY_APT_PACKAGES env var.

3. **Does markdown_katex work on Railway?**
   - What we know: It's in requirements.txt. The code tries it first before falling back to npx katex.
   - What's unclear: Whether it imports successfully on Railway (it depends on Node.js being available for its subprocess calls too).
   - Recommendation: If the error is KaTeX-related, test by simplifying generate_pdf to skip math processing entirely and see if bare HTML PDFs work.

## Sources

### Primary (HIGH confidence)
- `backend/utils/pdf_renderer.py` -- full PDF pipeline code reviewed
- `backend/api/report.py` -- all PDF export endpoints reviewed
- `nixpacks.toml` -- current Railway deployment config reviewed
- `frontend/src/styles/global.css` -- button/input CSS classes reviewed
- All 16 component files in `frontend/src/components/` -- button/input patterns audited

### Secondary (MEDIUM confidence)
- [Railway Nixpacks docs](https://docs.railway.com/reference/nixpacks) -- nixpacks still supported for existing services
- [Railway Build Configuration](https://docs.railway.com/builds/build-configuration) -- RAILPACK_DEPLOY_APT_PACKAGES documented
- [WeasyPrint First Steps](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html) -- system dependencies and common errors
- [Railway Help: WeasyPrint on FastAPI](https://station.railway.com/questions/weasyprint-causing-failure-on-fast-api-de-fa15aad8) -- community solutions
- [Railway Help: WeasyPrint dependencies](https://station.railway.com/questions/cant-install-weasyprint-dependencies-d742101d) -- apt package list

### Tertiary (LOW confidence)
- Railway builder auto-migration behavior -- conflicting information on whether existing services are auto-migrated

## Metadata

**Confidence breakdown:**
- PDF debugging strategy: MEDIUM - we know the possible causes but not the actual error until Railway is hit
- CSS standardization: HIGH - full audit complete, clear path forward
- Railway deployment: LOW - uncertain whether nixpacks or railpack is active for this service

**Research date:** 2026-04-03
**Valid until:** 2026-04-17 (Railway deployment landscape may change)

## Project Constraints (from CLAUDE.md)

- Tech stack: React + Flask, no framework migration
- Deployment: Railway via nixpacks (but may have migrated to railpack) -- no Docker
- All styling in single `global.css` (no CSS modules, no styled-components, no Tailwind)
- CSS custom properties for theming
- Flask blueprints for API endpoints
- Error handling: try/except returning `{"error": "message"}` with status codes
- Frontend builds via `tsc -b && vite build`, served statically by Flask
- npm install uses `--legacy-peer-deps`
