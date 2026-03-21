# Tau-LY Agent Guide

Welcome, Agent. This document exists to orient you to the **Tau-LY website** project. Please read this briefly to understand the boundaries, tech stack, and goals before starting tasks.

## 🎯 Overall Goal
Tau-LY is a web application designed for physics and engineering lab work automation. Its goal is "ultimate automation" for students and researchers. It provides a suite of tools for data analysis, formula calculations, numerical solvers, and an AI-driven "AutoLab" that orchestrates workflows automatically from plain language instructions.

## 🛠 Tech Stack
- **Frontend**: React, Vite, TypeScript, Plotly.js for interactive rendering.
- **Backend**: Python, Flask. 
- **Math/Physics Libraries**: SymPy, NumPy, Pandas, SciPy.
- **AI Integration**: OpenAI (GPT models) used for the chat sidebar (`chat_agent.py`) and the AutoLab orchestrator (`autolab.py`).

## 📂 Project Structure Tips
Do not over-read files into context unless necessary. Use `grep_search` or `find_by_name` to locate specific components.
- `/frontend/src/components/`: Contains all React UI views (e.g., `AutoLab.tsx`, `GraphFitting.tsx`, `ODESolver.tsx`).
- `/frontend/src/context/`: Contains React context providers (e.g., `AnalysisContext.tsx`).
- `/frontend/src/services/api.ts`: All outgoing fetch requests to the backend.
- `/backend/app.py`: The main Flask entry point. Registers standard blueprints.
- `/backend/api/`: Contains Flask blueprints grouping backend logic (`autolab.py`, `fitting.py`, `ode.py`, `assistant.py`, etc.).
- `/backend/utils/`: Shared numerical methods (`calculations.py`).
- `/app/chat_agent.py`: Houses the `ChatAgent` class that handles OpenAI interactions and system prompts.

## 🤖 AI Components Structure
If you are tasked with AI behavior changes:
1. **AutoLab** (`backend/api/autolab.py`): Uses OpenAI Tool Calling to chain backend functions (`parse_file`, `fit_data`, etc.). Evaluates and reports end-to-end physics results.
2. **Chat Assistant** (`backend/api/assistant.py` & `app/chat_agent.py`): A continuous sidebar chat available to users. The agent context there needs to be aware of what page the user is on.

## 🚨 Critical Rules for Agents
- **Local environment execution**: The project runs locally via `start.sh` or `nixpacks` during deployment (to Railway). If testing changes, `cd frontend && npm run build` followed by running `backend/app.py` is the usual standard. Do not run random commands unless the user requests debugging.
- **Do not commit/push to Git**: UNLESS the user explicitly asks for it in the current prompt. Do not blindly push code just because it was done in the past.
- **Environment Variables**: API keys (`OPENAI_API_KEY`) are managed via Railway or local env vars. Do not hardcode them.
- **Formatting**: Physics equations must be returned by AI in LaTeX (inline `$\sigma$` or display `$$...$$`). Calculator-ready scripts should be in SymPy syntax.

Use this knowledge to search what you need and avoid blindly reading large files. Good luck!

---

## 🔬 AutoLab Architecture (updated 2026-03)

AutoLab (`frontend/src/components/AutoLab.tsx` + `backend/api/autolab.py`) is the primary feature.

### Flow
User uploads file + types instructions → `POST /api/autolab/run` → OpenAI function-calling orchestrator runs tools in sequence:
1. `parse_file` — reads Excel/CSV, extracts x/y/err columns
2. `fit_data` — curve fit via scipy (linear/quadratic/cubic/power/exponential/sinusoidal/custom)
3. `evaluate_formula` — optional formula with uncertainty propagation
4. `compare_nsigma` — optional comparison to theoretical value
5. `generate_summary` — AI writes a 3–5 sentence summary (returned as final text)

Response shape: `{ steps: StepResult[], state: { parsed, fit, formula, nsigma }, fit_data: {...} }`

### Post-Analysis Chat
After analysis, an inline chat panel appears. It calls `POST /api/autolab/chat` with:
- `messages`: `[{role, content}]` conversation history
- `context`: `{ fit: {model_name, parameter_names, parameters, uncertainties, ...}, formula, nsigma }`

The chat backend builds a system prompt from the context and calls OpenAI.

### Rounding Convention
`roundWithUncertainty(value, uncertainty)` in `frontend/src/utils/format.ts`:
- Rounds uncertainty to 2 significant figures
- Rounds value to the same number of decimal places
- Returns `{ rounded: "100.15 ± 0.14", unrounded: "100.1543 ± 0.1412" }`
- Both are shown in the parameter table

### Results Layout
Results appear **below** the input section (never side-by-side). Structure:
1. Single green "✅ Analysis Summary" box (AI-generated text)
2. Parameter table (rounded + full precision columns, plus χ²/dof, P, R²)
3. Formula calculation section (if applicable)
4. N-sigma comparison (color-coded: green ≤ 2σ, orange 2–3σ, red > 3σ)
5. Fit plot + Residuals plot (residuals include error bars)
6. Inline AI chat panel

### Example Datasets (in AutoLab.tsx EXAMPLE_DATASETS)
- **Hooke's Law**: linear fit, compare k to 50 ± 2 N/m
- **Oscillation**: sinusoidal fit, calculate period T = 2π/ω, compare to 2.51 ± 0.10 s
- **Free Fall**: quadratic fit, extract g = 2a, compare to 9.81 ± 0.01 m/s²
  - Instructions intentionally omit the explicit formula — AI derives it from context

### AI System Prompt Key Points (SYSTEM_PROMPT in autolab.py)
- Rules 8–9 teach the AI custom functions: sinc, Gaussian, Lorentzian, damped oscillation
- Rule 9: AI knows to evaluate `2*a` for free-fall quadratic, `2*pi/omega` for period, etc.
- File uploads up to 50 MB are accepted (`app.config['MAX_CONTENT_LENGTH']` in `backend/app.py`)

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Tau-LY**

Tau-LY is a web application for physics and engineering lab work automation. It provides a suite of analysis tools — curve fitting, ODE solving, integration, formula evaluation, unit conversion, matrix operations, Fourier analysis, and an AI-driven "AutoLab" that orchestrates full analysis workflows from plain language instructions. Built for students and researchers who want to go from raw data to results with minimal friction.

**Core Value:** AutoLab: upload a data file, describe what you want in plain language, and get a complete physics analysis (fit, parameters, uncertainties, comparison to theory) — no manual tool selection required.

### Constraints

- **Tech stack**: Must stay React + Flask — no framework migration
- **AI provider**: OpenAI for AutoLab function-calling (Gemini supported only for sidebar chat)
- **Deployment**: Railway via nixpacks — no Docker migration
- **Budget**: Minimize unnecessary OpenAI API calls — rate limit AI endpoints
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Frontend
- React ^19.2.0 — UI component library
- TypeScript ~5.9.3 — compiled to ES2022, strict mode enabled
- Vite ^7.3.1 — dev server and build tool (ESNext modules)
- Vite ^7.3.1 with `@vitejs/plugin-react` ^5.1.1
- Build command: `tsc -b && vite build`
- Output: `frontend/dist/` (served statically by Flask in production)
- Dev proxy: `/api` → `http://localhost:5000` (configured in `frontend/vite.config.ts`)
- `react-router-dom` ^7.6.0 — client-side routing
- `plotly.js-dist-min` ^3.4.0 — interactive charts and plots
- `react-plotly.js` ^2.6.0 — React wrapper for Plotly
- `axios` ^1.7.0 — HTTP client for all backend API calls (configured in `frontend/src/services/api.ts`)
- `katex` ^0.16.0 — LaTeX math rendering in the chat UI
- `papaparse` ^5.5.3 — CSV parsing in the browser
- `xlsx` ^0.18.5 — Excel file reading in the browser
- Config: `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- Target: ES2022, DOM libs
- Strict: true, noUnusedLocals: true, noUnusedParameters: true, noEmit: true (Vite handles emit)
- moduleResolution: bundler
- `eslint` ^9.39.1 with `typescript-eslint` ^8.48.0
- `eslint-plugin-react-hooks` ^7.0.1
- `eslint-plugin-react-refresh` ^0.4.24
- Package manager: npm (lockfile: `frontend/package-lock.json`), install uses `--legacy-peer-deps`
## Backend
- Python 3 (exact version determined by nixpacks: `python3` from nixpkgs, Node.js 23 also provisioned)
- Virtual environment: `.venv/` at project root
- Flask >=3.0.0 — main web server (`backend/app.py`)
- flask-cors >=4.0.0 — CORS for `http://localhost:5173` and `http://localhost:3000` during dev
- `numpy` >=1.24.0 — numerical arrays and math
- `pandas` >=2.0.0 — data parsing (CSV, Excel, ODS, TSV)
- `scipy` >=1.10.0 — curve fitting (`optimize.curve_fit`), statistics (`stats.chi2`), ODE solving, integration
- `sympy` >=1.12 — symbolic math, uncertainty propagation, custom fit expression parsing
- `openai` >=1.40.0 — GPT models for AutoLab orchestration and chat assistant
- `google-genai` >=1.0.0 — Gemini models (alternative chat provider)
- `openpyxl` >=3.1.0 — Excel `.xlsx` read/write support for pandas
- Entry point: `backend/app.py` — Flask app factory, blueprint registration, static file serving
- Blueprints: `backend/api/` (formula, nsigma, fitting, units, matrix, ode, integrate, assistant, fourier, autolab)
- Shared utilities: `backend/utils/calculations.py`
- Chat agent: `app/chat_agent.py` (supports OpenAI and Gemini via `CHAT_PROVIDER` env var)
## Infrastructure / Deployment
- Run `./start.sh` from project root
- Starts Flask on `http://localhost:5000` and Vite dev server on `http://localhost:5173`
- Python venv set up automatically in `.venv/`
- Frontend proxies `/api/*` to Flask via Vite proxy config
- Railway (cloud platform)
- Deployment config: `nixpacks.toml` at project root
- Nixpacks provisions: `python3`, `nodejs_23`
- Install phase: creates `.venv`, pip installs `requirements.txt`, npm installs frontend
- Build phase: `cd frontend && npm run build`
- Start command: `. .venv/bin/activate && cd backend && python app.py`
- Port: reads `PORT` env var (defaults to 5000) in `backend/app.py`
- `OPENAI_API_KEY` — required for AutoLab (`backend/api/autolab.py`) and chat assistant when `CHAT_PROVIDER=openai`
- `GEMINI_API_KEY` — required when `CHAT_PROVIDER=gemini`
- `CHAT_PROVIDER` — `"openai"` (default) or `"gemini"` — selects AI provider for sidebar chat (`app/chat_agent.py`)
- `OPENAI_MODEL` — optional, overrides model for both AutoLab (default: `gpt-4o-mini`) and chat (default: `gpt-5-mini-2025-08-07`)
- `GEMINI_MODEL` — optional, overrides Gemini model (default: `gemini-2.0-flash`)
- `SYSTEM_PROMPT` — optional, overrides chat agent system prompt
- `PORT` — optional, Flask listen port (default: 5000)
- `.dockerignore` present — excludes `.venv/`, `__pycache__/`, `.env`, `node_modules/`, `.git/`
- No `Dockerfile` present; Railway uses nixpacks for builds
## Data Storage
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Conventions
- **React components**: PascalCase filenames and function names (e.g., `AutoLab.tsx`, `GraphFitting.tsx`)
- **Python constants**: SCREAMING_SNAKE_CASE (e.g., `SYSTEM_PROMPT`, `MAX_CONTENT_LENGTH`)
- **Flask blueprints**: `{module}_bp` naming pattern (e.g., `autolab_bp`, `fitting_bp`)
- **Python functions/variables**: snake_case throughout
- **TypeScript variables/functions**: camelCase
## TypeScript Patterns
- Strict mode enabled via `tsconfig.app.json`
- `AnalysisContext.tsx` uses `any` type extensively — not a pattern to follow
- Interface/type definitions co-located with components rather than in a dedicated `types/` folder
- No external state management library (Redux, Zustand, etc.)
## React Patterns
- All components are function components (no class components)
- Hooks used: `useState`, `useEffect`, `useRef`, `useContext`
- Global state shared via `AnalysisContext.tsx` (React Context API)
- No component library — all UI is custom with `global.css`
## Python Patterns
- Flask blueprint structure: each feature area gets its own blueprint in `backend/api/`
- Error handling: always wrapped in `try/except`, returns `{"error": "message"}` with 400/500 status
- Success responses include `"error": null` field alongside data
- Blueprints registered in `backend/app.py` with URL prefix `/api/{module}`
## API Conventions
- Endpoint pattern: `/api/{module}/{action}` (e.g., `/api/autolab/run`, `/api/fitting/fit`)
- File uploads: `multipart/form-data` POST
- Data payloads: `application/json` POST
- Response shape: `{ data: ..., error: null }` on success; `{ error: "message" }` on failure
- All API calls centralized in `frontend/src/services/api.ts`
## Styling
- Single `global.css` file for all styles (no CSS modules, no styled-components)
- CSS custom properties (design tokens) used for colors and spacing
- Mix of inline styles and class-based styles across components
- No utility-first CSS framework (no Tailwind)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- React SPA frontend served as static files by Flask in production
- Flask backend exposes a JSON REST API organised into Blueprints, one per feature domain
- Two separate AI subsystems: an always-available sidebar Chat Agent (`app/chat_agent.py`) and an AutoLab orchestrator (`backend/api/autolab.py`) that uses OpenAI function-calling to chain internal tool functions
- Shared computation utilities live in `backend/utils/calculations.py` and are imported directly by multiple blueprints (not called over HTTP)
- React Context (`frontend/src/context/AnalysisContext.tsx`) carries cross-page state (current tool, last result, AutoLab results)
## Layers
- Purpose: Render pages, collect user input, display results
- Location: `frontend/src/components/`
- Contains: One `.tsx` file per tool page plus shared `Sidebar.tsx`, `PlotWrapper.tsx`, `DataPreview.tsx`
- Depends on: `frontend/src/services/api.ts`, `frontend/src/context/AnalysisContext.tsx`, `frontend/src/utils/`
- Used by: End users via browser
- Purpose: Centralise all outbound HTTP calls to the backend
- Location: `frontend/src/services/api.ts`
- Contains: Typed async functions using Axios, one per API operation
- Depends on: Axios, environment's `/api` base path
- Used by: All component files
- Purpose: Share transient state across unrelated component trees without prop drilling
- Location: `frontend/src/context/AnalysisContext.tsx`
- Contains: `AnalysisProvider`, `useAnalysis` hook; tracks `currentTool`, `currentData`, `lastResult`, `analysisHistory`, `uploadedFileInfo`, `autolabResults`
- Depends on: React
- Used by: `Sidebar.tsx`, `AutoLab.tsx`, any component that needs cross-page awareness
- Purpose: Reusable formatting and LaTeX helpers
- Location: `frontend/src/utils/`
- Contains: `format.ts` (number formatting, uncertainty rounding), `latex.ts` (LaTeX rendering helper)
- Depends on: Nothing external
- Used by: Component files and `Sidebar.tsx`
- Purpose: Accept HTTP requests, validate inputs, delegate to computation layer, return JSON
- Location: `backend/api/`
- Contains: `autolab.py`, `fitting.py`, `formula.py`, `fourier.py`, `integrate.py`, `matrix.py`, `nsigma.py`, `ode.py`, `units.py`, `assistant.py`
- Depends on: `backend/utils/calculations.py`, SciPy/NumPy/SymPy/Pandas, OpenAI SDK
- Used by: Frontend service layer (via HTTP)
- Purpose: Shared numerical/mathematical functions used by multiple blueprints
- Location: `backend/utils/calculations.py`
- Contains: `propagate_uncertainty_independent`, `scientific_round`, `n_sigma`, `convert_units`, `latex_to_sympy`, `parse_num_expr`, `UNIT_CATEGORIES`
- Depends on: SymPy, NumPy, Python standard library
- Used by: `api/autolab.py`, `api/formula.py`, `api/nsigma.py`, `api/units.py`
- Purpose: General-purpose conversational assistant available on every page
- Location: `app/chat_agent.py` (class), `backend/api/assistant.py` (Flask endpoint), `app/system_prompt.md` (prompt)
- Contains: `ChatAgent` class with provider-switching (OpenAI / Gemini), retry logic, context injection
- Depends on: `OPENAI_API_KEY` or `GEMINI_API_KEY` env var, `CHAT_PROVIDER` env var
- Used by: `Sidebar.tsx` via `POST /api/assistant/chat`
- Purpose: Execute end-to-end physics analysis from a file + free-text instruction using OpenAI function-calling
- Location: `backend/api/autolab.py`
- Contains: Tool functions (`tool_parse_file`, `tool_fit_data`, `tool_evaluate_formula`, `tool_compare_nsigma`), orchestrator loop (`_run_orchestrator`), post-analysis chat endpoint
- Depends on: OpenAI SDK (gpt-4o-mini by default), `OPENAI_MODEL` env var, `backend/utils/calculations.py`
- Used by: `AutoLab.tsx` via `POST /api/autolab/run` and `POST /api/autolab/chat`
## Data Flow
- Component-local `useState` handles all UI state (inputs, loading flags, local results)
- `AnalysisContext` (React Context) carries cross-component state: `currentTool`, `lastResult`, `autolabResults`, `analysisHistory`, `uploadedFileInfo`
- No Redux or Zustand; no persistent client-side storage (no localStorage/sessionStorage)
- Server is stateless: all analysis state is recomputed on each request
## Key Abstractions
- Purpose: Group related API routes under a URL prefix
- Examples: `backend/api/fitting.py` (`fitting_bp`, `/api/fitting`), `backend/api/autolab.py` (`autolab_bp`, `/api/autolab`)
- Pattern: Each file defines `blueprint_name = Blueprint(...)` and exports it; `backend/app.py` registers all blueprints
- Purpose: Pure Python functions that perform one analysis step; called directly (not over HTTP) by the orchestrator
- Examples: `tool_parse_file`, `tool_fit_data`, `tool_evaluate_formula`, `tool_compare_nsigma` in `backend/api/autolab.py`
- Pattern: Accept typed arguments, return dict with either a result payload or `{ "error": "..." }`; sanitised before being sent to OpenAI conversation
- Purpose: Provider-agnostic AI client wrapper with retry logic and system-prompt management
- Examples: `app/chat_agent.py`
- Pattern: Instantiated once at module load in `backend/api/assistant.py`; exposes `ask(messages, extra_context)` method
- Purpose: React context giving any component read/write access to shared session state
- Examples: `frontend/src/context/AnalysisContext.tsx`
- Pattern: Wrap entire tree in `<AnalysisProvider>`; consume via `useAnalysis()` hook
## Entry Points
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads `index.html`; Vite bundles to `frontend/dist/`
- Responsibilities: Mount `<App />` inside `React.StrictMode`
- Location: `frontend/src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Wrap tree in `<AnalysisProvider>` and `<Router>`; render persistent header/nav/footer; declare all `<Route>` mappings; render persistent `<Sidebar />`
- Location: `backend/app.py`
- Triggers: `python backend/app.py` (dev) or nixpacks/Railway (production)
- Responsibilities: Create Flask app via `create_app()`; register all blueprints; configure CORS; serve `frontend/dist` as static SPA fallback; set 50 MB upload limit
## Error Handling
- Each blueprint `try/except` block returns `jsonify({"error": str(e)}), 500`
- AutoLab tool functions return `{"error": "..."}` dicts; the orchestrator logs them as failed steps but continues
- `_sanitize_float` / `_sanitize_dict` in `backend/api/autolab.py` convert `Infinity`/`NaN` floats to `None` before serialising to JSON
- Flask app-level handlers for 404, 413 (file too large), 500 registered in `backend/app.py`
- Frontend: Axios errors are caught in component `catch` blocks; error strings rendered inline
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
