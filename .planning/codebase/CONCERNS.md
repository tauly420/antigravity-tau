# Codebase Concerns

## Critical Issues

### Flask debug=True in Production
- `backend/app.py` runs with `debug=True` which is passed through to nixpacks/Railway deployment
- Werkzeug interactive debugger is exposed, enabling Remote Code Execution (RCE) if a stack trace is triggered
- **Fix**: Gate `debug=True` behind `os.environ.get('FLASK_ENV') == 'development'`

### Broken Default AI Model
- `app/chat_agent.py` defaults to `"gpt-5-mini-2025-08-07"` — a non-existent model name
- The sidebar chat assistant is broken by default for any deployment that doesn't override this
- **Fix**: Change default to a valid model (e.g., `"gpt-4o-mini"`)

## Security Concerns

### eval() on Raw User Input
- `backend/api/ode.py` and `backend/api/integrate.py` call `eval()` on user-supplied strings
- `sympify()` is called on user custom fit expressions without sanitization
- **Risk**: Arbitrary code execution on the server
- **Fix**: Use `sympy.sympify()` with `locals` allowlist and no builtins; never use bare `eval()`

### dangerouslySetInnerHTML Without Sanitization
- AI-generated output is rendered via `dangerouslySetInnerHTML` in React components
- No DOMPurify or equivalent sanitization before rendering
- **Risk**: XSS if AI output is ever manipulated or injected
- **Fix**: Sanitize with DOMPurify before rendering, or use a safe markdown renderer

### No Rate Limiting
- Zero rate limiting on any endpoint, including AI-backed ones (`/api/autolab/run`, `/api/autolab/chat`)
- **Risk**: Cost amplification attacks — a single user can exhaust OpenAI API budget
- **Fix**: Add Flask-Limiter with per-IP limits on AI endpoints

### Outdated Dependency with CVE
- `xlsx` v0.18.5 has **CVE-2023-30533** (prototype pollution via crafted spreadsheet)
- Used for file parsing in the frontend
- **Fix**: Upgrade to `xlsx` ≥ 0.20.0 or migrate to `exceljs`

## Technical Debt

### Duplicated Fitting Logic
- Exponential model defined with 2 parameters in `backend/api/fitting.py` but 3 in `backend/api/autolab.py`
- File parsing logic duplicated between `autolab.py` and `fitting.py` with behavioral divergence
- **Risk**: Silent inconsistencies between AutoLab and standalone GraphFitting results

### AutoLab.tsx God Component
- `frontend/src/components/AutoLab.tsx` is 1,141 lines — handles UI, state, API calls, rendering
- Difficult to test, maintain, or extend
- **Fix**: Extract sub-components (StepResults, ParameterTable, FitPlot, ChatPanel)

### AnalysisContext Uses `any` Throughout
- `frontend/src/context/AnalysisContext.tsx` typed with `any` — defeats TypeScript's safety guarantees
- **Fix**: Define proper interfaces for context shape

## Performance Concerns
- Large file uploads (up to 50 MB accepted) processed synchronously in Flask — no async/queue
- No response streaming for long AI operations — user waits with no feedback until complete
- No caching of repeated fit computations

## Missing Features / Gaps
- No loading states for individual AutoLab steps — only a single spinner
- Error recovery in AutoLab is all-or-nothing (full retry required on any step failure)
- No persistent history of past AutoLab runs

## Dependency Concerns
- No `requirements.txt` lockfile (pinned versions) — `pip install` may pull incompatible updates
- No `package-lock.json` committed (check gitignore) — frontend builds may be non-reproducible
- Flask dev server used in production (nixpacks) — should use gunicorn/uvicorn

## Developer Experience
- No `.env.example` file — new developers must guess required environment variables
- `backend/tests/` is empty with no guidance on how to run/write tests
- No README with setup instructions beyond what's in CLAUDE.md (agent-facing only)
- Mixed responsibility: `app/chat_agent.py` lives outside `backend/` breaking the module boundary
