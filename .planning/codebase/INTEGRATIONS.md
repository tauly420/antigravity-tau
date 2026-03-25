# External Integrations

**Analysis Date:** 2026-03-20

---

## OpenAI (GPT)

**Purpose:** Powers two distinct AI features:
1. **AutoLab orchestrator** — function-calling loop that chains `parse_file → fit_data → evaluate_formula → compare_nsigma → generate_summary`
2. **AutoLab post-analysis chat** — inline chat panel for discussing fit results
3. **Sidebar chat assistant** — global chat UI (when `CHAT_PROVIDER=openai`, which is the default)

**How it's called:**
- AutoLab orchestrator: `backend/api/autolab.py`, function `_run_orchestrator()` — instantiates `OpenAI(api_key=api_key)`, calls `client.chat.completions.create(model=model_name, messages=..., tools=..., tool_choice="auto")` in a loop of up to 10 turns
- AutoLab chat endpoint: `backend/api/autolab.py`, route `POST /api/autolab/chat` (line ~854) — same client, no tool calling, plain completion
- Sidebar chat: `app/chat_agent.py`, class `ChatAgent._ask_openai()` — called by `backend/api/assistant.py` route `POST /api/assistant/chat`

**Auth method:** API key via environment variable `OPENAI_API_KEY`, read with `os.getenv("OPENAI_API_KEY", "").strip()`

**Key config:**
- Default model for AutoLab: `gpt-4o-mini` (overridable via `OPENAI_MODEL` env var)
- Default model for sidebar chat: `gpt-5-mini-2025-08-07` (overridable via `OPENAI_MODEL` env var)
- Timeout: 20s, max_retries: 2 (in `ChatAgent.__init__`)
- Error checked at startup in `backend/api/assistant.py` (line ~26–40); fails gracefully with 503 if key missing

---

## Google Gemini

**Purpose:** Alternative AI provider for the sidebar chat assistant. Switched in via `CHAT_PROVIDER=gemini` env var. Not used for AutoLab.

**How it's called:**
- `app/chat_agent.py`, class `ChatAgent._ask_gemini()` — instantiates `genai.Client(api_key=api_key)`, calls `self.client.models.generate_content(model=self.model, contents=..., config={"system_instruction": ...})`
- Triggered via `backend/api/assistant.py` route `POST /api/assistant/chat` when `CHAT_PROVIDER=gemini`

**Auth method:** API key via environment variable `GEMINI_API_KEY`, read with `os.getenv("GEMINI_API_KEY", "").strip()`

**Key config:**
- Default model: `gemini-2.0-flash` (overridable via `GEMINI_MODEL` env var)
- SDK: `google-genai` >=1.0.0 (`from google import genai`)
- Retry logic: exponential backoff on rate-limit (429), 500, 503 errors
- Message format conversion: OpenAI-style `{role: "assistant"}` mapped to Gemini `{role: "model"}`; system messages folded into `system_instruction`

---

## Frontend API Layer (Internal)

**Purpose:** All frontend-to-backend HTTP calls are centralized in `frontend/src/services/api.ts` using axios.

**How it's called:**
- Axios instance created with `baseURL: '/api'` and `Content-Type: application/json`
- File uploads use `FormData` with `Content-Type: multipart/form-data` override
- Functions exported per feature: `evaluateFormula`, `calculateNSigma`, `convertUnits`, `fitData`, `chatWithAssistant`, `analyzeFourier`, `autolabChat`, etc.

**Key endpoints exposed:**
| Function | Method | Route |
|---|---|---|
| `evaluateFormula` | POST | `/api/formula/evaluate` |
| `calculateNSigma` | POST | `/api/nsigma/calculate` |
| `convertUnits` | POST | `/api/units/convert` |
| `fitData` | POST | `/api/fitting/fit` |
| `parseFile` / `parseFileData` | POST | `/api/fitting/parse` |
| `chatWithAssistant` | POST | `/api/assistant/chat` |
| `getAssistantStatus` | GET | `/api/assistant/status` |
| `analyzeFourier` | POST | `/api/fourier/analyze` |
| `inverseFourier` | POST | `/api/fourier/inverse` |
| `autolabChat` | POST | `/api/autolab/chat` |
| AutoLab run | POST | `/api/autolab/run` (called directly with FormData, not via api.ts helper) |

**Auth method:** None — all API calls are same-origin (no authentication layer).

**Dev proxy:** Vite proxies `/api` → `http://localhost:5000` in development (`frontend/vite.config.ts` line 9). In production, Flask serves both the frontend static files and `/api/*` routes from the same process.

---

## Railway (Deployment Platform)

**Purpose:** Cloud hosting and deployment for the full application.

**How it's called:**
- Deployment triggered via git push to Railway
- Build and start process defined in `nixpacks.toml` at project root
- Railway injects environment variables (API keys, `PORT`) at runtime

**Key config:**
- `nixpacks.toml` defines install, build, and start phases
- `PORT` env var read in `backend/app.py` line 79: `port = int(os.environ.get('PORT', 5000))`
- Flask binds to `host='0.0.0.0'` to accept Railway's external traffic

---

## File Format Parsers (Embedded, No External Service)

**Purpose:** Parse user-uploaded lab data files entirely within the backend process — no external service call.

**How it's called:**
- `backend/api/autolab.py`, function `tool_parse_file()` — uses `pandas` and `openpyxl`
- `backend/api/fitting.py` — separate parsing for the Graph Fitting tool

**Supported formats:**
- `.csv` — `pd.read_csv()`
- `.tsv`, `.dat`, `.txt` — `pd.read_csv(sep=r'\s+|,|\t', engine='python')`
- `.xlsx`, `.xls`, `.xlsm`, `.xlsb` — `pd.ExcelFile()` with `openpyxl`
- `.ods` — `pd.ExcelFile(engine='odf')`

**Key config:**
- Max upload size: 50 MB enforced in `backend/app.py` via `app.config['MAX_CONTENT_LENGTH']`
- Files are read into memory as bytes; never written to disk
