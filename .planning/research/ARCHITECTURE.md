# Architecture Research

**Domain:** AI-powered academic lab report generation integrated into existing physics lab automation app
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (based on codebase analysis + training data; web search unavailable)

## System Overview

```
                     AnalysisProvider (React Context)
                              |
              +---------------+--------------+
              |               |              |
         App Shell        Nav Bar        Sidebar
       (header/footer)                 (AI chat)
              |
         Route Switch
              |
   +----------+-----------+
   |                      |
AutoLab.tsx          ReportBuilder.tsx (NEW)
   |                      |
   | runs analysis        | consumes analysis results
   | stores to context    | + lab instruction context
   |                      | + user-provided context
   v                      v
AnalysisContext     ReportPreview.tsx (NEW)
(autolabResults)        |
              +---------+---------+
              |                   |
     SectionEditor.tsx (NEW)   PDF Download
       (per-section edit)          |
                                   v
                            POST /api/report/generate (NEW)
                                   |
                    +--------------+--------------+
                    |              |              |
             AI Content      matplotlib      WeasyPrint
             Generation      Plot PNGs       HTML -> PDF
             (OpenAI)                        (Hebrew RTL)
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ReportBuilder.tsx** (new) | Collects report context: lab instruction file upload, free-text context, experiment metadata. Triggers AI content generation. Orchestrates the report workflow. | Backend `POST /api/report/context`, `POST /api/report/generate-sections`; reads `autolabResults` from AnalysisContext |
| **ReportPreview.tsx** (new) | Renders full report preview in-app with section-by-section layout. Shows what the PDF will look like. | ReportBuilder (parent); SectionEditor (child) |
| **SectionEditor.tsx** (new) | Inline editor for a single report section (title, theory, planning, results, discussion). Supports markdown editing with live preview. | ReportPreview (parent); optional AI regenerate per-section |
| **report_bp** (new backend blueprint) | Handles lab instruction parsing, AI content generation, and PDF rendering. Three endpoints. | OpenAI API; WeasyPrint; matplotlib; existing `utils/calculations.py` |
| **backend/utils/doc_parser.py** (new) | Extracts text from uploaded PDF/Word lab instruction files. Handles Hebrew text. | `report_bp` calls it directly |
| **backend/utils/plot_export.py** (new) | Generates publication-quality matplotlib figures from fit data for embedding in PDFs. Thread-safe OO API. | `report_bp` calls it directly |
| **backend/templates/** (new directory) | Jinja2 HTML template + CSS for WeasyPrint PDF rendering. Embeds fonts for Hebrew RTL + math. | WeasyPrint consumes these |

## Recommended Project Structure

### New Backend Files

```
backend/
  api/
    report.py              # NEW: Report generation blueprint (report_bp)
  utils/
    doc_parser.py          # NEW: PDF/Word text extraction
    plot_export.py         # NEW: matplotlib OO API figure generation
  templates/
    report/
      report.html          # NEW: Jinja2 HTML template for WeasyPrint
      report.css           # NEW: Print stylesheet (embedded in HTML)
      fonts/
        NotoSansHebrew-*.woff2   # NEW: Hebrew RTL font
        NotoSans-*.woff2         # NEW: Latin text font
        katex/                   # NEW: Bundled KaTeX CSS + fonts for math
```

### New Frontend Files

```
frontend/src/
  components/
    report/
      ReportBuilder.tsx     # NEW: Report context collection + orchestration
      ReportPreview.tsx     # NEW: In-app report preview
      SectionEditor.tsx     # NEW: Per-section markdown editor
  types/
    report.ts              # NEW: TypeScript interfaces for report data
  services/
    api.ts                 # MODIFIED: Add report API functions
```

### Structure Rationale

- **`components/report/` subfolder:** Report generation is a multi-component feature. Grouping prevents cluttering the flat component directory. This also establishes a pattern for future feature groups.
- **`types/report.ts`:** Report has complex data structures shared between builder, preview, editor, and API calls. Co-locating types with components (the current pattern) would require duplication.
- **`backend/templates/report/`:** Keeps all report template assets together. The `fonts/` subdirectory is critical because WeasyPrint cannot fetch fonts from CDNs -- they must be locally bundled.
- **`backend/utils/doc_parser.py`:** Separated from `report.py` because document parsing is a distinct concern that may be reused (e.g., if instruction file upload is added to other tools).

## Architectural Patterns

### Pattern 1: Multi-Step Report Generation Pipeline

**What:** Report generation is NOT a single API call. It is a pipeline with user review between steps:
1. **Context collection** -- upload lab instructions + free-text input
2. **AI section generation** -- backend generates theory, planning, discussion sections
3. **User review/edit** -- frontend shows preview with editable sections
4. **PDF rendering** -- user clicks "Download PDF" after reviewing

**When to use:** Always. Never go directly from "Generate Report" to PDF download without user review.

**Trade-offs:** Adds a review step (more clicks), but prevents bad AI output from reaching the final PDF. Users need to verify AI-generated physics content.

**Data flow:**
```
Step 1: Context Collection
  User fills ReportBuilder form:
    - Uploads lab instruction file (PDF/Word) [optional]
    - Enters free-text context (experiment name, equipment, notes)
    - AutoLab results auto-populated from AnalysisContext

  Frontend sends: POST /api/report/parse-instructions
    Body: multipart/form-data { file: lab_instructions.pdf }
    Response: { text: "extracted text content", language: "he" | "en" }

Step 2: AI Section Generation
  Frontend sends: POST /api/report/generate-sections
    Body: {
      instructions_text: "...",       // from step 1
      free_text_context: "...",       // user input
      analysis_results: {             // from AnalysisContext.autolabResults
        fit: { model_name, parameters, uncertainties, ... },
        formula: { expression, value, uncertainty },
        nsigma: { n_sigma, verdict, theoretical_value },
        summary: "AI-generated analysis summary"
      },
      language: "he" | "en",
      sections_to_generate: ["theory", "planning", "results", "discussion"]
    }
    Response: {
      sections: {
        theory: { title: "...", content: "..." },
        planning: { title: "...", content: "..." },
        results: { title: "...", content: "..." },
        discussion: { title: "...", content: "..." }
      }
    }

Step 3: User Review (frontend-only, no API call)
  ReportPreview renders all sections
  User edits any section via SectionEditor
  Sections stored in component-local state

Step 4: PDF Generation
  Frontend sends: POST /api/report/generate-pdf
    Body: {
      title: "Hooke's Law Experiment",
      author: "Student Name",
      sections: [
        { id: "theory", title: "Theoretical Background", content: "..." },
        { id: "planning", title: "Measurement Planning", content: "..." },
        { id: "results", title: "Results", content: "..." },
        { id: "discussion", title: "Discussion", content: "..." }
      ],
      analysis_data: {
        fit: { ... },
        formula: { ... },
        nsigma: { ... }
      },
      plot_data: {
        x_data: [...], y_data: [...], x_fit: [...], y_fit: [...],
        residuals: [...], y_errors: [...], x_errors: [...],
        x_label: "Extension [m]", y_label: "Force [N]"
      },
      language: "he" | "en"
    }
    Response: Binary PDF (Content-Type: application/pdf)

  Frontend: URL.createObjectURL(blob) -> download
```

### Pattern 2: Hebrew RTL with Embedded LTR Math

**What:** The report body text is in Hebrew (RTL direction) but mathematical expressions, variable names, and equations are in English/LTR. This is standard Israeli academic format.

**When to use:** When `language: "he"` is specified.

**Implementation in WeasyPrint HTML template:**
```html
<html dir="rtl" lang="he">
<head>
  <style>
    @font-face {
      font-family: 'Noto Sans Hebrew';
      src: url('fonts/NotoSansHebrew-Regular.woff2');
    }
    body {
      font-family: 'Noto Sans Hebrew', 'Noto Sans', sans-serif;
      direction: rtl;
      text-align: right;
    }
    .math, .equation, .ltr-inline {
      direction: ltr;
      unicode-bidi: embed;
      font-family: 'Noto Sans', 'KaTeX_Main', serif;
    }
    .equation-block {
      direction: ltr;
      unicode-bidi: isolate;
      text-align: center;
      margin: 1em 0;
    }
  </style>
</head>
```

**Trade-offs:**
- Noto Sans Hebrew is well-supported and freely available (Google Fonts). Must be bundled locally for WeasyPrint.
- The `unicode-bidi: embed` approach for inline math is the standard CSS method. WeasyPrint supports this.
- KaTeX CSS rendering inside WeasyPrint needs prototype validation (MEDIUM confidence).

### Pattern 3: AI Content Generation with Structured Output

**What:** Use OpenAI to generate report sections (theory, planning, discussion) with structured JSON output, not free-form text.

**When to use:** For all AI-generated report sections.

**Implementation:**
```python
# In backend/api/report.py
def generate_report_sections(instructions_text, analysis_results, context, language):
    """Generate academic report sections using OpenAI."""
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    system_prompt = REPORT_SYSTEM_PROMPT  # Detailed academic writing guidelines

    user_prompt = build_report_prompt(
        instructions_text=instructions_text,
        analysis_results=analysis_results,
        context=context,
        language=language
    )

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"},  # Force JSON output
    )

    sections = json.loads(response.choices[0].message.content)
    return sections
```

**Trade-offs:**
- `response_format: json_object` ensures parseable output but slightly increases token usage.
- Generating all sections in one API call is cheaper than separate calls per section, but means regenerating one section requires regenerating all. Recommendation: generate all at once initially, then offer per-section regeneration via a separate endpoint.
- The AI system prompt must enforce: (a) Hebrew or English based on language param, (b) LaTeX notation for equations using `$...$` inline and `$$...$$` display, (c) academic register appropriate for Israeli university lab reports.

### Pattern 4: Server-Side Plot Generation (Thread-Safe)

**What:** Generate matplotlib figures for PDF embedding using the OO API, never pyplot.

**When to use:** All plots in the PDF report.

```python
# backend/utils/plot_export.py
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg
import io, base64
import numpy as np

def generate_fit_plot(x_data, y_data, x_fit, y_fit,
                      y_errors=None, x_errors=None,
                      x_label="x", y_label="y") -> str:
    """Generate fit plot as base64 PNG. Thread-safe."""
    fig = Figure(figsize=(8, 5), dpi=150)
    canvas = FigureCanvasAgg(fig)
    ax = fig.add_subplot(111)

    ax.errorbar(x_data, y_data, yerr=y_errors, xerr=x_errors,
                fmt='o', markersize=4, capsize=3, label='Data')
    ax.plot(x_fit, y_fit, 'r-', linewidth=1.5, label='Fit')
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)
    ax.legend()
    fig.tight_layout()

    buf = io.BytesIO()
    canvas.print_png(buf)
    return base64.b64encode(buf.getvalue()).decode()
```

**Trade-offs:** matplotlib OO API is more verbose than pyplot but is required for thread safety in Flask. The prior research already documented this pattern.

### Pattern 5: Report Data Contract

**What:** A shared TypeScript interface defining the complete report data structure, used by all report components and API calls.

```typescript
// frontend/src/types/report.ts

export interface ReportSection {
    id: string;           // "theory" | "planning" | "results" | "discussion"
    title: string;        // Section heading
    content: string;      // Markdown content (may include $LaTeX$)
    isEdited: boolean;    // User has modified AI-generated content
}

export interface ReportAnalysisData {
    fit?: {
        model_name: string;
        parameter_names: string[];
        parameters: number[];
        uncertainties: number[];
        chi_squared: number | null;
        reduced_chi_squared: number | null;
        p_value: number | null;
        r_squared: number | null;
        dof: number;
    };
    formula?: {
        expression: string;
        value: number;
        uncertainty: number;
        formatted: string;
    };
    nsigma?: {
        n_sigma: number;
        verdict: string;
        theoretical_value: number;
        theoretical_uncertainty: number;
    };
    summary?: string;
}

export interface ReportPlotData {
    x_data: number[];
    y_data: number[];
    x_fit: number[];
    y_fit: number[];
    residuals: number[];
    y_errors?: number[];
    x_errors?: number[];
    x_label: string;
    y_label: string;
}

export interface ReportContext {
    title: string;
    author: string;
    date: string;
    language: "he" | "en";
    instructionsText?: string;     // Extracted from uploaded file
    freeTextContext?: string;       // User-provided notes
}

export interface FullReportPayload {
    context: ReportContext;
    sections: ReportSection[];
    analysisData: ReportAnalysisData;
    plotData: ReportPlotData;
}
```

## Data Flow

### Complete Report Generation Flow

```
┌──────────────────────────────────────────────────────────┐
│ FRONTEND                                                  │
│                                                           │
│  AutoLab.tsx                                              │
│    └─ runs analysis                                       │
│    └─ stores results in AnalysisContext.autolabResults     │
│    └─ shows "Generate Report" button (NEW)                │
│         │                                                 │
│         v                                                 │
│  ReportBuilder.tsx                                        │
│    ├─ reads autolabResults from context                   │
│    ├─ file upload: lab instructions (PDF/Word)            │
│    │    └─ POST /api/report/parse-instructions            │
│    │         └─ returns extracted text + detected language │
│    ├─ free-text input: experiment context                 │
│    ├─ metadata: title, author, language toggle            │
│    └─ "Generate Report" click                             │
│         └─ POST /api/report/generate-sections             │
│              └─ returns AI-generated sections              │
│                   │                                       │
│                   v                                       │
│  ReportPreview.tsx                                        │
│    ├─ renders sections with LaTeX (KaTeX in browser)      │
│    ├─ each section wrapped in SectionEditor               │
│    │    └─ user can edit markdown content                  │
│    │    └─ user can "Regenerate" individual section        │
│    │         └─ POST /api/report/regenerate-section        │
│    └─ "Download PDF" button                               │
│         └─ POST /api/report/generate-pdf                  │
│              └─ receives binary PDF blob                   │
│              └─ triggers browser download                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ BACKEND (report_bp)                                       │
│                                                           │
│  POST /api/report/parse-instructions                      │
│    ├─ multipart/form-data with file                       │
│    ├─ doc_parser.py extracts text                         │
│    │    ├─ PDF: PyMuPDF (fitz) for text extraction        │
│    │    └─ DOCX: python-docx for paragraph extraction     │
│    ├─ detects language (Hebrew chars > 30% = "he")        │
│    └─ returns { text, language, page_count }              │
│                                                           │
│  POST /api/report/generate-sections                       │
│    ├─ JSON body with instructions_text + analysis_results │
│    ├─ builds detailed system prompt for academic writing   │
│    ├─ calls OpenAI with response_format: json_object      │
│    └─ returns { sections: { theory, planning, results,    │
│         discussion }, token_usage }                        │
│                                                           │
│  POST /api/report/regenerate-section                      │
│    ├─ JSON body with section_id + existing content +      │
│    │   user feedback                                      │
│    ├─ calls OpenAI for single section regeneration         │
│    └─ returns { section: { title, content } }             │
│                                                           │
│  POST /api/report/generate-pdf                            │
│    ├─ JSON body with all sections + analysis data +       │
│    │   plot data                                          │
│    ├─ plot_export.py: generates fit + residuals PNGs      │
│    ├─ renders Jinja2 HTML template with:                  │
│    │    ├─ section content (markdown -> HTML)              │
│    │    ├─ LaTeX equations (KaTeX server-side rendering)   │
│    │    ├─ parameter tables                                │
│    │    ├─ base64-embedded plot images                     │
│    │    └─ Hebrew RTL styling (if language="he")           │
│    ├─ WeasyPrint converts HTML -> PDF                     │
│    └─ returns binary PDF (Content-Type: application/pdf)  │
└──────────────────────────────────────────────────────────┘
```

### State Management for Report

Report state lives in **component-local state** within ReportBuilder.tsx, NOT in AnalysisContext. Rationale:

1. Report data is large (multiple sections of text, plot data arrays).
2. Report state is transient -- it only matters while the user is on the report page.
3. AnalysisContext already carries `autolabResults` which provides the input. The report output is a different lifecycle.
4. Avoids bloating AnalysisContext further (it already uses `any` throughout).

The only shared state is `autolabResults` (read from context) which provides the analysis results that seed the report.

### Key Data Flows

1. **AutoLab -> Report:** `AnalysisContext.autolabResults` is read by ReportBuilder. This is the primary bridge. The existing `setAutolabResults` call in AutoLab.tsx already stores fit, formula, nsigma, instructions, and filename.

2. **Lab instructions -> AI context:** Uploaded PDF/Word is sent to backend, text extracted, returned to frontend, then sent as context for AI section generation. The file is NOT stored server-side -- stateless like the rest of the app.

3. **Sections -> PDF:** The user's final edited sections (stored in ReportPreview component state) are sent to the PDF generation endpoint. The backend renders them fresh -- it does not cache any report state.

## Integration Points with Existing Code

### Existing Code to MODIFY

| File | Change | Why |
|------|--------|-----|
| `backend/app.py` | Add `from api.report import report_bp` and register with `/api/report` prefix | Standard blueprint registration pattern |
| `frontend/src/services/api.ts` | Add `parseInstructions()`, `generateSections()`, `regenerateSection()`, `generatePdf()` functions | Centralized API layer pattern |
| `frontend/src/components/AutoLab.tsx` | Add "Generate Report" button that navigates to `/report` route, passing results via context | Entry point from analysis to report |
| `frontend/src/App.tsx` | Add `<Route path="/report" element={<ReportBuilder />} />` | New page route |
| `frontend/src/context/AnalysisContext.tsx` | No changes needed | `autolabResults` already carries needed data |
| `requirements.txt` | Add `weasyprint>=62.0`, `matplotlib>=3.8.0`, `PyMuPDF>=1.23.0`, `python-docx>=1.0.0` | New backend dependencies |
| `nixpacks.toml` | Add `pango`, `cairo`, `gdk-pixbuf`, `gobject-introspection` to nixPkgs | WeasyPrint system dependencies |

### Existing Code to LEAVE ALONE

| File | Why Not Modify |
|------|----------------|
| `backend/api/autolab.py` | Report generation is a separate concern. AutoLab orchestrator should not know about reports. |
| `frontend/src/utils/exportPdf.ts` | Existing jsPDF-based export stays as a quick-export option. The new academic report is a different feature, not a replacement. |
| `app/chat_agent.py` | Report AI uses direct OpenAI calls, not the ChatAgent. ChatAgent is for conversational multi-turn; report generation is single-shot structured output. |

### New Backend Blueprint: `report_bp`

```python
# backend/api/report.py -- blueprint structure

report_bp = Blueprint('report', __name__)

@report_bp.route('/parse-instructions', methods=['POST'])
def parse_instructions():
    """Extract text from uploaded lab instruction PDF/Word file."""
    # multipart/form-data -> doc_parser.extract_text(file_bytes, filename)
    # Returns: { text, language, page_count }

@report_bp.route('/generate-sections', methods=['POST'])
def generate_sections():
    """AI-generate report sections from context + analysis results."""
    # JSON body -> OpenAI structured output
    # Returns: { sections: { theory, planning, results, discussion } }

@report_bp.route('/regenerate-section', methods=['POST'])
def regenerate_section():
    """Regenerate a single report section with optional user feedback."""
    # JSON body -> OpenAI single-section generation
    # Returns: { section: { title, content } }

@report_bp.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    """Render final report as PDF with embedded plots and Hebrew RTL."""
    # JSON body -> matplotlib plots + Jinja2 HTML + WeasyPrint -> PDF bytes
    # Returns: binary PDF (Content-Type: application/pdf)
```

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI API | Direct SDK call in `report.py`, same pattern as `autolab.py` | Uses `response_format: json_object` for structured sections. Same `OPENAI_API_KEY` env var. Budget concern: report generation is 1-2 API calls per report (vs. 3-5 for AutoLab analysis). |
| WeasyPrint | Python library call, no external service | Requires system libs (pango, cairo). Highest deployment risk -- test on Railway early. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AutoLab -> ReportBuilder | React Context (`autolabResults`) | Read-only. Report never writes back to AutoLab state. |
| ReportBuilder -> Backend | HTTP (4 endpoints) | Standard JSON + multipart pattern. Follows existing `/api/{module}/{action}` convention. |
| report.py -> doc_parser.py | Direct Python import | Same as how `autolab.py` imports from `utils/calculations.py`. |
| report.py -> plot_export.py | Direct Python import | Returns base64 PNG strings. |
| report.py -> templates/ | Jinja2 `render_template` | Standard Flask pattern. |

## Anti-Patterns

### Anti-Pattern 1: Putting Report Logic in AutoLab

**What people do:** Add report generation endpoints to `autolab.py` or add report UI to `AutoLab.tsx`.
**Why it's wrong:** AutoLab.tsx is already 1,141 lines (god component). Adding report UI would push it past 1,500. Also violates single responsibility -- analysis and report generation are different concerns with different lifecycles.
**Do this instead:** Separate `report_bp` blueprint and `components/report/` directory. AutoLab's only connection to reports is the "Generate Report" button that navigates to the report page.

### Anti-Pattern 2: Client-Side PDF for Academic Reports

**What people do:** Use the existing `exportPdf.ts` (jsPDF) approach for the new academic reports.
**Why it's wrong:** jsPDF cannot render Hebrew RTL text properly. It cannot render KaTeX math as vectors. It produces raster screenshots of HTML, resulting in blurry math and broken Hebrew. The existing export is fine for a quick English-only data dump but not for academic-quality Hebrew reports.
**Do this instead:** Server-side WeasyPrint for academic reports. Keep the existing jsPDF export as a "quick export" option.

### Anti-Pattern 3: Storing Report State Server-Side

**What people do:** Create a report drafts table/file system on the server, save report state between requests.
**Why it's wrong:** The app is intentionally stateless (no database, no auth, no persistent storage). Adding server-side state for reports breaks this architectural principle and adds complexity.
**Do this instead:** All report state lives in frontend component state. Each API call is self-contained: the frontend sends everything needed, the backend processes and returns. If the user refreshes the page, they start over (same as with AutoLab analysis).

### Anti-Pattern 4: One Mega API Call for Everything

**What people do:** A single `POST /api/report/generate` that takes analysis results and returns a finished PDF.
**Why it's wrong:** No user review step. AI-generated physics content can be wrong. Users must be able to read and edit sections before PDF generation. Also, a single call that does AI generation + plot rendering + PDF creation could take 15-30 seconds, causing timeouts.
**Do this instead:** Split into discrete steps: parse instructions, generate sections (AI), then generate PDF (rendering only, fast). User reviews between steps 2 and 3.

### Anti-Pattern 5: Rendering KaTeX Client-Side Then Sending HTML to Backend

**What people do:** Render LaTeX in the browser with KaTeX, capture the HTML, send it to the backend for PDF generation.
**Why it's wrong:** KaTeX's HTML output depends on CSS + fonts loaded in the browser. Sending raw HTML to WeasyPrint without the matching CSS/fonts produces broken math rendering.
**Do this instead:** Send raw LaTeX strings (`$...$`) in section content. The backend converts LaTeX to HTML using KaTeX server-side (via a Python KaTeX wrapper or pre-rendered HTML with bundled fonts/CSS in the template).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (current) | Synchronous PDF generation in Flask request. WeasyPrint takes 2-5 seconds per report. Acceptable. |
| 100-1K users | Add request timeout handling. Consider caching matplotlib figure generation for identical plot data. |
| 1K+ concurrent | WeasyPrint is CPU-heavy. Add a task queue (Celery/RQ) for PDF generation. Return a job ID, poll for completion. This is a future concern, not a v2.0 concern. |

### Scaling Priorities

1. **First bottleneck:** OpenAI API rate limits. Report generation adds 1-2 API calls per report on top of existing AutoLab calls. Mitigate: rate limit the report generation endpoints (same as should be done for AutoLab).
2. **Second bottleneck:** WeasyPrint CPU usage. Each PDF render blocks a Flask worker for 2-5 seconds. Mitigate: increase worker count, or move to async task queue if needed.

## Build Order (Dependency-Driven)

Based on component dependencies, the recommended build order is:

```
Phase 1: Foundation
  1. Report data types (types/report.ts)
  2. doc_parser.py (PDF/Word text extraction)
  3. parse-instructions endpoint
  --> Testable independently: upload a file, get text back

Phase 2: AI Content Pipeline
  4. Report system prompt design
  5. generate-sections endpoint
  6. ReportBuilder.tsx (context collection UI)
  --> Testable: collect context, generate sections, display raw text

Phase 3: Preview & Editing
  7. SectionEditor.tsx
  8. ReportPreview.tsx (renders sections with KaTeX)
  --> Testable: full in-app preview with editing

Phase 4: PDF Rendering
  9. plot_export.py (matplotlib figures)
  10. report.html + report.css templates (including Hebrew RTL)
  11. generate-pdf endpoint (WeasyPrint)
  12. Font bundling (Noto Sans Hebrew + KaTeX fonts)
  --> Testable: download PDF from preview

Phase 5: Integration & Polish
  13. "Generate Report" button in AutoLab.tsx
  14. Route in App.tsx
  15. Per-section regeneration endpoint
  16. Error handling, loading states, edge cases
```

**Rationale:** Start with the backend foundation (file parsing, AI generation) because they have the most unknowns (document parsing quality, AI output quality, Hebrew handling). PDF rendering is last because it depends on all other pieces and has the highest deployment risk (WeasyPrint on Railway).

## Sources

- Current codebase analysis: `AutoLab.tsx` (1,141 lines, results structure), `autolab.py` (orchestrator pattern), `exportPdf.ts` (existing jsPDF approach), `AnalysisContext.tsx` (shared state)
- Prior research: `.planning/research/STACK.md` (WeasyPrint recommendation), `.planning/research/ARCHITECTURE.md` (data flow patterns)
- WeasyPrint HTML-to-PDF: https://weasyprint.org/ (training data, MEDIUM confidence on latest API)
- PyMuPDF text extraction: https://pymupdf.readthedocs.io/ (training data, HIGH confidence on core API)
- python-docx: https://python-docx.readthedocs.io/ (training data, HIGH confidence)
- OpenAI structured output (json_object): https://platform.openai.com/docs/guides/structured-outputs (training data, MEDIUM confidence on latest API)
- CSS RTL/bidi: standard W3C specification, HIGH confidence
- Noto Sans Hebrew: Google Fonts, freely available, HIGH confidence

---
*Architecture research for: AI-powered academic lab report generation*
*Researched: 2026-03-23*
