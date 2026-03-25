# Tech Stack

**Analysis Date:** 2026-03-20

## Frontend

**Framework/Runtime:**
- React ^19.2.0 — UI component library
- TypeScript ~5.9.3 — compiled to ES2022, strict mode enabled
- Vite ^7.3.1 — dev server and build tool (ESNext modules)

**Build Tool:**
- Vite ^7.3.1 with `@vitejs/plugin-react` ^5.1.1
- Build command: `tsc -b && vite build`
- Output: `frontend/dist/` (served statically by Flask in production)
- Dev proxy: `/api` → `http://localhost:5000` (configured in `frontend/vite.config.ts`)

**Key Frontend Libraries:**
- `react-router-dom` ^7.6.0 — client-side routing
- `plotly.js-dist-min` ^3.4.0 — interactive charts and plots
- `react-plotly.js` ^2.6.0 — React wrapper for Plotly
- `axios` ^1.7.0 — HTTP client for all backend API calls (configured in `frontend/src/services/api.ts`)
- `katex` ^0.16.0 — LaTeX math rendering in the chat UI
- `papaparse` ^5.5.3 — CSV parsing in the browser
- `xlsx` ^0.18.5 — Excel file reading in the browser

**TypeScript Configuration:**
- Config: `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- Target: ES2022, DOM libs
- Strict: true, noUnusedLocals: true, noUnusedParameters: true, noEmit: true (Vite handles emit)
- moduleResolution: bundler

**Dev Tooling:**
- `eslint` ^9.39.1 with `typescript-eslint` ^8.48.0
- `eslint-plugin-react-hooks` ^7.0.1
- `eslint-plugin-react-refresh` ^0.4.24
- Package manager: npm (lockfile: `frontend/package-lock.json`), install uses `--legacy-peer-deps`

## Backend

**Language/Runtime:**
- Python 3 (exact version determined by nixpacks: `python3` from nixpkgs, Node.js 23 also provisioned)
- Virtual environment: `.venv/` at project root

**Framework:**
- Flask >=3.0.0 — main web server (`backend/app.py`)
- flask-cors >=4.0.0 — CORS for `http://localhost:5173` and `http://localhost:3000` during dev

**Key Backend Libraries:**
- `numpy` >=1.24.0 — numerical arrays and math
- `pandas` >=2.0.0 — data parsing (CSV, Excel, ODS, TSV)
- `scipy` >=1.10.0 — curve fitting (`optimize.curve_fit`), statistics (`stats.chi2`), ODE solving, integration
- `sympy` >=1.12 — symbolic math, uncertainty propagation, custom fit expression parsing
- `openai` >=1.40.0 — GPT models for AutoLab orchestration and chat assistant
- `google-genai` >=1.0.0 — Gemini models (alternative chat provider)
- `openpyxl` >=3.1.0 — Excel `.xlsx` read/write support for pandas

**Backend Structure:**
- Entry point: `backend/app.py` — Flask app factory, blueprint registration, static file serving
- Blueprints: `backend/api/` (formula, nsigma, fitting, units, matrix, ode, integrate, assistant, fourier, autolab)
- Shared utilities: `backend/utils/calculations.py`
- Chat agent: `app/chat_agent.py` (supports OpenAI and Gemini via `CHAT_PROVIDER` env var)

**Max Upload Size:** 50 MB (`app.config['MAX_CONTENT_LENGTH']` in `backend/app.py`)

## Infrastructure / Deployment

**Local Development:**
- Run `./start.sh` from project root
- Starts Flask on `http://localhost:5000` and Vite dev server on `http://localhost:5173`
- Python venv set up automatically in `.venv/`
- Frontend proxies `/api/*` to Flask via Vite proxy config

**Production Build (local):**
```bash
cd frontend && npm run build    # outputs to frontend/dist/
cd backend && python app.py     # serves dist/ as static files + /api/* routes
```

**Deployment Target:**
- Railway (cloud platform)
- Deployment config: `nixpacks.toml` at project root
- Nixpacks provisions: `python3`, `nodejs_23`
- Install phase: creates `.venv`, pip installs `requirements.txt`, npm installs frontend
- Build phase: `cd frontend && npm run build`
- Start command: `. .venv/bin/activate && cd backend && python app.py`
- Port: reads `PORT` env var (defaults to 5000) in `backend/app.py`

**Environment Variables Required:**
- `OPENAI_API_KEY` — required for AutoLab (`backend/api/autolab.py`) and chat assistant when `CHAT_PROVIDER=openai`
- `GEMINI_API_KEY` — required when `CHAT_PROVIDER=gemini`
- `CHAT_PROVIDER` — `"openai"` (default) or `"gemini"` — selects AI provider for sidebar chat (`app/chat_agent.py`)
- `OPENAI_MODEL` — optional, overrides model for both AutoLab (default: `gpt-4o-mini`) and chat (default: `gpt-5-mini-2025-08-07`)
- `GEMINI_MODEL` — optional, overrides Gemini model (default: `gemini-2.0-flash`)
- `SYSTEM_PROMPT` — optional, overrides chat agent system prompt
- `PORT` — optional, Flask listen port (default: 5000)

**Docker:**
- `.dockerignore` present — excludes `.venv/`, `__pycache__/`, `.env`, `node_modules/`, `.git/`
- No `Dockerfile` present; Railway uses nixpacks for builds

## Data Storage

**Databases:** None — all computation is stateless and in-memory per request.

**File Storage:** Uploaded files are read into memory as bytes (`file.read()` in `backend/api/autolab.py`) and not persisted to disk.

**Caching:** None — no Redis, Memcached, or in-process cache layer.
