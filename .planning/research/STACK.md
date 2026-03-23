# Stack Research

**Domain:** AI-powered academic lab report generation with Hebrew RTL support
**Researched:** 2026-03-23
**Confidence:** MEDIUM (versions from training data cutoff May 2025; WebSearch/WebFetch unavailable -- versions marked * need verification before install)

## Scope

This research covers ONLY new dependencies needed for the v2.0 milestone. The existing stack (React 19, Vite 7, TypeScript, Flask, SciPy/SymPy/NumPy, OpenAI, Plotly, KaTeX, Axios, papaparse, xlsx) is kept as-is and not re-evaluated.

The existing `jspdf` + `jspdf-autotable` in `frontend/package.json` will be **replaced** by server-side PDF generation. jsPDF cannot handle Hebrew RTL, LaTeX math rendering, or academic formatting at publication quality.

---

## Recommended Stack

### Core Technologies

| Technology | Version* | Purpose | Why Recommended |
|------------|----------|---------|-----------------|
| **WeasyPrint** | >=62.0 | HTML/CSS to PDF (server-side) | The only Python HTML-to-PDF engine with full CSS3 support including `direction: rtl`, `unicode-bidi`, `@page` rules, embedded fonts, and CSS grid/flexbox. Renders KaTeX HTML/CSS output directly as vector math. Pango (its text engine) has mature Hebrew/Arabic BiDi support via FriBidi. |
| **PyMuPDF (fitz)** | >=1.24.0* | Extract text from uploaded PDF instruction files | Fastest Python PDF text extractor. Handles Hebrew text, preserves reading order, works without external binaries (C extension, not subprocess). Extracts text, tables, and images. |
| **python-docx** | >=1.1.0* | Extract text from uploaded Word (.docx) instruction files | Standard library for reading Word documents. Extracts paragraphs, tables, and formatting. Handles Hebrew content embedded in .docx. No external binaries needed. |
| **Jinja2** | (already installed) | HTML report templating | Already a Flask transitive dependency. Used to render the HTML template that WeasyPrint converts to PDF. Zero new install needed. |
| **matplotlib** | >=3.8.0* | Generate static plot images for PDF reports | Produces publication-quality PNG/SVG figures. Plotly's `toImage()` is designed for screen; matplotlib produces clean print-ready output with proper DPI control. Use the OO API (not pyplot) for thread safety in Flask. |

### Supporting Libraries

| Library | Version* | Purpose | When to Use |
|---------|----------|---------|-------------|
| **Noto Sans Hebrew** (font, not pip) | latest | Hebrew font for PDF output | Bundle in `backend/templates/fonts/`. WeasyPrint needs local font files -- cannot fetch from Google Fonts at render time. Noto Sans Hebrew is Google's free font with full Hebrew character coverage and good readability. |
| **KaTeX CSS + fonts** (bundle, not pip) | match frontend version | LaTeX math rendering in PDF | Bundle KaTeX CSS and WOFF2 fonts locally in report template. WeasyPrint renders KaTeX's HTML/CSS output directly, producing vector-quality equations in PDF. |
| **DOMPurify** (npm) | >=3.0.0* | Sanitize AI-generated HTML before rendering | AI generates report section content that gets inserted into HTML template. Must sanitize to prevent XSS. Also useful for cleaning HTML in the in-app editor. |

### Frontend: In-App Report Editor

| Library | Version* | Purpose | When to Use |
|---------|----------|---------|-------------|
| **@tiptap/react** | >=2.6.0* | Rich text editor for report section editing | TipTap is a headless (unstyled) ProseMirror wrapper for React. Headless means it works with Tau-LY's existing custom CSS -- no component library conflict. Supports RTL via `dir` attribute on content blocks. |
| **@tiptap/starter-kit** | >=2.6.0* | Core editor extensions (bold, italic, headings, lists) | Bundled convenience package. Includes paragraph, heading, bold, italic, bullet list, ordered list, code block, blockquote, horizontal rule. |
| **@tiptap/extension-text-align** | >=2.6.0* | Text alignment (left, right, center) | Needed for RTL section alignment control. |
| **@tiptap/extension-placeholder** | >=2.6.0* | Placeholder text in empty sections | "AI will generate this section..." placeholders. |

---

## Architecture: How These Fit Together

### PDF Generation Flow (server-side)

```
User clicks "Generate Report" in frontend
  -> Frontend sends report config + AutoLab results to POST /api/report/generate
  -> Backend calls OpenAI to generate section content (theory, discussion, etc.)
  -> Backend renders Jinja2 HTML template with:
     - Hebrew RTL body text (dir="rtl", Noto Sans Hebrew font)
     - English LTR equations via KaTeX HTML (bundled CSS/fonts)
     - matplotlib-generated plot PNGs (base64 embedded)
     - Academic formatting (@page rules, numbered sections, figure captions)
  -> WeasyPrint converts HTML to PDF
  -> Returns PDF as binary response

User edits sections in TipTap editor, clicks "Export PDF"
  -> Same flow but with user-edited content instead of AI-generated
```

### File Upload Parsing Flow

```
User uploads lab instruction file (PDF or Word)
  -> POST /api/report/parse-instructions (multipart/form-data)
  -> Backend detects file type:
     - .pdf -> PyMuPDF extracts text
     - .docx -> python-docx extracts text
  -> Returns extracted text as JSON
  -> Frontend displays extracted context, user can edit/supplement
  -> Extracted text sent as context to AI for report generation
```

### Hebrew RTL + English Math Strategy

Israeli academic lab reports use a specific bidirectional pattern:
- Body text: Hebrew, right-to-left
- Equations: English/math, left-to-right (inline and display)
- Variable names in text: English, left-to-right
- Figure captions: Hebrew
- Section headers: Hebrew

This is handled with CSS BiDi, NOT by manually switching directions:

```css
.report-body {
    direction: rtl;
    unicode-bidi: embed;
    font-family: 'Noto Sans Hebrew', 'Inter', sans-serif;
    text-align: right;
}

.katex {
    direction: ltr;
    unicode-bidi: isolate;
}

.report-body code, .report-body .equation-ref {
    direction: ltr;
    unicode-bidi: isolate;
}
```

WeasyPrint's Pango text engine uses FriBidi for bidirectional text layout, which implements the Unicode BiDi Algorithm. This means inline English within Hebrew text automatically gets correct directional treatment -- no manual span wrapping needed for most cases.

**Confidence on Hebrew RTL in WeasyPrint:** MEDIUM. Pango/FriBidi support is well-documented, but the specific combination of KaTeX HTML output + RTL body text + WeasyPrint needs prototype validation. Flag this for early spike testing.

---

## Installation

### Backend (add to `requirements.txt`)

```
weasyprint>=62.0
pymupdf>=1.24.0
python-docx>=1.1.0
matplotlib>=3.8.0
```

### Frontend (npm install)

```bash
cd frontend
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-placeholder dompurify --legacy-peer-deps
npm install -D @types/dompurify --legacy-peer-deps
```

### Infrastructure (update `nixpacks.toml`)

```toml
[phases.setup]
nixPkgs = ["python3", "nodejs_23", "pango", "cairo", "gdk-pixbuf", "gobject-introspection", "harfbuzz"]
```

WeasyPrint requires system-level C libraries for text rendering. These are the nix package names; the exact names may differ on Railway's nixpacks -- test early.

### Font Files to Bundle

```
backend/templates/fonts/
  NotoSansHebrew-Regular.ttf
  NotoSansHebrew-Bold.ttf
  Inter-Regular.woff2          (already used in frontend)
  Inter-Bold.woff2
  KaTeX_Main-Regular.woff2     (copy from node_modules/katex/dist/fonts/)
  KaTeX_Math-Italic.woff2
  KaTeX_Size1-Regular.woff2
  ... (all KaTeX .woff2 fonts)
```

---

## Alternatives Considered

### PDF Generation

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **WeasyPrint** (server-side) | `jsPDF` (current, client-side) | jsPDF has no Hebrew RTL support, no CSS BiDi, cannot render KaTeX HTML. Current exportPdf.ts produces English-only, no-math-rendering PDFs. Fundamentally wrong tool for this job. |
| **WeasyPrint** | `reportlab` | Imperative coordinate-based API. Drawing Hebrew RTL text character-by-character is a nightmare. No CSS support. Tedious for complex academic layouts. |
| **WeasyPrint** | `@react-pdf/renderer` (client-side) | Cannot render KaTeX math. No BiDi support. Would need to rebuild all result components in react-pdf primitives. |
| **WeasyPrint** | Puppeteer/Playwright (headless Chrome) | Chromium binary is ~400MB. Cannot deploy on Railway without Docker. Overkill when WeasyPrint handles the subset of CSS we need. |
| **WeasyPrint** | `pdflatex` / `xelatex` subprocess | Requires full TeX Live installation (4GB+). Cannot deploy on Railway via nixpacks without major configuration. |
| **WeasyPrint** | `fpdf2` | No CSS support. Manual positioning. No BiDi. Same problems as reportlab. |
| **WeasyPrint** | `wkhtmltopdf` | Abandoned/unmaintained. Uses old WebKit. Poor CSS3 support. |
| **WeasyPrint** | `prince` (PrinceXML) | Commercial license ($3,800). Excellent quality but not justified for this project. |

### PDF Text Extraction

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **PyMuPDF** | `pdfplumber` | Slower. PyMuPDF extracts text faster and handles more PDF variants. |
| **PyMuPDF** | `PyPDF2` / `pypdf` | Lower quality text extraction, especially for complex layouts and Hebrew. |
| **PyMuPDF** | `pdfminer.six` | Slower, more complex API. Good for layout analysis but overkill for text extraction. |
| **PyMuPDF** | OCR (`pytesseract`) | Only needed for scanned PDFs. Most lab instructions are digital PDFs. Add OCR later if needed. |

### Rich Text Editor (Frontend)

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| **TipTap** | `slate` | Lower-level, more boilerplate. TipTap provides better DX with extension system. |
| **TipTap** | `Draft.js` | Facebook deprecated it. No active maintenance. |
| **TipTap** | `Quill` | Opinionated styling conflicts with custom CSS. Not headless. Limited extensibility. |
| **TipTap** | `CKEditor 5` | Heavy, GPL-licensed (commercial use requires paid license). |
| **TipTap** | Plain `<textarea>` | Cannot render rich text (bold, headings, lists). Users need to see formatted preview. |
| **TipTap** | `react-markdown` + textarea | View-only rendering. No inline editing experience. |
| **TipTap** | `MDXEditor` | Markdown-focused. We need HTML output for WeasyPrint, not markdown. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `jsPDF` for report generation | No Hebrew RTL, no KaTeX rendering, no CSS BiDi. Keep it only if needed for simple non-Hebrew exports. | WeasyPrint (server-side) |
| `html2canvas` | Rasterizes DOM to canvas -- blurry math, huge file sizes, breaks RTL | WeasyPrint renders CSS directly |
| Full TeX Live installation | 4GB+, cannot deploy on Railway | Generate KaTeX HTML for PDF; offer .tex download for users to compile locally |
| Any client-side PDF library for Hebrew | No JS PDF library handles BiDi correctly | Server-side WeasyPrint with Pango/FriBidi |
| `mammoth.js` for Word parsing | Client-side, but we need server-side processing alongside AI | `python-docx` on backend |
| `pdfjs-dist` for PDF text extraction | Designed for rendering PDFs in browser, not text extraction. Can extract text but slower and less reliable than PyMuPDF for server-side use. | PyMuPDF on backend |
| LangChain / LlamaIndex for AI report generation | Unnecessary abstraction layer. Direct OpenAI SDK is simpler, already proven in AutoLab, and gives more control over prompts. | Direct `openai` SDK (already installed) |
| Zustand / Redux for report state | Report editing state is local to the report builder page. React Context or component-level useState is sufficient. | Component-local state + props |

---

## Stack Patterns by Variant

**If Hebrew RTL is not needed (English-only reports):**
- WeasyPrint is still the right choice (best CSS-to-PDF engine)
- Skip Noto Sans Hebrew font bundling
- Skip BiDi CSS rules
- Everything else stays the same

**If deployment environment cannot support WeasyPrint system deps:**
- Fallback: Generate HTML report, let user print to PDF via browser (`window.print()` with `@media print` stylesheet)
- Quality is lower but avoids system dependency issues
- Hebrew RTL still works in browser print (browsers handle BiDi natively)
- This is the escape hatch, not the primary path

**If uploaded instruction files are scanned images (not digital PDFs):**
- Add `pytesseract` + Tesseract OCR with Hebrew language pack
- Defer this until user feedback confirms it is needed -- most university lab instructions are digital PDFs

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| WeasyPrint >=62.0 | Python 3.9+ | Requires Pango >= 1.44, Cairo >= 1.15. These come from nixpkgs. |
| PyMuPDF >=1.24.0 | Python 3.8+ | Ships its own MuPDF binary. No system deps. |
| python-docx >=1.1.0 | Python 3.7+ | Pure Python. No system deps. |
| matplotlib >=3.8.0 | Python 3.9+, NumPy >=1.24 | NumPy already in requirements.txt at >=1.24.0. |
| @tiptap/react >=2.6.0 | React >=17 | Compatible with React 19. Uses ref forwarding. |
| @tiptap/pm (ProseMirror) | Peer dep of @tiptap/react | Must be installed alongside. |
| DOMPurify >=3.0.0 | Any browser / Node 16+ | Isomorphic. Can also be used server-side if needed. |

---

## New Files Created by This Stack

### Backend

```
backend/api/report.py                  # Report generation blueprint
backend/api/parse_instructions.py      # File upload parsing (PDF/Word)
backend/templates/report_base.html     # Jinja2 base template for PDF
backend/templates/report_rtl.css       # RTL + academic print stylesheet
backend/templates/fonts/               # Bundled fonts (Noto Sans Hebrew, KaTeX, Inter)
backend/utils/plot_export.py           # matplotlib figure generation for reports
backend/utils/text_extract.py          # PyMuPDF + python-docx text extraction
```

### Frontend

```
frontend/src/components/ReportBuilder.tsx       # Main report generation page
frontend/src/components/ReportPreview.tsx        # In-app preview with TipTap editors
frontend/src/components/SectionEditor.tsx        # TipTap-based section editor component
frontend/src/components/InstructionUpload.tsx    # File upload for lab instructions
frontend/src/services/reportApi.ts               # API calls for report endpoints
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| WeasyPrint for PDF generation | MEDIUM | Library is proven, but: (a) exact version needs verification, (b) nixpacks system dep names need testing on Railway, (c) KaTeX CSS + Hebrew RTL combo needs prototype spike |
| Hebrew RTL in WeasyPrint | MEDIUM | Pango/FriBidi BiDi support is well-documented. Specific rendering quality with mixed Hebrew/math needs hands-on testing. |
| PyMuPDF for PDF text extraction | HIGH | Well-established, fast, no system deps. Hebrew text extraction works (uses MuPDF's text extraction which is encoding-aware). |
| python-docx for Word parsing | HIGH | Mature, stable, widely used. Reads Hebrew text from .docx without issues (Unicode-native). |
| TipTap for in-app editing | MEDIUM | Training data covers through v2.4. RTL content editing in TipTap works via ProseMirror's `dir` attribute support, but needs testing with Hebrew input. |
| matplotlib for report plots | HIGH | De facto standard. Use OO API for Flask thread safety. |
| DOMPurify for HTML sanitization | HIGH | Industry standard. Small, fast, well-maintained. |
| Direct OpenAI SDK for AI content | HIGH | Already proven in AutoLab. Same patterns, different prompts. |
| nixpacks WeasyPrint deployment | LOW | Highest risk area. System library names may not match. Test `python -c "import weasyprint"` in Railway environment ASAP. |

## Sources

All recommendations based on training data (cutoff May 2025) and codebase analysis. WebSearch and WebFetch were unavailable during research. All versions marked * should be verified with `pip index versions <pkg>` or `npm view <pkg> version` before adding to dependency files.

- WeasyPrint: https://weasyprint.org/ -- CSS3 PDF engine with Pango text rendering
- WeasyPrint RTL: Pango uses FriBidi for Unicode BiDi Algorithm implementation
- PyMuPDF: https://pymupdf.readthedocs.io/ -- PDF text extraction
- python-docx: https://python-docx.readthedocs.io/ -- Word document reading
- TipTap: https://tiptap.dev/ -- Headless rich text editor for React
- KaTeX: https://katex.org/ -- already in use for math rendering
- DOMPurify: https://github.com/cure53/DOMPurify
- Noto Sans Hebrew: https://fonts.google.com/noto/specimen/Noto+Sans+Hebrew
- matplotlib OO API: https://matplotlib.org/stable/api/figure_api.html
- Existing codebase: `frontend/src/utils/exportPdf.ts`, `frontend/package.json`, `requirements.txt`, `nixpacks.toml`

---
*Stack research for: AI-powered academic lab report generation with Hebrew RTL*
*Researched: 2026-03-23*
