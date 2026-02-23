"""
Curve Fitting API
Handles data fitting with various models
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy import optimize, stats
from sympy import sympify, symbols, lambdify
import math

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

        fname = file.filename.lower()
        is_csv = fname.endswith('.csv')
        is_tsv = fname.endswith('.tsv') or fname.endswith('.dat') or fname.endswith('.txt')
        is_excel = fname.endswith(('.xls', '.xlsx', '.xlsm', '.xlsb'))
        is_ods = fname.endswith('.ods')

        if not (is_csv or is_tsv or is_excel or is_ods):
            return jsonify({"error": "Unsupported file type. Use .csv, .tsv, .xlsx, .xls, .xlsm, .xlsb, .ods, .dat, or .txt"}), 400

        sheet_name = request.form.get('sheet_name', None)
        info_only = request.form.get('info_only', 'false').lower() == 'true'

        if is_csv:
            df = pd.read_csv(file)
            sheet_names = ['Sheet1']
        elif is_tsv:
            df = pd.read_csv(file, sep=r'\s+|,|\t', engine='python')
            sheet_names = ['Sheet1']
        elif is_ods:
            xl = pd.ExcelFile(file, engine='odf')
            sheet_names = xl.sheet_names
            if info_only:
                sheets_info = {}
                for sn in sheet_names:
                    try:
                        df_temp = xl.parse(sn, nrows=0)
                        sheets_info[sn] = list(df_temp.columns)
                    except Exception:
                        sheets_info[sn] = []
                return jsonify({"sheet_names": sheet_names, "sheets_info": sheets_info})
            target_sheet = sheet_name if sheet_name else sheet_names[0]
            df = xl.parse(target_sheet)
        else:
            # Excel formats
            xl = pd.ExcelFile(file)
            sheet_names = xl.sheet_names
            if info_only:
                sheets_info = {}
                for sn in sheet_names:
                    try:
                        df_temp = xl.parse(sn, nrows=0)
                        sheets_info[sn] = list(df_temp.columns)
                    except Exception:
                        sheets_info[sn] = []
                return jsonify({"sheet_names": sheet_names, "sheets_info": sheets_info})
            target_sheet = sheet_name if sheet_name else sheet_names[0]
            df = xl.parse(target_sheet)

        # Return all columns and data as rows
        df = df.dropna(how='all')
        columns = list(df.columns)
        
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
            "row_count": len(rows)
        })

    except Exception as e:
        return jsonify({"error": f"Failed to parse file: {str(e)}"}), 500


@fitting_bp.route('/fit', methods=['POST'])
def fit():
    """
    Perform curve fitting on data.
    Supports: linear, quadratic, cubic, power, exponential, sinusoidal, custom

    Returns chi_squared, reduced_chi_squared, p_value, dof alongside parameters.
    """
    try:
        data = request.get_json()

        x_data = np.array(data.get('x_data', []), dtype=float)
        y_data = np.array(data.get('y_data', []), dtype=float)
        y_errors = data.get('y_errors')
        if y_errors:
            y_errors = np.array(y_errors, dtype=float)

        model_type = data.get('model', 'linear').lower()
        custom_expr = data.get('custom_expr')
        initial_guess = data.get('initial_guess')

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
            def model(x, a, b):
                return a * np.exp(b * x)
            param_names = ['a', 'b']
            model_name = "y = a·exp(b·x)"
            p0 = [1, 0.1]

        elif model_type == 'sinusoidal':
            def model(x, a, b, c, d):
                return a * np.sin(b * x + c) + d
            param_names = ['A', 'ω', 'φ', 'D']
            model_name = "y = A·sin(ω·x + φ) + D"
            amp_guess = (np.max(y_data) - np.min(y_data)) / 2
            freq_guess = 2 * np.pi / (np.max(x_data) - np.min(x_data)) if np.max(x_data) != np.min(x_data) else 1
            p0 = [amp_guess, freq_guess, 0, np.mean(y_data)]

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

        # Perform curve fitting
        try:
            if y_errors is not None:
                popt, pcov = optimize.curve_fit(model, x_data, y_data, sigma=y_errors, p0=p0, absolute_sigma=True, maxfev=10000)
            else:
                popt, pcov = optimize.curve_fit(model, x_data, y_data, p0=p0, maxfev=10000)
        except Exception as e:
            return jsonify({"error": f"Fitting failed: {str(e)}"}), 400

        # Calculate uncertainties
        perr = np.sqrt(np.diag(pcov))

        # Calculate R-squared
        y_pred = model(x_data, *popt)
        ss_res = np.sum((y_data - y_pred)**2)
        ss_tot = np.sum((y_data - np.mean(y_data))**2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

        # Degrees of freedom
        n_params = len(popt)
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
