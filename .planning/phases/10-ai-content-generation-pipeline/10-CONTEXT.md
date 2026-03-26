# Phase 10: AI Content Generation Pipeline - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

AI generates all report sections (theoretical background, measurement method, discussion, conclusions) from experiment context and AutoLab analysis results. This phase builds the backend AI pipeline and the context form UI on the /report page. It does NOT include report preview, section editing, or PDF rendering -- those are Phase 11.

</domain>

<decisions>
## Implementation Decisions

### AI Generation Language
- **D-01:** User chooses report language per report via a toggle on the context form (Hebrew or English). Default is Hebrew.
- **D-02:** System prompt is always written in English regardless of output language. A directive like "Write all prose in Hebrew" controls the output language. GPT models follow English instructions more reliably.
- **D-03:** LaTeX equations are always in English/Latin notation inline within the prose, regardless of body language. This follows the Israeli academic standard established in Phase 8 (D-06).

### Context Form Design
- **D-04:** Context form and instruction file upload are complementary -- both coexist on the same page (ReportBeta.tsx). Neither is required; user can use either or both. AI merges all available inputs.
- **D-05:** Context form has minimal fields: title, subject area (e.g. mechanics, optics), equipment used, and a free-text notes field. AI infers the rest from instruction file and AutoLab results.
- **D-06:** Context form appears on the same page as the file upload, below the upload zone. Single scrollable page, no step navigation. Consistent with AutoLab's single-page approach.

### Gap-Filling Interaction
- **D-07:** After user clicks "Generate", AI analyzes available inputs and returns 1-3 follow-up questions displayed inline on the report page (like a mini form). User answers, then generation proceeds. No modal, no chat.
- **D-08:** Users can skip follow-up questions via a "Generate anyway" button. AI proceeds with assumptions and warns which context was missing in the output. Skippable but not silent.

### Section Content Depth
- **D-09:** Target intro physics lab level (University Physics 1/2). Theory explains relevant laws without full derivations. Matches existing AutoLab examples (Hooke's Law, Free Fall, Oscillation).
- **D-10:** Theoretical background includes key formulas only by default, plus any formulas the user explicitly requests in their context/notes. Derivations are included only if the user specifically asks for them.
- **D-11:** All sections generated in a single API call, returned as structured JSON with per-section content. One loading state, one endpoint. Simpler and cheaper than per-section calls.

### Claude's Discretion
- AI model selection for generation (gpt-4o-mini vs gpt-4o -- balance cost vs quality)
- Exact system prompt wording and section generation instructions
- JSON response schema for generated sections
- Number and phrasing of follow-up questions (1-3 as specified in CTX-03)
- How to merge instruction file text + form fields + AutoLab results into the AI prompt
- Error handling when AI generation fails or returns malformed output

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements
- `.planning/REQUIREMENTS.md` -- CTX-02, CTX-03, RPT-01, RPT-02, RPT-04, RPT-05 requirement definitions
- `.planning/ROADMAP.md` -- Phase 10 success criteria (5 criteria)

### Phase 9 foundation (data contract)
- `.planning/phases/09-report-data-contract-and-file-parsing/09-CONTEXT.md` -- Decisions on ReportAnalysisData contract shape (D-06 through D-11), file upload flow (D-01 through D-05), report page evolution (D-12 through D-14)
- `frontend/src/components/ReportBeta.tsx` -- Current report page with instruction file upload UI (Phase 9 output)
- `backend/api/report.py` -- Report blueprint with test-pdf and file upload endpoints

### Phase 8 foundation (PDF rendering)
- `.planning/phases/08-pdf-infrastructure-spike/08-CONTEXT.md` -- Decisions on equation rendering (D-04 through D-07), Hebrew RTL + English math standard (D-06)
- `backend/utils/pdf_renderer.py` -- WeasyPrint + KaTeX rendering pipeline

### AutoLab AI patterns (reference implementation)
- `backend/api/autolab.py` -- OpenAI function-calling orchestrator pattern, SYSTEM_PROMPT structure, `_run_orchestrator()` flow, `_build_chat_system()` for context-aware prompts
- `app/chat_agent.py` -- ChatAgent class with provider switching and retry logic

### Data contract and utilities
- `frontend/src/context/AnalysisContext.tsx` -- `autolabResults` state slot for passing data to report page
- `frontend/src/utils/format.ts` -- `roundWithUncertainty()` for parameter display
- `frontend/src/services/api.ts` -- Centralized API layer; new generation endpoint goes here

### Codebase analysis
- `.planning/codebase/CONVENTIONS.md` -- Naming conventions, API patterns
- `.planning/codebase/STRUCTURE.md` -- Where to add new code

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/autolab.py` -- OpenAI integration pattern: system prompt + tool calling + structured JSON responses. Report generation can follow the same pattern (minus tool calling since no iterative orchestration needed).
- `backend/api/report.py` -- Existing report blueprint at `/api/report/*`. Add generation endpoint here.
- `app/chat_agent.py` -- ChatAgent with retry logic and provider switching. Could wrap report generation calls, or use OpenAI directly like autolab.py does.
- `frontend/src/components/ReportBeta.tsx` -- Phase 9 added file upload zone and extracted text textarea. Context form fields and generation UI extend this component.
- `frontend/src/context/AnalysisContext.tsx` -- `autolabResults` already passes AutoLab data cross-page. Report page reads this for analysis context.
- `frontend/src/services/api.ts` -- Add `generateReport()` and `askFollowUp()` API functions here.

### Established Patterns
- OpenAI calls: `from openai import OpenAI`, `client.chat.completions.create()` with system + user messages
- System prompts: long string constants (SYSTEM_PROMPT in autolab.py) with numbered rules
- JSON responses: `response_format={"type": "json_object"}` for structured output
- Flask error handling: `try/except` returning `jsonify({"error": str(e)}), 500`
- Frontend API: typed async functions in api.ts using Axios

### Integration Points
- `backend/api/report.py` -- Add `/api/report/generate` and `/api/report/follow-up` endpoints
- `frontend/src/components/ReportBeta.tsx` -- Add context form fields, generate button, follow-up questions UI, loading states
- `frontend/src/services/api.ts` -- Add generation and follow-up API functions
- `requirements.txt` -- OpenAI SDK already present; no new dependencies expected

</code_context>

<specifics>
## Specific Ideas

- Follow the autolab.py pattern for OpenAI integration but simpler -- no function-calling orchestrator, just a single completion call with a well-crafted system prompt and structured JSON output
- The system prompt should include the actual parameter values from AutoLab results so the AI can reference real numbers (e.g., "the measured spring constant was k = 49.8 +/- 0.5 N/m")
- Follow-up questions should feel lightweight -- like a short form, not a conversation. Display as input fields, not chat bubbles
- Language toggle should be a simple dropdown or radio button, not buried in settings

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 10-ai-content-generation-pipeline*
*Context gathered: 2026-03-26*
