# Domain Pitfalls

**Domain:** Physics/engineering lab automation -- adding dark theme, report generation, AI solver features
**Researched:** 2026-03-20
**Confidence:** HIGH (based on codebase analysis + established patterns)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: eval() + AI-Generated Equations = Remote Code Execution

**What goes wrong:** The ODE and Integration backends use `eval()` on user input (6 call sites across `ode.py` and `integrate.py`). Adding AI that generates equation strings and feeding them through `eval()` creates a code execution chain: attacker crafts a prompt injection that makes the AI output malicious Python code, which the server executes.
**Why it happens:** Developers add AI features on top of insecure foundations because "it works."
**Consequences:** Arbitrary code execution on the server. Full compromise.
**Prevention:** Replace ALL `eval()` calls with `sympy.sympify()` + `sympy.lambdify()` BEFORE adding AI to these pages. This is a blocking prerequisite, not a nice-to-have.
**Detection:** `grep -r "eval(" backend/` -- any hit outside of test code is a security bug.

### Pitfall 2: Dark Theme Blocked by 420 Inline Style Declarations

**What goes wrong:** You add CSS custom properties for dark mode, toggle a `[data-theme="dark"]` class on `<html>`, and nothing changes. The UI still shows white backgrounds because ~420 inline `style={{...}}` declarations across 15 components hardcode colors like `color: '#666'`, `background: '#fff'`. Inline styles have the highest CSS specificity -- they override any CSS variable.
**Why it happens:** The codebase was built with inline styles for speed. `global.css` uses CSS variables, but components bypass them. AutoLab.tsx alone has ~93 inline style declarations.
**Consequences:** Dark theme only partially works -- cards dark but text/icons/borders stay light. Unreadable mess.
**Prevention:**
1. Migrate inline styles to CSS classes/variables FIRST, before attempting dark theme
2. `grep -rn "style={{" frontend/src/` to create migration checklist
3. Budget 2-3x the time you'd estimate for "just adding dark mode" -- the migration IS the work
**Detection:** If a PR titled "Add dark theme" only touches `global.css`, it will be broken. Every component file must be modified.

### Pitfall 3: Plotly Charts Ignore CSS Variables

**What goes wrong:** Beautiful dark theme, but Plotly charts remain bright white rectangles. Plotly.js does not read CSS custom properties -- it uses its own JavaScript layout object (`plot_bgcolor`, `paper_bgcolor`, `font.color`).
**Why it happens:** Every chart hardcodes `plot_bgcolor: '#fafafa'` and `paper_bgcolor: '#fff'` directly in JSX layout props. Plotly renders to canvas/SVG outside the CSS cascade.
**Consequences:** Charts look broken in dark mode. Users perceive entire feature as buggy.
**Prevention:**
1. Create shared `getPlotLayout(isDark)` utility returning Plotly layout defaults
2. Override ALL color properties: plot_bgcolor, paper_bgcolor, font.color, axis gridlines, zeroline, legend background, hover labels, colorbar text
3. Charts must re-render on theme toggle (key change or `Plotly.relayout()`)
**Detection:** Toggle dark mode on any page with a chart. If chart stays white, this pitfall was not addressed.

### Pitfall 4: WeasyPrint System Dependencies on Railway

**What goes wrong:** WeasyPrint installs fine via pip but crashes at runtime with `OSError: cannot load library 'libpango'` because its C dependencies (pango, cairo, gdk-pixbuf, gobject-introspection) are system-level packages not included by default.
**Why it happens:** pip install succeeds (Python bindings install), but the actual C libraries are missing from the deployment environment.
**Consequences:** PDF export works locally (macOS has these via Homebrew) but breaks in production on Railway.
**Prevention:**
1. Add system packages to `nixpacks.toml` immediately when adding WeasyPrint
2. Test in a fresh environment (Docker or CI) before deploying
3. Run `python -c "import weasyprint"` in the production environment as a smoke test
**Detection:** `import weasyprint` fails in production but works locally.

### Pitfall 5: PDF Reports Cannot Render LaTeX Math

**What goes wrong:** You build PDF generation but discover it cannot render the LaTeX equations central to every analysis result. Physics reports without equations are useless.
**Why it happens:** WeasyPrint renders HTML/CSS but has no native LaTeX support. If KaTeX CSS and fonts are not bundled in the template, math renders as broken HTML.
**Consequences:** Raw LaTeX strings in PDF (`$\sigma = 0.05$`) or missing/broken math rendering.
**Prevention:**
1. KaTeX renders to HTML/CSS -- WeasyPrint CAN render this, but KaTeX CSS and fonts must be bundled locally (not loaded from CDN)
2. Bundle KaTeX CSS + font files in `backend/templates/fonts/`
3. Prototype early: generate PDF of Hooke's Law example and check that `k = 49.8 +/- 0.5 N/m` renders as proper math
4. Use `@font-face` with local paths, not `@import url(...)` from Google Fonts
**Detection:** Generate PDF, check if equations appear as formatted math vs raw text.

---

## Moderate Pitfalls

### Pitfall 6: Jinja2/LaTeX Syntax Conflict

**What goes wrong:** LaTeX uses `{`, `}`, `%`, `\` as control characters. Jinja2 uses `{%`, `{{`. Template fails to render or produces broken LaTeX.
**Prevention:** Configure Jinja2 with custom delimiters:
```python
latex_env = Environment(
    block_start_string='\\BLOCK{',
    block_end_string='}',
    variable_start_string='\\VAR{',
    variable_end_string='}',
)
```
This is well-known but easy to forget.

### Pitfall 7: matplotlib Thread Safety in Flask

**What goes wrong:** Two concurrent requests generate plots simultaneously via pyplot, corrupting each other's figures.
**Prevention:** Use the object-oriented API exclusively. Never `plt.figure()`, `plt.plot()`, `plt.savefig()`. Always `Figure()` + `FigureCanvasAgg`.

### Pitfall 8: AI Hallucinating Wrong Equations

**What goes wrong:** User describes "damped harmonic oscillator" and GPT outputs incorrect ODE (wrong sign, missing term). Solver runs it, producing plausible but wrong results.
**Prevention:**
1. System prompt includes canonical forms of common physics ODEs
2. AI outputs equation AND human-readable explanation of each term
3. UI shows equation to user for confirmation before solving
4. Never auto-solve without user approval

### Pitfall 9: Token Explosion from Solution Arrays

**What goes wrong:** ODE solutions contain 1000+ data points. Sending as AI context hits token limits, costs spike, responses fail.
**Prevention:** Summarize numerical results: send statistics (min, max, mean, final value, period) not raw arrays. Hard cap at 50 data points.

### Pitfall 10: eval() Removal Breaks Existing Expressions

**What goes wrong:** `sympy.sympify()` doesn't support the same syntax as Python `eval()`. Lambda expressions, `np.sin`, conditional expressions fail silently.
**Prevention:**
1. Catalog all expression patterns before removing eval()
2. Use `sympify()` with `locals` dict mapping common functions to SymPy equivalents
3. Convert via `lambdify()` for numerical evaluation
4. Test: `2*x+1`, `sin(x)`, `exp(-x)`, `x**2`, `x^2`, `pi`, `abs(x)`, `sqrt(x)`
5. Do NOT remove eval() and add AI features in the same phase

### Pitfall 11: AutoLab Refactoring During Feature Addition

**What goes wrong:** Refactoring AutoLab.tsx (1,141 lines) simultaneously with adding report export. Three concerns change at once, bugs are impossible to attribute, core feature regresses.
**Prevention:** Strict phase separation: refactor FIRST (same visual output), THEN change layout, THEN add export. Each extraction gets its own commit.

---

## Minor Pitfalls

### Pitfall 12: Theme Flicker on Page Load (FOUC)

**What goes wrong:** Theme read from localStorage in React effect causes flash of light theme before dark applies.
**Prevention:** Read localStorage in a `<script>` in `index.html` BEFORE React mounts:
```html
<script>
  const t = localStorage.getItem('tau-ly-theme') ||
    (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
</script>
```

### Pitfall 13: PDF Report File Size

**What goes wrong:** Base64 high-resolution PNGs make PDFs huge (10MB+).
**Prevention:** 150 DPI (not 300) for report plots. PNG format (not SVG -- WeasyPrint SVG is slow). Target: 50-100KB per plot, total PDF under 1MB.

### Pitfall 14: Font Loading in WeasyPrint PDFs

**What goes wrong:** WeasyPrint cannot load Google Fonts via `@import url(...)` -- needs local font files.
**Prevention:** Bundle report fonts (Inter, JetBrains Mono, KaTeX fonts) as local files in `backend/templates/fonts/`. Reference via `@font-face` with relative paths.

### Pitfall 15: Report Missing Quality Indicators

**What goes wrong:** Report looks professional but exports a poor fit without warnings. Misleading document.
**Prevention:** Include chi2/dof, p-value, R-squared prominently. Add visual warnings for poor fits. Report should be at least as critical as on-screen display.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Security fixes | eval() removal breaks ODE/Integration (#10) | Catalog expressions first; add tests |
| Security fixes | eval() + AI = RCE (#1) | Fix BEFORE adding AI |
| Dark theme | 420 inline styles block theming (#2) | Migrate inline styles first |
| Dark theme | Plotly charts stay white (#3) | Build getPlotLayout() utility |
| Dark theme | FOUC on load (#12) | Pre-hydration script in index.html |
| PDF export | WeasyPrint deps on Railway (#4) | Add nixpkgs early; test deployment |
| PDF export | Math rendering in PDF (#5) | Bundle KaTeX CSS/fonts; prototype early |
| PDF export | File size (#13) + font loading (#14) | 150 DPI; local fonts |
| LaTeX export | Jinja2 delimiter conflict (#6) | Custom delimiters from day one |
| AI solvers | Hallucinated equations (#8) | User confirmation required |
| AI solvers | Token explosion (#9) | Summarize results; cap 50 points |
| AutoLab refactor | Refactor + feature = regressions (#11) | Separate phases |
| matplotlib in Flask | Thread safety (#7) | Use OO API, never pyplot |

## Risk Summary by Phase

1. **Security phase** (moderate risk): eval() removal is tricky due to zero test coverage (#10). Fix carefully.
2. **Theme phase** (highest labor): 420 inline styles are the real work (#2). Theme toggle itself is trivial.
3. **Report generation** (highest technical uncertainty): KaTeX-in-PDF rendering (#5) and WeasyPrint deployment (#4) are unresolved. Prototype early.
4. **AI expansion** (lowest risk): Well-understood ChatAgent reuse pattern. Context sizing (#9) is the main concern.

## Sources

- Direct codebase analysis: `global.css`, component files (inline style counts), `ode.py`/`integrate.py` (eval calls)
- WeasyPrint deployment patterns from community documentation
- matplotlib thread safety from official FAQ
- Jinja2 LaTeX patterns from official documentation
- KaTeX rendering constraints from library behavior
