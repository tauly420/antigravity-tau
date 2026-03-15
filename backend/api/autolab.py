"""
AutoLab — AI-Driven Workflow Automation
Orchestrates: parse → fit → formula → N-sigma → report
using Gemini function-calling to chain existing tools.
"""

from flask import Blueprint, request, jsonify
import os, json, traceback, io
import numpy as np
import pandas as pd
from scipy import optimize, stats
from sympy import sympify, symbols, diff, lambdify
import math

autolab_bp = Blueprint('autolab', __name__)

# ── Import existing utilities ──
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.calculations import propagate_uncertainty_independent, scientific_round, n_sigma


# ════════════════════════════════════════════════════════════════
# TOOL FUNCTIONS (called directly, not via HTTP)
# ════════════════════════════════════════════════════════════════

def tool_parse_file(file_bytes: bytes, filename: str, sheet_name: str = None,
                    x_col: str = None, y_col: str = None,
                    x_err_col: str = None, y_err_col: str = None,
                    x_col_index: int = None, y_col_index: int = None,
                    x_err_col_index: int = None, y_err_col_index: int = None):
    """Parse uploaded file and extract data columns."""
    fname = filename.lower()
    buf = io.BytesIO(file_bytes)

    if fname.endswith('.csv'):
        df = pd.read_csv(buf)
        sheets = ['Sheet1']
    elif fname.endswith(('.tsv', '.dat', '.txt')):
        df = pd.read_csv(buf, sep=r'\s+|,|\t', engine='python')
        sheets = ['Sheet1']
    elif fname.endswith(('.xlsx', '.xls', '.xlsm', '.xlsb')):
        xl = pd.ExcelFile(buf)
        sheets = xl.sheet_names
        target = sheet_name if sheet_name and sheet_name in sheets else sheets[0]
        df = xl.parse(target)
    elif fname.endswith('.ods'):
        xl = pd.ExcelFile(buf, engine='odf')
        sheets = xl.sheet_names
        target = sheet_name if sheet_name and sheet_name in sheets else sheets[0]
        df = xl.parse(target)
    else:
        return {"error": f"Unsupported file type: {filename}"}

    df = df.dropna(how='all').reset_index(drop=True)
    cols = list(df.columns)

    # Resolve columns by index if names not provided
    def resolve(name, index, fallback=None):
        if name and name in cols:
            return name
        if index is not None and 0 <= index < len(cols):
            return cols[index]
        return fallback

    xc = resolve(x_col, x_col_index)
    yc = resolve(y_col, y_col_index)
    xec = resolve(x_err_col, x_err_col_index)
    yec = resolve(y_err_col, y_err_col_index)

    result = {
        "columns": cols,
        "sheet_names": sheets,
        "num_rows": len(df),
    }

    if xc:
        result["x_data"] = pd.to_numeric(df[xc], errors='coerce').dropna().tolist()
        result["x_col"] = xc
    if yc:
        result["y_data"] = pd.to_numeric(df[yc], errors='coerce').dropna().tolist()
        result["y_col"] = yc
    if xec:
        result["x_errors"] = pd.to_numeric(df[xec], errors='coerce').dropna().tolist()
        result["x_err_col"] = xec
    if yec:
        result["y_errors"] = pd.to_numeric(df[yec], errors='coerce').dropna().tolist()
        result["y_err_col"] = yec

    return result


def tool_fit_data(x_data, y_data, y_errors=None, model='linear',
                  custom_expr=None, initial_guess=None):
    """Fit data with a model. Returns parameters, uncertainties, chi-squared, etc."""
    x = np.array(x_data, dtype=float)
    y = np.array(y_data, dtype=float)
    sigma = np.array(y_errors, dtype=float) if y_errors else None

    # Model definitions
    models = {
        'linear': (lambda x, a, b: a * x + b, ['a', 'b'], [1.0, 0.0]),
        'quadratic': (lambda x, a, b, c: a * x**2 + b * x + c, ['a', 'b', 'c'], [1.0, 1.0, 0.0]),
        'cubic': (lambda x, a, b, c, d: a * x**3 + b * x**2 + c * x + d, ['a', 'b', 'c', 'd'], [0.01, 1.0, 1.0, 0.0]),
        'power': (lambda x, a, b: a * np.power(np.abs(x), b), ['a', 'b'], [1.0, 1.0]),
        'exponential': (lambda x, a, b: a * np.exp(b * x), ['a', 'b'], [1.0, 0.1]),
        'sinusoidal': (lambda x, A, omega, phi, D: A * np.sin(omega * x + phi) + D,
                       ['A', 'omega', 'phi', 'D'], [1.0, 1.0, 0.0, 0.0]),
    }

    if model == 'custom' and custom_expr:
        # Build custom function from SymPy expression
        from sympy import sympify as sp_sympify
        import re
        expr_str = custom_expr
        expr_str = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', expr_str)
        expr = sp_sympify(expr_str)
        x_sym = symbols('x')
        free = sorted([s for s in expr.free_symbols if str(s) != 'x'], key=str)
        param_names = [str(s) for s in free]
        all_syms = [x_sym] + list(free)
        f_numpy = lambdify(all_syms, expr, modules=['numpy'])
        func = lambda x_val, *params: f_numpy(x_val, *params)
        p0 = initial_guess if initial_guess else [1.0] * len(param_names)
    elif model in models:
        func, param_names, p0 = models[model]
        if initial_guess:
            p0 = initial_guess
    else:
        return {"error": f"Unknown model: {model}"}

    try:
        popt, pcov = optimize.curve_fit(
            func, x, y, p0=p0, sigma=sigma,
            absolute_sigma=True if sigma is not None else False,
            maxfev=10000
        )
        perr = np.sqrt(np.diag(pcov))

        # Compute fit statistics
        y_fit_full = func(x, *popt)
        residuals = y - y_fit_full
        n_data = len(x)
        n_params = len(popt)
        dof = n_data - n_params

        if sigma is not None:
            chi2 = float(np.sum((residuals / sigma) ** 2))
        else:
            chi2 = float(np.sum(residuals ** 2))

        reduced_chi2 = chi2 / dof if dof > 0 else float('inf')

        # P-value
        p_value = None
        if dof > 0:
            try:
                p_value = float(1.0 - stats.chi2.cdf(chi2, dof))
            except Exception:
                pass

        # R-squared
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        # Generate smooth fit curve
        x_fit = np.linspace(x.min(), x.max(), 300)
        y_fit = func(x_fit, *popt)

        return {
            "parameters": popt.tolist(),
            "uncertainties": perr.tolist(),
            "parameter_names": param_names,
            "chi_squared": chi2,
            "reduced_chi_squared": reduced_chi2,
            "p_value": p_value,
            "r_squared": r_squared,
            "dof": dof,
            "n_data": n_data,
            "n_params": n_params,
            "model_name": model if model != 'custom' else custom_expr,
            "x_fit": x_fit.tolist(),
            "y_fit": y_fit.tolist(),
            "residuals": residuals.tolist(),
            "x_data": x.tolist(),
            "y_data": y.tolist(),
            "y_errors": sigma.tolist() if sigma is not None else None,
        }
    except Exception as e:
        return {"error": f"Fit failed: {str(e)}"}


def tool_evaluate_formula(expression, variables, uncertainties):
    """Evaluate formula with uncertainty propagation."""
    value, uncertainty, error = propagate_uncertainty_independent(
        expression, variables, uncertainties, is_latex=False
    )
    if error:
        return {"error": error}
    formatted = scientific_round(value, uncertainty)
    return {"value": value, "uncertainty": uncertainty, "formatted": formatted}


def tool_compare_nsigma(value1, uncertainty1, value2, uncertainty2):
    """Compare two measurements using N-sigma."""
    n_sig, err = n_sigma(value1, uncertainty1, value2, uncertainty2)
    if err:
        return {"error": err}
    if n_sig <= 1:
        verdict = "Excellent agreement"
    elif n_sig <= 2:
        verdict = "Good agreement"
    elif n_sig <= 3:
        verdict = "Acceptable agreement"
    else:
        verdict = "Possible disagreement"
    return {"n_sigma": round(n_sig, 4), "verdict": verdict}


# ════════════════════════════════════════════════════════════════
# GEMINI FUNCTION-CALLING ORCHESTRATOR
# ════════════════════════════════════════════════════════════════

TOOL_DECLARATIONS = [
    {
        "name": "parse_file",
        "description": "Parse the uploaded data file and extract columns. Use column names OR 0-based column indices. You MUST call this first to get the data.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "sheet_name": {"type": "STRING", "description": "Sheet name to use (for Excel files). If not specified, uses the first sheet."},
                "x_col": {"type": "STRING", "description": "Name of the X data column"},
                "y_col": {"type": "STRING", "description": "Name of the Y data column"},
                "x_err_col": {"type": "STRING", "description": "Name of the X error column (optional)"},
                "y_err_col": {"type": "STRING", "description": "Name of the Y error column (optional)"},
                "x_col_index": {"type": "INTEGER", "description": "0-based index of X column (use if name unknown)"},
                "y_col_index": {"type": "INTEGER", "description": "0-based index of Y column"},
                "x_err_col_index": {"type": "INTEGER", "description": "0-based index of X error column"},
                "y_err_col_index": {"type": "INTEGER", "description": "0-based index of Y error column"},
            },
        },
    },
    {
        "name": "fit_data",
        "description": "Fit the parsed data with a model. Available models: linear, quadratic, cubic, power, exponential, sinusoidal, custom. For custom: provide custom_expr using 'x' as variable.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "model": {"type": "STRING", "description": "Model name: linear, quadratic, cubic, power, exponential, sinusoidal, or custom"},
                "custom_expr": {"type": "STRING", "description": "Custom expression (e.g. 'A*sin(omega*x + phi) + D'). Only needed if model='custom'."},
                "initial_guess": {"type": "ARRAY", "items": {"type": "NUMBER"}, "description": "Initial parameter guesses (optional)"},
            },
            "required": ["model"],
        },
    },
    {
        "name": "evaluate_formula",
        "description": "Evaluate a formula using fitted parameters and propagate uncertainties. The expression must use Python/SymPy syntax (** for power, * for multiply). Variable names must match the fitted parameter names exactly.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "expression": {"type": "STRING", "description": "Formula expression in Python/SymPy syntax (e.g. 'A*phi**2')"},
            },
            "required": ["expression"],
        },
    },
    {
        "name": "compare_nsigma",
        "description": "Compare the formula result with a theoretical value using N-sigma test.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "theoretical_value": {"type": "NUMBER", "description": "The expected/theoretical value to compare against"},
                "theoretical_uncertainty": {"type": "NUMBER", "description": "Uncertainty of the theoretical value (0 if exact)"},
            },
            "required": ["theoretical_value"],
        },
    },
    {
        "name": "generate_summary",
        "description": "Generate a final summary of all results. Call this as the LAST step after all analysis is done.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "language": {"type": "STRING", "description": "Language for the summary: 'en' or 'he'"},
            },
        },
    },
]


def _run_orchestrator(file_bytes, filename, instructions, theoretical_value=None,
                      theoretical_uncertainty=None):
    """Run the Gemini function-calling orchestrator."""
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        # Debug: print all env var names to help diagnose
        env_keys = [k for k in os.environ.keys() if 'KEY' in k.upper() or 'GEMINI' in k.upper() or 'API' in k.upper()]
        print(f"[AutoLab] GEMINI_API_KEY not found! Related env vars: {env_keys}")
        return {"error": "GEMINI_API_KEY not set. Please add it in Railway Variables.", "steps": []}

    client = genai.Client(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # State that accumulates as tools execute
    state = {
        "parsed": None,
        "fit": None,
        "formula": None,
        "nsigma": None,
    }
    steps = []  # log of what happened

    # Build the system instruction
    system = (
        "You are an automated lab analysis agent. The user has uploaded a data file "
        "and given instructions. You must execute the analysis step by step using the tools.\n\n"
        "RULES:\n"
        "1. ALWAYS call parse_file first to get the data.\n"
        "2. Then call fit_data to fit the data.\n"
        "3. If the user asks for a formula calculation, call evaluate_formula.\n"
        "4. If a theoretical value is provided, call compare_nsigma.\n"
        "5. ALWAYS call generate_summary as the last step.\n"
        "6. For column selection: if the user says 'columns 1-4' they mean 0-based indices 0,1,2,3. "
        "If they say 'column A, B, C' they mean column names.\n"
        "7. For the formula expression, use EXACTLY the parameter names from the fit result.\n"
    )

    if theoretical_value is not None:
        system += f"\nTheoretical value to compare against: {theoretical_value}"
        if theoretical_uncertainty:
            system += f" ± {theoretical_uncertainty}"
        system += "\n"

    # Initial user message
    user_msg = f"File: {filename}\n\nInstructions: {instructions}"

    # Build Gemini tools config
    tools = [{"function_declarations": TOOL_DECLARATIONS}]

    contents = [{"role": "user", "parts": [{"text": user_msg}]}]

    max_turns = 10
    for turn in range(max_turns):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config={
                    "system_instruction": system,
                    "tools": tools,
                },
            )
        except Exception as e:
            steps.append({"step": "error", "message": f"Gemini API error: {str(e)}"})
            break

        # Check if the response has function calls
        candidate = response.candidates[0] if response.candidates else None
        if not candidate:
            steps.append({"step": "error", "message": "No response from AI"})
            break

        parts = candidate.content.parts if candidate.content else []
        fn_calls = [p for p in parts if hasattr(p, 'function_call') and p.function_call]
        text_parts = [p for p in parts if hasattr(p, 'text') and p.text]

        if not fn_calls:
            # AI is done — extract final text
            final_text = " ".join(p.text for p in text_parts) if text_parts else ""
            if final_text:
                steps.append({"step": "summary", "message": final_text})
            break

        # Execute each function call
        fn_responses = []
        for part in fn_calls:
            fc = part.function_call
            fn_name = fc.name
            fn_args = dict(fc.args) if fc.args else {}

            step_result = _execute_tool(fn_name, fn_args, state, file_bytes, filename)
            steps.append(step_result)

            fn_responses.append({
                "function_response": {
                    "name": fn_name,
                    "response": step_result.get("result", {"status": "done"}),
                }
            })

        # Add assistant response + function results to conversation
        contents.append(candidate.content)
        contents.append({"role": "user", "parts": fn_responses})

    return {"steps": steps, "state": state}


def _execute_tool(fn_name, fn_args, state, file_bytes, filename):
    """Execute a single tool call and update state."""
    try:
        if fn_name == "parse_file":
            result = tool_parse_file(file_bytes, filename, **fn_args)
            if "error" not in result:
                state["parsed"] = result
            return {
                "step": "parse",
                "tool": fn_name,
                "args": fn_args,
                "result": _safe_result(result),
                "success": "error" not in result,
            }

        elif fn_name == "fit_data":
            if not state["parsed"] or "x_data" not in state["parsed"]:
                return {"step": "fit", "tool": fn_name, "result": {"error": "No parsed data"}, "success": False}

            result = tool_fit_data(
                x_data=state["parsed"]["x_data"],
                y_data=state["parsed"]["y_data"],
                y_errors=state["parsed"].get("y_errors"),
                **fn_args,
            )
            if "error" not in result:
                state["fit"] = result
            return {
                "step": "fit",
                "tool": fn_name,
                "args": fn_args,
                "result": _safe_result(result),
                "success": "error" not in result,
            }

        elif fn_name == "evaluate_formula":
            if not state["fit"]:
                return {"step": "formula", "tool": fn_name, "result": {"error": "No fit results"}, "success": False}

            expression = fn_args.get("expression", "")
            variables = {}
            uncertainties = {}
            for i, name in enumerate(state["fit"]["parameter_names"]):
                variables[name] = state["fit"]["parameters"][i]
                uncertainties[name] = state["fit"]["uncertainties"][i]

            result = tool_evaluate_formula(expression, variables, uncertainties)
            if "error" not in result:
                state["formula"] = result
                state["formula"]["expression"] = expression
            return {
                "step": "formula",
                "tool": fn_name,
                "args": fn_args,
                "result": _safe_result(result),
                "success": "error" not in result,
            }

        elif fn_name == "compare_nsigma":
            if not state["formula"]:
                return {"step": "nsigma", "tool": fn_name, "result": {"error": "No formula result"}, "success": False}

            tv = fn_args.get("theoretical_value", 0)
            tu = fn_args.get("theoretical_uncertainty", 0)
            result = tool_compare_nsigma(
                state["formula"]["value"], state["formula"]["uncertainty"],
                tv, tu,
            )
            if "error" not in result:
                state["nsigma"] = result
                state["nsigma"]["theoretical_value"] = tv
                state["nsigma"]["theoretical_uncertainty"] = tu
            return {
                "step": "nsigma",
                "tool": fn_name,
                "args": fn_args,
                "result": _safe_result(result),
                "success": "error" not in result,
            }

        elif fn_name == "generate_summary":
            # Summary is generated by the AI text response
            return {
                "step": "summary",
                "tool": fn_name,
                "result": {"status": "generating"},
                "success": True,
            }

        else:
            return {"step": "unknown", "tool": fn_name, "result": {"error": f"Unknown tool: {fn_name}"}, "success": False}

    except Exception as e:
        return {"step": fn_name, "tool": fn_name, "result": {"error": str(e)}, "success": False}


def _safe_result(result):
    """Make result JSON-safe, truncating large arrays."""
    if not isinstance(result, dict):
        return result
    safe = {}
    for k, v in result.items():
        if isinstance(v, list) and len(v) > 20:
            safe[k] = v[:5] + ["..."] + v[-5:]
            safe[f"{k}_length"] = len(v)
        elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            safe[k] = str(v)
        else:
            safe[k] = v
    return safe


# ════════════════════════════════════════════════════════════════
# API ENDPOINT
# ════════════════════════════════════════════════════════════════

@autolab_bp.route('/run', methods=['POST'])
def run():
    """
    Run AutoLab analysis.

    Multipart form data:
      - file: the data file
      - instructions: natural language instructions
      - theoretical_value: (optional) value to compare against
      - theoretical_uncertainty: (optional)
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({"error": "Empty filename"}), 400

        instructions = request.form.get('instructions', '')
        if not instructions.strip():
            return jsonify({"error": "Instructions are required"}), 400

        theoretical_value = request.form.get('theoretical_value')
        theoretical_uncertainty = request.form.get('theoretical_uncertainty')

        if theoretical_value:
            theoretical_value = float(theoretical_value)
        if theoretical_uncertainty:
            theoretical_uncertainty = float(theoretical_uncertainty)

        file_bytes = file.read()

        result = _run_orchestrator(
            file_bytes, file.filename, instructions,
            theoretical_value, theoretical_uncertainty,
        )

        # Include full data arrays for plotting
        state = result.get("state", {})
        fit = state.get("fit")
        if fit:
            result["fit_data"] = {
                "x_data": fit.get("x_data"),
                "y_data": fit.get("y_data"),
                "y_errors": fit.get("y_errors"),
                "x_fit": fit.get("x_fit"),
                "y_fit": fit.get("y_fit"),
                "residuals": fit.get("residuals"),
                "parameters": fit.get("parameters"),
                "uncertainties": fit.get("uncertainties"),
                "parameter_names": fit.get("parameter_names"),
                "chi_squared": fit.get("chi_squared"),
                "reduced_chi_squared": fit.get("reduced_chi_squared"),
                "p_value": fit.get("p_value"),
                "dof": fit.get("dof"),
                "model_name": fit.get("model_name"),
            }

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "steps": []}), 500
