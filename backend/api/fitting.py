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
    Parse uploaded Excel or CSV file.
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

        is_csv = file.filename.endswith('.csv')
        is_excel = file.filename.endswith(('.xls', '.xlsx'))

        if not is_csv and not is_excel:
            return jsonify({"error": "Unsupported file type. Use .csv or .xlsx"}), 400

        # Read sheet_name from form data
        sheet_name = request.form.get('sheet_name', None)
        info_only = request.form.get('info_only', 'false').lower() == 'true'

        if is_csv:
            df = pd.read_csv(file)
            sheet_names = ['Sheet1']
        else:
            # If info_only, return all sheet names and columns of first sheet
            xl = pd.ExcelFile(file)
            sheet_names = xl.sheet_names

            if info_only:
                # Return metadata: sheet names + columns per sheet
                sheets_info = {}
                for sn in sheet_names:
                    try:
                        df_temp = xl.parse(sn, nrows=0)
                        sheets_info[sn] = list(df_temp.columns)
                    except Exception:
                        sheets_info[sn] = []

                return jsonify({
                    "sheet_names": sheet_names,
                    "sheets_info": sheets_info
                })

            # Parse specific sheet
            target_sheet = sheet_name if sheet_name else sheet_names[0]
            df = xl.parse(target_sheet)

        # Return all columns and data as rows
        df = df.dropna(how='all')
        columns = list(df.columns)
        
        # Convert to rows (list of dicts)
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
            # Rough guess: amplitude ~ range/2, freq ~ 2π/range
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

        # Calculate reduced chi-squared
        dof = len(x_data) - len(popt)
        if y_errors is not None:
            chi_squared = np.sum(((y_data - y_pred) / y_errors)**2)
        else:
            chi_squared = ss_res
        reduced_chi2 = chi_squared / dof if dof > 0 else chi_squared

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
            "chi_squared": float(reduced_chi2),
            "model_name": model_name,
            "x_fit": x_fit.tolist(),
            "y_fit": y_fit.tolist(),
            "residuals": residuals,
            "error": None
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
