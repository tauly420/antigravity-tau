# Technology Stack

**Project:** Tau-LY Milestone 2 (Dark Theme + Report Generation + AI-Assisted Solvers)
**Researched:** 2026-03-20
**Note:** WebSearch/WebFetch were unavailable during this research pass. Versions are from training data (cutoff May 2025). Versions marked with (*) should be verified with `npm view <pkg> version` or `pip index versions <pkg>` before installing.

## Recommended Additions to Existing Stack

The existing stack (React 19 + Vite 7 + Flask + SciPy/SymPy/NumPy + OpenAI) is kept as-is. Below are additions only.

---

### 1. Dark Science Theme

| Technology | Version* | Purpose | Why |
|------------|----------|---------|-----|
| CSS Custom Properties (existing) | n/a | Theme system | Already in use (`global.css` design tokens in `:root`). Add `[data-theme="dark"]` selector with dark overrides. Zero new dependencies. |
| `Inter` + `JetBrains Mono` fonts | n/a | Typography | Inter already loaded via Google Fonts. Add JetBrains Mono for code/numbers -- monospaced digits are essential for scientific data tables and parameter readouts. |
| Plotly `plotly_dark` template | built-in | Dark chart theming | Plotly ships dark templates. Create a shared `getPlotLayout(isDark)` utility that returns Plotly layout overrides. No library needed. |

**Rationale: No component library.**

The project uses zero UI component libraries -- just vanilla CSS with design tokens (`:root` block in `global.css`). Adding a component library (Mantine, MUI, Radix) would require rewriting all 15+ existing components. The correct approach is:

1. Define dark token set in `global.css` under `[data-theme="dark"]`
2. Migrate ~420 inline `style={{}}` declarations to use CSS variables (this is the real work)
3. Add a ThemeProvider context + toggle that sets `document.documentElement.dataset.theme`
4. Persist preference to `localStorage`; use pre-hydration `<script>` to avoid FOUC
5. Create `getPlotLayout(isDark)` utility for Plotly chart colors

This is CSS refactoring + ~200 lines of new dark token definitions, not a library adoption.

**Confidence:** HIGH -- CSS custom properties theming is a standard pattern. The codebase already uses CSS variables.

#### Alternatives Considered

| Option | Why Not |
|--------|---------|
| Mantine UI | Would require rewriting every component to use Mantine primitives. Overkill for theming an existing app with 15+ custom components. |
| MUI / Material UI | Same migration cost. Also adds 200KB+ to bundle. Material Design aesthetic doesn't match "instrument dashboard" goal. |
| Radix UI Themes | Lighter, but still requires wrapping all components. |
| Tailwind CSS | Good for new projects, but migrating existing CSS classes is busywork with no structural gain. |
| CSS-in-JS (styled-components, emotion) | Runtime overhead, and the codebase already uses plain CSS effectively. |

---

### 2. PDF + LaTeX Report Generation

| Technology | Version* | Purpose | Why |
|------------|----------|---------|-----|
| `weasyprint` | >=62.0* | HTML/CSS to PDF | Best Python HTML-to-PDF engine for publication-quality output. Supports CSS grid, flexbox, `@page` rules, embedded fonts. |
| `jinja2` | >=3.1.0 | HTML + LaTeX templating | Already a Flask dependency (Flask depends on Jinja2). Use for both HTML report templates and .tex source generation. |
| `matplotlib` | >=3.8.0* | Static plot images for reports | Generate publication-quality PNG figures for embedding in PDF/LaTeX. Plotly is interactive-only; matplotlib produces clean static output. |
| `dompurify` (npm) | >=3.0.0* | Sanitize KaTeX HTML for reports | Already needed for XSS prevention; also useful for sanitizing HTML before PDF generation. |

**Architecture: Dual-path report generation.**

```
"Export PDF" button
  -> Frontend sends analysis state to POST /api/report/pdf
  -> Backend renders Jinja2 HTML template with data
  -> matplotlib generates figure PNGs (base64-embedded in HTML)
  -> KaTeX CSS + fonts bundled locally in the template
  -> WeasyPrint converts HTML to PDF
  -> Returns PDF as binary response (Content-Type: application/pdf)

"Export LaTeX" button
  -> Frontend sends analysis state to POST /api/report/latex
  -> Backend renders Jinja2 .tex template with data
  -> matplotlib generates figure PNGs
  -> Returns .zip containing report.tex + figure PNGs
```

**The key technical challenge is math rendering in PDF.** Options analysis:

| Approach | Math Rendering | Quality | Deployment Complexity |
|----------|---------------|---------|----------------------|
| WeasyPrint + KaTeX HTML | KaTeX renders to HTML/CSS, WeasyPrint renders that | HIGH (vector) | MEDIUM (needs system libs) |
| Client-side html2canvas + jsPDF | Screenshots rendered DOM | LOW (raster, blurry) | LOW (no server deps) |
| Puppeteer/Playwright headless | Full browser rendering | HIGH | HIGH (Chromium binary ~400MB) |
| window.print() / browser PDF | Native browser print | MEDIUM | NONE |
| reportlab | Manual layout API | MEDIUM | LOW |

**Recommendation: WeasyPrint + KaTeX HTML (server-side).**

WeasyPrint renders HTML/CSS to PDF with high fidelity. KaTeX output is HTML/CSS (not canvas), so WeasyPrint can render it directly. The key requirement: bundle KaTeX CSS and fonts locally in the HTML template (WeasyPrint cannot fetch from CDNs). This produces vector-quality math in the PDF.

The prior research pass recommended client-side PDF generation. After analysis, server-side is better because:
1. KaTeX HTML renders cleanly in WeasyPrint (vector, not raster screenshots)
2. matplotlib generates better static plots than Plotly's toImage() export
3. The backend already has all analysis data -- no need to serialize and send it from frontend
4. Report layout can be optimized for print (different from screen layout)

**WeasyPrint deployment on Railway/nixpacks:**
```toml
# nixpacks.toml -- add system dependencies
[phases.setup]
nixPkgs = ["python3", "nodejs_23", "pango", "cairo", "gdk-pixbuf", "gobject-introspection"]
```

This is the highest deployment risk. Test early by running `python -c "import weasyprint"` in the Railway environment.

**Confidence:** MEDIUM -- WeasyPrint is well-established but: (a) version needs live verification, (b) nixpacks package names need testing on Railway, (c) KaTeX CSS rendering in WeasyPrint needs prototype validation.

**Why WeasyPrint over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| `reportlab` | Imperative API -- draw rectangles, place text at coordinates. Tedious for complex layouts with math. |
| `fpdf2` | Same problem as reportlab. No CSS support. |
| `pdflatex` / `xelatex` subprocess | Requires full TeX Live (4GB+). Cannot deploy on Railway without major config. |
| `pandoc` subprocess | Extra binary dependency. Good for markdown-to-PDF but we control the template. |
| Client-side `jsPDF` + `html2canvas` | Produces raster screenshots. Math is blurry. Large files. |
| Client-side `@react-pdf/renderer` | Cannot render KaTeX math. Would need to rebuild all result components in react-pdf primitives. |
| Puppeteer/Playwright | Chromium binary is ~400MB. Hard to deploy on Railway. |

**LaTeX source generation (separate from PDF):**

Users want editable .tex files to paste into their lab reports. This is a first-class output, not an intermediate step. Generate from a Jinja2 `.tex` template with custom delimiters to avoid LaTeX/Jinja2 syntax conflicts:
```python
latex_env = Environment(
    block_start_string='\\BLOCK{',
    block_end_string='}',
    variable_start_string='\\VAR{',
    variable_end_string='}',
    comment_start_string='\\#{',
    comment_end_string='}',
    loader=FileSystemLoader("templates")
)
```

---

### 3. AI-Assisted ODE/Integration Solvers

| Technology | Version* | Purpose | Why |
|------------|----------|---------|-----|
| `openai` (existing) | >=1.40.0 | AI equation setup + interpretation | Already in use for AutoLab. Reuse the same client. |
| OpenAI `gpt-4o-mini` (existing) | current | Model for solver AI | Same model as AutoLab. Fast, cheap, good at math. No reason to use a different model. |

**Architecture: Reuse ChatAgent, NOT AutoLab's function-calling orchestrator.**

The ODE/Integration AI needs three things:
1. **Equation setup** -- user describes physics problem, AI outputs the ODE/integral in SymPy syntax
2. **Method advice** -- AI recommends solver method based on equation properties
3. **Result interpretation** -- after solving, AI explains the solution

This is **conversational assistance**, not autonomous multi-step execution. The existing `ChatAgent` (`app/chat_agent.py`) already handles this pattern:
- Accepts arbitrary context via the `POST /api/assistant/chat` endpoint
- Injects context into system prompt
- Supports multi-turn conversation

**What to build:**
1. Extract a shared `AIChatPanel.tsx` component from the AutoLab post-analysis chat UI
2. Embed it in `ODESolver.tsx` and `NumericalIntegrator.tsx`
3. Enrich the `ChatAgent` system prompt with ODE/Integration domain knowledge (method selection heuristics, common physics ODEs, SymPy syntax guide)
4. Send page state as context: equation, parameters, method, results summary (NOT full solution arrays -- cap at 50 data points to avoid token explosion)

**No new libraries or API integrations needed.**

**Critical prerequisite:** Replace `eval()` with `sympy.sympify()` + `sympy.lambdify()` in `ode.py` and `integrate.py` BEFORE adding AI. AI-generated equations + eval() = remote code execution via prompt injection.

**Confidence:** HIGH -- direct extension of existing architecture using the same libraries.

| Alternative | Why Not |
|-------------|---------|
| AutoLab-style function-calling orchestrator | Overkill for conversational help. Adds complexity, latency, and API cost. |
| Local LLM (Ollama, llama.cpp) | Adds deployment complexity. GPT-4o-mini is cheap and already integrated. |
| LangChain | Unnecessary abstraction. Direct OpenAI SDK is simpler and proven in AutoLab. |
| Wolfram Alpha API | Paid, rate-limited. SymPy already does symbolic math locally. |
| Anthropic Claude API | Would add a second AI provider. Consistency matters. |

---

## Complete New Dependencies

### Backend (add to `requirements.txt`)

```
weasyprint>=62.0
matplotlib>=3.8.0
```

(`jinja2` is already a Flask dependency. `dompurify` is frontend-only.)

### Frontend (add to `package.json`)

```bash
npm install dompurify
npm install -D @types/dompurify
```

DOMPurify is for XSS prevention on AI-generated HTML (security fix), also useful for sanitizing report HTML. No other new frontend packages needed -- dark theme is CSS-only, report export calls backend endpoints.

### Infrastructure (update `nixpacks.toml`)

```toml
[phases.setup]
nixPkgs = ["python3", "nodejs_23", "pango", "cairo", "gdk-pixbuf", "gobject-introspection"]
```

### New Backend Files

```
backend/api/report.py              # Report generation blueprint
backend/templates/report.html      # Jinja2 HTML template for PDF
backend/templates/report.tex       # Jinja2 LaTeX template
backend/templates/report.css       # Print stylesheet (embedded)
backend/templates/fonts/           # Bundled KaTeX + JetBrains Mono fonts
backend/utils/plot_export.py       # matplotlib figure generation
backend/utils/ai_tools.py          # Shared OpenAI helpers (extracted from autolab)
```

### New Frontend Files

```
frontend/src/context/ThemeContext.tsx         # Theme provider + toggle
frontend/src/utils/plotTheme.ts              # Plotly layout config per theme
frontend/src/components/shared/AIChatPanel.tsx  # Reusable AI chat component
```

---

## Installation

```bash
# Backend additions
pip install weasyprint>=62.0 matplotlib>=3.8.0

# Frontend additions
cd frontend && npm install dompurify && npm install -D @types/dompurify

# Verify WeasyPrint system deps (must have pango/cairo installed)
python -c "import weasyprint; weasyprint.HTML(string='<h1>test</h1>').write_pdf('/tmp/test.pdf')"

# Verify matplotlib
python -c "from matplotlib.figure import Figure; print('matplotlib OK')"
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Dark theme (CSS tokens, no library) | HIGH | Standard pattern; codebase already uses CSS variables. Main work is inline style migration. |
| WeasyPrint for PDF | MEDIUM | Library is proven but: version unverified, nixpacks config needs testing, KaTeX rendering needs prototype. |
| Jinja2 for LaTeX templates | HIGH | Already a Flask dependency. Custom delimiters for LaTeX are well-documented. |
| matplotlib for report figures | HIGH | De facto standard. Use OO API (not pyplot) for thread safety in Flask. |
| AI-assisted solvers (ChatAgent reuse) | HIGH | Endpoint already supports arbitrary context. Only system prompt changes needed. |
| eval() -> sympify migration | HIGH | Well-documented SymPy pattern. Security-critical prerequisite. |
| DOMPurify for XSS | HIGH | Standard solution. Small package. |

## Sources

All recommendations based on training data (cutoff May 2025) and codebase analysis. WebSearch and WebFetch were unavailable during research.

- WeasyPrint: https://weasyprint.org/
- Jinja2 LaTeX templating: https://jinja.palletsprojects.com/
- matplotlib OO API: https://matplotlib.org/stable/api/figure_api.html
- Plotly.js templates: https://plotly.com/javascript/templates/
- OpenAI function calling: https://platform.openai.com/docs/guides/function-calling
- KaTeX: https://katex.org/ (already in use)
- DOMPurify: https://github.com/cure53/DOMPurify
- SymPy sympify: https://docs.sympy.org/latest/modules/core.html#sympy.core.sympify.sympify
