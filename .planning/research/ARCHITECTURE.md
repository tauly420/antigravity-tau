# Architecture Patterns

**Domain:** Physics/engineering lab automation -- dark theme, report generation, AI-assisted solvers
**Researched:** 2026-03-20

## Recommended Architecture

### High-Level Component Map (after changes)

```
                      AnalysisProvider (React Context)
                              |
                    ThemeProvider (new)
                              |
          +-------------------+-------------------+
          |                   |                   |
     App Shell           Tab Bar Nav          Sidebar
   (header/footer)    (replaces nav-bar)    (AI chat)
          |
    Route Switch
          |
  +-------+--------+--------+--------+
  |       |        |        |        |
AutoLab  ODE   Integrator  ...   Reports
  |       |        |                 |
  |   AIPanel   AIPanel        ReportBuilder
  |   (new)     (new)          (new)
  |
AutoLabResults (extracted)
  |
ReportExporter (new, shared)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ThemeProvider** (new) | Store theme preference, toggle dark/light, set `data-theme` on `<html>` | All components via context; persists to localStorage |
| **TabBar** (new) | Horizontal tab navigation with active state | React Router (`NavLink`), replaces current nav |
| **AIChatPanel** (new, shared) | Reusable inline AI chat panel for any tool page | Backend via `POST /api/assistant/chat` with page-specific context |
| **ReportBuilder** (new) | Configures and triggers report export | Backend `POST /api/report/pdf` and `/api/report/latex` |
| **AutoLabResults** (extracted) | Renders analysis results (summary, params, plots, N-sigma) | Extracted from AutoLab.tsx; receives typed props |
| **PlotlyTheme** (new utility) | Generates Plotly layout config per theme | Any component rendering charts |

### New Backend Structure

```
backend/api/report.py              # Report generation blueprint (PDF + LaTeX)
backend/templates/
  report.html                      # Jinja2 HTML template for WeasyPrint PDF
  report.tex                       # Jinja2 LaTeX template (custom delimiters)
  report.css                       # Print stylesheet (embedded in HTML)
  fonts/                           # Bundled KaTeX + JetBrains Mono fonts
backend/utils/
  plot_export.py                   # matplotlib OO API figure generation
  ai_tools.py                      # Shared OpenAI helpers (extracted from autolab)
```

## Data Flow

### Dark Theme Data Flow

```
Page load:
  -> <script> in index.html reads localStorage('tau-ly-theme')
  -> Sets document.documentElement.dataset.theme BEFORE React mounts
  -> No flash of wrong theme (FOUC prevention)

User clicks toggle:
  -> ThemeProvider.setTheme('dark')
  -> localStorage.setItem('tau-ly-theme', 'dark')
  -> document.documentElement.dataset.theme = 'dark'
  -> CSS variables swap via [data-theme="dark"] selector in global.css
  -> Plotly layouts receive theme-derived colors via usePlotlyTheme() hook
  -> Plot components re-render with new layout (key change or Plotly.relayout)
```

**Why CSS custom properties (not React state for colors):** The codebase already has 882 lines of CSS using variables. Adding a parallel React color system creates two sources of truth and causes full re-renders. CSS variables swap instantly with zero React re-rendering.

### Report Generation Data Flow

```
Frontend                              Backend
--------                              -------
"Export PDF" button clicks            POST /api/report/pdf
  sends: { analysisState }               |
                                         +-> plot_export.py: matplotlib generates figures (OO API)
                                         |     - Scatter + fit line + residuals
                                         |     - 150 DPI PNG, base64-encoded
                                         +-> Jinja2 renders report.html with:
                                         |     - Analysis data (params, chi2, formula, nsigma)
                                         |     - Base64 figure images
                                         |     - KaTeX CSS + fonts bundled locally
                                         +-> WeasyPrint converts HTML string -> PDF bytes
                                         +-> Response(pdf_bytes, mimetype="application/pdf")
  receives: blob
  triggers: URL.createObjectURL(blob) -> download

"Export LaTeX" button clicks          POST /api/report/latex
  sends: { analysisState }               |
                                         +-> plot_export.py: matplotlib generates PNGs
                                         +-> Jinja2 renders report.tex (custom delimiters)
                                         +-> zipfile bundles: report.tex + figure_*.png
                                         +-> Response(zip_bytes, mimetype="application/zip")
  receives: blob
  triggers: download .zip
```

**Why server-side PDF (WeasyPrint) not client-side (jsPDF/html2canvas):**
- KaTeX renders to HTML/CSS; WeasyPrint renders HTML/CSS to PDF with vector quality
- html2canvas produces raster screenshots -- math is blurry
- Backend has all analysis data and matplotlib for clean static plots
- Report layout can be optimized for print (separate from screen layout)

### AI-Assisted Solver Data Flow

```
User fills ODE form + clicks "AI Help"
  -> AIChatPanel renders inline below form
  -> User types: "What method should I use for this stiff system?"
  -> AIChatPanel calls POST /api/assistant/chat with:
      {
        message: "...",
        context: {
          currentTool: "ODE Solver",
          pageState: {
            equation: "y'' + 0.5*y' + 9.81*sin(y) = 0",
            method: "RK45",
            params: { t_span: [0, 10], y0: [0.5, 0] }
          },
          lastResult: {  // SUMMARIZED, not full arrays
            final_value: [0.001, -0.003],
            max_y: 0.498,
            num_points: 200,
            appears_oscillatory: true,
            estimated_period: 2.01
          }
        }
      }
  -> ChatAgent builds system prompt with ODE-specific context
  -> OpenAI returns advice
  -> AIChatPanel renders response with LaTeX support
  -> Optional: AI suggests parameter changes, user applies to form
```

**Why reuse ChatAgent, not AutoLab-style orchestrator:** ODE/Integration AI needs conversation (Q&A about equations, method selection, result interpretation) -- not autonomous multi-step execution. The ChatAgent already supports arbitrary context injection. Adding function-calling orchestration would add complexity, latency, and cost for no benefit.

**Critical context sizing rule:** Never send full solution arrays to AI. Summarize: final values, extrema, period estimates, convergence info. Cap at 50 data points maximum. Full solution arrays (1000+ points) blow up token counts.

## Patterns to Follow

### Pattern 1: CSS Custom Property Theming
**What:** All colors as CSS custom properties in `:root`, overridden in `[data-theme="dark"]`.
**When:** Every component, every new style.
```css
:root {
    --bg: #f5f5f7;
    --surface: #ffffff;
    --text: #1a1a2e;
}

[data-theme="dark"] {
    --bg: #0d1117;
    --surface: #161b22;
    --text: #e6edf3;
    --text-secondary: #8b949e;
    --border: #30363d;
}
```

### Pattern 2: matplotlib Object-Oriented API (Thread Safety)
**What:** Use `Figure`/`FigureCanvas` directly, never `plt.*` functions.
**When:** All server-side plot generation.
```python
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg
import io, base64

def generate_fit_plot(x, y, y_fit, residuals) -> str:
    fig = Figure(figsize=(8, 5), dpi=150)
    canvas = FigureCanvasAgg(fig)
    ax = fig.add_subplot(111)
    ax.errorbar(x, y, fmt='o', markersize=4)
    ax.plot(x, y_fit, 'r-', linewidth=1.5)
    buf = io.BytesIO()
    canvas.print_png(buf)
    return base64.b64encode(buf.getvalue()).decode()
```
**Why:** pyplot is not thread-safe. Two concurrent Flask requests sharing pyplot state corrupt each other's figures.

### Pattern 3: Shared AIChatPanel Component
**What:** Generic chat UI extracted from AutoLab, parameterized by endpoint and context.
```typescript
interface AIChatPanelProps {
    toolName: string;
    pageContext: Record<string, unknown>;
    placeholder?: string;
}
```
**When:** Adding AI to any tool page. AutoLab chat should also migrate to this.

### Pattern 4: Jinja2 with Custom Delimiters for LaTeX
**What:** Avoid Jinja2/LaTeX syntax conflicts.
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
**When:** Any .tex template generation.

### Pattern 5: Report Data Contract
**What:** TypeScript interface defining analysis results for report generation.
```typescript
interface ReportData {
    title: string;
    timestamp: string;
    fit?: { model: string; parameters: ParamRow[]; chi2_dof: number; p_value: number; r_squared: number; };
    formula?: { expression: string; result: string; uncertainty: string; };
    nsigma?: { measured: string; theoretical: string; n_sigma: number; };
    summary: string;
}
```
**When:** Both PDF and LaTeX exporters consume this same contract.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Hardcoded Colors Anywhere
**What:** Using hex values in inline styles or CSS instead of variables.
**Why bad:** Breaks theming. Every hardcoded color is a dark-mode bug.
**Instead:** Always `var(--token-name)`. Grep for hex values during code review.

### Anti-Pattern 2: pyplot in Flask
**What:** Using `plt.figure()`, `plt.plot()`, `plt.savefig()` in a web backend.
**Why bad:** Not thread-safe. Concurrent requests corrupt each other's plots.
**Instead:** `Figure()` + `FigureCanvasAgg` object-oriented API.

### Anti-Pattern 3: Duplicated Chat UIs
**What:** Copy-pasting AutoLab chat code into ODE and Integration.
**Why bad:** Three copies of the same UI. Triple bug fixes.
**Instead:** Extract shared `AIChatPanel` component.

### Anti-Pattern 4: eval() for AI-Generated Equations
**What:** Passing AI output through `eval()`.
**Why bad:** Remote code execution via prompt injection.
**Instead:** `sympy.sympify()` -> `sympy.lambdify()`.

### Anti-Pattern 5: Sending Full Solution Arrays to AI
**What:** Serializing 1000+ data points as AI context.
**Why bad:** Token explosion, API failures, cost spikes.
**Instead:** Summarize to statistics (min, max, mean, period, final value). Cap at 50 points.

## Scalability Considerations

| Concern | Current (< 100 users) | At 1K concurrent | Notes |
|---------|----------------------|-------------------|-------|
| PDF generation | Synchronous in request (1-2s) | Add task queue (Celery/RQ) | WeasyPrint is CPU-heavy |
| matplotlib rendering | In-process (< 500ms) | Same -- fast enough | Thread-safe with OO API |
| OpenAI API calls | Direct per request | Add rate limiting middleware | Already a concern |
| Theme switching | Instant (CSS variable swap) | Instant | No scaling concern |
| LaTeX generation | String templating (< 100ms) | Same -- trivial | No scaling concern |

## Sources

- Current codebase analysis: `global.css` (CSS variables), `AutoLab.tsx` (1,141 lines, inline styles), `ode.py`/`integrate.py` (eval calls)
- CSS custom properties theming: standard MDN-documented pattern
- matplotlib thread safety: documented in matplotlib FAQ
- WeasyPrint HTML-to-PDF: https://weasyprint.org/
- Jinja2 LaTeX custom delimiters: documented pattern in Jinja2 docs

---
*Architecture analysis: 2026-03-20*
