# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
project-root/
├── backend/                  # Python/Flask backend
│   ├── app.py                # Flask application factory + entry point
│   ├── api/                  # Flask blueprints (one file per feature)
│   │   ├── autolab.py        # AutoLab AI orchestration + chat endpoints
│   │   ├── assistant.py      # General sidebar chat endpoint
│   │   ├── fitting.py        # File parsing + curve fitting
│   │   ├── formula.py        # Formula evaluation + uncertainty propagation
│   │   ├── fourier.py        # Fourier / DFT analysis
│   │   ├── integrate.py      # Numerical integration (1D–multi-D)
│   │   ├── matrix.py         # Matrix operations and linear algebra
│   │   ├── nsigma.py         # N-sigma comparison
│   │   ├── ode.py            # ODE solver
│   │   └── units.py          # Unit conversion
│   ├── utils/
│   │   └── calculations.py   # Shared math utilities (uncertainty, rounding, unit tables)
│   └── tests/                # Backend test directory (see TESTING.md)
├── frontend/                 # React/Vite/TypeScript frontend
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Root component: routing, layout, nav
│   │   ├── components/       # Page-level and shared UI components
│   │   │   ├── AutoLab.tsx
│   │   │   ├── ConstantsReference.tsx
│   │   │   ├── DataPreview.tsx
│   │   │   ├── FormulaCalculator.tsx
│   │   │   ├── FourierAnalysis.tsx
│   │   │   ├── GraphFitting.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── MatrixCalculator.tsx
│   │   │   ├── NSigmaCalculator.tsx
│   │   │   ├── NumericalIntegrator.tsx
│   │   │   ├── ODESolver.tsx
│   │   │   ├── PlotWrapper.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatisticsCalculator.tsx
│   │   │   ├── UnitConverter.tsx
│   │   │   └── Workflow.tsx
│   │   ├── context/
│   │   │   └── AnalysisContext.tsx   # React Context for cross-page state
│   │   ├── services/
│   │   │   └── api.ts                # All Axios calls to backend (single file)
│   │   ├── styles/
│   │   │   └── global.css            # Global CSS
│   │   └── utils/
│   │       ├── format.ts             # Number formatting, roundWithUncertainty
│   │       └── latex.ts              # LaTeX rendering helper
│   ├── public/               # Static assets (favicon, icons)
│   ├── dist/                 # Vite build output (served by Flask in production)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── app/                      # AI chat agent module
│   ├── chat_agent.py         # ChatAgent class (OpenAI / Gemini provider switching)
│   └── system_prompt.md      # System prompt loaded by ChatAgent at runtime
├── .planning/
│   └── codebase/             # GSD codebase analysis documents
├── requirements.txt          # Python dependencies
├── nixpacks.toml             # Railway deployment build config
├── start.sh                  # Local dev startup script
├── CLAUDE.md                 # Agent guide
└── README.md
```

## Directory Purposes

**`backend/api/`:**
- Purpose: Flask Blueprint modules, one per feature domain
- Contains: Route handlers, request/response logic, inline scipy/sympy computation for simpler endpoints
- Key files: `autolab.py` (most complex — AI orchestration, ~880 lines), `fitting.py` (file parsing + curve fitting)

**`backend/utils/`:**
- Purpose: Shared computation functions imported by multiple blueprints
- Contains: `calculations.py` — uncertainty propagation (`propagate_uncertainty_independent`), scientific rounding (`scientific_round`), n-sigma (`n_sigma`), unit tables (`UNIT_CATEGORIES`, `convert_units`), LaTeX-to-SymPy conversion (`latex_to_sympy`)
- Key files: `calculations.py`

**`backend/tests/`:**
- Purpose: Backend test suite
- Contains: Test files for backend logic
- Key files: Check this directory for test coverage

**`frontend/src/components/`:**
- Purpose: All React UI pages and shared display components
- Contains: One `.tsx` per tool route, plus `Sidebar.tsx` (persistent AI chat), `PlotWrapper.tsx` (Plotly wrapper), `DataPreview.tsx` (file data table)
- Key files: `AutoLab.tsx` (largest component — full analysis pipeline UI), `GraphFitting.tsx`, `Workflow.tsx`

**`frontend/src/services/`:**
- Purpose: Single module for all backend communication
- Contains: `api.ts` — one exported async function per API endpoint, typed with TypeScript interfaces, all using the Axios instance configured with base URL `/api`
- Key files: `api.ts`

**`frontend/src/context/`:**
- Purpose: React Context for sharing state across unrelated page components
- Contains: `AnalysisContext.tsx` — `AnalysisProvider`, `useAnalysis` hook, six shared state slots
- Key files: `AnalysisContext.tsx`

**`frontend/src/utils/`:**
- Purpose: Pure frontend utility functions
- Contains: `format.ts` (number display logic, `roundWithUncertainty`, `smartFormat`, `formatPValue`), `latex.ts` (LaTeX string rendering for Sidebar chat)
- Key files: `format.ts`

**`app/`:**
- Purpose: AI chat agent module loaded by `backend/api/assistant.py`
- Contains: `chat_agent.py` (provider-switching `ChatAgent` class), `system_prompt.md` (loaded at runtime)
- Key files: `chat_agent.py`

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run build`)
- Committed: No (in `.gitignore`)

## Key File Locations

**Entry Points:**
- `backend/app.py`: Flask app factory, blueprint registration, static file serving, error handlers
- `frontend/src/main.tsx`: React DOM mount
- `frontend/src/App.tsx`: Router, layout shell, all route declarations

**Configuration:**
- `requirements.txt`: Python package dependencies
- `frontend/package.json`: Node.js dependencies and scripts
- `frontend/vite.config.ts`: Vite build configuration
- `frontend/tsconfig.json`: TypeScript compiler settings
- `nixpacks.toml`: Railway deployment build commands

**Core Logic:**
- `backend/utils/calculations.py`: All shared numerical methods
- `backend/api/autolab.py`: AutoLab orchestration, tool functions, system prompt constant `SYSTEM_PROMPT`
- `app/chat_agent.py`: `ChatAgent` class — the sidebar AI implementation
- `app/system_prompt.md`: System prompt text loaded by `ChatAgent` at startup
- `frontend/src/services/api.ts`: All typed HTTP calls to the backend

**AI Prompts:**
- `app/system_prompt.md`: General assistant system prompt (loaded from file)
- `backend/api/autolab.py` line 337: `SYSTEM_PROMPT` constant for AutoLab orchestration
- `backend/api/autolab.py` line 703: `_build_chat_system()` — dynamic prompt builder for post-analysis chat

**Testing:**
- `backend/tests/`: Backend test files

## Naming Conventions

**Files:**
- Frontend components: PascalCase `.tsx` matching the route name (e.g., `AutoLab.tsx`, `GraphFitting.tsx`)
- Frontend utilities: camelCase `.ts` (e.g., `format.ts`, `latex.ts`)
- Backend blueprints: snake_case `.py` matching the URL prefix (e.g., `fitting.py` → `/api/fitting`)
- Backend utilities: snake_case `.py`

**Directories:**
- Frontend source subdirectories: lowercase plural nouns (`components`, `services`, `context`, `utils`, `styles`)
- Backend subdirectories: lowercase nouns (`api`, `utils`, `tests`)

**Routes:**
- URL paths match the blueprint filename and the nav link label: `/api/fitting`, `/api/autolab`, `/api/formula`, etc.
- Frontend routes match the nav label in lowercase: `/autolab`, `/fitting`, `/formula`, `/matrix`, `/ode`, `/integrator`, `/nsigma`, `/units`, `/fourier`, `/statistics`, `/constants`, `/workflow`

## Where to Add New Code

**New Tool Page (full stack):**
1. Backend: create `backend/api/newtool.py` with a Blueprint `newtool_bp`; register it in `backend/app.py` with `url_prefix='/api/newtool'`
2. Frontend component: create `frontend/src/components/NewTool.tsx`
3. Frontend API: add typed function(s) to `frontend/src/services/api.ts`
4. Routing: add `<Route path="/newtool" element={<NewTool />} />` in `frontend/src/App.tsx`
5. Navigation: add `<Link to="/newtool">` in the `<nav>` section of `frontend/src/App.tsx`
6. Sidebar tip: add an entry to the `PAGE_TIPS` record in `frontend/src/components/Sidebar.tsx`

**New Shared Math Utility:**
- Add to `backend/utils/calculations.py`; import it in the relevant blueprint(s) with `from utils.calculations import ...`

**New Fit Model (AutoLab + GraphFitting):**
- AutoLab: add entry to the `models` dict in `tool_fit_data` in `backend/api/autolab.py`; update the `SYSTEM_PROMPT` model list if needed
- GraphFitting: add corresponding entry to the models dict in `backend/api/fitting.py`

**New Frontend Utility:**
- Add to `frontend/src/utils/format.ts` (number/text formatting) or `frontend/src/utils/latex.ts` (LaTeX helpers), or create a new `frontend/src/utils/name.ts` file

**New Cross-Page State Slot:**
- Add state variable + setter to `AnalysisContext.tsx` (`AnalysisContextType` interface, `AnalysisProvider` body, and the `value` prop)

## Special Directories

**`frontend/dist/`:**
- Purpose: Production-built React SPA (HTML, JS, CSS bundles)
- Generated: Yes, by `cd frontend && npm run build`
- Committed: No

**`frontend/node_modules/`:**
- Purpose: Installed npm packages
- Generated: Yes, by `npm install`
- Committed: No

**`.venv/`** (root or `.claude/worktrees/heuristic-hawking/.venv`):
- Purpose: Python virtual environment
- Generated: Yes, by `python3 -m venv .venv`
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Generated: By GSD map-codebase agent
- Committed: Yes

**`.claude/`:**
- Purpose: Claude Code configuration, GSD workflow scripts, agent definitions, git worktrees
- Generated: Partially (worktrees are generated)
- Committed: Yes (scripts/config), No (worktree working copies)

---

*Structure analysis: 2026-03-20*
