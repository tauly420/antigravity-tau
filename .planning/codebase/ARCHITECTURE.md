# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Client-Server SPA with AI Orchestration layer

**Key Characteristics:**
- React SPA frontend served as static files by Flask in production
- Flask backend exposes a JSON REST API organised into Blueprints, one per feature domain
- Two separate AI subsystems: an always-available sidebar Chat Agent (`app/chat_agent.py`) and an AutoLab orchestrator (`backend/api/autolab.py`) that uses OpenAI function-calling to chain internal tool functions
- Shared computation utilities live in `backend/utils/calculations.py` and are imported directly by multiple blueprints (not called over HTTP)
- React Context (`frontend/src/context/AnalysisContext.tsx`) carries cross-page state (current tool, last result, AutoLab results)

## Layers

**Frontend UI Layer:**
- Purpose: Render pages, collect user input, display results
- Location: `frontend/src/components/`
- Contains: One `.tsx` file per tool page plus shared `Sidebar.tsx`, `PlotWrapper.tsx`, `DataPreview.tsx`
- Depends on: `frontend/src/services/api.ts`, `frontend/src/context/AnalysisContext.tsx`, `frontend/src/utils/`
- Used by: End users via browser

**Frontend Service Layer:**
- Purpose: Centralise all outbound HTTP calls to the backend
- Location: `frontend/src/services/api.ts`
- Contains: Typed async functions using Axios, one per API operation
- Depends on: Axios, environment's `/api` base path
- Used by: All component files

**Frontend Context Layer:**
- Purpose: Share transient state across unrelated component trees without prop drilling
- Location: `frontend/src/context/AnalysisContext.tsx`
- Contains: `AnalysisProvider`, `useAnalysis` hook; tracks `currentTool`, `currentData`, `lastResult`, `analysisHistory`, `uploadedFileInfo`, `autolabResults`
- Depends on: React
- Used by: `Sidebar.tsx`, `AutoLab.tsx`, any component that needs cross-page awareness

**Frontend Utility Layer:**
- Purpose: Reusable formatting and LaTeX helpers
- Location: `frontend/src/utils/`
- Contains: `format.ts` (number formatting, uncertainty rounding), `latex.ts` (LaTeX rendering helper)
- Depends on: Nothing external
- Used by: Component files and `Sidebar.tsx`

**Backend API Layer (Flask Blueprints):**
- Purpose: Accept HTTP requests, validate inputs, delegate to computation layer, return JSON
- Location: `backend/api/`
- Contains: `autolab.py`, `fitting.py`, `formula.py`, `fourier.py`, `integrate.py`, `matrix.py`, `nsigma.py`, `ode.py`, `units.py`, `assistant.py`
- Depends on: `backend/utils/calculations.py`, SciPy/NumPy/SymPy/Pandas, OpenAI SDK
- Used by: Frontend service layer (via HTTP)

**Backend Computation Utilities:**
- Purpose: Shared numerical/mathematical functions used by multiple blueprints
- Location: `backend/utils/calculations.py`
- Contains: `propagate_uncertainty_independent`, `scientific_round`, `n_sigma`, `convert_units`, `latex_to_sympy`, `parse_num_expr`, `UNIT_CATEGORIES`
- Depends on: SymPy, NumPy, Python standard library
- Used by: `api/autolab.py`, `api/formula.py`, `api/nsigma.py`, `api/units.py`

**AI Chat Layer:**
- Purpose: General-purpose conversational assistant available on every page
- Location: `app/chat_agent.py` (class), `backend/api/assistant.py` (Flask endpoint), `app/system_prompt.md` (prompt)
- Contains: `ChatAgent` class with provider-switching (OpenAI / Gemini), retry logic, context injection
- Depends on: `OPENAI_API_KEY` or `GEMINI_API_KEY` env var, `CHAT_PROVIDER` env var
- Used by: `Sidebar.tsx` via `POST /api/assistant/chat`

**AI AutoLab Orchestration Layer:**
- Purpose: Execute end-to-end physics analysis from a file + free-text instruction using OpenAI function-calling
- Location: `backend/api/autolab.py`
- Contains: Tool functions (`tool_parse_file`, `tool_fit_data`, `tool_evaluate_formula`, `tool_compare_nsigma`), orchestrator loop (`_run_orchestrator`), post-analysis chat endpoint
- Depends on: OpenAI SDK (gpt-4o-mini by default), `OPENAI_MODEL` env var, `backend/utils/calculations.py`
- Used by: `AutoLab.tsx` via `POST /api/autolab/run` and `POST /api/autolab/chat`

## Data Flow

**Standard Tool Request (e.g. Formula Calculator):**

1. User fills form in `frontend/src/components/FormulaCalculator.tsx`
2. Component calls typed function from `frontend/src/services/api.ts` (e.g. `evaluateFormula`)
3. Axios sends `POST /api/formula/evaluate` to Flask
4. `backend/api/formula.py` validates input, calls `propagate_uncertainty_independent` from `backend/utils/calculations.py`
5. Blueprint returns JSON `{ value, uncertainty, formatted, ... }`
6. Component renders result; stores it in `AnalysisContext` via `setLastResult`

**AutoLab Full-Analysis Flow:**

1. User uploads file + types natural language instructions in `frontend/src/components/AutoLab.tsx`
2. Component posts multipart form to `POST /api/autolab/run`
3. `_run_orchestrator` in `backend/api/autolab.py` pre-scans column headers, sends system prompt + user message to OpenAI with tool schema
4. OpenAI returns tool_calls; orchestrator dispatches to local Python functions (`tool_parse_file` → `tool_fit_data` → `tool_evaluate_formula` → `tool_compare_nsigma` → `generate_summary`) in sequence over up to 10 turns
5. State object `{ parsed, fit, formula, nsigma }` accumulates results; each tool result is appended back to the OpenAI message list
6. Final AI text response (summary) is captured; full `{ steps, state, fit_data }` returned to frontend
7. `AutoLab.tsx` renders summary box, parameter table, plots (Plotly), and post-analysis chat panel

**Post-Analysis Chat Flow:**

1. User types in inline chat panel inside `AutoLab.tsx`
2. Component calls `autolabChat` from `frontend/src/services/api.ts`
3. `POST /api/autolab/chat` receives `{ messages, context: { fit, formula, nsigma } }`
4. `_build_chat_system` constructs a system prompt injecting all analysis context
5. Single OpenAI call; reply returned as `{ reply: string }`

**Sidebar Chat Flow:**

1. User types in `frontend/src/components/Sidebar.tsx`
2. `chatWithAssistant` in `frontend/src/services/api.ts` posts `{ message, context: { currentTool, lastResult, ... } }`
3. `POST /api/assistant/chat` delegates to `ChatAgent.ask()` in `app/chat_agent.py`
4. `ChatAgent` prepends system prompt, injects context as a second system message, calls OpenAI or Gemini
5. Reply string returned to `Sidebar.tsx` for rendering (with LaTeX via `renderLatex` from `frontend/src/utils/latex.ts`)

**State Management:**

- Component-local `useState` handles all UI state (inputs, loading flags, local results)
- `AnalysisContext` (React Context) carries cross-component state: `currentTool`, `lastResult`, `autolabResults`, `analysisHistory`, `uploadedFileInfo`
- No Redux or Zustand; no persistent client-side storage (no localStorage/sessionStorage)
- Server is stateless: all analysis state is recomputed on each request

## Key Abstractions

**Flask Blueprint:**
- Purpose: Group related API routes under a URL prefix
- Examples: `backend/api/fitting.py` (`fitting_bp`, `/api/fitting`), `backend/api/autolab.py` (`autolab_bp`, `/api/autolab`)
- Pattern: Each file defines `blueprint_name = Blueprint(...)` and exports it; `backend/app.py` registers all blueprints

**Tool Function (AutoLab):**
- Purpose: Pure Python functions that perform one analysis step; called directly (not over HTTP) by the orchestrator
- Examples: `tool_parse_file`, `tool_fit_data`, `tool_evaluate_formula`, `tool_compare_nsigma` in `backend/api/autolab.py`
- Pattern: Accept typed arguments, return dict with either a result payload or `{ "error": "..." }`; sanitised before being sent to OpenAI conversation

**ChatAgent:**
- Purpose: Provider-agnostic AI client wrapper with retry logic and system-prompt management
- Examples: `app/chat_agent.py`
- Pattern: Instantiated once at module load in `backend/api/assistant.py`; exposes `ask(messages, extra_context)` method

**AnalysisContext:**
- Purpose: React context giving any component read/write access to shared session state
- Examples: `frontend/src/context/AnalysisContext.tsx`
- Pattern: Wrap entire tree in `<AnalysisProvider>`; consume via `useAnalysis()` hook

## Entry Points

**Frontend SPA:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`; Vite bundles to `frontend/dist/`
- Responsibilities: Mount `<App />` inside `React.StrictMode`

**Frontend App Shell:**
- Location: `frontend/src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Wrap tree in `<AnalysisProvider>` and `<Router>`; render persistent header/nav/footer; declare all `<Route>` mappings; render persistent `<Sidebar />`

**Backend Flask Application:**
- Location: `backend/app.py`
- Triggers: `python backend/app.py` (dev) or nixpacks/Railway (production)
- Responsibilities: Create Flask app via `create_app()`; register all blueprints; configure CORS; serve `frontend/dist` as static SPA fallback; set 50 MB upload limit

## Error Handling

**Strategy:** Errors are caught at the blueprint handler level and returned as JSON `{ "error": "..." }` with an appropriate HTTP status code. Frontend components display the error string to the user.

**Patterns:**
- Each blueprint `try/except` block returns `jsonify({"error": str(e)}), 500`
- AutoLab tool functions return `{"error": "..."}` dicts; the orchestrator logs them as failed steps but continues
- `_sanitize_float` / `_sanitize_dict` in `backend/api/autolab.py` convert `Infinity`/`NaN` floats to `None` before serialising to JSON
- Flask app-level handlers for 404, 413 (file too large), 500 registered in `backend/app.py`
- Frontend: Axios errors are caught in component `catch` blocks; error strings rendered inline

## Cross-Cutting Concerns

**Logging:** `print(...)` statements in backend blueprints (no structured logging framework). AutoLab logs tool execution steps implicitly through the `steps` return value.

**Validation:** Performed inside each blueprint handler (check for required form fields/JSON keys; return 400 with error message). No shared validation middleware.

**Authentication:** None. The application has no user accounts or auth layer.

**CORS:** Configured in `backend/app.py` via `flask-cors`; allows `http://localhost:5173` and `http://localhost:3000` for `/api/*` routes. Production serves frontend as static files from the same Flask process, so CORS is only relevant in development.

**LaTeX Rendering:** Physics formulas in the Chat sidebar are rendered client-side using `frontend/src/utils/latex.ts`. The AutoLab AI is explicitly instructed to use Unicode symbols (±, χ², σ) rather than LaTeX backslash notation in its summaries, to avoid rendering conflicts in the results panel.

---

*Architecture analysis: 2026-03-20*
