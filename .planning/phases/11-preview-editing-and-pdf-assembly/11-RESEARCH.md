# Phase 11: Preview, Editing, and PDF Assembly - Research

**Researched:** 2026-03-27
**Domain:** React UI components, PDF generation with WeasyPrint, KaTeX rendering, Plotly image export
**Confidence:** HIGH

## Summary

Phase 11 builds the final user-facing layer for the lab report feature: an accordion-based section editor with live KaTeX preview, a title page form, plot embedding, template selection, and PDF export via WeasyPrint. All foundational infrastructure is already in place from Phases 8, 9, and 10 -- WeasyPrint with Hebrew fonts and KaTeX CSS (Phase 8), the ReportAnalysisData type contract (Phase 9), and AI content generation returning structured JSON sections (Phase 10).

The primary technical challenges are: (1) wiring the accordion editor with live KaTeX preview using the existing `renderLatex()` utility, (2) capturing Plotly plots as base64 images via `Plotly.toImage()` and sending them to the backend for PDF embedding, (3) assembling the full HTML report from sections + title page + plots + parameter table and passing it through the existing `generate_pdf()` pipeline, and (4) supporting three CSS template variants.

**Primary recommendation:** Build incrementally -- accordion editor first, then title page form, then plot capture, then PDF assembly endpoint, then template variants. The existing `pdf_renderer.py` and `report_styles.css` handle the hard parts (fonts, KaTeX, RTL). The new work is mostly React component composition and HTML template assembly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Accordion-based section layout. Each section (Theory, Method, Discussion, Conclusions, Results) is a collapsible card. Click to expand shows rendered KaTeX preview + Edit button.
- **D-02:** Editing replaces preview with side-by-side layout: textarea on left, live KaTeX-rendered preview on right. Real-time update as user types.
- **D-03:** "AI Generated -- Please Review" badge appears on each AI-generated section. Badge clears as soon as the user modifies the text in that section. Simple signal that user has reviewed.
- **D-04:** Default template is Israeli university lab report style: title page with university-style header, numbered sections in Hebrew, A4, 2.5cm margins, Noto Sans Hebrew body, equations inline.
- **D-05:** Three PDF templates available: Israeli lab report (default), Minimal clean, LaTeX-inspired academic. User selects via dropdown on the report page near the Export button.
- **D-06:** Page breaks handled automatically by WeasyPrint with smart breaking. No forced page breaks per section -- short sections can share pages.
- **D-07:** Plots exported from frontend using Plotly.toImage() as PNG/SVG. Base64 images sent to backend for PDF embedding. Plots look exactly like what the user sees in AutoLab.
- **D-08:** Plot thumbnails shown inline in the report editor (in the Results section accordion). Numbered figure captions displayed. User sees exactly what goes into the PDF before exporting.
- **D-09:** Claude's Discretion on title page form design. Standard fields: name, student ID, lab partner, course name, experiment title, date. Hebrew labels by default, follows language toggle.

### Claude's Discretion
- Title page form field layout and placement on report page
- PDF header/footer content and styling
- Font sizes and spacing within PDF templates
- Parameter table formatting in PDF (reuse existing roundWithUncertainty conventions)
- Figure caption numbering format
- How to handle missing plots or partial analyses gracefully
- Template-specific CSS organization (one file per template vs conditional blocks)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | User can fill in title page information (name, ID, partner, course, experiment title, date) via a form | TitlePageForm component per D-09, fields defined in UI-SPEC. Existing inline style patterns from ReportBeta.tsx. |
| UI-02 | User can preview each report section in-app before exporting to PDF | SectionAccordion component per D-01, KaTeX rendering via existing `renderLatex()` from `frontend/src/utils/latex.ts`. GeneratedSections already available from Phase 10. |
| UI-03 | User can edit any AI-generated section text before exporting to PDF | Side-by-side editor per D-02, textarea + live KaTeX preview with 300ms debounce. AIGeneratedBadge per D-03 clears on first edit. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI components | Project standard |
| TypeScript | ~5.9.3 | Type safety | Project standard |
| KaTeX | 0.16.28 (frontend) | LaTeX rendering in browser | Already used in `latex.ts` and Sidebar |
| plotly.js-dist-min | 3.4.0 | Charts + `Plotly.toImage()` for export | Already used across AutoLab, GraphFitting |
| WeasyPrint | 68.1 (backend) | Server-side PDF generation | Phase 8 validated, Hebrew RTL + KaTeX CSS works |
| markdown_katex | installed | Server-side LaTeX-to-HTML | Used by `pdf_renderer.py` with npx fallback |
| Flask | 3.1.3 | Backend API | Project standard |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Noto Sans Hebrew | bundled (400, 700) | Hebrew body font for PDF | All PDF templates |
| KaTeX fonts | bundled (woff2) | Math font rendering in PDF | Equations in PDF |

### No New Dependencies Required
This phase requires zero new npm or pip packages. Everything is already installed and proven.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
  components/
    ReportBeta.tsx         # Existing -- extend with new sections below generate button
    report/                # NEW subdirectory for report sub-components
      SectionAccordion.tsx # Collapsible section card
      SectionEditor.tsx    # Side-by-side textarea + KaTeX preview
      TitlePageForm.tsx    # Student metadata form
      TemplateSelector.tsx # PDF template dropdown
      PlotThumbnail.tsx    # Inline plot preview with caption
      ExportPDFButton.tsx  # PDF export CTA
  utils/
    latex.ts               # Existing renderLatex() -- reuse as-is
    format.ts              # Existing roundWithUncertainty() -- reuse as-is

backend/
  api/
    report.py              # Existing -- add /export-pdf endpoint
  utils/
    pdf_renderer.py        # Existing -- add report assembly functions
  templates/
    report_base.html       # Existing -- extend or create per-template variants
    report_styles.css      # Existing -- extend with template-specific sections
```

### Pattern 1: Accordion State Management
**What:** Each section has three states: collapsed, expanded-preview, expanded-editing. Managed with a single `Record<string, 'collapsed' | 'preview' | 'editing'>` state.
**When to use:** All five report sections.
**Example:**
```typescript
// Source: Derived from D-01, D-02 decisions
const [sectionStates, setSectionStates] = useState<Record<string, 'collapsed' | 'preview' | 'editing'>>({
  theory: 'collapsed',
  method: 'collapsed',
  results: 'collapsed',
  discussion: 'collapsed',
  conclusions: 'collapsed',
});

const toggleSection = (key: string) => {
  setSectionStates(prev => ({
    ...prev,
    [key]: prev[key] === 'collapsed' ? 'preview' : 'collapsed',
  }));
};

const startEditing = (key: string) => {
  setSectionStates(prev => ({ ...prev, [key]: 'editing' }));
};
```

### Pattern 2: Debounced KaTeX Preview
**What:** Textarea input triggers live KaTeX preview with 300ms debounce to avoid re-rendering on every keystroke.
**When to use:** SectionEditor component.
**Example:**
```typescript
// Source: Existing renderLatex() in frontend/src/utils/latex.ts
const [previewHtml, setPreviewHtml] = useState('');
const debounceRef = useRef<ReturnType<typeof setTimeout>>();

const handleTextChange = (text: string) => {
  setSectionText(text);
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    setPreviewHtml(renderLatex(text));
  }, 300);
};
```

### Pattern 3: Plot Capture via Plotly.toImage()
**What:** Capture fit and residuals plots as base64 PNG from the Plotly DOM elements.
**When to use:** Before PDF export, and for inline thumbnails in Results accordion.
**Example:**
```typescript
// Source: Existing pattern in frontend/src/utils/exportPdf.ts line 48-52
import Plotly from 'plotly.js-dist-min';

async function capturePlot(el: HTMLElement, width = 700, height = 420): Promise<string> {
  const gd = el as any;
  return await Plotly.toImage(gd, { format: 'png', width, height, scale: 2 });
  // Returns: "data:image/png;base64,..."
}
```

### Pattern 4: PDF Export Endpoint
**What:** New `POST /api/report/export-pdf` endpoint that receives sections, title page data, plot images (base64), template choice, and returns PDF bytes.
**When to use:** ExportPDFButton click.
**Example:**
```python
# Source: Existing pattern in backend/api/report.py and backend/utils/pdf_renderer.py
@report_bp.route('/export-pdf', methods=['POST'])
def export_pdf():
    body = request.get_json()
    sections = body.get('sections', {})
    title_page = body.get('title_page', {})
    plots = body.get('plots', {})  # {fit: "data:image/png;base64,...", residuals: "..."}
    template = body.get('template', 'israeli')
    language = body.get('language', 'he')
    analysis_data = body.get('analysis_data', {})

    html_body = assemble_report_html(sections, title_page, plots, analysis_data, template, language)
    processed = process_text_with_math(html_body)
    pdf_bytes = generate_pdf(processed)

    return Response(pdf_bytes, mimetype='application/pdf',
                    headers={'Content-Disposition': 'attachment; filename="lab-report.pdf"'})
```

### Pattern 5: Template CSS Strategy
**What:** One base CSS file with template-specific overrides via CSS classes on the `<body>` element.
**When to use:** Supporting D-05's three templates.
**Recommendation:** Use `<body class="template-israeli">`, `<body class="template-minimal">`, `<body class="template-academic">` with cascading overrides in report_styles.css. Keeps one file, avoids duplication.

### Anti-Patterns to Avoid
- **Client-side PDF generation:** jsPDF cannot handle Hebrew RTL. The existing `exportPdf.ts` uses jsPDF and does NOT support Hebrew. All academic PDF export must go through WeasyPrint on the backend.
- **Sending raw HTML from frontend to backend:** The frontend should send structured data (sections text, title page fields, base64 plots). The backend assembles HTML from templates. This prevents XSS and keeps PDF layout control server-side.
- **Re-rendering plots on the backend:** Plotly is a frontend library. Plots must be captured as images on the frontend and sent as base64 to the backend. Do not attempt server-side Plotly rendering.
- **Editing with contentEditable:** The project explicitly chose textarea + preview (REQUIREMENTS.md "Out of Scope" rules out WYSIWYG). Do not use contentEditable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LaTeX rendering in browser | Custom parser | `renderLatex()` from `frontend/src/utils/latex.ts` | Already handles $$, $, markdown, KaTeX |
| LaTeX rendering in PDF | Custom converter | `process_text_with_math()` from `backend/utils/pdf_renderer.py` | Handles display/inline math, bidi text |
| Number formatting | Manual rounding | `roundWithUncertainty()` from `frontend/src/utils/format.ts` | Handles sig figs, uncertainty propagation display |
| PDF generation | HTML string hacks | `generate_pdf()` from `backend/utils/pdf_renderer.py` | WeasyPrint with font config, base_url resolution |
| Plot image capture | Canvas manipulation | `Plotly.toImage()` API | Returns clean base64 PNG, handles scaling |
| Hebrew RTL layout | Manual bidi markers | WeasyPrint's CSS `dir="rtl"` support | Handles bidi algorithm, math LTR embedding |

**Key insight:** Phase 8 already solved the hardest problems (Hebrew fonts, KaTeX in WeasyPrint, RTL layout). Phase 11 is assembly and UI work, not infrastructure.

## Common Pitfalls

### Pitfall 1: Base64 Image Size in JSON Payload
**What goes wrong:** Plotly.toImage() at scale:2 for a 700x420 plot produces ~200-400KB base64 strings. Two plots = ~800KB. Combined with section text, the JSON payload to `/export-pdf` could be 1-2MB.
**Why it happens:** Base64 encoding adds 33% overhead to binary data. High-resolution plot images are large.
**How to avoid:** Flask already has `MAX_CONTENT_LENGTH = 50MB` (set in app.py for file uploads). 1-2MB is well within limits. Use PNG format (not SVG) for predictable size. Consider scale:1.5 instead of 2 if size becomes an issue.
**Warning signs:** Slow PDF export response times, request timeouts.

### Pitfall 2: KaTeX Preview Performance with Large Sections
**What goes wrong:** Re-rendering KaTeX HTML on every keystroke causes UI lag, especially with multiple display equations.
**Why it happens:** KaTeX rendering is synchronous and CPU-bound. Long sections with many equations take noticeable time.
**How to avoid:** 300ms debounce on textarea input (per D-02 interaction contract). Only re-render the preview div, not the entire component. Use `React.memo` on the preview pane if needed.
**Warning signs:** Typing lag in the editor, UI feels sluggish.

### Pitfall 3: Missing Plot Elements When User Hasn't Run AutoLab
**What goes wrong:** `autolabResults` in AnalysisContext is null if user navigated directly to the report page without running AutoLab first.
**Why it happens:** Report page is accessible independently. AutoLab results are transient (no persistence).
**How to avoid:** Check for null `autolabResults` and show graceful empty states. UI-SPEC already defines "No plot available -- run AutoLab analysis first" placeholder. Results section accordion should still work with text-only content.
**Warning signs:** TypeError on null access, blank sections.

### Pitfall 4: RTL/LTR Direction in Side-by-Side Editor
**What goes wrong:** Hebrew text in textarea flows RTL but LaTeX code reads LTR. Mixed content confuses cursor position and selection.
**Why it happens:** Textarea `dir` attribute affects entire content. Hebrew paragraphs with inline `$...$` math create bidirectional text.
**How to avoid:** Set `dir="auto"` on the textarea (not "rtl") so the browser's bidi algorithm handles each line independently. The KaTeX preview pane should use `dir="rtl"` for Hebrew language, matching the PDF output.
**Warning signs:** Cursor jumping, text selection behaving unexpectedly, dollar signs appearing on wrong side.

### Pitfall 5: Template CSS Specificity Conflicts
**What goes wrong:** Template-specific CSS overrides don't apply because base styles have higher specificity.
**Why it happens:** The existing `report_styles.css` has very specific selectors for KaTeX elements.
**How to avoid:** Use body class-based nesting: `.template-minimal h2 { ... }` overrides base `h2 { ... }`. Keep template overrides at the end of the CSS file. Do not use `!important`.
**Warning signs:** PDF looks identical regardless of template selection.

### Pitfall 6: WeasyPrint Base64 Image Handling
**What goes wrong:** WeasyPrint cannot render `<img src="data:image/png;base64,...">` in all configurations.
**Why it happens:** Some WeasyPrint versions have issues with data URIs for images.
**How to avoid:** Write base64-decoded plot images to temp files, reference them with `file://` URLs in the HTML, and clean up after PDF generation. Or use WeasyPrint's `url_fetcher` to handle data URIs. Test this early.
**Warning signs:** Blank image areas in PDF, broken image icons.

## Code Examples

### Existing renderLatex() Usage (reuse for live preview)
```typescript
// Source: frontend/src/utils/latex.ts
import { renderLatex } from '../utils/latex';

// Returns HTML string safe for dangerouslySetInnerHTML
const html = renderLatex("ערך קבוע הקפיץ $k = 49.8 \\pm 0.5 \\text{ N/m}$ נמצא תואם.");
// Handles: $$...$$ display math, $...$ inline math, **bold**, *italic*, lists
```

### Existing Plotly.toImage() Pattern (reuse for plot capture)
```typescript
// Source: frontend/src/utils/exportPdf.ts lines 48-52
import Plotly from 'plotly.js-dist-min';

async function plotToImage(el: HTMLElement, width = 700, height = 400): Promise<string> {
    const gd = el as any;
    const img = await Plotly.toImage(gd, { format: 'png', width, height, scale: 2 });
    return img; // "data:image/png;base64,..."
}
```

### Existing generate_pdf() (reuse for PDF output)
```python
# Source: backend/utils/pdf_renderer.py lines 140-174
from utils.pdf_renderer import generate_pdf, process_text_with_math

html_body = "<h1>Report Title</h1><p>Content with $E = mc^2$</p>"
processed = process_text_with_math(html_body)
pdf_bytes = generate_pdf(processed)
# Returns: bytes starting with %PDF
```

### Backend Report HTML Assembly (new function needed)
```python
# Source: Pattern derived from existing pdf_renderer.py template substitution
def assemble_report_html(sections, title_page, plots, analysis_data, template, language):
    """Build full report HTML from structured data.

    Args:
        sections: {theory: str, method: str, discussion: str, conclusions: str}
        title_page: {name: str, student_id: str, partner: str, course: str, title: str, date: str}
        plots: {fit: "base64...", residuals: "base64..."}
        analysis_data: {fit: {parameters: [...]}, ...}
        template: 'israeli' | 'minimal' | 'academic'
        language: 'he' | 'en'

    Returns:
        HTML string for the full report body.
    """
    # Section headers per language
    headers = {
        'he': {'theory': '1. רקע תיאורטי', 'method': '2. שיטת מדידה', ...},
        'en': {'theory': '1. Theoretical Background', ...},
    }
    # ... assemble HTML with title page, sections, plots, parameter table
```

### GeneratedSections Interface (already defined)
```typescript
// Source: frontend/src/services/api.ts lines 262-268
export interface GeneratedSections {
    theory: string;
    method: string;
    discussion: string;
    conclusions: string;
    warnings?: string[];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsPDF client-side (exportPdf.ts) | WeasyPrint server-side | Phase 8 (2026-03) | Hebrew RTL + LaTeX now works. Old jsPDF export still exists for quick AutoLab export but cannot do Hebrew. |
| No report editing | Textarea + KaTeX preview | Phase 11 design | Users can review and modify AI output before export |
| Single PDF format | Three templates | Phase 11 design | Flexibility without complexity |

**Deprecated/outdated:**
- `frontend/src/utils/exportPdf.ts` (jsPDF-based): Still functional for quick AutoLab exports but NOT for academic Hebrew reports. Do not extend it for Phase 11 purposes.

## Open Questions

1. **WeasyPrint base64 image handling**
   - What we know: WeasyPrint handles `<img>` tags with file:// URLs. Data URI support varies by version.
   - What's unclear: Whether WeasyPrint 68.1 handles `data:image/png;base64,...` in `<img src>` directly.
   - Recommendation: Test early in implementation. If data URIs fail, write temp files and use file:// paths. The `generate_pdf()` function already sets `base_url=BACKEND_DIR` which enables relative file resolution.

2. **Results section content**
   - What we know: Theory, Method, Discussion, Conclusions come from AI generation (Phase 10). Results section needs parameter table + plots from `autolabResults`.
   - What's unclear: Whether Results section also needs AI-generated text (RPT-03 says "auto-populated from AutoLab analysis").
   - Recommendation: Results section is data-driven (not AI-generated): parameter table formatted with `roundWithUncertainty`, goodness-of-fit stats, formula results, n-sigma comparison, and embedded plots. No AI text needed for Results.

3. **Plot availability timing**
   - What we know: Plots exist in AutoLab page DOM. User navigates to Report page. `autolabResults` carries data but not DOM elements.
   - What's unclear: How to get plot DOM references from AutoLab page when user is on Report page.
   - Recommendation: Capture plot images (base64) at navigation time or store them in AnalysisContext. Add `plotImages: { fit: string | null, residuals: string | null }` to the context. Capture when AutoLab analysis completes, before user navigates away.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| WeasyPrint | PDF generation | Yes | 68.1 | None (hard requirement) |
| markdown_katex | Server-side LaTeX | Yes | installed | npx katex subprocess (already implemented) |
| npx katex | Fallback LaTeX | Yes | 0.16.44 | Already used as fallback in pdf_renderer.py |
| KaTeX (frontend) | Live preview | Yes | 0.16.28 | None needed |
| Plotly.js | Plot capture | Yes | 3.4.0 | None needed |
| Noto Sans Hebrew fonts | PDF Hebrew text | Yes | bundled in backend/templates/fonts/ | None (hard requirement) |
| KaTeX fonts (woff2) | PDF math rendering | Yes | bundled in backend/templates/fonts/katex-fonts/ | None (hard requirement) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) |
| Config file | backend/tests/conftest.py |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Title page fields appear in PDF | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_title_page_in_pdf -x` | No -- Wave 0 |
| UI-02 | Section preview renders KaTeX | manual | Visual inspection of accordion expand | N/A (frontend) |
| UI-03 | Section editing updates preview | manual | Visual inspection of side-by-side editor | N/A (frontend) |
| D-04 | Israeli template A4 formatting | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_israeli_template -x` | No -- Wave 0 |
| D-05 | Three templates produce valid PDFs | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_all_templates -x` | No -- Wave 0 |
| D-07 | Plot images embedded in PDF | integration | `cd backend && python -m pytest tests/test_pdf_export.py::test_plot_embedding -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_pdf_export.py` -- covers export-pdf endpoint, template variants, plot embedding, title page
- [ ] Test fixtures for sample section content with LaTeX, sample base64 plot image, sample title page data

*(Existing test files `test_pdf_render.py` and `test_report_generate.py` cover Phase 8 and 10 functionality respectively. Phase 11 needs a new test file for the export pipeline.)*

## Project Constraints (from CLAUDE.md)

- **Tech stack:** React + Flask, no framework migration
- **Styling:** Single `global.css` + inline styles, no CSS modules, no Tailwind, no component library
- **Components:** Function components only, hooks-based state
- **Python patterns:** Flask blueprint structure, try/except with `{"error": "message"}` responses
- **API convention:** `/api/{module}/{action}`, JSON POST, response shape `{ data, error: null }`
- **LaTeX formatting:** Physics equations in LaTeX (inline `$...$` or display `$$...$$`)
- **No new dependencies without justification** -- this phase needs zero new packages
- **Environment variables:** Do not hardcode API keys
- **GSD workflow:** Use GSD commands for code changes

## Sources

### Primary (HIGH confidence)
- `backend/utils/pdf_renderer.py` -- Existing WeasyPrint pipeline, `generate_pdf()`, `process_text_with_math()`
- `backend/api/report.py` -- Existing Flask blueprint with test-pdf, analyze-context, generate endpoints
- `frontend/src/utils/latex.ts` -- Existing `renderLatex()` with KaTeX + markdown support
- `frontend/src/utils/exportPdf.ts` -- Existing `Plotly.toImage()` pattern at lines 48-52
- `frontend/src/types/report.ts` -- `ReportAnalysisData` type contract
- `frontend/src/components/ReportBeta.tsx` -- Current report page (706 lines)
- `frontend/src/services/api.ts` -- `GeneratedSections` interface, report API functions
- `.planning/phases/11-preview-editing-and-pdf-assembly/11-CONTEXT.md` -- All locked decisions D-01 through D-09
- `.planning/phases/11-preview-editing-and-pdf-assembly/11-UI-SPEC.md` -- Full UI design contract

### Secondary (MEDIUM confidence)
- [Plotly.js static image export docs](https://plotly.com/javascript/static-image-export/) -- toImage() API format options
- WeasyPrint 68.1 -- verified installed and working locally; data URI image support needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and proven in Phases 8-10
- Architecture: HIGH - Builds directly on existing patterns, no new architectural decisions needed
- Pitfalls: MEDIUM - WeasyPrint base64 image handling and plot availability timing need runtime validation

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no moving dependencies)
