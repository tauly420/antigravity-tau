"""
Curve Fitting API
Handles data fitting with various models
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy import optimize, stats
from sympy import sympify, symbols, lambdify
import math
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.calculations import robust_read_tabular, file_kind_from_name

fitting_bp = Blueprint('fitting', __name__)


@fitting_bp.route('/parse', methods=['POST'])
def parse_file():
    """
    Parse uploaded data file.
    Supports: .csv, .tsv, .xlsx, .xls, .ods, .dat
    If 'info_only' query param is set, return sheet names and column names.
    Otherwise, return data from the specified sheet and columns.
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        import pandas as pd

        kind = file_kind_from_name(file.filename)
        if kind is None:
            return jsonify({"error": "Unsupported file type. Use .csv, .tsv, .xlsx, .xls, .xlsm, .xlsb, .ods, .dat, or .txt"}), 400

        sheet_name = request.form.get('sheet_name', None)
        info_only = request.form.get('info_only', 'false').lower() == 'true'
        max_rows_str = request.form.get('max_rows', None)
        max_rows = int(max_rows_str) if max_rows_str else None

        # For multi-sheet info-only requests, read every sheet's columns via the
        # robust parser so headerless sheets still report sensible column names.
        if info_only and kind in ('excel', 'ods'):
            try:
                file.seek(0)
            except (AttributeError, OSError):
                pass
            engine = 'odf' if kind == 'ods' else None
            xl = pd.ExcelFile(file, engine=engine)
            sheet_names_all = xl.sheet_names or ['Sheet1']
            sheets_info = {}
            for sn in sheet_names_all:
                try:
                    file.seek(0)
                except (AttributeError, OSError):
                    pass
                try:
                    df_sn, _ = robust_read_tabular(file, kind, sheet_name=sn)
                    sheets_info[sn] = list(df_sn.columns)
                except Exception:
                    sheets_info[sn] = []
            return jsonify({"sheet_names": sheet_names_all, "sheets_info": sheets_info})

        df, sheet_names = robust_read_tabular(file, kind, sheet_name=sheet_name)

        if df is None or df.empty or len(df.columns) == 0:
            # Sheet has no tabular data (e.g., only an embedded image).
            return jsonify({
                "columns": list(df.columns) if df is not None else [],
                "rows": [],
                "sheet_names": sheet_names,
                "row_count": 0,
                "warning": "Sheet contains no tabular data (it may hold only images, charts, or be empty).",
            })

        total_rows = len(df)
        columns = list(df.columns)

        # Optionally limit rows (for preview)
        if max_rows is not None and max_rows > 0:
            df = df.head(max_rows)

        rows = []
        for _, row in df.iterrows():
            row_dict = {}
            for col in columns:
                val = row[col]
                try:
                    row_dict[col] = float(val)
                except (ValueError, TypeError):
                    row_dict[col] = str(val) if pd.notna(val) else None
            rows.append(row_dict)

        return jsonify({
            "columns": columns,
            "rows": rows,
            "sheet_names": sheet_names,
            "row_count": total_rows
        })

    except Exception as e:
        return jsonify({"error": f"Failed to parse file: {str(e)}"}), 500


@fitting_bp.route('/fit', methods=['POST'])
def fit():
    """
    Perform curve fitting on data.
    Supports: linear, quadratic, cubic, power, exponential, sinusoidal, fractional, gaussian, custom

    Returns chi_squared, reduced_chi_squared, p_value, dof alongside parameters.
    """
    try:
        data = request.get_json()

        x_data = np.array(data.get('x_data', []), dtype=float)
        y_data = np.array(data.get('y_data', []), dtype=float)
        y_errors = data.get('y_errors')
        if y_errors:
            y_errors = np.array(y_errors, dtype=float)
            # Replace zero uncertainties with a small positive value to avoid division by zero
            if np.any(y_errors == 0):
                min_nonzero = np.min(y_errors[y_errors > 0]) if np.any(y_errors > 0) else 1.0
                y_errors = np.where(y_errors == 0, min_nonzero * 0.1, y_errors)

        model_type = data.get('model', 'linear').lower()
        custom_expr = data.get('custom_expr')
        initial_guess = data.get('initial_guess')
        fixed_params_raw = data.get('fixed_params') or {}
        # Coerce fixed-param values to floats; ignore invalid
        fixed_params = {}
        for k, v in fixed_params_raw.items():
            try:
                fixed_params[str(k)] = float(v)
            except (TypeError, ValueError):
                continue

        if len(x_data) != len(y_data):
            return jsonify({"error": "x_data and y_data must have the same length"}), 400

        if len(x_data) < 2:
            return jsonify({"error": "At least 2 data points are required"}), 400

        # Define model function and parameter names
        if model_type == 'linear':
            def model(x, a, b):
                return a * x + b
            param_names = ['a', 'b']
            model_name = "y = a·x + b"
            p0 = None

        elif model_type == 'quadratic':
            def model(x, a, b, c):
                return a * x**2 + b * x + c
            param_names = ['a', 'b', 'c']
            model_name = "y = a·x² + b·x + c"
            p0 = None

        elif model_type == 'cubic':
            def model(x, a, b, c, d):
                return a * x**3 + b * x**2 + c * x + d
            param_names = ['a', 'b', 'c', 'd']
            model_name = "y = a·x³ + b·x² + c·x + d"
            p0 = None

        elif model_type == 'power':
            def model(x, a, b):
                return a * x**b
            param_names = ['a', 'b']
            model_name = "y = a·x^b"
            p0 = [1, 1]

        elif model_type == 'exponential':
            def model(x, a, b, c):
                return a * np.exp(b * x) + c
            param_names = ['a', 'b', 'c']
            model_name = "y = a·exp(b·x) + c"
            p0 = [1.0, 0.1, 0.0]

        elif model_type == 'sinusoidal':
            def model(x, a, b, c, d):
                return a * np.sin(b * x + c) + d
            param_names = ['A', 'ω', 'φ', 'D']
            model_name = "y = A·sin(ω·x + φ) + D"
            amp_guess = (np.max(y_data) - np.min(y_data)) / 2
            freq_guess = 2 * np.pi / (np.max(x_data) - np.min(x_data)) if np.max(x_data) != np.min(x_data) else 1
            p0 = [amp_guess, freq_guess, 0, np.mean(y_data)]

        elif model_type == 'fractional':
            def model(x, a, b, c, d):
                return a / (b * x + c) + d
            param_names = ['a', 'b', 'c', 'd']
            model_name = "y = a/(b\u00b7x+c) + d"
            p0 = [1.0, 1.0, 1.0, 0.0]

        elif model_type == 'gaussian':
            def model(x, A, mu, sigma, D):
                return A * np.exp(-((x - mu)**2) / (2 * sigma**2)) + D
            param_names = ['A', 'mu', 'sigma', 'D']
            model_name = "y = A\u00b7exp(-(x-\u03bc)\u00b2/(2\u03c3\u00b2)) + D"
            p0 = [1.0, 0.0, 1.0, 0.0]

        elif model_type == 'super_gaussian':
            # Super-Gaussian: exponent is the regular Gaussian exponent, squared.
            # y = A * exp(-((x-mu)^2 / (2*sigma^2))^2) + D  -> overall power 4 in x
            def model(x, A, mu, sigma, D):
                u = ((x - mu)**2) / (2 * sigma**2)
                return A * np.exp(-(u**2)) + D
            param_names = ['A', 'mu', 'sigma', 'D']
            model_name = "y = A\u00b7exp(-((x-\u03bc)\u00b2/(2\u03c3\u00b2))\u00b2) + D"
            # Initial guess from data shape if possible
            try:
                A0 = float(np.max(y_data) - np.min(y_data))
                mu0 = float(x_data[int(np.argmax(y_data))])
                sigma0 = float((np.max(x_data) - np.min(x_data)) / 4) or 1.0
                D0 = float(np.min(y_data))
                p0 = [A0, mu0, sigma0, D0]
            except Exception:
                p0 = [1.0, 0.0, 1.0, 0.0]

        elif model_type == 'custom':
            if not custom_expr:
                return jsonify({"error": "custom_expr is required for custom model"}), 400

            try:
                expr = sympify(custom_expr)
                free_vars = expr.free_symbols

                if symbols('x') not in free_vars:
                    return jsonify({"error": "Custom expression must contain variable 'x'"}), 400

                param_syms = sorted([s for s in free_vars if str(s) != 'x'], key=str)
                param_names = [str(s) for s in param_syms]

                model = lambdify([symbols('x')] + param_syms, expr, 'numpy')
                model_name = f"y = {custom_expr}"
                p0 = initial_guess

            except Exception as e:
                return jsonify({"error": f"Invalid custom expression: {str(e)}"}), 400
        else:
            return jsonify({"error": f"Unknown model type: {model_type}"}), 400

        # If user pinned some parameters to specific values, wrap the model so that
        # curve_fit only optimises the remaining (free) parameters. Fixed parameters
        # are reported with their pinned value and zero uncertainty.
        active_fixed = {k: v for k, v in fixed_params.items() if k in param_names}
        free_indices = [i for i, p in enumerate(param_names) if p not in active_fixed]
        free_param_names = [param_names[i] for i in free_indices]

        if active_fixed and free_indices:
            base_model = model

            def wrapped_model(x, *free_args):
                full = []
                fi = 0
                for p in param_names:
                    if p in active_fixed:
                        full.append(active_fixed[p])
                    else:
                        full.append(free_args[fi])
                        fi += 1
                return base_model(x, *full)

            fit_model = wrapped_model
            fit_p0 = [p0[i] for i in free_indices] if isinstance(p0, (list, tuple)) and len(p0) == len(param_names) else None
        elif active_fixed and not free_indices:
            return jsonify({"error": "All parameters were fixed; nothing left to fit."}), 400
        else:
            fit_model = model
            fit_p0 = p0

        # Perform curve fitting
        try:
            if y_errors is not None:
                popt_free, pcov_free = optimize.curve_fit(fit_model, x_data, y_data, sigma=y_errors, p0=fit_p0, absolute_sigma=True, maxfev=10000)
            else:
                popt_free, pcov_free = optimize.curve_fit(fit_model, x_data, y_data, p0=fit_p0, maxfev=10000)
        except Exception as e:
            return jsonify({"error": f"Fitting failed: {str(e)}"}), 400

        perr_free = np.sqrt(np.diag(pcov_free))

        # Reconstruct full popt / perr including fixed parameters
        if active_fixed:
            popt = []
            perr = []
            fi = 0
            for p in param_names:
                if p in active_fixed:
                    popt.append(active_fixed[p])
                    perr.append(0.0)
                else:
                    popt.append(float(popt_free[fi]))
                    perr.append(float(perr_free[fi]))
                    fi += 1
            popt = np.array(popt)
            perr = np.array(perr)
        else:
            popt = popt_free
            perr = perr_free

        # Calculate R-squared
        y_pred = model(x_data, *popt)
        ss_res = np.sum((y_data - y_pred)**2)
        ss_tot = np.sum((y_data - np.mean(y_data))**2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        # Degrees of freedom — only free parameters consume a dof
        n_params = len(free_param_names) if active_fixed else len(popt)
        n_data = len(x_data)
        dof = n_data - n_params

        # Chi-squared and P-value
        if y_errors is not None:
            chi2_total = float(np.sum(((y_data - y_pred) / y_errors)**2))
        else:
            # Without y_errors, estimate sigma from residuals
            chi2_total = float(ss_res)

        reduced_chi2 = chi2_total / dof if dof > 0 else float('inf')

        # P-value: probability of getting chi² >= observed, given dof
        if dof > 0 and y_errors is not None:
            p_value = float(stats.chi2.sf(chi2_total, dof))
        else:
            p_value = None  # Undefined without proper errors or dof

        # Generate fitted curve
        x_fit = np.linspace(x_data.min(), x_data.max(), 200)
        y_fit = model(x_fit, *popt)

        # Calculate residuals
        residuals = (y_data - y_pred).tolist()

        return jsonify({
            "parameters": popt.tolist(),
            "uncertainties": perr.tolist(),
            "parameter_names": param_names,
            "fixed_params": active_fixed,
            "r_squared": float(r_squared),
            "chi_squared": chi2_total,
            "reduced_chi_squared": float(reduced_chi2),
            "p_value": p_value,
            "dof": dof,
            "n_data": n_data,
            "n_params": n_params,
            "model_name": model_name,
            "x_fit": x_fit.tolist(),
            "y_fit": y_fit.tolist(),
            "residuals": residuals,
            "error": None
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
