"""
Curve Fitting API
Handles data fitting with various models
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy import optimize, stats
from sympy import sympify, symbols, lambdify

fitting_bp = Blueprint('fitting', __name__)


@fitting_bp.route('/fit', methods=['POST'])
def fit():
    """
    Perform curve fitting on data.
    
    Request JSON:
    {
        "x_data": [1, 2, 3, 4, 5],
        "y_data": [2.1, 3.9, 6.2, 7.8, 10.1],
        "y_errors": [0.2, 0.3, 0.2, 0.4, 0.3],  // optional
        "model": "linear",  // linear, quadratic, cubic, power, exponential, custom
        "custom_expr": null,  // for custom model, e.g., "a*x**b + c"
        "initial_guess": null  // optional initial parameter guess for custom models
    }
    
    Response JSON:
    {
        "parameters": [2.01, 0.03],
        "uncertainties": [0.15, 0.02],
        "r_squared": 0.998,
        "chi_squared": 0.5,
        "model_name": "y = a*x + b",
        "x_fit": [1, 1.1, ..., 5],
        "y_fit": [2.04, 2.24, ..., 10.08]
    }
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
            model_name = "y = a*x + b"
            p0 = None
            
        elif model_type == 'quadratic':
            def model(x, a, b, c):
                return a * x**2 + b * x + c
            param_names = ['a', 'b', 'c']
            model_name = "y = a*x² + b*x + c"
            p0 = None
            
        elif model_type == 'cubic':
            def model(x, a, b, c, d):
                return a * x**3 + b * x**2 + c * x + d
            param_names = ['a', 'b', 'c', 'd']
            model_name = "y = a*x³ + b*x² + c*x + d"
            p0 = None
            
        elif model_type == 'power':
            def model(x, a, b):
                return a * x**b
            param_names = ['a', 'b']
            model_name = "y = a*x^b"
            p0 = [1, 1]
            
        elif model_type == 'exponential':
            def model(x, a, b):
                return a * np.exp(b * x)
            param_names = ['a', 'b']
            model_name = "y = a*exp(b*x)"
            p0 = [1, 0.1]
            
        elif model_type == 'custom':
            if not custom_expr:
                return jsonify({"error": "custom_expr is required for custom model"}), 400
            
            # Parse custom expression
            try:
                expr = sympify(custom_expr)
                free_vars = expr.free_symbols
                
                # Separate x from parameters
                if symbols('x') not in free_vars:
                    return jsonify({"error": "Custom expression must contain variable 'x'"}), 400
                
                param_syms = [s for s in free_vars if str(s) != 'x']
                param_names = [str(s) for s in param_syms]
                
                # Create lambda function
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
                popt, pcov = optimize.curve_fit(model, x_data, y_data, sigma=y_errors, p0=p0, absolute_sigma=True)
            else:
                popt, pcov = optimize.curve_fit(model, x_data, y_data, p0=p0)
        except Exception as e:
            return jsonify({"error": f"Fitting failed: {str(e)}"}), 400
        
        # Calculate uncertainties
        perr = np.sqrt(np.diag(pcov))
        
        # Calculate R-squared
        y_pred = model(x_data, *popt)
        ss_res = np.sum((y_data - y_pred)**2)
        ss_tot = np.sum((y_data - np.mean(y_data))**2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        # Calculate chi-squared
        if y_errors is not None:
            chi_squared = np.sum(((y_data - y_pred) / y_errors)**2)
        else:
            chi_squared = ss_res
        
        # Generate fitted curve
        x_fit = np.linspace(x_data.min(), x_data.max(), 200)
        y_fit = model(x_fit, *popt)
        
        # Calculate residuals
        residuals = y_data - y_pred
        
        return jsonify({
            "parameters": popt.tolist(),
            "uncertainties": perr.tolist(),
            "parameter_names": param_names,
            "r_squared": float(r_squared),
            "chi_squared": float(chi_squared),
            "model_name": model_name,
            "x_fit": x_fit.tolist(),
            "y_fit": y_fit.tolist(),
            "residuals": residuals.tolist(),
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
