"""
AutoLab — AI-Driven Workflow Automation
Orchestrates: parse → fit → formula → N-sigma → report
using OpenAI function-calling to chain existing tools.
"""

from flask import Blueprint, request, jsonify
import os, json, traceback, io
import numpy as np
import pandas as pd
from scipy import optimize, stats
from sympy import sympify, symbols, diff, lambdify
import math


def _sanitize_float(v):
    """Convert Infinity/NaN floats to None for JSON safety."""
    if v is None:
        return None
    if isinstance(v, float) and (math.isinf(v) or math.isnan(v)):
        return None
    return v


def _sanitize_dict(d):
    """Recursively sanitize a dict so it's JSON-serializable (no Infinity/NaN)."""
    if not isinstance(d, dict):
        return d
    safe = {}
    for k, v in d.items():
        if isinstance(v, float):
            safe[k] = _sanitize_float(v)
        elif isinstance(v, dict):
            safe[k] = _sanitize_dict(v)
        elif isinstance(v, list):
            safe[k] = [_sanitize_float(x) if isinstance(x, float) else x for x in v]
        else:
            safe[k] = v
    return safe

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
    # Ensure column names are strings (handles integer-indexed columns)
    df.columns = [str(c) for c in df.columns]
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


def tool_fit_data(x_data, y_data, y_errors=None, x_errors=None, model='linear',
                  custom_expr=None, initial_guess=None, fixed_params=None):
    """Fit data with a model. Returns parameters, uncertainties, chi-squared, etc.
    When x_errors are provided, effective errors are computed via error propagation:
    sigma_eff = sqrt(y_err² + (df/dx · x_err)²)
    """
    x = np.array(x_data, dtype=float)
    y = np.array(y_data, dtype=float)
    sigma_y = np.array(y_errors, dtype=float) if y_errors else None
    sigma_x = np.array(x_errors, dtype=float) if x_errors else None
    sigma = sigma_y  # will be upgraded to effective sigma if x_errors present

    # Model definitions
    models = {
        'linear': (lambda x, a, b: a * x + b, ['a', 'b'], [1.0, 0.0]),
        'quadratic': (lambda x, a, b, c: a * x**2 + b * x + c, ['a', 'b', 'c'], [1.0, 1.0, 0.0]),
        'cubic': (lambda x, a, b, c, d: a * x**3 + b * x**2 + c * x + d, ['a', 'b', 'c', 'd'], [0.01, 1.0, 1.0, 0.0]),
        'power': (lambda x, a, b, c: a * np.power(np.abs(x), b) + c, ['a', 'b', 'c'], [1.0, 1.0, 0.0]),
        'exponential': (lambda x, a, b, c: a * np.exp(b * x) + c, ['a', 'b', 'c'], [1.0, 0.1, 0.0]),
        'sinusoidal': (lambda x, A, omega, phi, D: A * np.sin(omega * x + phi) + D,
                       ['A', 'omega', 'phi', 'D'], [1.0, 1.0, 0.0, 0.0]),
        'fractional': (lambda x, a, b, c, d: a / (b * x + c) + d,
                       ['a', 'b', 'c', 'd'], [1.0, 1.0, 1.0, 0.0]),
        'gaussian': (lambda x, A, mu, sigma, D: A * np.exp(-((x - mu)**2) / (2 * sigma**2)) + D,
                     ['A', 'mu', 'sigma', 'D'], [1.0, 0.0, 1.0, 0.0]),
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

    # Handle fixed parameters: wrap the model function to inject fixed values
    all_param_names = list(param_names)  # full list before removing fixed
    fixed_params = fixed_params or {}
    if fixed_params:
        fixed_indices = []
        free_indices = []
        for i, name in enumerate(param_names):
            if name in fixed_params:
                fixed_indices.append((i, fixed_params[name]))
            else:
                free_indices.append(i)

        if not free_indices:
            return {"error": "All parameters are fixed — nothing to fit."}

        # Build a wrapper that injects fixed values into the full param vector
        _original_func = func
        _all_n = len(param_names)

        def _wrapped(x_val, *free_vals):
            full = [None] * _all_n
            fi = 0
            for idx in range(len(full)):
                # check if this index is fixed
                fixed_val = None
                for fidx, fval in fixed_indices:
                    if fidx == idx:
                        fixed_val = fval
                        break
                if fixed_val is not None:
                    full[idx] = fixed_val
                else:
                    full[idx] = free_vals[fi]
                    fi += 1
            return _original_func(x_val, *full)

        func = _wrapped
        free_param_names = [param_names[i] for i in free_indices]
        p0 = [p0[i] for i in free_indices]
        param_names = free_param_names

    try:
        # First fit (using y_errors only if no x_errors, or as initial pass)
        popt, pcov = optimize.curve_fit(
            func, x, y, p0=p0, sigma=sigma,
            absolute_sigma=True if sigma is not None else False,
            maxfev=10000
        )

        # If x-errors are provided, compute effective sigma and refit
        if sigma_x is not None:
            dx = np.gradient(func(x, *popt), x)  # numerical dy/dx at data points
            y_err_sq = sigma_y**2 if sigma_y is not None else np.zeros_like(x)
            sigma_eff = np.sqrt(y_err_sq + (dx * sigma_x)**2)
            sigma_eff[sigma_eff == 0] = np.min(sigma_eff[sigma_eff > 0]) * 0.1 if np.any(sigma_eff > 0) else 1.0
            sigma = sigma_eff
            # Refit with effective errors
            popt, pcov = optimize.curve_fit(
                func, x, y, p0=popt, sigma=sigma,
                absolute_sigma=True, maxfev=10000
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

        reduced_chi2 = chi2 / dof if dof > 0 else None

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

        # Reconstruct full parameter list if some were fixed
        if fixed_params:
            full_popt = np.zeros(len(all_param_names))
            full_perr = np.zeros(len(all_param_names))
            fi = 0
            for i, name in enumerate(all_param_names):
                if name in fixed_params:
                    full_popt[i] = fixed_params[name]
                    full_perr[i] = 0.0  # no uncertainty for fixed params
                else:
                    full_popt[i] = popt[fi]
                    full_perr[i] = perr[fi]
                    fi += 1
            popt = full_popt
            perr = full_perr
            param_names = all_param_names

        # Generate smooth fit curve using the wrapped func with free params only
        x_fit = np.linspace(x.min(), x.max(), 300)
        if fixed_params:
            free_popt = [popt[i] for i in range(len(all_param_names)) if all_param_names[i] not in fixed_params]
            y_fit = func(x_fit, *free_popt)
        else:
            y_fit = func(x_fit, *popt)

        result = {
            "parameters": popt.tolist(),
            "uncertainties": perr.tolist(),
            "parameter_names": param_names,
            "chi_squared": _sanitize_float(chi2),
            "reduced_chi_squared": _sanitize_float(reduced_chi2),
            "p_value": _sanitize_float(p_value),
            "r_squared": _sanitize_float(float(r_squared)),
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
            "x_errors": sigma_x.tolist() if sigma_x is not None else None,
        }
        return result
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
# OPENAI FUNCTION-CALLING ORCHESTRATOR
# ════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = (
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
    "8. CUSTOM FUNCTION KNOWLEDGE — If the user asks to fit a non-standard function, "
    "use model='custom' and provide custom_expr. Examples:\n"
    "   - sinc: custom_expr='A * sin(pi*x/x0) / (pi*x/x0)', initial_guess=[<y_max>, <x_range/4>]\n"
    "   - Gaussian: custom_expr='A * exp(-((x-mu)**2)/(2*sigma**2))', initial_guess=[<y_max>, <x_mid>, <x_range/4>]\n"
    "   - Lorentzian: custom_expr='A * gamma**2 / ((x-x0)**2 + gamma**2)', initial_guess=[<y_max>, <x_mid>, 1.0]\n"
    "   - Damped oscillation: custom_expr='A * exp(-b*x) * sin(omega*x + phi)', initial_guess=[1.0, 0.1, 1.0, 0.0]\n"
    "   - Always estimate initial_guess from the data range to help convergence.\n"
    "   - For standard named models (linear, quadratic, cubic, power, exponential, sinusoidal, fractional, gaussian), "
    "use those model names directly — no custom needed.\n"
    "9. FORMULA INTELLIGENCE — Derive quantities smartly from fit parameters:\n"
    "   - Quadratic fit (a, b, c): to extract g from free-fall, evaluate '2*a'\n"
    "   - Sinusoidal fit (A, omega, phi, D): period T = '2*pi/omega', max velocity = 'A*omega', "
    "max acceleration = 'A*omega**2'\n"
    "   - Linear fit (a, b): slope is 'a', intercept is 'b'\n"
    "   - Exponential fit (a, b): time constant tau = '-1/b' (for decay), half-life = 'log(2)/abs(b)'\n"
    "10. SUMMARY — Write a concise scientific summary using **Markdown formatting**.\n"
    "   Use **bold** for key values and parameter names. Use numbered or bulleted lists if helpful.\n"
    "   Include: model used (include the formula, e.g. 'y = ax + b'), "
    "key parameter values with uncertainties (properly rounded using ± symbol, NOT \\pm), "
    "derived quantity if applicable, and N-sigma result with interpretation. Keep it to 3-5 sentences. "
    "Use Unicode symbols: ± for plus-minus, χ² for chi-squared, σ for sigma. Do NOT use LaTeX backslash notation.\n"
    "   Refer to χ² reduced (not χ²/dof).\n"
    "11. DATA AWARENESS — Always read column headers carefully:\n"
    "   - If columns are labeled like 'x', 'x_error', 'y', 'y_error', automatically map them.\n"
    "   - If user says 'y as function of x', identify y and x columns by name.\n"
    "   - ALWAYS include error columns when they exist — look for columns containing "
    "'error', 'err', 'uncertainty', 'unc', 'sigma', 'δ', 'Δ' in their names.\n"
    "   - When x-error columns exist, ALWAYS pass x_err_col to parse_file. "
    "The fit will automatically propagate x-errors into effective uncertainties.\n"
    "12. DATA MANIPULATION — If the user asks to transform data (multiply, divide, convert units, "
    "take logarithm), acknowledge the transformation in the summary and apply it as described.\n"
    "13. AXIS LABELS — Use the experiment context from the user's instructions to choose meaningful "
    "axis labels. For example, if the experiment is 'voltage vs time on a capacitor', the x-axis "
    "should be 'Time [s]' and y-axis 'Voltage [V]'. Use the column names and units when possible. "
    "The frontend will use the x_col and y_col names from parse_file as axis labels.\n"
    "14. FIXED PARAMETERS — If the user specifies that a parameter should be fixed "
    "(e.g. 'no offset', 'c=0', 'force through origin'), use fixed_params to set it. "
    "For example, fixed_params={'c': 0} fixes the constant at zero. The general model forms "
    "include a +c constant by default; fix c=0 if the user wants a simpler model without offset.\n"
    "15. FIT MODEL SELECTION — The user's instructions may specify which model to use. "
    "If the user says 'fit linear', 'fit exponential', etc., use that model. The user may also "
    "specify fixed parameters like 'exponential with no offset' (use fixed_params={'c': 0}).\n"
)


def _run_orchestrator(file_bytes, filename, instructions, theoretical_value=None,
                      theoretical_uncertainty=None):
    """Run the OpenAI function-calling orchestrator."""
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        env_keys = [k for k in os.environ.keys() if 'KEY' in k.upper() or 'OPENAI' in k.upper() or 'API' in k.upper()]
        print(f"[AutoLab] OPENAI_API_KEY not found! Related env vars: {env_keys}")
        return {"error": "OPENAI_API_KEY not set. Please add it in Railway Variables.", "steps": []}

    client = OpenAI(api_key=api_key)
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # State that accumulates as tools execute
    state = {
        "parsed": None,
        "fit": None,
        "formula": None,
        "nsigma": None,
    }
    steps = []  # log of what happened

    system = SYSTEM_PROMPT
    if theoretical_value is not None:
        system += f"\nTheoretical value to compare against: {theoretical_value}"
        if theoretical_uncertainty:
            system += f" ± {theoretical_uncertainty}"
        system += "\n"

    # OpenAI tools config
    tools = [
        {
            "type": "function",
            "function": {
                "name": "parse_file",
                "description": "Parse the uploaded data file and extract columns. Use column names OR 0-based column indices. You MUST call this first to get the data.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sheet_name": {"type": "string", "description": "Sheet name to use (for Excel files). If not specified, uses the first sheet."},
                        "x_col": {"type": "string", "description": "Name of the X data column"},
                        "y_col": {"type": "string", "description": "Name of the Y data column"},
                        "x_err_col": {"type": "string", "description": "Name of the X error column (optional)"},
                        "y_err_col": {"type": "string", "description": "Name of the Y error column (optional)"},
                        "x_col_index": {"type": "integer", "description": "0-based index of X column (use if name unknown)"},
                        "y_col_index": {"type": "integer", "description": "0-based index of Y column"},
                        "x_err_col_index": {"type": "integer", "description": "0-based index of X error column"},
                        "y_err_col_index": {"type": "integer", "description": "0-based index of Y error column"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "fit_data",
                "description": "Fit the parsed data with a model. Available models: linear, quadratic, cubic, power, exponential, sinusoidal, fractional, gaussian, custom. For custom: provide custom_expr using 'x' as variable and initial_guess.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "model": {"type": "string", "description": "Model name: linear, quadratic, cubic, power, exponential, sinusoidal, fractional, gaussian, or custom"},
                        "custom_expr": {"type": "string", "description": "Custom expression (e.g. 'A*sin(omega*x+phi)+D'). Only needed if model='custom'."},
                        "initial_guess": {"type": "array", "items": {"type": "number"}, "description": "Initial parameter guesses — required for custom models, optional otherwise"},
                        "fixed_params": {"type": "object", "description": "Dict mapping parameter names to fixed values. E.g. {'c': 0} to fix the constant term at zero. Parameters not in this dict will be fitted freely."},
                    },
                    "required": ["model"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "evaluate_formula",
                "description": "Evaluate a formula using fitted parameters and propagate uncertainties. The expression must use Python/SymPy syntax (** for power, * for multiply). Variable names must match the fitted parameter names exactly.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {"type": "string", "description": "Formula expression in Python/SymPy syntax (e.g. '2*a' or 'A*omega**2')"},
                    },
                    "required": ["expression"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "compare_nsigma",
                "description": "Compare the formula result with a theoretical value using N-sigma test.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "theoretical_value": {"type": "number", "description": "The expected/theoretical value to compare against"},
                        "theoretical_uncertainty": {"type": "number", "description": "Uncertainty of the theoretical value (0 if exact)"},
                    },
                    "required": ["theoretical_value"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "generate_summary",
                "description": "Generate a final summary of all results. Call this as the LAST step after all analysis is done.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "language": {"type": "string", "description": "Language for the summary: 'en' or 'he'"},
                    },
                },
            },
        },
    ]

    # Pre-scan columns so the AI knows what's in the file before tool calls
    try:
        _pre = tool_parse_file(file_bytes, filename)
        col_list = _pre.get("columns", [])
        col_info = f"\nColumns in file: {', '.join(col_list)}" if col_list else ""
    except Exception:
        col_info = ""

    # Initial user message
    user_msg = f"File: {filename}{col_info}\n\nInstructions: {instructions}"

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_msg},
    ]

    max_turns = 10
    for turn in range(max_turns):
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                tools=tools,
                tool_choice="auto",
            )
        except Exception as e:
            steps.append({"step": "error", "message": f"OpenAI API error: {str(e)}"})
            break

        choice = response.choices[0] if response.choices else None
        if not choice:
            steps.append({"step": "error", "message": "No response from AI"})
            break

        msg = choice.message

        # If the model wants to call tools
        if msg.tool_calls:
            # Add assistant message to conversation
            messages.append(msg)

            for tool_call in msg.tool_calls:
                fn_name = tool_call.function.name
                try:
                    fn_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    fn_args = {}

                step_result = _execute_tool(fn_name, fn_args, state, file_bytes, filename)
                steps.append(step_result)

                # Add tool response to conversation
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(step_result.get("result", {"status": "done"}), default=str),
                })
        else:
            # No tool calls — AI is done, extract final text
            final_text = (msg.content or "").strip()
            if final_text:
                steps.append({"step": "summary", "message": final_text})
            break

        # Check for stop
        if choice.finish_reason == "stop":
            break

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

            # Extract fixed_params separately to pass as keyword arg
            fit_args = dict(fn_args)
            fixed_params = fit_args.pop("fixed_params", None)

            result = tool_fit_data(
                x_data=state["parsed"]["x_data"],
                y_data=state["parsed"]["y_data"],
                y_errors=state["parsed"].get("y_errors"),
                x_errors=state["parsed"].get("x_errors"),
                fixed_params=fixed_params,
                **fit_args,
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
            # Summary is generated by the AI text response after this tool call
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
    """Make result JSON-safe, truncating large arrays and sanitizing floats."""
    if not isinstance(result, dict):
        return result
    safe = {}
    for k, v in result.items():
        if isinstance(v, list) and len(v) > 20:
            safe[k] = v[:5] + ["..."] + v[-5:]
            safe[f"{k}_length"] = len(v)
        elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            safe[k] = None
        elif isinstance(v, dict):
            safe[k] = _safe_result(v)
        else:
            safe[k] = v
    return safe


# ════════════════════════════════════════════════════════════════
# CHAT ENDPOINT — talk about analysis results
# ════════════════════════════════════════════════════════════════

def _build_chat_system(context: dict) -> str:
    """Build a system prompt for post-analysis chat, injecting analysis context."""
    lines = [
        "You are a lab analysis assistant. The user has just completed an automated analysis. "
        "Help them understand, interpret, and extend their results. Be concise and scientific.\n"
        "FORMAT: Use **Markdown formatting** — **bold** for key values, numbered/bulleted lists where helpful. "
        "Use Unicode symbols: ± for plus-minus, χ² for chi-squared, σ for sigma. Do NOT use LaTeX backslash notation. "
        "Refer to χ² reduced (not χ²/dof).\n",
        "=== ANALYSIS RESULTS CONTEXT ===",
    ]

    fit = context.get("fit")
    if fit:
        lines.append(f"Model fitted: {fit.get('model_name', 'unknown')}")
        params = fit.get("parameter_names", [])
        values = fit.get("parameters", [])
        uncs = fit.get("uncertainties", [])
        if params:
            lines.append("Fitted parameters:")
            for i, p in enumerate(params):
                v = values[i] if i < len(values) else "?"
                u = uncs[i] if i < len(uncs) else "?"
                lines.append(f"  {p} = {v} ± {u}")
        rchi2 = fit.get("reduced_chi_squared")
        if rchi2 is not None:
            lines.append(f"χ² reduced = {rchi2:.4f}")
        pval = fit.get("p_value")
        if pval is not None:
            lines.append(f"P-value = {pval:.4f}")
        rsq = fit.get("r_squared")
        if rsq is not None:
            lines.append(f"R² = {rsq:.6f}")

    formula = context.get("formula")
    if formula:
        expr = formula.get("expression", "")
        fmt = formula.get("formatted", "")
        lines.append(f"Formula evaluated: {expr} = {fmt}")

    nsigma = context.get("nsigma")
    if nsigma:
        ns = nsigma.get("n_sigma", "?")
        verdict = nsigma.get("verdict", "")
        tv = nsigma.get("theoretical_value", "")
        tu = nsigma.get("theoretical_uncertainty", "")
        lines.append(f"N-sigma comparison: N-σ = {ns} — {verdict}")
        lines.append(f"  Theoretical value used: {tv} ± {tu}")

    parsed = context.get("parsed")
    if parsed:
        lines.append(f"Data columns: {', '.join(parsed.get('columns', []))}")
        lines.append(f"Data rows: {parsed.get('num_rows', '?')}")
        if parsed.get("x_col"):
            lines.append(f"X column: {parsed['x_col']}, Y column: {parsed.get('y_col', '?')}")

    instr = context.get("instructions")
    if instr:
        lines.append(f"User's original instructions: {instr}")

    file_info = context.get("file_info")
    if file_info:
        lines.append(f"File: {file_info.get('name', '?')} ({file_info.get('size', 0) / 1024:.1f} KB)")

    lines.append("=================================")
    return "\n".join(lines)


# ════════════════════════════════════════════════════════════════
# API ENDPOINTS
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
                "x_errors": fit.get("x_errors"),
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
                "r_squared": fit.get("r_squared"),
            }

        # Sanitize entire result to prevent JSON Infinity/NaN errors
        result = _sanitize_dict(result)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "steps": []}), 500


@autolab_bp.route('/chat', methods=['POST'])
def chat():
    """
    Chat about AutoLab analysis results.

    JSON body:
      - messages: [{role: 'user'|'assistant', content: str}]
      - context: {fit: {...}, formula: {...}, nsigma: {...}}
    """
    try:
        from openai import OpenAI

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return jsonify({"error": "OPENAI_API_KEY not set"}), 500

        client = OpenAI(api_key=api_key)
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        data = request.get_json(force=True)
        messages = data.get("messages", [])
        context = data.get("context", {})

        system_content = _build_chat_system(context)

        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": system_content}] + messages,
        )

        reply = response.choices[0].message.content if response.choices else "No response."
        return jsonify({"reply": reply})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
