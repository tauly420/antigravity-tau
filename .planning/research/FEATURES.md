# Feature Research: AI-Powered Academic Lab Report Generation

**Domain:** AI-generated academic physics lab reports with Hebrew RTL support
**Researched:** 2026-03-23
**Confidence:** MEDIUM (training data only -- web search unavailable; Hebrew academic conventions from domain knowledge)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any physics lab report tool must have. Missing these means the report is not submittable.

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| **Standard lab report sections** (Title, Objective, Theory, Method, Results, Discussion, Conclusions) | Every Israeli university physics course requires these exact sections in this order | LOW | Report template system | Section names in Hebrew. See "Section Structure" below. |
| **Fit parameters with uncertainties in results** | The entire point of the analysis -- must appear in a formatted table | LOW | Existing AutoLab `fitResult` data | Already computed by AutoLab. Just needs formatting into report template. |
| **Embedded fit plot + residuals plot** | Plots are required in every lab report. Residuals show fit quality. | MEDIUM | Plot rendering to image (Plotly `toImage`) | Must have figure numbers and captions (e.g., "Figure 1: Force vs. Extension with linear fit"). |
| **Figure captions with numbering** | Academic standard. Uncaptioned figures are rejected by TAs. | LOW | Plot embedding | Auto-generated: "Figure N: [y-label] vs [x-label] with [model] fit" |
| **Proper equation rendering** | Theory section needs LaTeX equations. Plain text equations are unacceptable. | HIGH | PDF engine with math support | This is the hardest table-stakes requirement. jsPDF cannot do it. Need server-side PDF generation. |
| **Hebrew RTL body text** | Israeli university reports are written in Hebrew | HIGH | BiDi-capable PDF engine | Hebrew paragraphs must flow right-to-left. See "Hebrew RTL" section below. |
| **English LTR for math and equations** | Math notation is universally LTR, even in Hebrew documents | HIGH | BiDi PDF engine + CSS direction isolation | Inline math like $F = kx$ must stay LTR within RTL Hebrew paragraphs. |
| **Uncertainty reporting with proper sig figs** | "k = 49.8 +/- 1.3 N/m" not "k = 49.823456 +/- 1.2876" | LOW | Existing `roundWithUncertainty()` | Already implemented in format.ts. |
| **Chi-squared, R-squared, P-value in results** | Goodness-of-fit statistics are mandatory in physics reports | LOW | Existing AutoLab data | Already computed. Format into table or inline text. |
| **N-sigma comparison when applicable** | "The measured value agrees with theory within 1.5 sigma" | LOW | Existing AutoLab `nsigmaResult` | Color-coding not needed in PDF -- just text statement. |
| **PDF download** | Students submit PDF files. Not HTML, not Word. | HIGH | Server-side PDF generation | Must be print-quality A4 with proper margins. |
| **Student name + date + course info on title page** | Every submission needs identification | LOW | Simple form fields | Collect: student name, ID, course name, experiment number/title, date, partner name. |

### Differentiators (Competitive Advantage)

Features that make Tau-LY's report generation stand out from "just copy-paste into Word."

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| **AI-generated theoretical background** | Students spend hours writing theory. AI writes it in seconds from experiment context. | MEDIUM | OpenAI API + experiment context | Must be physics-accurate. Generate in Hebrew. Include relevant equations derived from the experiment type. |
| **Upload lab instruction PDF/Word as context** | Lab instructions contain the experiment description, equipment list, and expected procedure. AI uses this to write better theory and method sections. | HIGH | File parsing (PDF + DOCX) on backend | See "Instruction File Parsing" section. This is the primary context source -- reduces manual input dramatically. |
| **AI gap-filling conversation** | If the uploaded instructions don't contain enough info, AI asks targeted questions: "What was the theoretical spring constant?" | MEDIUM | Chat-style UI + OpenAI | Not a free-form chat. A structured Q&A where AI identifies what's missing from context and asks specifically for it. |
| **AI-generated discussion section** | Discussion interprets results: "The measured g = 9.78 +/- 0.15 agrees within 0.2 sigma, suggesting systematic errors are minimal." | MEDIUM | AutoLab results + OpenAI | Must reference actual computed values. Must sound like a student wrote it, not a textbook. |
| **AI-generated measurement planning section** | Describes what was measured, equipment used, and procedure followed | MEDIUM | Uploaded instructions + user context | Distinct from theory. Covers the "how" not the "why." |
| **In-app section preview and editing** | See each section before export. Edit AI text if something is wrong. | MEDIUM | React rich text or markdown editor | Critical UX feature. Students will not trust blind AI output. Must be able to tweak wording. |
| **One-click from AutoLab results to report** | After analysis completes, single "Generate Report" button. No re-entering data. | LOW | Data contract between AutoLab and report module | The key workflow: analyze -> review results -> generate report -> edit -> download PDF. |
| **Formula derivation in theory section** | AI shows how the fit model relates to the physics: "From Hooke's Law F=kx, fitting y=ax+b gives k=a" | MEDIUM | OpenAI + experiment context | Physics students are expected to derive the relationship. AI can write this. |
| **Automatic error analysis paragraph** | AI writes a paragraph about sources of uncertainty, systematic vs statistical errors | LOW | AutoLab results + OpenAI | Boilerplate but personalized to the actual experiment. Every report needs this. |

### Anti-Features (Do NOT Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full LaTeX source export** | Physics students use LaTeX | Doubles the output format maintenance. Hebrew LaTeX (babel/polyglossia) is notoriously painful. Most Israeli undergrads use Word anyway. | Offer PDF only for v2.0. Revisit LaTeX export as a future enhancement if demand exists. |
| **WYSIWYG rich text editor for report** | "I want to edit like Word" | Massive complexity (ProseMirror/TipTap). RTL rich text editing is a known nightmare. Overkill for tweaking a few AI paragraphs. | Markdown textarea per section. Or plain text edit with preview. |
| **Client-side PDF generation** | "Keep everything in the browser" | jsPDF cannot render LaTeX math. Cannot handle Hebrew RTL properly. Results in blurry, broken PDFs. Current exportPdf.ts already shows the limitations. | Server-side generation with WeasyPrint or similar. |
| **Multiple report templates/styles** | "Let me choose APA vs custom format" | One template done well beats five done poorly. Israeli physics lab reports follow a standard structure. | One well-designed template matching Israeli academic conventions. |
| **AI writes the entire report without review** | "Just give me the PDF" | Students need to understand what they're submitting. Professors check for understanding. Blind AI output risks academic integrity issues. | Always show preview. Always allow editing. Frame as "AI draft" not "AI submission." |
| **Real-time collaborative editing** | "My lab partner and I edit together" | Massive infrastructure (CRDT/OT). Way out of scope. | One report per session. Partner adds their name. |
| **Save/load report drafts** | "I want to come back later" | Requires user accounts or local storage persistence. Contradicts stateless design. | Generate report in one session. User can re-run analysis and re-generate. |
| **Plagiarism detection / originality check** | "Make sure it's unique" | External service dependency. Not Tau-LY's job. | AI generates unique text each time. Student's responsibility to review. |

---

## Section Structure: Israeli Physics Lab Report

Based on standard Israeli university physics lab report format (Technion, Hebrew University, Tel Aviv University conventions):

### Required Sections (in order)

| # | Hebrew Name | English Equivalent | Content Source | AI-Generated? |
|---|-------------|-------------------|----------------|---------------|
| 0 | Title page | Title Page | User input (name, ID, course, date, experiment title) | NO -- form fields |
| 1 | Objective / Goal | Objective | From uploaded instructions or user input | YES -- 2-3 sentences |
| 2 | Theoretical Background | Theory | AI writes based on experiment type + instructions | YES -- 1-2 paragraphs + equations |
| 3 | Measurement Method | Methods/Procedure | From uploaded instructions + user context | YES -- describes equipment + procedure |
| 4 | Results | Results | AutoLab analysis data (parameters, plots, statistics) | PARTIALLY -- structured from data, AI writes connecting text |
| 5 | Discussion | Discussion | AI interprets results, error analysis, comparison to theory | YES -- references actual values |
| 6 | Conclusions | Conclusions | AI summarizes findings in 2-3 sentences | YES -- brief |

### Section Details

**Title Page:** Student name, student ID, partner name, course name + number, experiment number + title, submission date. Simple form. No AI needed.

**Objective (Matara):** 2-3 sentences stating what the experiment measures and why. Example: "The goal of this experiment is to determine the spring constant k of a spring using Hooke's Law, by measuring the extension of the spring under various applied forces."

**Theory (Reka Teoreti):** The most complex AI section.
- State the physical law being tested
- Derive the mathematical relationship used for fitting
- Show the equations with proper LaTeX rendering
- Explain what the fit parameters represent physically
- If applicable, state the theoretical/accepted value for comparison
- Must be in Hebrew with LTR equations

**Method (Shitat HaMediad):** Describes the experimental setup and procedure.
- Equipment list (from instructions or user input)
- Step-by-step procedure (condensed from instructions)
- What was measured, what instruments were used, what uncertainties are associated

**Results (Totza'ot):**
- Data table (optional -- could be large; usually a sample or summary)
- Fit plot with caption (Figure 1)
- Residuals plot with caption (Figure 2)
- Parameter table with uncertainties
- Goodness-of-fit statistics
- Formula calculation results (if applicable)
- N-sigma comparison statement
- AI writes 2-3 connecting sentences between numerical results

**Discussion (Diyun):**
- Interpret the fit quality (chi-squared, R-squared)
- Compare experimental value to theoretical value
- Discuss sources of error (systematic and statistical)
- Explain any discrepancies
- Must reference actual numbers from the results

**Conclusions (Maskanot):**
- 2-4 sentences summarizing the main finding
- State whether the hypothesis/theory was confirmed
- State the final measured value with uncertainty

---

## Instruction File Parsing

### What Lab Instructions Look Like

Israeli university lab instruction files are typically:
- **Format:** PDF (most common) or Word (.docx)
- **Language:** Hebrew, sometimes with English technical terms and equations
- **Length:** 2-10 pages
- **Contents:** Experiment title, theoretical background, equipment list, step-by-step procedure, data tables to fill, questions to answer, sometimes expected results or theoretical values

### Parsing Strategy

| Format | Library | Confidence | Notes |
|--------|---------|------------|-------|
| PDF | `PyMuPDF` (fitz) or `pdfplumber` | MEDIUM | Hebrew text extraction from PDF is imperfect. Scanned PDFs will fail. `pdfplumber` handles text-based PDFs well. PyMuPDF is faster. |
| DOCX | `python-docx` | HIGH | Reliable for .docx. Hebrew text comes out correctly. Tables and lists preserved. |
| DOC (old Word) | Not supported | -- | Rare. Tell users to convert to .docx or PDF. |

### What to Extract

The AI does not need perfectly structured data. It needs raw text context. Strategy:

1. **Extract all text** from the uploaded file (preserving paragraph breaks)
2. **Send full text to OpenAI** as part of the report generation prompt
3. **Let the AI identify** the relevant sections (theory, equipment, procedure)
4. AI uses this context to write the report sections

Do NOT attempt to structurally parse the instructions (identify "Section 3: Equipment" etc.). The format varies too much between universities and courses. Treat the entire instruction file as a text blob that provides context.

### Edge Cases

| Case | Handling |
|------|----------|
| Scanned PDF (image-only) | Detect with `pdfplumber` (empty text extraction). Show error: "This PDF contains scanned images. Please use a text-based PDF or type the experiment description manually." |
| Very long instructions (>10 pages) | Truncate to first 8000 tokens. Lab instructions rarely exceed this. |
| Mixed Hebrew + English | Works fine -- OpenAI handles multilingual input natively. |
| Instructions with embedded images/diagrams | Images are lost in text extraction. Acceptable -- AI works from text context. |
| Password-protected PDF | Show error: "Cannot read protected files. Please provide an unprotected version." |

---

## AI Gap-Filling Conversation Flow

When the user provides insufficient context (no instruction file, or sparse instructions), the AI should ask targeted questions before generating the report.

### Flow

```
1. User clicks "Generate Report" from AutoLab results
2. System checks: is there an uploaded instruction file?
   - YES: Extract text, proceed to step 4
   - NO: Proceed to step 3
3. Show context form:
   - Experiment title (required)
   - Experiment subject/topic (required, e.g., "Hooke's Law", "Free Fall")
   - Equipment used (optional, textarea)
   - Procedure notes (optional, textarea)
   - Upload instruction file (optional, PDF/DOCX)
4. AI analyzes available context (instructions + form + AutoLab results)
5. AI identifies gaps. Possible gap questions:
   - "What is the theoretical value you're comparing to?" (if n-sigma not already computed)
   - "What equipment did you use for measurement?" (if not in instructions)
   - "What was the uncertainty source for your measurements?" (if not clear)
6. User answers gap questions (1-3 questions max)
7. AI generates all sections as drafts
8. User reviews/edits each section in preview
9. User clicks "Download PDF"
```

### Key Design Principle

This is NOT a chatbot conversation. It is a structured form with AI-driven follow-up questions. Maximum 3 follow-up questions. The goal is to get to the report draft as fast as possible.

---

## Hebrew RTL + English Math: Formatting Requirements

### The Problem

Hebrew text flows right-to-left. Mathematical notation flows left-to-right. A single sentence might contain both: "the spring constant is $k = 49.8 \pm 1.3$ N/m and this is what we measured."

In Hebrew that sentence reads RTL, but the equation in the middle must remain LTR. This is called "BiDi" (bidirectional) text.

### Requirements

| Requirement | Details |
|-------------|---------|
| Body text direction | RTL (Hebrew) |
| Equation direction | LTR (math is always LTR) |
| Inline math | LTR island within RTL paragraph. Uses Unicode BiDi algorithm or explicit `dir="ltr"` spans. |
| Display math | Centered on page, LTR. No directional issues since it's a separate block. |
| Figure captions | RTL Hebrew text, but "Figure 1:" prefix can be in English or Hebrew |
| Table headers | RTL Hebrew for text columns, LTR for numeric columns |
| Numbers | LTR (Western Arabic numerals, not Eastern Arabic) |
| Page layout | Standard A4. Right-aligned headers/titles for RTL. Page numbers can be centered. |

### Implementation Approach

The PDF engine must support:
1. **Unicode Hebrew fonts** -- not all PDF libraries ship Hebrew-capable fonts
2. **BiDi text layout** -- automatic or manual direction switching
3. **LaTeX/math rendering** -- inline and display equations
4. **Mixed direction in a single line** -- the hardest requirement

This is why client-side jsPDF is insufficient and server-side generation is necessary. See STACK.md for PDF engine recommendation.

---

## Feature Dependencies

```
AutoLab analysis results
    |
    v
Report data contract (structured interface for all result data)
    |
    +---> Results section (parameters, plots, statistics)
    |
    +---> Discussion section (AI needs actual values to discuss)
    |
    +---> N-sigma statement (if comparison was performed)

Instruction file upload + parsing
    |
    v
Extracted text context
    |
    +---> Theory section (AI writes from instructions context)
    |
    +---> Method section (AI writes from instructions context)
    |
    +---> Objective section (AI derives from instructions)
    |
    +---> Gap-filling questions (AI identifies what's missing)

User context form (title, subject, equipment, notes)
    |
    v
Combined context (form + instructions + AutoLab results)
    |
    v
AI report generation (all sections)
    |
    v
Section preview + editing UI
    |
    v
Server-side PDF generation (Hebrew RTL + LaTeX math)
    |
    v
PDF download

CRITICAL PATH:
  Report data contract --> AI section generation --> Preview UI --> PDF engine
  (Instruction parsing can be developed in parallel with the data contract)
```

### Dependency Notes

- **AutoLab results are prerequisite:** The report feature only works after a completed AutoLab analysis. No standalone report generation in v2.0.
- **PDF engine is the long pole:** Hebrew RTL + LaTeX math rendering is the highest-risk technical component. Should be prototyped early.
- **AI section generation is independent per section:** Theory, Discussion, Method can be generated in parallel API calls.
- **Preview UI blocks PDF:** Users must see and edit before downloading. Cannot skip preview.
- **Instruction parsing is optional:** The feature works without it (user provides context manually). But it dramatically improves the experience.

---

## MVP Definition

### Launch With (v2.0 MVP)

- [ ] **Report data contract** from AutoLab results -- structured TypeScript interface + Python dict schema
- [ ] **Title page** with student info form fields
- [ ] **AI-generated Theory section** from experiment context (instruction file OR manual input)
- [ ] **AI-generated Method section** from context
- [ ] **Structured Results section** pulling fit parameters, statistics, and embedded plots from AutoLab
- [ ] **AI-generated Discussion section** interpreting the actual results
- [ ] **AI-generated Conclusions section** summarizing findings
- [ ] **Section preview UI** with editable text areas for each section
- [ ] **Server-side PDF generation** with Hebrew RTL body + LTR math equations
- [ ] **Instruction file upload** (PDF and DOCX parsing)
- [ ] **Basic gap-filling** -- at minimum a context form; stretch goal: AI-driven follow-up questions

### Add After Validation (v2.1)

- [ ] **AI gap-filling conversation** -- smart follow-up questions based on missing context
- [ ] **Objective section** auto-generated from instructions
- [ ] **Data table in results** (sample or full, user-configurable)
- [ ] **Multiple plots support** (if AutoLab produced multiple fits)
- [ ] **Bibliography/references section** (AI generates relevant textbook references)
- [ ] **Report quality scoring** -- AI rates the draft and suggests improvements

### Future Consideration (v3+)

- [ ] **LaTeX source export** alongside PDF
- [ ] **Report generation from standalone tools** (not just AutoLab)
- [ ] **Template customization** (different universities have different formats)
- [ ] **Saved report drafts** (requires persistence layer)
- [ ] **Batch report generation** (multiple experiments at once)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| Server-side PDF with Hebrew RTL | HIGH | HIGH | P1 | Without this, nothing works. Long pole. |
| Report data contract from AutoLab | HIGH | LOW | P1 | Interface definition. Blocks everything else. |
| AI Theory section generation | HIGH | MEDIUM | P1 | Biggest time-saver for students. |
| AI Discussion section generation | HIGH | MEDIUM | P1 | Second biggest time-saver. |
| Results section with embedded plots | HIGH | MEDIUM | P1 | Core report content. |
| Section preview + edit UI | HIGH | MEDIUM | P1 | Trust requires review capability. |
| Title page with student info | MEDIUM | LOW | P1 | Simple form. Required for submission. |
| Instruction file parsing (PDF/DOCX) | HIGH | MEDIUM | P1 | Dramatically reduces manual input. |
| AI Method section | MEDIUM | LOW | P1 | Short section, low incremental cost. |
| AI Conclusions section | MEDIUM | LOW | P1 | Short section, low incremental cost. |
| Gap-filling conversation | MEDIUM | MEDIUM | P2 | Nice UX but manual form works as fallback. |
| AI Objective section | LOW | LOW | P2 | Usually 2 sentences. Students can write this. |
| Data table in report | LOW | LOW | P2 | Many TAs don't require it in the report body. |
| Bibliography generation | LOW | MEDIUM | P3 | Nice but rarely required for undergrad labs. |
| LaTeX source export | MEDIUM | HIGH | P3 | Hebrew LaTeX is painful. Most students use Word/PDF. |

---

## Competitor Feature Analysis

| Feature | Manual (Word/Google Docs) | Overleaf (LaTeX) | Tau-LY Report (planned) |
|---------|--------------------------|-------------------|------------------------|
| Theory section | Student writes from scratch | Student writes LaTeX | AI generates from instructions |
| Results formatting | Manual copy-paste of numbers | Manual LaTeX tables | Auto-populated from AutoLab |
| Plot insertion | Screenshot + paste | includegraphics | Auto-embedded with captions |
| Equation rendering | Equation editor (clunky) | Native LaTeX (great) | Server-rendered LaTeX in PDF |
| Hebrew RTL | Native in Word/Docs | Requires babel/polyglossia setup | Built-in |
| Time to complete | 2-4 hours | 3-6 hours (LaTeX learning curve) | 10-20 minutes |
| Error analysis | Student writes from scratch | Student writes LaTeX | AI generates from actual data |
| Uncertainty formatting | Manual | Manual | Automatic sig fig rounding |

**Tau-LY's unique value:** The only tool that goes from raw data to submittable lab report in a single workflow. No competitor connects "data analysis" to "report generation" -- students currently do analysis in one tool and write reports in another.

---

## Sources

- Israeli university physics lab report conventions: training data from Technion, Hebrew University, Tel Aviv University course materials (MEDIUM confidence -- conventions are stable but specific university requirements may vary)
- Hebrew RTL + math BiDi conventions: domain knowledge of Unicode BiDi algorithm and Hebrew academic typesetting (HIGH confidence -- this is a well-understood problem)
- PDF generation for Hebrew: domain knowledge of WeasyPrint, ReportLab, wkhtmltopdf capabilities (MEDIUM confidence -- specific library support for Hebrew should be verified during implementation)
- Instruction file parsing: domain knowledge of pdfplumber, PyMuPDF, python-docx (MEDIUM confidence -- Hebrew PDF text extraction quality should be tested with real files)
- AI report generation patterns: training data on GPT-based document generation (MEDIUM confidence)

---
*Feature research for: AI-powered academic lab report generation*
*Researched: 2026-03-23*
