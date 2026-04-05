# Phase 16: DOCX Export with Math Rendering - Research

**Researched:** 2026-04-05
**Domain:** python-docx, LaTeX-to-OMML conversion, Hebrew RTL in Word, image embedding
**Confidence:** HIGH

## Summary

DOCX export requires a backend pipeline parallel to the existing PDF export: same data inputs (sections, title_page, plots, analysis_data), different output format. The conversion chain for math is LaTeX -> MathML (via `latex2mathml`) -> OMML (via XSLT with Microsoft's `MML2OMML.XSL`) -> appended to python-docx paragraph elements. python-docx 1.2.0 is already installed and has robust support for paragraphs, tables, images, and styles, but lacks native APIs for RTL bidi and math equations -- both require direct XML manipulation via `lxml`.

Hebrew RTL is achieved by setting `<w:bidi/>` on paragraph properties and `<w:rtl/>` on run properties via the underlying XML API. Math runs are inserted as OMML elements that Word natively renders left-to-right within the RTL paragraph context. Plot images are embedded via `Document.add_picture()` with `BytesIO` streams from base64-decoded plot data. Font embedding is NOT supported by python-docx -- the recommendation text should mention installing Noto Sans Hebrew for best results, but the document will render with fallback fonts on systems without it.

**Primary recommendation:** Build `backend/utils/docx_renderer.py` mirroring `pdf_renderer.py` structure. Use `latex2mathml` + bundled `MML2OMML.XSL` for math. Add `/export-docx` and `/export-results-docx` endpoints to `report.py`. Frontend adds format selector defaulting to DOCX.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Best-effort full OMML conversion. Attempt to convert ALL LaTeX expressions to native Office Math (OMML). Fractions, Greek letters, superscripts, integrals, summations -- all rendered as real equation objects editable in Word. Only truly exotic/unsupported LaTeX falls back to plain text.
- **D-02:** Same fonts as PDF export -- Noto Sans Hebrew for body text. RTL paragraph direction set via python-docx with LTR runs for math and English content. Consistent look across PDF and DOCX output.
- **D-03:** DOCX is the default export format. Export button defaults to DOCX with small recommendation text (e.g., "Recommended -- editable equations, better compatibility"). PDF available as secondary option via dropdown or smaller button.
- **D-04:** Both tiers support both formats -- results-only DOCX/PDF and full report DOCX/PDF. Consistent experience regardless of export tier.
- **D-05:** Remove template selector entirely -- both PDF and DOCX. The current 3-template dropdown (Israeli, Minimal, Academic) is removed from the UI. Single clean document style for both formats.
- **D-06:** DOCX is positioned as the recommended format over PDF.
- **D-07:** Plots MUST be embedded in DOCX exports. Fit plots and residuals plots captured via Plotly.toImage() are embedded as images in the DOCX file. This is a hard requirement.

### Claude's Discretion
- DOCX document structure and styling (margins, spacing, heading styles)
- OMML conversion library/approach (latex2mathml, custom converter, etc.)
- How recommendation text is worded in the UI
- Backend endpoint structure (new endpoints vs extending existing report endpoints)
- How plot images are sized and positioned in DOCX
- Figure caption formatting in DOCX
- Error handling when OMML conversion fails for specific expressions
- How to embed Noto Sans Hebrew font (embed in DOCX vs require user to have it installed)

### Deferred Ideas (OUT OF SCOPE)
- User-selectable fonts for DOCX export
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCX-01 | User can download a DOCX lab report with the same sections, title page, and content as the PDF export | python-docx 1.2.0 supports all needed document structures (paragraphs, tables, headings, images). Build `assemble_report_docx()` and `assemble_results_docx()` mirroring existing HTML assemblers. |
| DOCX-02 | Math equations rendered as OMML where possible, LaTeX text fallback | latex2mathml 3.79.0 + MML2OMML.XSL XSLT pipeline. Wrap in try/except for graceful fallback to plain text. |
| DOCX-03 | DOCX supports Hebrew RTL text direction with English LTR math | Direct XML manipulation: `<w:bidi/>` on paragraph pPr, `<w:rtl/>` on Hebrew run rPr. OMML elements render LTR natively. |
| DOCX-04 | Fit and residuals plots embedded as images | `Document.add_picture(BytesIO(decoded_base64), width=Inches(6))` -- python-docx handles this natively. |
| DOCX-05 | User can choose between PDF and DOCX export format | Frontend format selector dropdown/toggle defaulting to DOCX. API functions `exportReportDocx()` and `exportResultsDocx()` in api.ts. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| python-docx | 1.2.0 | DOCX document creation | Already installed. Only viable pure-Python DOCX generator. |
| latex2mathml | 3.79.0 | LaTeX to MathML conversion | Pure Python, no external deps, well-maintained, standard in the ecosystem |
| lxml | 6.0.2 | XSLT transformation (MathML->OMML) and XML manipulation | Already installed as python-docx dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MML2OMML.XSL | N/A (bundled file) | Microsoft's XSLT stylesheet for MathML-to-OMML | Required for every math conversion. Bundle in `backend/utils/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| latex2mathml | Custom LaTeX parser | latex2mathml covers 95%+ of physics LaTeX; custom parser is months of work |
| MML2OMML.XSL | Custom MathML-to-OMML converter | XSL is the standard; custom would miss edge cases |
| python-docx | docxtpl (template-based) | Extra dependency, templates are overkill for programmatic generation |

**Installation:**
```bash
pip install latex2mathml
```
Add `latex2mathml>=3.77.0` to `requirements.txt`. The MML2OMML.XSL file must be sourced from an open-source repository (e.g., TEIC/Stylesheets on GitHub) and bundled at `backend/utils/MML2OMML.XSL`.

## Architecture Patterns

### Recommended Project Structure
```
backend/
  utils/
    docx_renderer.py     # NEW: DOCX generation pipeline (mirrors pdf_renderer.py)
    MML2OMML.XSL         # NEW: Bundled XSLT stylesheet
    pdf_renderer.py       # EXISTING: unchanged
  api/
    report.py             # MODIFIED: add /export-docx and /export-results-docx endpoints
frontend/
  src/
    services/
      api.ts              # MODIFIED: add exportReportDocx(), exportResultsDocx()
    components/
      AutoLab.tsx          # MODIFIED: format selector on export button
      report/
        ReportSection.tsx  # MODIFIED: format selector, remove template selector
```

### Pattern 1: LaTeX to OMML Conversion Pipeline
**What:** Three-stage conversion: LaTeX string -> MathML -> OMML XML element
**When to use:** Every time a LaTeX expression (from `$...$` or `$$...$$` delimiters) needs to appear in DOCX
**Example:**
```python
# Source: GitHub python-openxml/python-docx#320, Anjou-YES/Latex2Mathml2OMML
import latex2mathml.converter
from lxml import etree

# Load XSLT once at module level
_XSL_PATH = os.path.join(os.path.dirname(__file__), 'MML2OMML.XSL')
_XSLT = etree.XSLT(etree.parse(_XSL_PATH))

def latex_to_omml(latex_expr: str) -> etree._Element:
    """Convert LaTeX to OMML element for insertion into python-docx paragraph."""
    mathml_str = latex2mathml.converter.convert(latex_expr)
    mathml_tree = etree.fromstring(mathml_str)
    omml_tree = _XSLT(mathml_tree)
    return omml_tree.getroot()
```

### Pattern 2: RTL Paragraph with Bidi
**What:** Set paragraph direction to RTL for Hebrew text
**When to use:** Every Hebrew paragraph in the DOCX
**Example:**
```python
# Source: GitHub python-openxml/python-docx#1411
from docx.oxml.parser import OxmlElement

def set_paragraph_rtl(paragraph):
    """Set paragraph to right-to-left direction."""
    pPr = paragraph._p.get_or_add_pPr()
    bidi = OxmlElement("w:bidi")
    pPr.insert_element_before(bidi,
        "w:adjustRightInd", "w:snapToGrid", "w:spacing",
        "w:ind", "w:contextualSpacing", "w:mirrorIndents",
        "w:suppressOverlap", "w:jc", "w:textDirection",
        "w:textAlignment", "w:textboxTightWrap", "w:outlineLvl",
        "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange",
    )
```

### Pattern 3: Mixed Math+Text Paragraph
**What:** Parse text with `$...$` delimiters, split into text runs and OMML elements
**When to use:** Any paragraph containing inline LaTeX
**Example:**
```python
import re

def add_mixed_paragraph(doc, text, is_rtl=True):
    """Add paragraph with mixed text and inline math."""
    para = doc.add_paragraph()
    if is_rtl:
        set_paragraph_rtl(para)
    
    # Split on $...$ delimiters
    parts = re.split(r'(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)', text)
    for i, part in enumerate(parts):
        if i % 2 == 0:
            # Regular text
            if part.strip():
                run = para.add_run(part)
                if is_rtl:
                    run.font.name = 'Noto Sans Hebrew'
        else:
            # Math expression -- convert to OMML
            try:
                omml = latex_to_omml(part.strip())
                para._element.append(omml)
            except Exception:
                # Fallback: plain text
                run = para.add_run(part.strip())
                run.font.italic = True
```

### Pattern 4: Image Embedding from Base64
**What:** Decode base64 plot data and insert as inline image
**When to use:** Fit and residuals plots
**Example:**
```python
import base64
import io
from docx.shared import Inches

def add_plot_image(doc, base64_data, caption, fig_num, language='he'):
    """Add plot image with figure caption."""
    if ',' in base64_data:
        base64_data = base64_data.split(',', 1)[1]
    img_bytes = base64.b64decode(base64_data)
    stream = io.BytesIO(img_bytes)
    doc.add_picture(stream, width=Inches(5.5))
    
    fig_label = 'Figure' if language == 'en' else '\u05d0\u05d9\u05d5\u05e8'
    caption_para = doc.add_paragraph(f'{fig_label} {fig_num}: {caption}')
    caption_para.alignment = 1  # CENTER
```

### Anti-Patterns to Avoid
- **Generating HTML then converting to DOCX:** Do NOT reuse the HTML assembly from pdf_renderer.py. python-docx works with its own document model, not HTML. Build a parallel assembler.
- **Saving OMML as image fallback:** Do NOT render math as PNG images. The whole point of DOCX export is editable OMML equations.
- **Using python-docx's font.rtl directly:** The `font.rtl` property is read-only in many contexts. Use XML manipulation via `OxmlElement` instead.
- **Embedding fonts in DOCX:** python-docx cannot embed fonts. Do not attempt to hack the DOCX ZIP to inject font files -- it's fragile and Word may reject the file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LaTeX parsing | Custom LaTeX tokenizer | `latex2mathml.converter.convert()` | Covers fractions, Greek, sums, integrals, superscripts, subscripts, text-in-math |
| MathML to OMML | Custom XML builder | `MML2OMML.XSL` via `lxml.etree.XSLT` | Microsoft's own stylesheet, handles all OMML edge cases |
| DOCX ZIP packaging | Manual ZIP manipulation | `python-docx` Document model | Handles relationships, content types, media parts automatically |
| Paragraph bidi | Regex-based text reversal | `<w:bidi/>` XML element | Word's own RTL mechanism; text reversal would break cursor behavior |

**Key insight:** The entire OMML math pipeline is a solved problem with latex2mathml + MML2OMML.XSL. The only custom code needed is glue between these components and python-docx's paragraph model.

## Common Pitfalls

### Pitfall 1: MML2OMML.XSL Not Found on Server
**What goes wrong:** The XSLT file is expected at a Windows Office path that doesn't exist on Linux/macOS/Railway.
**Why it happens:** Most tutorials reference `C:\Program Files\Microsoft Office\Office14\MML2OMML.XSL`.
**How to avoid:** Bundle the XSL file in the repo at `backend/utils/MML2OMML.XSL`. Source from TEIC/Stylesheets GitHub (open-source licensed). Load once at module init.
**Warning signs:** `FileNotFoundError` or empty XSLT output.

### Pitfall 2: latex2mathml Namespace Mismatch
**What goes wrong:** latex2mathml output uses `<math xmlns="http://www.w3.org/1998/Math/MathML">` but some MML2OMML.XSL versions expect a different namespace or no namespace.
**Why it happens:** Multiple versions of MML2OMML.XSL exist with slightly different expectations.
**How to avoid:** Test the exact combination of latex2mathml 3.79.0 output with the specific XSL version bundled. If namespace stripping is needed, do it before XSLT transform.
**Warning signs:** XSLT returns empty document or no `<m:oMath>` elements.

### Pitfall 3: Display Math vs Inline Math in OMML
**What goes wrong:** All math renders as display (centered block) even when it should be inline.
**Why it happens:** OMML has `<m:oMathPara>` (display/block) and `<m:oMath>` (inline). The XSLT may wrap everything in `<m:oMathPara>`.
**How to avoid:** For inline math, extract the `<m:oMath>` child from any wrapping `<m:oMathPara>`. For display math, use the full `<m:oMathPara>`.
**Warning signs:** Equations appearing on their own lines when they should be inline with Hebrew text.

### Pitfall 4: RTL Bidi Element Ordering
**What goes wrong:** `insert_element_before` fails or produces invalid XML because the successor element list is wrong.
**Why it happens:** OOXML schema requires strict element ordering in `<w:pPr>`.
**How to avoid:** Use the exact successor list from the python-docx issue #1411 workaround (shown in Pattern 2 above).
**Warning signs:** Word reports "unreadable content" when opening the DOCX.

### Pitfall 5: Base64 Image Decoding Issues
**What goes wrong:** `add_picture()` fails with "cannot identify image file".
**Why it happens:** The base64 string includes the `data:image/png;base64,` prefix which must be stripped.
**How to avoid:** Always split on first comma and decode only the payload portion.
**Warning signs:** `UnidentifiedImageError` or `ValueError`.

### Pitfall 6: Font Not Available on User's System
**What goes wrong:** Hebrew text renders in Calibri or Times New Roman instead of Noto Sans Hebrew.
**Why it happens:** python-docx sets the font NAME but cannot embed the font file. If the user doesn't have Noto Sans Hebrew, Word uses its fallback.
**How to avoid:** Set font name to "Noto Sans Hebrew" in the document. Include recommendation text in the UI: "For best results, install Noto Sans Hebrew font." This is an acceptable tradeoff -- the document structure and equations still work correctly with any Hebrew-capable font.
**Warning signs:** Correct equations but wrong typeface.

### Pitfall 7: Template Selector Removal Breaking PDF Export
**What goes wrong:** Removing the template selector dropdown in ReportSection.tsx but not updating the PDF endpoint call, which still expects a `template` parameter.
**Why it happens:** D-05 says remove the selector, but `export-pdf` endpoint validates `template` param.
**How to avoid:** Hardcode `template: 'israeli'` (or a new single style) in the frontend API call. Keep backend accepting the parameter for backward compat but ignore the validation.
**Warning signs:** PDF export breaks after UI changes.

## Code Examples

### Full DOCX Generation Entry Point
```python
# Source: Verified pattern from python-docx 1.2.0 docs + community solutions
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import io

def generate_docx(sections, title_page, plots, analysis_data, language='he') -> bytes:
    """Generate a DOCX lab report. Returns bytes."""
    doc = Document()
    
    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Noto Sans Hebrew'
    font.size = Pt(11)
    
    is_rtl = (language == 'he')
    
    # Title page
    _add_title_page(doc, title_page, language, is_rtl)
    
    # Sections
    for key in ['theory', 'method']:
        content = sections.get(key, '')
        if content.strip():
            _add_section(doc, HEADERS[language][key], content, is_rtl)
    
    # Results section with data
    _add_results_section(doc, analysis_data, plots, language, is_rtl)
    
    for key in ['discussion', 'conclusions']:
        content = sections.get(key, '')
        if content.strip():
            _add_section(doc, HEADERS[language][key], content, is_rtl)
    
    # Save to bytes
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.read()
```

### Backend Endpoint
```python
# Source: Mirrors existing export_pdf() pattern in report.py
@report_bp.route('/export-docx', methods=['POST'])
def export_docx():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body is required"}), 400
    
    sections = body.get('sections', {})
    title_page = body.get('title_page', {})
    plots = body.get('plots', {})
    language = body.get('language', 'he')
    analysis_data = body.get('analysis_data', {})
    
    docx_bytes = generate_docx(sections, title_page, plots, analysis_data, language)
    
    return Response(
        docx_bytes,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        headers={
            'Content-Disposition': 'attachment; filename="lab-report.docx"',
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
    )
```

### Frontend Format Selector
```typescript
// Source: Pattern derived from existing export UI in AutoLab.tsx
type ExportFormat = 'docx' | 'pdf';

const [exportFormat, setExportFormat] = useState<ExportFormat>('docx');

// In JSX:
<select value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)}>
  <option value="docx">DOCX (Recommended)</option>
  <option value="pdf">PDF</option>
</select>
```

### Frontend API Functions
```typescript
// Source: Mirrors existing exportReportPdf pattern in api.ts
export const exportReportDocx = async (data: {
    sections: Record<string, string>;
    title_page: Record<string, string>;
    plots: Record<string, string | null>;
    language: string;
    analysis_data: Record<string, unknown>;
}): Promise<Blob> => {
    const response = await api.post('/report/export-docx', data, {
        responseType: 'blob',
    });
    return response.data;
};

export const exportResultsDocx = async (data: {
    analysis_data: Record<string, unknown>;
    plots: Record<string, string | null>;
    summary: string;
    language: string;
}): Promise<Blob> => {
    const response = await api.post('/report/export-results-docx', data, {
        responseType: 'blob',
    });
    return response.data;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Math as images in DOCX | OMML native equations | Standard since Office 2007 | Equations are editable in Word |
| python-docx 0.x | python-docx 1.2.0 | 2024 | Stable API, better style support |
| latex2mathml 2.x | latex2mathml 3.79.0 | 2024 | Better coverage of LaTeX commands |

**Deprecated/outdated:**
- `python-docx` before 1.0: Different import paths, less stable API
- Using `pandoc` subprocess for DOCX: Adds heavyweight dependency, less control over OMML quality

## Open Questions

1. **MML2OMML.XSL Version Compatibility**
   - What we know: Multiple versions exist on GitHub (TEIC, transpect, meTypeset). They should all work with latex2mathml output.
   - What's unclear: Which specific version works best with latex2mathml 3.79.0's MathML namespace handling.
   - Recommendation: Test the TEIC version first. If namespace issues arise, try the meTypeset version. Both are Apache/open-source licensed.

2. **Complex LaTeX Expressions Failing OMML Conversion**
   - What we know: latex2mathml handles standard physics LaTeX well (fractions, Greek, sums, integrals, superscripts). Custom macros (e.g., `\text{}` inside math) may need special handling.
   - What's unclear: Exact failure rate for the project's EQUATION_TEST_SUITE.
   - Recommendation: Run the 12-expression test suite through the pipeline during implementation. Log which expressions succeed and which fall back.

3. **Noto Sans Hebrew Display Without Font Installed**
   - What we know: Word will use a fallback Hebrew font (e.g., David, Arial) if Noto Sans Hebrew isn't installed.
   - What's unclear: Whether the fallback still looks acceptable.
   - Recommendation: Accept this limitation. Include note in recommendation text. The document's structure and equations are font-independent.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| python-docx | DOCX generation | Yes | 1.2.0 | -- |
| lxml | XSLT transform | Yes | 6.0.2 | -- |
| latex2mathml | LaTeX to MathML | No (not installed) | 3.79.0 available | Must install |
| MML2OMML.XSL | MathML to OMML | No (not bundled) | N/A | Must download and bundle |

**Missing dependencies with no fallback:**
- `latex2mathml` -- must be added to requirements.txt and installed
- `MML2OMML.XSL` -- must be sourced from GitHub (TEIC/Stylesheets or similar) and placed in `backend/utils/`

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 7.0.0+ |
| Config file | None (default discovery) |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCX-01 | DOCX generated with correct sections | unit | `cd backend && python -m pytest tests/test_docx_renderer.py::test_full_report_docx -x` | No -- Wave 0 |
| DOCX-02 | LaTeX converted to OMML in DOCX | unit | `cd backend && python -m pytest tests/test_docx_renderer.py::test_latex_to_omml -x` | No -- Wave 0 |
| DOCX-03 | Hebrew RTL paragraphs with bidi element | unit | `cd backend && python -m pytest tests/test_docx_renderer.py::test_rtl_bidi -x` | No -- Wave 0 |
| DOCX-04 | Plot images embedded in DOCX | unit | `cd backend && python -m pytest tests/test_docx_renderer.py::test_plot_embedding -x` | No -- Wave 0 |
| DOCX-05 | Both format endpoints return correct content-type | unit | `cd backend && python -m pytest tests/test_docx_renderer.py::test_export_endpoints -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_docx_renderer.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_docx_renderer.py` -- covers DOCX-01 through DOCX-05
- [ ] Framework install: already available (pytest in requirements.txt)

## Project Constraints (from CLAUDE.md)

- **Tech stack**: React + Flask -- no framework migration
- **AI provider**: OpenAI for AutoLab (not relevant to DOCX export)
- **Deployment**: Railway via nixpacks -- latex2mathml is pure Python so no native dependency concern
- **No Docker**: nixpacks only
- **API pattern**: `/api/{module}/{action}` -- new endpoints follow `/api/report/export-docx`
- **Response shape**: `{ data: ..., error: null }` on success for JSON; raw bytes for file downloads
- **File uploads**: multipart/form-data POST (not relevant -- export is JSON POST returning blob)
- **LaTeX**: Equations in LaTeX format (inline `$...$`, display `$$...$$`) -- same delimiters parsed in DOCX renderer

## Sources

### Primary (HIGH confidence)
- python-docx 1.2.0 docs (installed, API verified) -- document creation, add_picture, styles
- python-openxml/python-docx GitHub issues #320, #1411 -- OMML insertion and bidi workarounds
- latex2mathml PyPI 3.79.0 -- LaTeX to MathML pure Python converter

### Secondary (MEDIUM confidence)
- TEIC/Stylesheets GitHub -- MML2OMML.XSL open-source source
- Anjou-YES/Latex2Mathml2OMML GitHub -- Full pipeline reference implementation
- markdocx PyPI -- Validates the latex2mathml -> XSLT -> OMML pipeline as proven approach

### Tertiary (LOW confidence)
- Font embedding limitations -- based on python-docx issue tracker, no official docs confirming impossibility. Practically, font embedding via python-docx is not supported but manual ZIP manipulation might work (not recommended).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- python-docx 1.2.0 and latex2mathml 3.79.0 are installed/available, lxml already present
- Architecture: HIGH -- mirrors existing pdf_renderer.py pattern, well-documented community patterns for OMML insertion
- Pitfalls: HIGH -- common issues well-documented in GitHub issues; RTL/bidi workaround confirmed
- Math conversion: MEDIUM -- latex2mathml + MML2OMML.XSL is the standard approach but exact compatibility with all 12 test expressions needs runtime verification

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable domain, libraries change slowly)
