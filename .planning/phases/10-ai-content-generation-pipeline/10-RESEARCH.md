# Phase 10: AI Content Generation Pipeline - Research

**Researched:** 2026-03-26
**Domain:** OpenAI structured JSON generation, prompt engineering for physics report sections, React form UI
**Confidence:** HIGH

## Summary

Phase 10 builds the AI content generation pipeline that takes experiment context (form fields, instruction file text, AutoLab analysis results) and produces structured report sections (theory, method, discussion, conclusions) via OpenAI. The architecture is straightforward: a single `POST /api/report/generate` endpoint that constructs a detailed system prompt from all available context, calls OpenAI with `response_format={"type": "json_object"}`, and returns per-section content as structured JSON. A secondary `POST /api/report/follow-up` endpoint handles the gap-filling interaction where AI asks clarifying questions before generation.

The project already has a well-established OpenAI integration pattern in `backend/api/autolab.py` -- direct `client.chat.completions.create()` calls with system prompts. The report generation follows this same pattern but simpler: no function-calling orchestrator, just a single completion with JSON mode. The frontend extends `ReportBeta.tsx` with a context form (title, subject, equipment, notes, language toggle) and inline follow-up question UI.

**Primary recommendation:** Use `response_format={"type": "json_object"}` (already proven pattern in the codebase's OpenAI SDK v2.29.0) with a carefully structured system prompt that injects actual parameter values. Start with `gpt-4o-mini` for cost efficiency -- the intro physics lab level (D-09) does not require GPT-4o quality.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** User chooses report language per report via a toggle on the context form (Hebrew or English). Default is Hebrew.
- **D-02:** System prompt is always written in English regardless of output language. A directive like "Write all prose in Hebrew" controls the output language. GPT models follow English instructions more reliably.
- **D-03:** LaTeX equations are always in English/Latin notation inline within the prose, regardless of body language. This follows the Israeli academic standard established in Phase 8 (D-06).
- **D-04:** Context form and instruction file upload are complementary -- both coexist on the same page (ReportBeta.tsx). Neither is required; user can use either or both. AI merges all available inputs.
- **D-05:** Context form has minimal fields: title, subject area (e.g. mechanics, optics), equipment used, and a free-text notes field. AI infers the rest from instruction file and AutoLab results.
- **D-06:** Context form appears on the same page as the file upload, below the upload zone. Single scrollable page, no step navigation. Consistent with AutoLab's single-page approach.
- **D-07:** After user clicks "Generate", AI analyzes available inputs and returns 1-3 follow-up questions displayed inline on the report page (like a mini form). User answers, then generation proceeds. No modal, no chat.
- **D-08:** Users can skip follow-up questions via a "Generate anyway" button. AI proceeds with assumptions and warns which context was missing in the output. Skippable but not silent.
- **D-09:** Target intro physics lab level (University Physics 1/2). Theory explains relevant laws without full derivations.
- **D-10:** Theoretical background includes key formulas only by default, plus any formulas the user explicitly requests in their context/notes. Derivations are included only if the user specifically asks for them.
- **D-11:** All sections generated in a single API call, returned as structured JSON with per-section content. One loading state, one endpoint. Simpler and cheaper than per-section calls.

### Claude's Discretion
- AI model selection for generation (gpt-4o-mini vs gpt-4o -- balance cost vs quality)
- Exact system prompt wording and section generation instructions
- JSON response schema for generated sections
- Number and phrasing of follow-up questions (1-3 as specified in CTX-03)
- How to merge instruction file text + form fields + AutoLab results into the AI prompt
- Error handling when AI generation fails or returns malformed output

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-02 | User can provide experiment context via a form (title, subject, equipment, procedure notes) alongside or instead of file upload | Context form UI on ReportBeta.tsx, fields defined by D-05 |
| CTX-03 | AI identifies missing context from available inputs and asks 1-3 targeted follow-up questions before generating the report | Two-step flow: analyze endpoint returns questions, then generate endpoint produces sections |
| RPT-01 | AI generates a theoretical background section with relevant physics theory and LaTeX equations based on experiment context | System prompt instructs theory generation with KaTeX-compatible LaTeX; JSON output schema includes `theory` section |
| RPT-02 | AI generates a measurement method section describing equipment and procedure based on uploaded instructions and user context | System prompt instructs method generation from instruction file + equipment list; JSON output schema includes `method` section |
| RPT-04 | AI generates a discussion section interpreting actual results, comparing to theory, and analyzing sources of error | System prompt injects actual fit parameters, chi-squared, n-sigma values so AI can reference real numbers |
| RPT-05 | AI generates a conclusions section summarizing main findings and measured values | JSON output schema includes `conclusions` section with actual measured values |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai (Python SDK) | 2.29.0 (installed) | OpenAI API calls for report generation | Already used by autolab.py; no new dependency |
| Flask | >=3.0.0 (installed) | Report blueprint endpoints | Existing backend framework |
| React | ^19.2.0 (installed) | Context form and generation UI | Existing frontend framework |
| axios | ^1.7.0 (installed) | API calls from frontend | Existing HTTP client |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| KaTeX | ^0.16.0 (installed) | Render LaTeX in generated section previews | Display equations in follow-up and generated content |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `response_format: json_object` | `response_format: json_schema` (strict mode) | Strict mode guarantees schema adherence but requires all fields to have defaults. json_object is simpler, already sufficient, and compatible with gpt-4o-mini |
| gpt-4o-mini | gpt-4o | 4o is higher quality but ~15x more expensive. Intro physics level content (D-09) is well within 4o-mini capability |
| Single completion call | Function-calling orchestrator | Orchestrator is overkill -- no iterative tool use needed. One prompt, one response |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
backend/api/report.py              # Add /generate and /follow-up endpoints
backend/prompts/                    # NEW: prompt templates directory
  report_system.py                  # System prompt builder for report generation
  report_followup.py                # System prompt for follow-up question generation
frontend/src/components/ReportBeta.tsx  # Extend with context form + generation UI
frontend/src/services/api.ts        # Add generateReport(), askFollowUpQuestions() functions
frontend/src/types/report.ts        # Add GeneratedSections, FollowUpQuestion interfaces
```

### Pattern 1: Two-Step Generation Flow
**What:** Split generation into two API calls: (1) analyze context and return follow-up questions, (2) generate all sections with answers included.
**When to use:** Always -- this implements D-07 (follow-up questions before generation).
**Example:**
```python
# Step 1: POST /api/report/analyze-context
# Input: { context_form: {...}, instruction_text: str, analysis_data: {...} }
# Output: { questions: [{ id: str, question: str, hint: str }], can_skip: bool }

# Step 2: POST /api/report/generate
# Input: { context_form: {...}, instruction_text: str, analysis_data: {...},
#          answers: [{ id: str, answer: str }], language: "he" | "en" }
# Output: { sections: { theory: str, method: str, discussion: str, conclusions: str },
#           warnings: [str] }
```

### Pattern 2: Context Merging into System Prompt
**What:** Build a single comprehensive system prompt that includes all available context inline, rather than splitting across messages.
**When to use:** For the generation call. Follows the established autolab.py `_build_chat_system()` pattern.
**Example:**
```python
def build_report_system_prompt(context_form: dict, instruction_text: str,
                                analysis_data: dict, answers: list,
                                language: str) -> str:
    """Build system prompt with all context injected."""
    lines = [
        "You are a physics lab report writer for university students.",
        f"OUTPUT LANGUAGE: Write all prose in {'Hebrew' if language == 'he' else 'English'}.",
        "LaTeX equations must always be in English/Latin notation using KaTeX-compatible syntax.",
        "Use $...$ for inline math and $$...$$ for display math.",
        "",
        "=== EXPERIMENT CONTEXT ===",
    ]

    if context_form.get("title"):
        lines.append(f"Experiment title: {context_form['title']}")
    if context_form.get("subject"):
        lines.append(f"Subject area: {context_form['subject']}")
    # ... inject all context fields, instruction text, analysis results

    if analysis_data.get("fit"):
        fit = analysis_data["fit"]
        lines.append(f"Fit model: {fit.get('model_name')}")
        # inject actual parameter values with uncertainties

    return "\n".join(lines)
```

### Pattern 3: JSON Response Schema
**What:** Use `response_format={"type": "json_object"}` with explicit schema instructions in the system prompt.
**When to use:** For the generation endpoint to get structured per-section output.
**Example:**
```python
# In system prompt:
# "Respond with a JSON object with this exact structure:
# {
#   "theory": "...",       // Theoretical background with LaTeX equations
#   "method": "...",       // Measurement method description
#   "discussion": "...",   // Discussion of results
#   "conclusions": "...",  // Conclusions
#   "warnings": ["..."]   // Missing context warnings (if user skipped questions)
# }"

response = client.chat.completions.create(
    model=model_name,
    messages=[{"role": "system", "content": system_prompt},
              {"role": "user", "content": user_message}],
    response_format={"type": "json_object"},
)
sections = json.loads(response.choices[0].message.content)
```

### Pattern 4: Follow-Up Questions as Lightweight Form
**What:** Display AI-generated questions as input fields, not chat bubbles. Consistent with D-07.
**When to use:** After the analyze-context call returns questions.
**Example (React):**
```typescript
// Follow-up questions state
const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
const [answers, setAnswers] = useState<Record<string, string>>({});

// Render as form fields
{followUpQuestions.map(q => (
  <div key={q.id}>
    <label>{q.question}</label>
    {q.hint && <small>{q.hint}</small>}
    <input value={answers[q.id] || ''} onChange={...} />
  </div>
))}
<button onClick={generateWithAnswers}>Generate Report</button>
<button onClick={generateWithoutAnswers}>Generate Anyway</button>
```

### Anti-Patterns to Avoid
- **Per-section API calls:** Violates D-11. All sections must be generated in a single call. Cheaper, simpler, ensures cross-section coherence.
- **Chat-style follow-up:** Violates D-07. Follow-up questions are form fields, not a conversation.
- **Hardcoded section templates:** AI should generate content, not fill in blanks. The system prompt guides structure, not a template engine.
- **LaTeX in system prompt directives:** System prompt is in English (D-02). LaTeX instructions use `$...$` KaTeX notation.
- **Using `\pm` in output:** Autolab convention uses Unicode symbols (plus-minus, chi-squared, sigma). Keep consistent in AI instructions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing from AI response | Custom regex parser | `json.loads()` with `response_format={"type": "json_object"}` | OpenAI guarantees valid JSON when json_object mode is used |
| Retry logic for OpenAI failures | Custom retry loops | OpenAI SDK built-in retries (default: 2 retries with backoff) | SDK handles rate limits and transient errors automatically |
| LaTeX validation | Custom LaTeX parser | Let KaTeX handle rendering errors on frontend | KaTeX will show error messages for invalid LaTeX; no need to validate server-side |
| Hebrew/English language detection | Language detection library | Explicit user toggle (D-01) | User selects language; no need to detect |

**Key insight:** The OpenAI Python SDK v2.29.0 already handles retries, rate limiting, and JSON mode. The existing autolab.py patterns handle sanitization and error wrapping. Reuse, don't rebuild.

## Common Pitfalls

### Pitfall 1: LaTeX Incompatibility with KaTeX
**What goes wrong:** OpenAI models may generate LaTeX using commands that KaTeX does not support (e.g., `\text{}` without proper escaping, `\boldsymbol`, `\begin{align}`).
**Why it happens:** GPT models are trained on full LaTeX (texlive), not the KaTeX subset.
**How to avoid:** System prompt must explicitly state: "Use only KaTeX-compatible LaTeX. Use `\text{}` for text in math mode, `\cdot` not `\times`, `\frac{}{}` for fractions. For multi-line equations use `\\` within a single `$$...$$` block, NOT `\begin{align}`. Supported environments: `aligned`, `gathered`, `cases`."
**Warning signs:** Equations render as red error text on the frontend.

### Pitfall 2: Hebrew RTL Mixed with LaTeX Equations
**What goes wrong:** Generated text mixes Hebrew paragraphs with inline `$...$` equations, causing rendering issues when displayed or converted to PDF.
**Why it happens:** RTL/LTR direction switching is complex; AI may not place equations correctly within Hebrew sentences.
**How to avoid:** System prompt should instruct: "When writing in Hebrew, place inline equations in separate `$...$` markers. Start each display equation on its own line with `$$` markers." Phase 8 PDF renderer already handles this pattern.
**Warning signs:** Equations appear reversed or misplaced in preview.

### Pitfall 3: AI Hallucinating Parameter Values
**What goes wrong:** AI invents parameter values instead of using the actual ones from the analysis.
**Why it happens:** If analysis data is not prominently placed in the prompt, the model may generate plausible but incorrect values.
**How to avoid:** Inject actual values with explicit labels in the system prompt: "ACTUAL MEASURED VALUES (use these exact numbers, do not make up values): k = 49.8 +/- 0.5 N/m". Repeat in the user message.
**Warning signs:** Generated report contains values that don't match the AutoLab output.

### Pitfall 4: JSON Mode Requires "JSON" in Prompt
**What goes wrong:** OpenAI returns an error when using `response_format={"type": "json_object"}` but the system/user messages don't mention "JSON".
**Why it happens:** OpenAI requires the word "JSON" to appear somewhere in the messages when json_object mode is enabled.
**How to avoid:** Include "Respond with a JSON object" in the system prompt.
**Warning signs:** API returns 400 error about missing JSON instruction.

### Pitfall 5: Token Limit for Long Instruction Files
**What goes wrong:** Instruction file text + analysis context + system prompt exceeds model context window.
**Why it happens:** Instruction PDFs can be very long (10+ pages of Hebrew text).
**How to avoid:** Truncate instruction text to first ~3000 characters with a note "(truncated)". gpt-4o-mini has 128k context but costs scale linearly with input tokens.
**Warning signs:** Slow response times, high API costs, or context window errors.

### Pitfall 6: "Generate Anyway" Without Answers Produces Generic Content
**What goes wrong:** When user skips follow-up questions, generated content is too vague.
**Why it happens:** AI lacks specific context it asked about.
**How to avoid:** Per D-08, include explicit warnings in the output about what was assumed. System prompt should instruct: "If context is missing, state your assumptions explicitly in the text."
**Warning signs:** Generated theory section is generic textbook content instead of experiment-specific.

## Code Examples

### Backend: Report Generation Endpoint
```python
# Source: Pattern from backend/api/autolab.py adapted for report generation

@report_bp.route('/generate', methods=['POST'])
def generate():
    """Generate all report sections from context."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        context_form = data.get("context_form", {})
        instruction_text = data.get("instruction_text", "")
        analysis_data = data.get("analysis_data", {})
        answers = data.get("answers", [])
        language = data.get("language", "he")

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return jsonify({"error": "OPENAI_API_KEY not set"}), 500

        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        system_prompt = build_report_system_prompt(
            context_form, instruction_text, analysis_data, answers, language
        )

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the lab report sections now."},
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        sections = json.loads(content)

        return jsonify({"sections": sections, "error": None})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
```

### Backend: Follow-Up Question Endpoint
```python
@report_bp.route('/analyze-context', methods=['POST'])
def analyze_context():
    """Analyze available context and return follow-up questions."""
    try:
        data = request.get_json()
        context_form = data.get("context_form", {})
        instruction_text = data.get("instruction_text", "")
        analysis_data = data.get("analysis_data", {})

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return jsonify({"error": "OPENAI_API_KEY not set"}), 500

        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        system_prompt = build_followup_system_prompt(
            context_form, instruction_text, analysis_data
        )

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Analyze the available context and return follow-up questions."},
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        result = json.loads(content)

        return jsonify({
            "questions": result.get("questions", []),
            "can_generate_without": result.get("can_generate_without", True),
            "error": None,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
```

### Frontend: API Functions
```typescript
// Source: Pattern from frontend/src/services/api.ts

export interface ContextForm {
  title: string;
  subject: string;
  equipment: string;
  notes: string;
  language: 'he' | 'en';
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  hint?: string;
}

export interface GeneratedSections {
  theory: string;
  method: string;
  discussion: string;
  conclusions: string;
  warnings?: string[];
}

export const analyzeReportContext = async (data: {
  context_form: ContextForm;
  instruction_text: string;
  analysis_data: any;
}): Promise<{
  questions: FollowUpQuestion[];
  can_generate_without: boolean;
  error: string | null;
}> => {
  const response = await api.post('/report/analyze-context', data);
  return response.data;
};

export const generateReport = async (data: {
  context_form: ContextForm;
  instruction_text: string;
  analysis_data: any;
  answers: { id: string; answer: string }[];
  language: 'he' | 'en';
}): Promise<{
  sections: GeneratedSections;
  error: string | null;
}> => {
  const response = await api.post('/report/generate', data);
  return response.data;
};
```

### System Prompt: Analysis Data Injection
```python
# Source: Pattern from backend/api/autolab.py _build_chat_system()

def _inject_analysis_context(lines: list, analysis_data: dict):
    """Inject actual analysis results into system prompt."""
    fit = analysis_data.get("fit")
    if fit:
        lines.append(f"Fit model used: {fit.get('modelName', 'unknown')}")
        lines.append("ACTUAL MEASURED PARAMETERS (use these exact values):")
        for param in fit.get("parameters", []):
            lines.append(f"  {param['name']} = {param['value']} +/- {param['uncertainty']}")
            lines.append(f"    Rounded: {param['rounded']}")
        gof = fit.get("goodnessOfFit", {})
        if gof.get("chiSquaredReduced") is not None:
            lines.append(f"  Chi-squared reduced = {gof['chiSquaredReduced']}")
        if gof.get("rSquared") is not None:
            lines.append(f"  R-squared = {gof['rSquared']}")
        if gof.get("pValue") is not None:
            lines.append(f"  P-value = {gof['pValue']}")

    formula = analysis_data.get("formula")
    if formula:
        lines.append(f"Derived quantity: {formula.get('expression')} = {formula.get('formatted')}")

    nsigma = analysis_data.get("nsigma")
    if nsigma:
        lines.append(f"N-sigma comparison: {nsigma.get('nSigma')} sigma - {nsigma.get('verdict')}")
        lines.append(f"  Theoretical value: {nsigma.get('theoreticalValue')} +/- {nsigma.get('theoreticalUncertainty')}")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `response_format: json_object` | `response_format: json_schema` (strict mode) | Aug 2024 | Strict mode guarantees schema adherence, but json_object is simpler and sufficient for this use case |
| Per-section AI calls | Single call with structured JSON | Project decision D-11 | Cheaper, faster, ensures cross-section coherence |
| English-only prompts | Multilingual output via directive | Established pattern in GPT | System prompt stays English, output language controlled by directive |

**Deprecated/outdated:**
- Old ChatCompletion API (`openai.ChatCompletion.create()`) -- replaced by `client.chat.completions.create()` in SDK v1.0+. Project already uses new API.

## Open Questions

1. **Optimal system prompt length vs quality**
   - What we know: Longer prompts with more explicit instructions improve output quality but cost more tokens
   - What's unclear: The ideal balance for intro physics lab reports
   - Recommendation: Start with a detailed prompt (~1500 tokens), iterate based on output quality. System prompt tokens are cached by OpenAI after first call.

2. **Follow-up question quality from gpt-4o-mini**
   - What we know: gpt-4o-mini handles structured tasks well
   - What's unclear: Whether it can reliably identify what context is truly missing vs asking unnecessary questions
   - Recommendation: Use gpt-4o-mini for both analysis and generation. If follow-up questions are poor quality, consider gpt-4o for the analysis step only.

3. **ReportAnalysisData availability from AnalysisContext**
   - What we know: `autolabResults` is stored in AnalysisContext as `any` type
   - What's unclear: Whether the data is already normalized to `ReportAnalysisData` format by Phase 9 code, or if normalization happens on the report page
   - Recommendation: Check if Phase 9 added a normalization step. If not, normalize in `ReportBeta.tsx` before sending to the API.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=7.0.0 (installed in requirements.txt) |
| Config file | none -- needs creation or inline config |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-02 | Context form fields accepted by /generate endpoint | unit | `cd backend && python -m pytest tests/test_report_generate.py::test_context_form_fields -x` | No -- Wave 0 |
| CTX-03 | /analyze-context returns 1-3 follow-up questions | unit (mocked) | `cd backend && python -m pytest tests/test_report_generate.py::test_followup_questions -x` | No -- Wave 0 |
| RPT-01 | Generated JSON contains theory section with LaTeX | unit (mocked) | `cd backend && python -m pytest tests/test_report_generate.py::test_theory_section -x` | No -- Wave 0 |
| RPT-02 | Generated JSON contains method section | unit (mocked) | `cd backend && python -m pytest tests/test_report_generate.py::test_method_section -x` | No -- Wave 0 |
| RPT-04 | Generated discussion references actual parameter values | unit (mocked) | `cd backend && python -m pytest tests/test_report_generate.py::test_discussion_references_values -x` | No -- Wave 0 |
| RPT-05 | Generated conclusions section present | unit (mocked) | `cd backend && python -m pytest tests/test_report_generate.py::test_conclusions_section -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_report_generate.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_report_generate.py` -- covers CTX-02, CTX-03, RPT-01, RPT-02, RPT-04, RPT-05 (mock OpenAI responses)
- [ ] `backend/tests/conftest.py` -- shared Flask test client fixture (if not already present)

**Note on testing AI endpoints:** Tests MUST mock OpenAI calls. Use `unittest.mock.patch` to replace `client.chat.completions.create` with canned JSON responses. This tests endpoint logic, JSON parsing, and error handling without hitting the API. Pattern already established -- the existing test file `backend/tests/test_safe_eval.py` shows pytest is already used.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** React + Flask, no framework migration
- **AI provider:** OpenAI for AutoLab/report function-calling (Gemini only for sidebar chat)
- **Deployment:** Railway via nixpacks
- **Budget:** Minimize unnecessary OpenAI API calls -- rate limit AI endpoints
- **Environment variables:** `OPENAI_API_KEY` via Railway or local env vars, never hardcoded
- **Formatting:** Physics equations returned in LaTeX (inline `$...$` or display `$$...$$`). KaTeX-compatible.
- **Error handling:** Always `try/except`, return `{"error": "message"}` with 400/500 status
- **API pattern:** `POST /api/{module}/{action}`, all calls in `frontend/src/services/api.ts`
- **Blueprint pattern:** `{module}_bp` naming, registered in `backend/app.py`
- **No CSS framework:** All styling via `global.css` and inline styles
- **Naming:** React PascalCase, Python snake_case, Flask blueprint `{module}_bp`
- **GSD workflow:** Use GSD commands for all file-changing operations

## Sources

### Primary (HIGH confidence)
- `backend/api/autolab.py` -- OpenAI integration pattern, system prompt structure, `_build_chat_system()`, `client.chat.completions.create()` usage
- `backend/api/report.py` -- Existing report blueprint with `/test-pdf` and `/upload-instructions` endpoints
- `frontend/src/components/ReportBeta.tsx` -- Current report page UI (Phase 9 output)
- `frontend/src/types/report.ts` -- `ReportAnalysisData` interface defining the data contract
- `frontend/src/services/api.ts` -- API layer patterns
- `frontend/src/context/AnalysisContext.tsx` -- `autolabResults` state slot
- OpenAI SDK v2.29.0 installed in project `.venv`
- OpenAI Structured Outputs documentation -- https://developers.openai.com/api/docs/guides/structured-outputs

### Secondary (MEDIUM confidence)
- OpenAI model pricing and capabilities (gpt-4o-mini vs gpt-4o) -- based on current docs
- KaTeX supported functions list -- based on KaTeX documentation

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in the project
- Architecture: HIGH -- follows established patterns from autolab.py with simpler flow
- Pitfalls: MEDIUM -- LaTeX/KaTeX compatibility and Hebrew RTL concerns are based on Phase 8 experience but not fully validated for AI-generated content
- Code examples: HIGH -- derived directly from existing codebase patterns

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- no rapidly moving dependencies)
