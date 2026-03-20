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
