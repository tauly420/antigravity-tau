# Phase 9: Report Data Contract and File Parsing - Research

**Researched:** 2026-03-24
**Domain:** Data normalization layer + document text extraction (PDF/DOCX)
**Confidence:** HIGH

## Summary

Phase 9 has two distinct workstreams: (1) defining a `ReportAnalysisData` TypeScript interface and Python normalization function that guarantee a consistent shape from AutoLab results, and (2) adding PDF/DOCX lab instruction file upload with text extraction. Both workstreams build on well-understood existing patterns in this codebase.

The AutoLab orchestrator (`_run_orchestrator` in `autolab.py`) already returns a predictable `{ steps, state: { parsed, fit, formula, nsigma }, fit_data }` shape. The normalization task is mapping this into a strict contract where all sections are present but nullable, eliminating the scattered `?.` and `any` types that currently pervade the frontend. For file parsing, PyMuPDF (PDF) and python-docx (DOCX) are the decided libraries -- both are pure pip installs with no system dependencies, making Railway deployment straightforward.

**Primary recommendation:** Define the TypeScript `ReportAnalysisData` interface first (it is the contract), then write the Python `normalize_autolab_result()` function to produce that exact shape, then build the upload endpoint and UI.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Upload lives on the `/report` page as part of the report builder flow. ReportBeta.tsx is the shell.
- **D-02:** Extracted text appears in an editable textarea for user confirmation/editing before it is sent to AI. Handles OCR errors, irrelevant sections, or encoding issues.
- **D-03:** Single file upload only (one PDF or DOCX at a time). User can re-upload to replace.
- **D-04:** Scanned PDFs with no extractable text show a warning message ("No text found -- this may be a scanned/image PDF") and fall back to manual text entry in the textarea. No OCR attempted.
- **D-05:** Upload supports both drag-and-drop dropzone and click-to-browse button. Follow similar style to AutoLab file upload.
- **D-06:** `ReportAnalysisData` uses optional sections with null for partial analyses. All fields present in the interface, but formula/nsigma/etc. are nullable. Downstream code checks presence and skips missing sections.
- **D-07:** Both frontend (TypeScript interface) and backend (Python normalization function) implement the contract. TypeScript defines the shape for frontend consumption; Python ensures any AutoLab result dict maps to the guaranteed shape before sending to AI.
- **D-08:** Contract includes raw data arrays (x, y, errors) plus fit curve points. Enables Phase 11 to re-render plots as images for PDF embedding without re-running the analysis.
- **D-09:** Reuse existing `roundWithUncertainty()` from `frontend/src/utils/format.ts` for parameter display. Same 2-sig-fig uncertainty rounding already used in AutoLab results. Academic reports use the same convention.
- **D-10:** Normalization layer outputs parameter values as LaTeX-ready strings (e.g., `$k = 49.8 \pm 0.5$ N/m`). KaTeX rendering is already proven from Phase 8.
- **D-11:** Goodness-of-fit stats (chi-squared/dof, R-squared, P-value) stored as structured numeric objects: `{ chiSquaredReduced: number, rSquared: number, pValue: number }`. Downstream phases decide formatting.
- **D-12:** ReportBeta.tsx gains the instruction file upload zone and extracted text textarea in this phase. No report preview or section editor yet -- that is Phase 11.
- **D-13:** Beta badge stays on the /report page. Remove in Phase 12 when full flow is integrated.
- **D-14:** Test PDF button from Phase 8 stays as a permanent debug tool.

### Claude's Discretion
- Internal file size limits for instruction uploads (reasonable default, aligned with existing 50MB app limit)
- Exact textarea sizing and placeholder text for extracted content
- Python normalization function naming and location within `backend/api/report.py` or a new utils module
- TypeScript interface file location (co-located with ReportBeta.tsx or in a shared types file)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | User can upload a lab instruction file (PDF or DOCX, Hebrew or English) as context for report generation | PyMuPDF for PDF text extraction, python-docx for DOCX text extraction, Flask multipart upload endpoint on report_bp, drag-and-drop UI with editable textarea confirmation |
| RPT-03 | Results section is auto-populated from AutoLab analysis -- fit parameters with uncertainties, chi-squared/R-squared/P-value, n-sigma comparison, and embedded fit + residuals plots with numbered captions | ReportAnalysisData contract normalizes AutoLab result shape; roundWithUncertainty() reused for formatting; raw data arrays preserved for plot re-rendering in Phase 11 |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PyMuPDF | >=1.24.0 | PDF text extraction | Bundles MuPDF in wheel -- no system deps. Handles Hebrew/English text. Already decided in STATE.md |
| python-docx | >=1.1.0 | DOCX text extraction | Pure Python, no system deps. Paragraph-level extraction covers lab instructions. Already decided in STATE.md |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Flask (existing) | >=3.0.0 | HTTP endpoint for upload | Already in stack -- add route to existing report_bp |
| roundWithUncertainty (existing) | N/A | Parameter formatting | Already in frontend/src/utils/format.ts -- reuse for LaTeX parameter strings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyMuPDF | pdfplumber | pdfplumber is higher-level but slower; PyMuPDF already decided |
| python-docx | docx2txt | docx2txt is simpler but less maintained; python-docx already decided |

**Installation:**
```bash
pip install PyMuPDF python-docx
```

**No nixpacks changes needed:** PyMuPDF ships as a self-contained wheel with MuPDF bundled. python-docx is pure Python. Neither requires additional system packages in nixpacks.toml.

## Architecture Patterns

### Recommended Project Structure
```
backend/api/report.py          # Add upload-instruction + normalize endpoints to existing blueprint
backend/utils/file_parser.py   # NEW: PDF/DOCX text extraction functions (keep report.py thin)
frontend/src/types/report.ts   # NEW: ReportAnalysisData interface + related types
frontend/src/components/ReportBeta.tsx  # EXTEND: Add upload dropzone + textarea
frontend/src/services/api.ts   # EXTEND: Add uploadInstructionFile() function
```

### Pattern 1: ReportAnalysisData Contract
**What:** A TypeScript interface that defines the guaranteed shape for all downstream consumers (AI generation, preview, PDF assembly). Python normalization function produces dicts matching this shape exactly.
**When to use:** Any time AutoLab results need to be consumed outside AutoLab.tsx itself.
**Example:**
```typescript
// frontend/src/types/report.ts
export interface FitParameter {
  name: string;
  value: number;
  uncertainty: number;
  /** Pre-formatted: "49.8 +/- 0.5" */
  rounded: string;
  /** LaTeX-ready: "$k = 49.8 \\pm 0.5$" */
  latex: string;
}

export interface GoodnessOfFit {
  chiSquaredReduced: number | null;
  rSquared: number | null;
  pValue: number | null;
  dof: number | null;
}

export interface FitSection {
  modelName: string;
  parameters: FitParameter[];
  goodnessOfFit: GoodnessOfFit;
  /** Raw data for plot re-rendering */
  xData: number[];
  yData: number[];
  xErrors: number[] | null;
  yErrors: number[] | null;
  /** Smooth fit curve */
  xFit: number[];
  yFit: number[];
  residuals: number[];
}

export interface FormulaSection {
  expression: string;
  value: number;
  uncertainty: number;
  formatted: string;
  latex: string;
}

export interface NSigmaSection {
  nSigma: number;
  verdict: string;
  theoreticalValue: number;
  theoreticalUncertainty: number;
}

export interface ReportAnalysisData {
  /** Always present if AutoLab ran successfully */
  fit: FitSection | null;
  /** Present only if formula evaluation was performed */
  formula: FormulaSection | null;
  /** Present only if n-sigma comparison was performed */
  nsigma: NSigmaSection | null;
  /** AI-generated summary text from AutoLab */
  summary: string | null;
  /** Original user instructions */
  instructions: string;
  /** Original filename */
  filename: string;
}
```

### Pattern 2: Python Normalization Function
**What:** A function that takes the raw AutoLab `state` dict and `steps` list, extracts all relevant data, applies `roundWithUncertainty`-equivalent rounding, and returns a clean dict matching the TypeScript interface.
**When to use:** Called once after AutoLab analysis completes, before passing data to the report pipeline.
**Example:**
```python
# backend/utils/report_normalizer.py
def normalize_autolab_result(state: dict, steps: list, instructions: str, filename: str) -> dict:
    """Convert raw AutoLab state into guaranteed ReportAnalysisData shape."""
    fit = state.get("fit")
    formula = state.get("formula")
    nsigma = state.get("nsigma")

    result = {
        "fit": None,
        "formula": None,
        "nsigma": None,
        "summary": None,
        "instructions": instructions,
        "filename": filename,
    }

    if fit and "error" not in fit:
        params = []
        for i, name in enumerate(fit.get("parameter_names", [])):
            val = fit["parameters"][i]
            unc = fit["uncertainties"][i]
            rounded_str = scientific_round(val, unc)
            params.append({
                "name": name,
                "value": val,
                "uncertainty": unc,
                "rounded": rounded_str,
                "latex": f"${name} = {rounded_str}$",
            })
        result["fit"] = {
            "modelName": fit.get("model_name", "unknown"),
            "parameters": params,
            "goodnessOfFit": {
                "chiSquaredReduced": fit.get("reduced_chi_squared"),
                "rSquared": fit.get("r_squared"),
                "pValue": fit.get("p_value"),
                "dof": fit.get("dof"),
            },
            "xData": fit.get("x_data", []),
            "yData": fit.get("y_data", []),
            "xErrors": fit.get("x_errors"),
            "yErrors": fit.get("y_errors"),
            "xFit": fit.get("x_fit", []),
            "yFit": fit.get("y_fit", []),
            "residuals": fit.get("residuals", []),
        }

    # Extract summary from steps
    for step in reversed(steps):
        if step.get("step") == "summary" and step.get("message"):
            result["summary"] = step["message"]
            break

    return result
```

### Pattern 3: File Upload Endpoint
**What:** A `POST /api/report/upload-instructions` endpoint that accepts a PDF or DOCX file, extracts text, and returns it.
**When to use:** When user uploads a lab instruction file on the /report page.
**Example:**
```python
# backend/api/report.py
@report_bp.route('/upload-instructions', methods=['POST'])
def upload_instructions():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    filename = file.filename.lower()
    file_bytes = file.read()

    if filename.endswith('.pdf'):
        text = extract_pdf_text(file_bytes)
    elif filename.endswith('.docx'):
        text = extract_docx_text(file_bytes)
    else:
        return jsonify({"error": "Unsupported file type. Use PDF or DOCX."}), 400

    warning = None
    if not text.strip():
        warning = "No text found -- this may be a scanned/image PDF"

    return jsonify({"text": text, "warning": warning, "error": None})
```

### Pattern 4: File Parser Utils
**What:** Thin extraction functions in a dedicated utils module.
**Example:**
```python
# backend/utils/file_parser.py
import io

def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF."""
    import pymupdf
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts)

def extract_docx_text(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(para.text for para in doc.paragraphs)
```

### Anti-Patterns to Avoid
- **Typing autolabResults as `any`:** The whole point of this phase is eliminating `any`. The normalized data MUST flow through the typed `ReportAnalysisData` interface. Do not add new `any` types.
- **Duplicating rounding logic:** Use the existing `roundWithUncertainty()` in frontend and `scientific_round()` in backend. Do not rewrite rounding.
- **Putting parsing logic in report.py:** Keep the blueprint thin (routes only). Extraction functions belong in `backend/utils/file_parser.py`.
- **Server-side OCR fallback:** Per D-04, scanned PDFs return a warning and empty text. Do not attempt OCR.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser | PyMuPDF `page.get_text()` | PDF parsing has edge cases (encodings, ligatures, Hebrew) -- PyMuPDF handles them |
| DOCX text extraction | Custom XML parser | python-docx `Document` + paragraph iteration | DOCX is a ZIP of XML files with complex schema |
| Uncertainty rounding | New rounding function | Existing `roundWithUncertainty()` (TS) / `scientific_round()` (Python) | Already tested and proven in AutoLab |
| Drag-and-drop file upload | Custom DnD implementation | HTML5 drag events + input[type=file] | Same pattern already works in AutoLab.tsx |

**Key insight:** The normalization layer is the high-value work in this phase. File parsing is just plumbing using established libraries.

## Common Pitfalls

### Pitfall 1: Partial AutoLab Results
**What goes wrong:** AutoLab can return partial state -- fit succeeded but formula failed, or no nsigma was requested. Code that assumes all sections are present will crash.
**Why it happens:** The OpenAI orchestrator is non-deterministic. Tool calls can fail or be skipped.
**How to avoid:** The `ReportAnalysisData` contract explicitly uses `| null` for every optional section. The normalization function checks each state key before populating.
**Warning signs:** `TypeError: Cannot read properties of null` in the browser console.

### Pitfall 2: NaN/Infinity in Fit Statistics
**What goes wrong:** AutoLab results can contain `NaN`, `Infinity`, or `null` for statistics like chi-squared or p-value (e.g., when DOF is 0 or fit failed partially).
**Why it happens:** Edge cases in scipy curve_fit.
**How to avoid:** The existing `_sanitize_float` / `_sanitize_dict` in autolab.py already converts these to `None`. The normalization layer should treat `None` as the canonical "not available" value and pass it through. The TypeScript interface uses `number | null`.
**Warning signs:** JSON serialization errors or "NaN" displaying in the UI.

### Pitfall 3: Hebrew PDF Text Extraction Quality
**What goes wrong:** Hebrew text from PDFs can come out reversed or garbled depending on the PDF's internal text encoding.
**Why it happens:** Some PDFs encode Hebrew using visual ordering (left-to-right byte order) rather than logical ordering. This is especially common in scanned-and-OCR'd documents.
**How to avoid:** Per D-02, the extracted text appears in an editable textarea for user confirmation. Users can fix garbled text manually. Per D-04, scanned PDFs with no text show a warning.
**Warning signs:** Hebrew characters appearing in wrong order in the textarea.

### Pitfall 4: TypeScript/Python Shape Drift
**What goes wrong:** The Python normalization produces a dict with slightly different keys than the TypeScript interface expects (e.g., `chi_squared_reduced` vs `chiSquaredReduced`).
**Why it happens:** Python uses snake_case, TypeScript uses camelCase.
**How to avoid:** The Python normalization function MUST output camelCase keys matching the TypeScript interface exactly. This is the contract boundary. Alternatively, the frontend could have a mapping layer, but producing the right shape in Python is cleaner.
**Warning signs:** `undefined` values when accessing fields that should be populated.

### Pitfall 5: Large File Uploads
**What goes wrong:** User uploads a 40MB PDF and the server runs out of memory or takes too long.
**Why it happens:** PyMuPDF loads the entire PDF into memory.
**How to avoid:** The existing Flask config sets `MAX_CONTENT_LENGTH = 50 * 1024 * 1024`. For instruction files (which are typically < 5MB), this is more than sufficient. Consider adding a more restrictive limit on the upload-instructions endpoint (e.g., 10MB) since lab instruction PDFs should not be enormous.

## Code Examples

### AutoLab Result Shape (source of truth)
```python
# From _run_orchestrator in autolab.py, the return shape is:
{
    "steps": [
        {"step": "parse", "tool": "parse_file", "result": {...}, "success": True},
        {"step": "fit", "tool": "fit_data", "result": {...}, "success": True},
        {"step": "formula", "tool": "evaluate_formula", "result": {...}, "success": True},
        {"step": "nsigma", "tool": "compare_nsigma", "result": {...}, "success": True},
        {"step": "summary", "message": "The analysis shows..."},
    ],
    "state": {
        "parsed": {
            "columns": ["Time_s", "Height_m", ...],
            "x_data": [0.0, 0.1, ...],
            "y_data": [0.0, 0.05, ...],
            "y_errors": [0.10, 0.10, ...],
            "x_errors": [0.02, 0.02, ...],  # may be None
            "x_col": "Time_s",
            "y_col": "Height_m",
        },
        "fit": {
            "parameters": [4.905, 0.012, -0.003],
            "uncertainties": [0.05, 0.02, 0.01],
            "parameter_names": ["a", "b", "c"],
            "chi_squared": 12.5,
            "reduced_chi_squared": 0.96,
            "p_value": 0.48,
            "r_squared": 0.9998,
            "dof": 13,
            "model_name": "quadratic",
            "x_data": [...], "y_data": [...],
            "x_fit": [...], "y_fit": [...],
            "residuals": [...],
            "y_errors": [...], "x_errors": [...]
        },
        "formula": {  # null if not evaluated
            "value": 9.81,
            "uncertainty": 0.10,
            "formatted": "9.81 +/- 0.10",
            "expression": "2*a"
        },
        "nsigma": {  # null if not compared
            "n_sigma": 0.0,
            "verdict": "Excellent agreement",
            "theoretical_value": 9.81,
            "theoretical_uncertainty": 0.01
        }
    }
}
```

### How AutoLab.tsx Currently Stores Results in Context
```typescript
// From AutoLab.tsx line 314-328
setAutolabResults({
    fit: data.state.fit ? {
        model_name: data.state.fit.model_name,
        parameter_names: data.state.fit.parameter_names,
        parameters: data.state.fit.parameters,
        uncertainties: data.state.fit.uncertainties,
        reduced_chi_squared: data.state.fit.reduced_chi_squared,
        p_value: data.state.fit.p_value,
        r_squared: data.state.fit.r_squared,
    } : undefined,
    formula: data.state.formula,
    nsigma: data.state.nsigma,
    instructions,
    filename: file?.name,
});
```

### PyMuPDF Text Extraction (verified from official docs)
```python
# Source: https://pymupdf.readthedocs.io/en/latest/tutorial.html
import pymupdf  # Note: import is 'pymupdf' not 'fitz' (modern convention)

doc = pymupdf.open(stream=file_bytes, filetype="pdf")
for page in doc:
    text = page.get_text()  # plain UTF-8 text
doc.close()
```

### python-docx Text Extraction
```python
# Source: https://python-docx.readthedocs.io/
from docx import Document
import io

doc = Document(io.BytesIO(file_bytes))
full_text = "\n".join(para.text for para in doc.paragraphs)
# Note: tables are NOT included in paragraphs. For lab instructions,
# tables may contain equipment lists. Consider also extracting table cells.
```

### Existing File Upload Pattern in AutoLab.tsx (reference for consistency)
```typescript
// AutoLab.tsx uses native fetch with FormData for file upload:
const formData = new FormData();
formData.append('file', file);
formData.append('instructions', instructions);
const resp = await fetch('/api/autolab/run', { method: 'POST', body: formData });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import fitz` | `import pymupdf` | PyMuPDF 1.24.x (2024) | Both work, but `import pymupdf` is the modern convention |
| `autolabResults: any` | `ReportAnalysisData` interface | This phase | Eliminates defensive null-checking and `any` types |

**Deprecated/outdated:**
- PyMuPDF `import fitz`: Still works but `import pymupdf` is preferred going forward.

## Open Questions

1. **DOCX table extraction**
   - What we know: `python-docx` paragraph iteration only gets paragraph text, not table contents. Lab instruction files sometimes have equipment lists in tables.
   - What is unclear: Whether real-world lab instruction files use tables heavily enough to matter.
   - Recommendation: Start with paragraph-only extraction. The editable textarea (D-02) lets users paste in missing content. Add table extraction as a follow-up if users report missing data.

2. **Normalization endpoint vs. frontend-only**
   - What we know: D-07 says both frontend and backend implement the contract. The Python normalizer is needed for Phase 10 (AI generation needs the normalized data).
   - What is unclear: Whether Phase 9 should expose a `/api/report/normalize` endpoint or just define the Python function for Phase 10 to call internally.
   - Recommendation: Define the Python function in `backend/utils/report_normalizer.py`. Do NOT expose as an endpoint yet -- Phase 10 will call it internally when preparing the AI prompt. The frontend reads `autolabResults` from context and applies the TypeScript interface shape locally.

3. **Interface file location**
   - Discretion area: The TypeScript interface could live co-located with ReportBeta.tsx or in a shared `frontend/src/types/report.ts`.
   - Recommendation: `frontend/src/types/report.ts` -- this contract will be imported by multiple components (ReportBeta, future preview, future PDF assembly) so a shared location is cleaner.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (already in requirements.txt) |
| Config file | None -- tests run from `backend/` directory |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01a | PDF text extraction returns text | unit | `cd backend && python -m pytest tests/test_file_parser.py::test_pdf_extraction -x` | No -- Wave 0 |
| CTX-01b | DOCX text extraction returns text | unit | `cd backend && python -m pytest tests/test_file_parser.py::test_docx_extraction -x` | No -- Wave 0 |
| CTX-01c | Empty/scanned PDF returns empty string + warning | unit | `cd backend && python -m pytest tests/test_file_parser.py::test_empty_pdf -x` | No -- Wave 0 |
| CTX-01d | Unsupported file type returns error | unit | `cd backend && python -m pytest tests/test_file_parser.py::test_unsupported_type -x` | No -- Wave 0 |
| RPT-03a | Normalize full AutoLab result (all sections present) | unit | `cd backend && python -m pytest tests/test_report_normalizer.py::test_full_normalization -x` | No -- Wave 0 |
| RPT-03b | Normalize partial result (fit only, no formula/nsigma) | unit | `cd backend && python -m pytest tests/test_report_normalizer.py::test_partial_normalization -x` | No -- Wave 0 |
| RPT-03c | Normalize handles NaN/None in fit statistics | unit | `cd backend && python -m pytest tests/test_report_normalizer.py::test_nan_handling -x` | No -- Wave 0 |
| RPT-03d | Output keys are camelCase matching TypeScript interface | unit | `cd backend && python -m pytest tests/test_report_normalizer.py::test_camel_case_keys -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_file_parser.py` -- covers CTX-01 (a,b,c,d)
- [ ] `backend/tests/test_report_normalizer.py` -- covers RPT-03 (a,b,c,d)
- [ ] Test fixture: sample PDF bytes (can be generated programmatically with PyMuPDF)
- [ ] Test fixture: sample DOCX bytes (can be generated programmatically with python-docx)
- [ ] Framework install: already present (`pytest>=7.0.0` in requirements.txt)

## Sources

### Primary (HIGH confidence)
- `backend/api/autolab.py` -- full source code read, exact return shape documented
- `frontend/src/context/AnalysisContext.tsx` -- `autolabResults` typed as `any`, confirmed
- `frontend/src/utils/format.ts` -- `roundWithUncertainty()` implementation verified
- `frontend/src/components/AutoLab.tsx` -- result consumption pattern documented
- `backend/api/report.py` -- existing blueprint with test-pdf endpoint only
- `frontend/src/components/ReportBeta.tsx` -- current stub verified
- PyMuPDF installation docs: https://pymupdf.readthedocs.io/en/latest/installation.html -- no system deps needed, ships as wheel
- PyMuPDF text extraction tutorial: https://pymupdf.readthedocs.io/en/latest/tutorial.html

### Secondary (MEDIUM confidence)
- python-docx paragraph extraction pattern from PyPI docs and community examples
- PyMuPDF Railway/nixpacks deployment compatibility -- verified that wheels are self-contained (no system deps)

### Tertiary (LOW confidence)
- Hebrew PDF text extraction quality -- depends on specific PDF encoding. Mitigated by editable textarea (D-02).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- libraries already decided in STATE.md, verified no system deps needed
- Architecture: HIGH -- follows established Flask blueprint + React component patterns in this codebase
- Pitfalls: HIGH -- all pitfalls derived from direct source code analysis of AutoLab result shape
- File parsing: MEDIUM -- PyMuPDF Hebrew handling depends on source PDF quality (mitigated by D-02/D-04)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain, no fast-moving dependencies)
