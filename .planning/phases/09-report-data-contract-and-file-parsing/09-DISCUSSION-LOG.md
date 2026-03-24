# Phase 9: Report Data Contract and File Parsing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 09-report-data-contract-and-file-parsing
**Areas discussed:** Instruction file upload flow, Data contract shape, Results assembly format, Report page evolution

---

## Instruction File Upload Flow

### Upload location

| Option | Description | Selected |
|--------|-------------|----------|
| On /report page | Upload on existing /report page as part of step-by-step report builder flow | :heavy_check_mark: |
| Inline in AutoLab results | Upload below AutoLab results alongside Generate Report button | |
| Standalone upload modal | Modal triggered from either AutoLab or /report | |

**User's choice:** On /report page (Recommended)
**Notes:** Keeps report concerns together. ReportBeta.tsx already exists as the shell.

### Extracted text presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Editable textarea | User can edit extracted text before proceeding | :heavy_check_mark: |
| Read-only preview with accept/reject | Shows text read-only, user accepts or re-uploads | |
| Collapsible preview | Text collapsed by default with summary line | |

**User's choice:** Editable textarea (Recommended)
**Notes:** Handles OCR errors, irrelevant sections, Hebrew encoding issues.

### File count

| Option | Description | Selected |
|--------|-------------|----------|
| Single file only | One PDF or DOCX at a time, re-upload to replace | :heavy_check_mark: |
| Multiple files | Several instruction files concatenated | |

**User's choice:** Single file only (Recommended)

### No-text fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Show warning + fallback to manual | Warning message, user types instructions manually | :heavy_check_mark: |
| Reject with error | Refuse the file | |
| Attempt OCR | Run Tesseract OCR on scanned pages | |

**User's choice:** Show warning + fallback to manual (Recommended)

---

## Data Contract Shape

### Partial analysis handling

| Option | Description | Selected |
|--------|-------------|----------|
| Optional sections with null | All fields present, nullable for missing steps | :heavy_check_mark: |
| Strict -- require full analysis | Only works if all steps completed | |
| Variants per analysis type | Separate interfaces per analysis completeness | |

**User's choice:** Optional sections with null (Recommended)

### Normalization layer location

| Option | Description | Selected |
|--------|-------------|----------|
| Both with shared contract | TS interface + Python normalization function | :heavy_check_mark: |
| Frontend only | TS normalizer transforms raw API response | |
| Backend only | Python normalizer, frontend uses as-is | |

**User's choice:** Both with shared contract (Recommended)

### Raw data inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Include raw data | x/y/error arrays + fit curve points in contract | :heavy_check_mark: |
| Summary stats only | Only parameter values, uncertainties, chi2, R2 | |
| You decide | Claude's discretion | |

**User's choice:** Include raw data (Recommended)

---

## Results Assembly Format

### Parameter formatting

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse roundWithUncertainty | Same 2-sig-fig uncertainty rounding as AutoLab | :heavy_check_mark: |
| Scientific notation variant | Force scientific notation for all values | |
| You decide | Claude picks based on magnitude | |

**User's choice:** Reuse roundWithUncertainty (Recommended)

### LaTeX timing

| Option | Description | Selected |
|--------|-------------|----------|
| LaTeX strings now | Normalization outputs LaTeX-ready strings | :heavy_check_mark: |
| Plain text -- LaTeX later | Plain text, Phase 10/11 handles conversion | |
| Both formats | Both plain and LaTeX representations | |

**User's choice:** LaTeX strings now (Recommended)

### Stats format

| Option | Description | Selected |
|--------|-------------|----------|
| Structured object | Numeric fields for downstream flexibility | :heavy_check_mark: |
| Pre-formatted strings | Display-ready strings | |
| You decide | Claude's discretion | |

**User's choice:** Structured object (Recommended)

---

## Report Page Evolution

### Page scope

| Option | Description | Selected |
|--------|-------------|----------|
| Upload + text preview only | Add upload zone and textarea, no report preview yet | :heavy_check_mark: |
| Minimal -- backend only | Keep page as-is, parsing endpoint only | |
| Full scaffolding | Build full page skeleton with placeholders | |

**User's choice:** Upload + text preview only (Recommended)

### Beta badge

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Beta badge | Remove in Phase 12 when full flow integrated | :heavy_check_mark: |
| Remove badge | Drop indicator | |
| You decide | Claude's discretion | |

**User's choice:** Keep Beta badge (Recommended)

### Upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| Both drag-and-drop + button | Dropzone area with drag or click-to-browse | :heavy_check_mark: |
| Button only | Simple file picker button | |
| You decide | Claude's discretion | |

**User's choice:** Both drag-and-drop + button (Recommended)

---

## Claude's Discretion

- File size limits for instruction uploads
- Textarea sizing and placeholder text
- Python normalization function naming and location
- TypeScript interface file location

## Deferred Ideas

None -- discussion stayed within phase scope
