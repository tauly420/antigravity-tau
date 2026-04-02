# Phase 14: Report and AutoLab Merge - Research

**Researched:** 2026-03-31
**Domain:** React component architecture, WeasyPrint PDF pipeline, Flask blueprint integration
**Confidence:** HIGH

## Summary

This phase merges two large pages (AutoLab.tsx at 1215 lines and ReportBeta.tsx at 1338 lines) into a single progressive flow at `/autolab`. The core challenge is architectural: extracting report functionality from ReportBeta.tsx, embedding it below AutoLab results, removing the inline chat, building a results-only PDF backend endpoint, fixing the WeasyPrint 500 error on Railway, and removing the jsPDF client-side export. All report sub-components (SectionAccordion, SectionEditor, TitlePageForm, PlotThumbnail -- 449 lines total) are reusable as-is.

The existing code has strong separation: ReportBeta.tsx already imports from `api.ts` functions (`analyzeReportContext`, `generateReport`, `exportReportPdf`, `uploadInstructionFile`) and uses the `normalizeAnalysisData` helper. The backend `/api/report/*` endpoints stay unchanged. The main work is frontend restructuring, building a new `ReportExpander` collapse/expand section, adding a results-only PDF endpoint on the backend, and debugging the WeasyPrint Railway deployment.

**Primary recommendation:** Decompose into sub-components. Extract report logic from ReportBeta.tsx into a new `ReportSection.tsx` component (~400-500 lines) that receives analysis data as props. Keep AutoLab.tsx focused on analysis, with ReportSection conditionally rendered below results. Build `assemble_results_html()` as a lightweight sibling to `assemble_report_html()` in pdf_renderer.py for results-only PDF.

## Project Constraints (from CLAUDE.md)

- **Tech stack**: React + Flask, no framework migration
- **AI provider**: OpenAI for AutoLab function-calling
- **Deployment**: Railway via nixpacks -- no Docker
- **Styling**: Single `global.css` with CSS custom properties, no CSS modules or Tailwind
- **Components**: Function components with hooks only (no class components)
- **State**: useState + useContext only (no Redux/Zustand)
- **API calls**: Centralized in `frontend/src/services/api.ts` using Axios
- **Python patterns**: Flask blueprints, try/except with `{"error": "message"}` responses
- **LaTeX**: Always returned by AI in LaTeX; rendered with KaTeX in frontend, KaTeX HTML in PDF
- **Package install**: `npm install --legacy-peer-deps`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single progressive flow at `/autolab`. Upload -> Analysis Results -> [optional] Generate Full Report section. Everything on one scrolling page.
- **D-02:** `/report` route removed entirely. `ReportBeta.tsx` deleted. All report functionality merged into the AutoLab page.
- **D-03:** After analysis completes, a prominent "Generate Full Lab Report" expand button appears below results. Clicking it reveals the report generation section (context form, AI generation, section editor, title page form, PDF export).
- **D-04:** Context form fields pre-filled from analysis where available (experiment title from filename/instructions, analysis data auto-loaded). User just adds personal info (name, ID, partner, course) and hits generate.
- **D-05:** Optional lab instruction file upload (PDF/DOCX) available in the report section. Already built in Phase 9.
- **D-06:** Analysis results data (fit parameters, uncertainties, chi-squared/R-squared/P-value, n-sigma, plots) automatically flows into report generation -- no re-entry needed.
- **D-07:** Fix the WeasyPrint 500 error on Railway deployment. Debug the actual error, fix whatever's broken (likely system dependency, font path, or template issue).
- **D-08:** Improve PDF output quality -- better formatting, layout, font rendering. Not just "make it work" but "make it good."
- **D-09:** Two PDF export tiers: (1) Results-only PDF -- just analysis results + plots, no AI-generated sections. (2) Full lab report PDF -- complete academic report with AI sections, title page, etc.
- **D-10:** Remove jsPDF client-side export entirely. All PDF generation goes through WeasyPrint backend.
- **D-11:** AutoLab's inline AI chat (post-analysis assistant) removed from this page. Will move to sidebar/global chat in Phase 13's UI overhaul.
- **D-12:** Keep only the Free Fall example dataset (remove Hooke's Law and Oscillation). Extend the Free Fall example to demo the full flow including report generation with pre-filled context form details and lab instructions.
- **D-13:** All existing report features survive in the merged page: section accordion editor with KaTeX preview, title page form, template selector (israeli/minimal/academic), language toggle (Hebrew/English), AI follow-up questions.

### Claude's Discretion
- Layout and visual design of the expand/collapse transition between analysis and report sections
- How the two PDF export options (results-only vs full report) are presented (buttons, dropdown, etc.)
- Pre-fill mapping logic (which analysis fields map to which context form fields)
- How to structure the merged component code (single large component vs sub-components)

### Deferred Ideas (OUT OF SCOPE)
- Inline AI chat -> moves to sidebar/global chat in Phase 13 UI overhaul
- Additional example datasets beyond Free Fall -- can be added later if needed
</user_constraints>

## Standard Stack

### Core (already installed, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.0 | UI components | Already in project |
| Flask | >=3.0.0 | Backend API | Already in project |
| WeasyPrint | >=68.0 | Server-side PDF generation | Already in requirements.txt; only viable Hebrew RTL + LaTeX option |
| Axios | ^1.7.0 | HTTP client | Already in project, centralized in api.ts |
| Plotly.js | ^3.4.0 | Charts/plots | Already in project |

### Packages to Remove
| Library | Version | Reason |
|---------|---------|--------|
| jspdf | ^4.2.1 | D-10: All PDF via WeasyPrint backend |
| jspdf-autotable | ^5.0.7 | D-10: Dependency of jsPDF |

**Uninstall command:**
```bash
cd frontend && npm uninstall jspdf jspdf-autotable --legacy-peer-deps
```

### No New Dependencies
This phase requires zero new packages. All functionality is built from existing libraries. The results-only PDF is a new backend endpoint using the existing WeasyPrint pipeline.

## Architecture Patterns

### Recommended Component Structure

```
frontend/src/components/
  AutoLab.tsx              # Main page (~800 lines after refactor, down from 1215)
  report/
    SectionAccordion.tsx   # Existing, no changes (159 lines)
    SectionEditor.tsx      # Existing, no changes (71 lines)
    TitlePageForm.tsx       # Existing, no changes (173 lines)
    PlotThumbnail.tsx       # Existing, no changes (46 lines)
    ReportSection.tsx       # NEW: Report generation flow (~400-500 lines)
    ReportExpander.tsx      # NEW: Expand/collapse button + animation (~60 lines)
    PdfExportSelector.tsx   # NEW: Two-button PDF export group (~80 lines)
    FreeFallDemo.tsx        # NEW: Extended demo data + report context (~100 lines)
```

### Pattern 1: Sub-Component Extraction from ReportBeta.tsx

**What:** Extract report generation flow (context form, follow-up questions, AI generation, section accordion, title page, PDF export) into `ReportSection.tsx` that receives analysis data as props.

**When to use:** Always -- this is the core architectural decision.

**Key props interface:**
```typescript
interface ReportSectionProps {
  analysisData: Record<string, unknown> | null;  // Normalized autolab results
  plotImages: { fit: string | null; residuals: string | null };
  initialTitle?: string;  // Pre-filled from filename/instructions
}
```

**What to extract from ReportBeta.tsx:**
- Lines 97-199: State declarations (contextForm, language, generationPhase, followUpQuestions, answers, generatedSections, titlePageData, editedSections, editableSections, selectedTemplate, exportStatus)
- The `normalizeAnalysisData()` function (lines 17-86) -- move to a shared util since both ReportBeta and AutoLab already use it
- Context form JSX + handlers
- Follow-up questions JSX + handlers
- Section accordion with editors
- Title page form integration
- Template selector + language toggle
- PDF export buttons + handlers

**What stays in AutoLab.tsx:**
- Upload section, instructions, model selection
- Analysis execution and results display
- ReportExpander toggle button
- Results-only PDF export button
- Free Fall demo button

### Pattern 2: Expand/Collapse Animation

**What:** CSS `max-height` transition for smooth reveal of report section.
**When to use:** For the ReportExpander component.

```typescript
// ReportExpander.tsx pattern
const [expanded, setExpanded] = useState(false);
const contentRef = useRef<HTMLDivElement>(null);

// On expand, set max-height to scrollHeight, then after animation, set to 'none' for dynamic content
useEffect(() => {
  const el = contentRef.current;
  if (!el) return;
  if (expanded) {
    el.style.maxHeight = el.scrollHeight + 'px';
    const timer = setTimeout(() => { el.style.maxHeight = 'none'; }, 300);
    return () => clearTimeout(timer);
  } else {
    el.style.maxHeight = el.scrollHeight + 'px';
    requestAnimationFrame(() => { el.style.maxHeight = '0'; });
  }
}, [expanded]);
```

### Pattern 3: Results-Only PDF Backend Endpoint

**What:** New endpoint `/api/report/export-results-pdf` that generates a lightweight PDF with only analysis results (summary, parameter table, plots, formula, n-sigma).
**When to use:** For the "Export Results PDF" button.

```python
# In backend/api/report.py
@report_bp.route('/export-results-pdf', methods=['POST'])
def export_results_pdf():
    """Generate results-only PDF (no AI sections, no title page)."""
    body = request.get_json(silent=True)
    analysis_data = body.get('analysis_data', {})
    plots = body.get('plots', {})
    summary = body.get('summary', '')
    language = body.get('language', 'en')

    html_body = assemble_results_html(analysis_data, plots, summary, language)
    processed = process_text_with_math(html_body)
    direction = 'rtl' if language == 'he' else 'ltr'
    pdf_bytes = generate_pdf(processed, direction=direction, lang=language)
    # ... return Response
```

### Pattern 4: Pre-fill Mapping

**What:** Map analysis results to context form fields automatically (D-04).

```typescript
// Pre-fill logic when report section expands
const preFillFromAnalysis = (analysisState: any, file: File | null, instructions: string): Partial<ContextForm> => {
  const title = file?.name?.replace(/\.(xlsx?|csv|tsv|ods)$/i, '').replace(/[_-]/g, ' ') || '';
  return {
    title: title || extractExperimentName(instructions),
    subject: '',  // Can't reliably extract
    equipment: '',
    notes: instructions,  // Use analysis instructions as procedure notes
  };
};
```

### Anti-Patterns to Avoid
- **Single mega-component:** Do NOT put all 2500+ lines into one AutoLab.tsx. The merged page should be AutoLab.tsx (~800 lines) + ReportSection.tsx (~400-500 lines) + small utility components.
- **Duplicating normalizeAnalysisData:** This function exists in ReportBeta.tsx. Extract it to `frontend/src/utils/normalize.ts` so both the report section and any future consumer can import it.
- **Client-side PDF generation:** D-10 explicitly bans jsPDF. All PDF goes through `/api/report/export-pdf` and the new `/api/report/export-results-pdf`.
- **Keeping dead code:** ReportBeta.tsx's embedded analysis UI (data upload, preview, analysis execution -- lines 146-159 state, and corresponding JSX) is NOT needed since AutoLab already handles analysis. Only the report-generation flow transfers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Client-side jsPDF | WeasyPrint backend `/api/report/export-pdf` | Hebrew RTL, LaTeX math, professional formatting |
| LaTeX in PDF | Custom LaTeX->HTML | `render_latex_for_pdf()` in pdf_renderer.py | KaTeX integration already battle-tested |
| Plot capture | Custom canvas export | `Plotly.toImage()` as base64 PNG | Already used in ReportBeta.tsx |
| Data normalization | Manual snake_case->camelCase | `normalizeAnalysisData()` from ReportBeta.tsx | Already handles all edge cases |
| Expand/collapse animation | JavaScript animation lib | CSS `max-height` transition | Simple, performant, no dependencies |

## Common Pitfalls

### Pitfall 1: AutoLab.tsx Becomes Unmanageable
**What goes wrong:** Merging 1338 lines of ReportBeta.tsx into 1215 lines of AutoLab.tsx creates a 2500+ line monster.
**Why it happens:** Temptation to "just move the JSX over" without decomposition.
**How to avoid:** Extract ReportSection.tsx as a self-contained component. It receives analysis data as props and manages its own state (context form, generation phase, sections, export).
**Warning signs:** AutoLab.tsx exceeding 1000 lines after merge.

### Pitfall 2: normalizeAnalysisData Duplication
**What goes wrong:** The function currently lives inside ReportBeta.tsx (lines 17-86). When ReportBeta is deleted, it needs a new home.
**Why it happens:** Copy-pasting instead of extracting to a shared utility.
**How to avoid:** Move to `frontend/src/utils/normalize.ts` before deleting ReportBeta.tsx.
**Warning signs:** Same function appearing in two files.

### Pitfall 3: Plot Images Not Available When Report Section Renders
**What goes wrong:** Report section tries to use plot images for PDF export, but Plotly plots haven't been captured yet.
**Why it happens:** Plot capture depends on DOM elements being rendered. If the user expands report before plots are fully loaded, images may be null.
**How to avoid:** Use the existing `plotImages` from AnalysisContext (already set by the useEffect in ReportBeta.tsx that captures via `Plotly.toImage`). Move that capture logic into AutoLab.tsx so it runs when analysis results arrive, before the user can expand the report section.
**Warning signs:** PDF exports with missing plot images.

### Pitfall 4: WeasyPrint Railway Error -- System Dependencies
**What goes wrong:** WeasyPrint 500 error on Railway deployment.
**Why it happens:** WeasyPrint requires system libraries (pango, cairo, gdk-pixbuf, glib, harfbuzz, fontconfig, shared-mime-info, libffi, gobject-introspection). These are already in `nixpacks.toml` but the error may be:
  1. Missing font files (Inter font not bundled)
  2. `GDK_PIXBUF_MODULE_FILE` env var not set for nixpkgs
  3. `XDG_DATA_DIRS` not including shared-mime-info path
  4. KaTeX subprocess (npx katex) not available in Railway (Node.js may not be in PATH during Python execution)
  5. markdown_katex Python package not installed
**How to avoid:** Debug by hitting `/api/report/test-pdf` on Railway and reading the traceback. The endpoint already returns full traceback on error. Fix systematically based on actual error.
**Warning signs:** 500 error with traceback mentioning "Fontconfig", "Pango", "GLib", or "KaTeX".

### Pitfall 5: Route Removal Breaking Navigation
**What goes wrong:** Removing `/report` route but not updating all navigation links that reference it.
**Why it happens:** Links to `/report` may exist in App.tsx, AutoLab.tsx (the "Generate Report" button at line 1178), and potentially other components.
**How to avoid:** Grep for all references to `/report` and `ReportBeta` before deletion.
**Warning signs:** 404 errors when clicking old report links.

### Pitfall 6: jsPDF Removal Breaking AutoLab PDF Export
**What goes wrong:** Current AutoLab.tsx imports `exportAutolabPdf` from `utils/exportPdf.ts` which uses jsPDF. Removing jsPDF without replacing the export breaks the existing PDF download button.
**Why it happens:** The jsPDF removal (D-10) and results-only PDF backend endpoint (D-09) must be coordinated.
**How to avoid:** Build the backend results-only endpoint FIRST, update AutoLab.tsx to use it, THEN remove jsPDF and `exportPdf.ts`.
**Warning signs:** PDF download button throwing errors.

### Pitfall 7: Free Fall Demo Pre-fill Data Missing Report Context
**What goes wrong:** D-12 says extend Free Fall example to demo the full flow including report generation with pre-filled context form. If only analysis fields are pre-filled, the demo is incomplete.
**Why it happens:** EXAMPLE_DATASETS currently only has analysis fields (instructions, theoVal, theoUnc, columns, rows). No report context fields.
**How to avoid:** Extend the Free Fall example data to include: title page data (student name, course, experiment title) and context form data (title, subject, equipment, notes) as demo defaults.

## Code Examples

### Existing API Functions (already in api.ts, no changes needed)

```typescript
// These all exist and work -- just need to be called from the new ReportSection component
export const analyzeReportContext = async (data: {...}) => { ... };
export const generateReport = async (data: {...}) => { ... };
export const exportReportPdf = async (data: {...}): Promise<Blob> => { ... };
export const uploadInstructionFile = async (file: File) => { ... };
```

### New API Function Needed (add to api.ts)

```typescript
export const exportResultsPdf = async (data: {
    analysis_data: Record<string, unknown>;
    plots: Record<string, string | null>;
    summary: string;
    language: string;
}): Promise<Blob> => {
    const response = await api.post('/report/export-results-pdf', data, {
        responseType: 'blob',
    });
    return response.data;
};
```

### Plot Capture Pattern (move from ReportBeta to AutoLab)

```typescript
// In AutoLab.tsx -- capture plot images after analysis completes
useEffect(() => {
    const capturePlots = async () => {
        try {
            // Use refs instead of querySelectorAll for reliability
            if (fitPlotRef.current) {
                const fitImg = await Plotly.toImage(fitPlotRef.current, { format: 'png', width: 700, height: 400, scale: 2 });
                const residualsImg = residualsPlotRef.current
                    ? await Plotly.toImage(residualsPlotRef.current, { format: 'png', width: 700, height: 300, scale: 2 })
                    : null;
                setPlotImages({ fit: fitImg, residuals: residualsImg });
            }
        } catch (e) {
            console.warn('Could not capture plot images:', e);
        }
    };
    if (fitData && !plotImages.fit) {
        // Small delay to ensure Plotly has finished rendering
        const timer = setTimeout(capturePlots, 500);
        return () => clearTimeout(timer);
    }
}, [fitData, plotImages.fit, setPlotImages]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsPDF client-side PDF | WeasyPrint server-side PDF | Phase 8 (2026-03-23) | Hebrew RTL + LaTeX math support |
| Separate /report page | Merged into /autolab | Phase 14 (this phase) | Single progressive flow |
| 3 example datasets | 1 Free Fall demo | Phase 14 (this phase) | Focused demo experience |
| Inline AI chat in AutoLab | Removed (moves to sidebar Phase 13) | Phase 14 (this phase) | Cleaner page |

## Open Questions

1. **WeasyPrint Railway Error Root Cause**
   - What we know: The endpoint exists (`/api/report/export-pdf`), nixpacks.toml has system packages, WeasyPrint is in requirements.txt
   - What's unclear: The exact error. Could be font paths, GDK_PIXBUF, KaTeX subprocess, or Python import issue
   - Recommendation: First task should hit `/api/report/test-pdf` on Railway (or reproduce locally) and capture the traceback. Fix based on actual error, not speculation.

2. **PDF Quality Improvements (D-08)**
   - What we know: Current templates exist at `backend/templates/report_base.html` and `report_styles.css`
   - What's unclear: What specific quality issues exist (spacing, font rendering, margins, math sizing)
   - Recommendation: Generate a test PDF locally, identify specific issues, then fix CSS/template. This is iterative.

3. **Free Fall Demo Report Context**
   - What we know: D-12 says extend example to demo full report flow
   - What's unclear: What realistic demo values for student name, course, equipment, etc.
   - Recommendation: Use obviously fake but realistic demo values: "Student Name: Demo User", "Course: Physics Lab 1", "Equipment: Timer, meter stick, metal ball"

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| WeasyPrint | PDF generation | Locally: needs check | >=68.0 in requirements.txt | None -- core feature |
| KaTeX (npx) | LaTeX in PDF | Locally: needs check | npm global or npx | markdown_katex Python fallback |
| pango/cairo | WeasyPrint deps | Railway: in nixpacks.toml | System packages | None -- hard requirement |
| Node.js | KaTeX subprocess | Railway: nodejs_23 in nixpacks | 23.x | markdown_katex Python package |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend only, no frontend tests) |
| Config file | None found (pytest defaults) |
| Quick run command | `cd backend && python -m pytest tests/ -x --tb=short` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-07 | WeasyPrint PDF generation works | integration | `cd backend && python -m pytest tests/test_pdf_render.py -x` | Yes |
| D-09 | Results-only PDF endpoint works | integration | `cd backend && python -m pytest tests/test_pdf_export.py -x` | Yes (needs new test) |
| D-10 | jsPDF removed, no client import | manual | `grep -r "jspdf\|jsPDF" frontend/src/` should return nothing | N/A |
| D-02 | /report route removed | manual | `grep -r "'/report'" frontend/src/` should return nothing | N/A |
| D-01 | Progressive flow renders | manual | Visual inspection | N/A |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x --tb=short`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green + visual verification of progressive flow

### Wave 0 Gaps
- [ ] `tests/test_results_pdf.py` -- covers results-only PDF endpoint (D-09)
- [ ] Update `tests/test_pdf_export.py` if current tests reference old endpoint shapes

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of AutoLab.tsx (1215 lines), ReportBeta.tsx (1338 lines), report sub-components (449 lines)
- Direct codebase analysis of backend/api/report.py (267 lines), backend/utils/pdf_renderer.py (430 lines)
- Direct codebase analysis of frontend/src/services/api.ts -- all API functions verified
- Direct codebase analysis of nixpacks.toml -- deployment configuration verified
- Direct codebase analysis of frontend/src/utils/exportPdf.ts -- jsPDF usage confirmed (254 lines)

### Secondary (MEDIUM confidence)
- WeasyPrint Railway debugging approach based on existing infrastructure (test-pdf endpoint exists)

### Tertiary (LOW confidence)
- Exact WeasyPrint Railway error cause -- speculative until actual traceback is captured

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already exist in the project, no new dependencies
- Architecture: HIGH -- both source files read in full, sub-components counted, integration points mapped
- Pitfalls: HIGH -- based on direct code analysis of actual integration points
- PDF debugging: LOW -- exact Railway error unknown until reproduced

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependency changes expected)
