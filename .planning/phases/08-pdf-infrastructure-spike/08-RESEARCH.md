# Phase 8: PDF Infrastructure Spike - Research

**Researched:** 2026-03-23
**Domain:** Server-side PDF generation with Hebrew RTL text and LaTeX math equations
**Confidence:** MEDIUM

## Summary

This phase validates that WeasyPrint can generate Hebrew RTL PDFs with inline English math equations on Railway. The core pipeline is: Python constructs HTML with embedded KaTeX-rendered math -> WeasyPrint converts HTML+CSS to PDF. The critical risks are (1) KaTeX font rendering in WeasyPrint, (2) Hebrew RTL + English LTR bidirectional text mixing, and (3) WeasyPrint system library availability on Railway via nixpacks.

WeasyPrint 68.1 (current) uses Pango for text layout, which handles the Unicode Bidirectional Algorithm natively. RTL support has been functional since WeasyPrint ~v43 (2018+). KaTeX rendering issues with WeasyPrint were resolved in WeasyPrint v48 (2019), though font bundling requires explicit configuration. The `markdown-katex` Python package provides a proven bridge: it calls the KaTeX CLI via subprocess to render LaTeX to static HTML, with a `no_inline_svg` option specifically for WeasyPrint compatibility.

Railway deployment uses nixpacks, which already provisions `nodejs_23` -- this is required because KaTeX rendering happens via a Node.js subprocess. The main deployment risk is ensuring all WeasyPrint system libraries (pango, cairo, gdk-pixbuf, fontconfig, harfbuzz) are available in the nixpacks build.

**Primary recommendation:** Use `markdown-katex` for LaTeX-to-HTML conversion (it wraps KaTeX CLI via subprocess, already handles the `no_inline_svg` workaround), WeasyPrint for HTML-to-PDF, bundled Noto Sans Hebrew + KaTeX fonts committed to the repo, and explicit nixpkgs additions for system libraries.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Claude's Discretion on throwaway vs foundation balance -- write clean code where practical, but don't over-engineer for a spike. Core rendering logic should be reusable by Phase 11 if it works well.
- **D-02:** Keep `/api/report/test-pdf` as a permanent debug endpoint -- useful for diagnosing rendering issues on Railway production. Can be gated behind a dev flag later.
- **D-03:** New module at `backend/api/report.py` as a Flask blueprint registered at `/api/report/*`, following the existing codebase convention (like `autolab.py`, `fitting.py`).
- **D-04:** Target intro physics level -- mechanics, waves, optics, basic E&M. Matches existing AutoLab examples (Hooke's Law, Oscillation, Free Fall).
- **D-05:** Special attention to `\text{}` inside math mode -- expressions like `$k = 49.8 \pm 0.5 \text{ N/m}$` are a known rendering risk when adjacent to Hebrew RTL text.
- **D-06:** Equations are always English/Latin notation; Hebrew appears only in surrounding paragraph text. This is the Israeli academic standard.
- **D-07:** Rendering correctness verified by visual inspection of a generated test PDF. No automated pixel-comparison or text-extraction tests at this stage.

### Claude's Discretion
- PDF visual style (margins, font sizes, page layout) -- no user preferences yet; use reasonable academic defaults
- Railway fallback strategy if WeasyPrint + KaTeX CSS fails -- determine during implementation
- Font bundling approach (repo-committed vs build-time download)
- KaTeX rendering method (HTML/CSS vs SVG) -- pick what works with WeasyPrint

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | User can download a publication-quality A4 PDF lab report with Hebrew RTL body text and English LTR math equations | WeasyPrint handles RTL via Pango bidi algorithm; CSS `direction: rtl` + `unicode-bidi: embed` for Hebrew paragraphs; math rendered as inline LTR spans |
| PDF-02 | PDF renders LaTeX equations (inline and display) correctly within Hebrew paragraphs | markdown-katex with `no_inline_svg=True` produces WeasyPrint-compatible HTML; KaTeX fonts must be bundled locally; issue #867 fixes landed in WeasyPrint v48 |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| weasyprint | >=68.0 | HTML/CSS to PDF conversion | Only Python PDF lib that supports both CSS paged media and RTL text via Pango; actively maintained |
| markdown-katex | >=202406.1035 | LaTeX to HTML rendering (wraps KaTeX CLI) | Proven WeasyPrint integration; `no_inline_svg` option; handles subprocess management |
| katex (npm) | >=0.16.0 | Math typesetting engine (called via CLI by markdown-katex) | Already in frontend dependencies; fastest math renderer; HTML/CSS output (no JS needed at render time) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Noto Sans Hebrew (font) | Latest from Google Fonts | Hebrew body text in PDF | Bundled in repo at `backend/fonts/`; registered via CSS `@font-face` |
| KaTeX fonts (font files) | Matching katex npm version | Math symbol rendering | Bundled alongside KaTeX CSS; referenced by `@font-face` rules in KaTeX stylesheet |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| markdown-katex | Direct subprocess call to `npx katex` | markdown-katex handles caching, `no_inline_svg`, font CSS insertion; rolling your own adds complexity |
| WeasyPrint | Puppeteer/Playwright headless Chrome | Full browser = heavier deploy, more memory, but would handle any CSS; overkill for this use case |
| Bundled fonts in repo | Build-time font download | Repo-committed is simpler, more reliable on Railway, no network dependency at build time |

**Installation:**
```bash
# Python
pip install weasyprint>=68.0 markdown-katex>=202406.1035

# npm (KaTeX CLI for markdown-katex to invoke)
npm install -g katex
# OR ensure katex is in frontend/node_modules (already present)
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
  api/
    report.py            # Flask blueprint: /api/report/*
  utils/
    pdf_renderer.py      # HTML template assembly + WeasyPrint PDF generation
  fonts/
    NotoSansHebrew-Regular.ttf
    NotoSansHebrew-Bold.ttf
    katex-fonts/          # KaTeX .woff2 font files
  templates/
    report_base.html      # Jinja2 HTML template for PDF
    report_styles.css     # Page layout, RTL, font-face declarations
```

### Pattern 1: LaTeX-to-HTML Pipeline
**What:** Convert LaTeX expressions in text to static HTML before passing to WeasyPrint
**When to use:** Every time text containing `$...$` or `$$...$$` delimiters needs to go into a PDF
**Example:**
```python
# Source: markdown-katex docs + WeasyPrint integration pattern
from markdown_katex.extension import tex2html

def render_latex_for_pdf(latex_expr: str, display_mode: bool = False) -> str:
    """Convert a single LaTeX expression to WeasyPrint-compatible HTML."""
    options = {
        'no_inline_svg': True,       # Required for WeasyPrint
        'insert_fonts_css': False,   # We bundle fonts ourselves
    }
    if display_mode:
        return tex2html(latex_expr, options)
    else:
        return tex2html(latex_expr, options)

def process_text_with_math(text: str) -> str:
    """Replace $...$ and $$...$$ in text with rendered KaTeX HTML."""
    import re
    # Display math first (greedy match for $$...$$)
    text = re.sub(
        r'\$\$([\s\S]*?)\$\$',
        lambda m: f'<div class="math-display">{render_latex_for_pdf(m.group(1), display_mode=True)}</div>',
        text
    )
    # Inline math (non-greedy match for $...$)
    text = re.sub(
        r'(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)',
        lambda m: f'<span class="math-inline" dir="ltr">{render_latex_for_pdf(m.group(1), display_mode=False)}</span>',
        text
    )
    return text
```

### Pattern 2: RTL + LTR Bidirectional Layout
**What:** Hebrew body text flows RTL; math equations are LTR inline elements
**When to use:** Every Hebrew paragraph that contains math
**Example:**
```html
<!-- Source: CSS bidi spec + WeasyPrint RTL support -->
<html dir="rtl" lang="he">
<body>
  <p dir="rtl" style="direction: rtl; unicode-bidi: embed;">
    <!-- Hebrew paragraph with inline math -->
    ...Hebrew text here...
    <span class="math-inline" dir="ltr" style="direction: ltr; unicode-bidi: embed;">
      <!-- KaTeX-rendered HTML here -->
    </span>
    ...more Hebrew text...
  </p>
</body>
</html>
```

### Pattern 3: Font Bundling with CSS @font-face
**What:** Declare fonts via CSS so WeasyPrint finds them without system install
**When to use:** Always -- Railway has no pre-installed Hebrew or math fonts
**Example:**
```css
/* Source: WeasyPrint font docs + Google Fonts */
@font-face {
    font-family: 'Noto Sans Hebrew';
    src: url('file:///app/backend/fonts/NotoSansHebrew-Regular.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
}
@font-face {
    font-family: 'Noto Sans Hebrew';
    src: url('file:///app/backend/fonts/NotoSansHebrew-Bold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
}

/* KaTeX fonts -- reference the bundled .woff2 files */
@font-face {
    font-family: 'KaTeX_Main';
    src: url('file:///app/backend/fonts/katex-fonts/KaTeX_Main-Regular.woff2') format('woff2');
    font-weight: normal;
    font-style: normal;
}
/* ... repeat for KaTeX_Math, KaTeX_AMS, KaTeX_Size1-4, etc. */

body {
    font-family: 'Noto Sans Hebrew', sans-serif;
    direction: rtl;
    unicode-bidi: embed;
}

.math-inline, .math-display {
    direction: ltr;
    unicode-bidi: embed;
    font-family: 'KaTeX_Main', 'KaTeX_Math', serif;
}
```

### Pattern 4: WeasyPrint PDF Generation
**What:** Convert assembled HTML to PDF
**When to use:** Final step of the rendering pipeline
**Example:**
```python
# Source: WeasyPrint docs
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration
import os

def generate_pdf(html_content: str) -> bytes:
    """Generate PDF from HTML string with bundled fonts."""
    font_config = FontConfiguration()

    # Base URL for resolving relative paths to fonts/images
    base_url = os.path.dirname(os.path.abspath(__file__))

    html = HTML(string=html_content, base_url=base_url)
    pdf_bytes = html.write_pdf(font_configuration=font_config)
    return pdf_bytes
```

### Pattern 5: Flask Binary File Response
**What:** Return PDF as downloadable file from Flask endpoint
**When to use:** The test endpoint and future report download
**Example:**
```python
# Source: Flask docs
from flask import Blueprint, Response

report_bp = Blueprint('report', __name__)

@report_bp.route('/test-pdf', methods=['GET'])
def test_pdf():
    """Generate and return a test PDF for infrastructure validation."""
    try:
        pdf_bytes = generate_test_pdf()
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={'Content-Disposition': 'inline; filename="test-report.pdf"'}
        )
    except Exception as e:
        return {"error": str(e)}, 500
```

### Anti-Patterns to Avoid
- **Inline KaTeX CSS from CDN:** WeasyPrint cannot fetch remote resources at render time on Railway. All CSS and fonts must be local.
- **Using `markdown-katex` with `insert_fonts_css=True` in production:** It inserts CDN links. Set to `False` and use your own bundled `@font-face` declarations.
- **System-level font installation at runtime:** Don't rely on `fc-cache` or system font dirs. Use CSS `@font-face` with explicit file paths.
- **SVG inline in KaTeX output:** WeasyPrint has a long-standing SVG rendering limitation. Always use `no_inline_svg=True`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LaTeX to HTML rendering | Custom regex-based LaTeX parser | markdown-katex (wraps KaTeX CLI) | LaTeX parsing is enormously complex; KaTeX handles thousands of edge cases |
| SVG-to-img conversion for WeasyPrint | Manual base64 encoding of SVG | `no_inline_svg=True` in markdown-katex | markdown-katex already handles this conversion |
| RTL text layout algorithm | Custom character-level bidi logic | CSS `direction: rtl` + Pango (via WeasyPrint) | Unicode Bidi Algorithm is a W3C spec; Pango implements it |
| PDF page layout (headers, footers, page numbers) | Manual coordinate placement | CSS `@page` rules in WeasyPrint | WeasyPrint supports CSS Paged Media spec |
| Font subsetting/embedding | Manual font processing | WeasyPrint auto-embeds fonts referenced via `@font-face` | WeasyPrint handles font embedding in PDF automatically |

**Key insight:** The entire pipeline relies on existing tools doing what they do best -- KaTeX for math, WeasyPrint/Pango for layout, CSS for styling. The spike's job is to prove they work together, not to build custom rendering.

## Common Pitfalls

### Pitfall 1: KaTeX Fonts Not Found by WeasyPrint
**What goes wrong:** Math equations render with fallback system fonts instead of proper KaTeX math fonts, producing ugly or incorrect output.
**Why it happens:** WeasyPrint uses Pango for font resolution, which looks at system fonts and CSS `@font-face` declarations. KaTeX CSS references fonts via relative paths that may not resolve in WeasyPrint's context.
**How to avoid:** Bundle KaTeX font files (.woff2) in the repo. Write explicit `@font-face` rules with absolute `file:///` paths or paths relative to a known `base_url`. Test font loading early.
**Warning signs:** Math symbols appear as boxes, question marks, or in a serif font instead of the expected KaTeX math font.

### Pitfall 2: SVG Rendering Failures in WeasyPrint
**What goes wrong:** KaTeX by default uses inline SVG for some elements (square roots, extensible arrows, etc.). WeasyPrint does not render inline SVG correctly.
**Why it happens:** Long-standing WeasyPrint limitation with inline `<svg>` elements (GitHub issue #867, fixed for layout but SVG sizing remains fragile).
**How to avoid:** Always use `no_inline_svg=True` when rendering KaTeX for WeasyPrint. This converts inline SVGs to `<img>` tags with base64-encoded SVG data.
**Warning signs:** Square root signs missing, fraction bars invisible, extensible brackets broken.

### Pitfall 3: Bidirectional Text Mixing Breaks Math Placement
**What goes wrong:** Inline math equations appear at the wrong position in a Hebrew sentence, or the sentence reorders incorrectly.
**Why it happens:** The Unicode Bidi Algorithm treats LTR content within RTL context as an "embedding" that can be reordered. If bidi control characters or CSS properties are missing, the browser/renderer may place the math in unexpected positions.
**How to avoid:** Wrap every inline math expression in a `<span dir="ltr">` with `unicode-bidi: embed`. Set the paragraph to `dir="rtl"`. Test with sentences that have math at the beginning, middle, and end.
**Warning signs:** Math appears at line start instead of inline; numbers in math reorder with Hebrew text.

### Pitfall 4: WeasyPrint System Libraries Missing on Railway
**What goes wrong:** `ImportError: cannot load library 'libgobject-2.0-0'` or similar at runtime on Railway.
**Why it happens:** WeasyPrint depends on C libraries (cairo, pango, gdk-pixbuf, gobject) that nixpacks does not provision by default.
**How to avoid:** Add explicit nixPkgs to `nixpacks.toml`: `pango`, `cairo`, `gdk-pixbuf`, `glib`, `gobject-introspection`, `fontconfig`, `harfbuzz`, `pkg-config`, `shared-mime-info`, `libffi`.
**Warning signs:** Works locally (macOS has these via Homebrew), fails on Railway deployment.

### Pitfall 5: `\text{}` in Math Mode Adjacent to Hebrew
**What goes wrong:** The text content inside `\text{}` (e.g., unit labels like "N/m") renders with Hebrew font or gets reordered into the Hebrew text flow.
**Why it happens:** `\text{}` in KaTeX renders as a `<span>` with text-mode styling. If the surrounding context is RTL, this span may inherit RTL direction.
**How to avoid:** Ensure the KaTeX output wrapper (`<span class="math-inline" dir="ltr">`) contains the entire KaTeX HTML including `\text{}` content. The LTR direction on the wrapper should protect inner text spans.
**Warning signs:** Unit labels appear reversed or disconnected from the equation.

### Pitfall 6: Node.js Not Available for KaTeX CLI
**What goes wrong:** `markdown-katex` cannot find `npx` or `katex` CLI, causing rendering to fail silently or error out.
**Why it happens:** Railway provisions Node.js via nixpacks, but the PATH may not be correctly configured when Python subprocess calls `npx`.
**How to avoid:** Verify that `nodejs_23` in nixpacks.toml makes `npx` and `node` available on PATH. Consider installing `katex` globally during the build phase (`npm install -g katex`) or pointing `markdown-katex` at the local `node_modules/.bin/katex` from the frontend install. Test the subprocess call explicitly in the spike.
**Warning signs:** Works locally, `FileNotFoundError` or `katex: command not found` on Railway.

## Code Examples

### Test Endpoint: Full Integration
```python
# backend/api/report.py
from flask import Blueprint, Response
import os

report_bp = Blueprint('report', __name__)

@report_bp.route('/test-pdf', methods=['GET'])
def test_pdf():
    """Infrastructure spike: generate test PDF with Hebrew + math."""
    try:
        from utils.pdf_renderer import generate_test_pdf
        pdf_bytes = generate_test_pdf()
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': 'inline; filename="test-report.pdf"',
                'Content-Type': 'application/pdf'
            }
        )
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}, 500
```

### Equation Test Suite (10+ expression types)
```python
# Expressions matching D-04 (intro physics level) and D-05 (text in math)
EQUATION_TEST_SUITE = [
    # 1. Spring constant with units (text-in-math, the primary concern)
    r"k = 49.8 \pm 0.5 \text{ N/m}",
    # 2. Period formula
    r"T = \frac{2\pi}{\omega}",
    # 3. Gravitational acceleration
    r"g = 9.81 \pm 0.01 \text{ m/s}^2",
    # 4. Chi-squared per degree of freedom
    r"\frac{\chi^2}{\text{dof}} = 1.23",
    # 5. R-squared
    r"R^2 = 0.9987",
    # 6. Greek letters and subscripts
    r"\sigma_{\alpha} = \sqrt{\frac{\sum_{i=1}^{N}(x_i - \bar{x})^2}{N-1}}",
    # 7. Fraction
    r"\frac{F}{m} = a",
    # 8. Integral
    r"\int_0^L F(x) \, dx = W",
    # 9. Superscripts and exponents
    r"E = mc^2",
    # 10. Damped oscillation (complex expression)
    r"x(t) = A e^{-\gamma t} \cos(\omega t + \phi)",
    # 11. Plus-minus with uncertainty
    r"v = 3.42 \pm 0.08 \text{ m/s}",
    # 12. Sinc function
    r"I(\theta) = I_0 \left(\frac{\sin \alpha}{\alpha}\right)^2",
]
```

### nixpacks.toml Update
```toml
[phases.setup]
nixPkgs = [
    'python3', 'nodejs_23',
    # WeasyPrint system dependencies
    'pango', 'cairo', 'gdk-pixbuf', 'glib',
    'gobject-introspection', 'fontconfig', 'harfbuzz',
    'pkg-config', 'shared-mime-info', 'libffi'
]

[phases.install]
cmds = [
    'python3 -m venv .venv',
    '.venv/bin/pip install --upgrade pip',
    '.venv/bin/pip install -r requirements.txt',
    'cd frontend && npm install --legacy-peer-deps',
    'npm install -g katex'
]

[phases.build]
cmds = ['cd frontend && npm run build']

[start]
cmd = '. .venv/bin/activate && cd backend && python app.py'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WeasyPrint with broken KaTeX rendering | KaTeX layout fixes in WeasyPrint v48+ | July 2019 | Math superscripts, roots, and inline tables render correctly |
| Inline SVG in KaTeX output | `no_inline_svg=True` option in markdown-katex | ~2020 | Required workaround for WeasyPrint SVG limitation |
| System font installation for WeasyPrint | CSS `@font-face` with bundled fonts | WeasyPrint v52+ improved font handling | No need for system-level font installation |
| NIXPACKS_PKGS env var for Railway | `nixPkgs` in `nixpacks.toml` | nixpacks v1.0+ | Declarative config checked into repo, not fragile env vars |

**Deprecated/outdated:**
- `flask-weasyprint` package: Last updated 2023; not needed -- just use `weasyprint.HTML(string=...)` directly
- WeasyPrint versions < 52: Missing critical font and layout fixes; use 68.0+

## Open Questions

1. **markdown-katex subprocess PATH on Railway**
   - What we know: Railway provisions Node.js 23 via nixpacks; `npx` should be on PATH
   - What's unclear: Whether Python subprocess inherits the correct PATH in the Railway start command context
   - Recommendation: Test explicitly in the spike. Fallback: write a small Node.js script that markdown-katex can invoke, or call `node -e "..."` directly from Python subprocess

2. **KaTeX font file paths in production**
   - What we know: WeasyPrint resolves `@font-face` `src: url(...)` relative to `base_url` parameter
   - What's unclear: Exact working directory and path resolution on Railway (`cd backend && python app.py`)
   - Recommendation: Use absolute paths constructed with `os.path.abspath()` in the Python code; test both locally and on Railway

3. **Pango bidi algorithm completeness**
   - What we know: Pango implements Unicode Bidi Algorithm; WeasyPrint RTL support is "pretty decent" per maintainers
   - What's unclear: Whether complex mixed bidi scenarios (math at paragraph boundaries, nested embeddings) work correctly
   - Recommendation: This is exactly what the spike tests. Include edge cases: math at start of RTL line, math at end, multiple math expressions in one sentence

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=7.0.0 |
| Config file | none -- see Wave 0 |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | WeasyPrint generates a PDF with Hebrew RTL text | integration | `cd backend && python -m pytest tests/test_pdf_render.py::test_generates_pdf_with_hebrew -x` | Wave 0 |
| PDF-01 | PDF contains correct A4 page dimensions | integration | `cd backend && python -m pytest tests/test_pdf_render.py::test_pdf_page_size -x` | Wave 0 |
| PDF-02 | KaTeX renders all 12 test expressions without error | unit | `cd backend && python -m pytest tests/test_pdf_render.py::test_katex_renders_all_expressions -x` | Wave 0 |
| PDF-02 | Generated HTML contains KaTeX CSS classes | unit | `cd backend && python -m pytest tests/test_pdf_render.py::test_katex_html_structure -x` | Wave 0 |
| PDF-02 | WeasyPrint accepts KaTeX HTML without warnings | integration | `cd backend && python -m pytest tests/test_pdf_render.py::test_weasyprint_no_katex_warnings -x` | Wave 0 |

Note: Per D-07, visual correctness is verified by manual inspection. Automated tests verify that the pipeline produces output without errors, that PDF bytes are valid, and that KaTeX HTML is structurally correct.

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_pdf_render.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green + visual inspection of test PDF before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_pdf_render.py` -- covers PDF-01 and PDF-02 automated checks
- [ ] `backend/tests/conftest.py` -- shared fixtures (e.g., skip if WeasyPrint system libs not installed)
- [ ] `pytest.ini` at project root or backend root -- configure test paths
- [ ] Framework install: `pip install weasyprint markdown-katex` -- WeasyPrint requires system libs on dev machine

## Sources

### Primary (HIGH confidence)
- [WeasyPrint PyPI](https://pypi.org/project/weasyprint/) -- version 68.1, Feb 2026
- [WeasyPrint GitHub issue #867](https://github.com/Kozea/WeasyPrint/issues/867) -- KaTeX rendering fixes landed in v48 (2019)
- [WeasyPrint GitHub issue #1215](https://github.com/Kozea/WeasyPrint/issues/1215) -- KaTeX font rendering, resolved
- [markdown-katex PyPI](https://pypi.org/project/markdown-katex/) -- `no_inline_svg` option, `tex2html` function
- [KaTeX API docs](https://katex.org/docs/api) -- `renderToString` for server-side rendering
- [Railway WeasyPrint dependencies](https://station.railway.com/questions/cant-install-weasyprint-dependencies-d742101d) -- nixpacks package requirements

### Secondary (MEDIUM confidence)
- [WeasyPrint RTL support issue #106](https://github.com/Kozea/WeasyPrint/issues/106) -- RTL functional since ~v43, bidi "pretty decent"
- [Railway WeasyPrint error thread](https://station.railway.com/questions/error-installing-weasy-print-a30df387) -- NIXPACKS_PKGS solution
- [Noto Sans Hebrew - Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+Hebrew) -- OFL license, variable weight font
- [WeasyPrint DeepWiki - Font System](https://deepwiki.com/Kozea/WeasyPrint/4.3-font-system-and-text-layout) -- Pango text layout architecture

### Tertiary (LOW confidence)
- [NixOS/nixpkgs WeasyPrint definition](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/python-modules/weasyprint/default.nix) -- exact nix package names (could not fetch file content, names inferred from Railway threads)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM -- WeasyPrint + KaTeX is a proven combination per GitHub issues, but Hebrew RTL + KaTeX specifically is untested in public sources
- Architecture: HIGH -- Flask blueprint pattern is well-established in this codebase; HTML-to-PDF pipeline is straightforward
- Pitfalls: HIGH -- Multiple GitHub issues and Railway community threads document exactly these problems
- Railway deployment: MEDIUM -- nixpkgs solution works per multiple Railway threads, but some users report inconsistencies

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (30 days -- stable libraries, low churn)
