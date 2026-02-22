"""
Numerical Integration API
NEW FEATURE: 1D and multi-dimensional numerical integration
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy import integrate

integrate_bp = Blueprint('integrate', __name__)


@integrate_bp.route('/1d', methods=['POST'])
def integrate_1d():
    """
    Perform 1D numerical integration with divergence detection.
    
    Request JSON:
    {
        "function": "x**2",
        "bounds": [0, 1],
        "method": "quad"  // quad, trapezoid, simpson, romberg
    }
    
    Response JSON:
    {
        "result": 0.333,
        "error_estimate": 3.7e-15,
        "warning": null,
        "diverged": false
    }
    """
    try:
        data = request.get_json()
        
        function_str = data.get('function', '')
        bounds = data.get('bounds', [])
        method = data.get('method', 'quad').lower()
        
        if not function_str:
            return jsonify({"error": "function is required"}), 400
        
        if len(bounds) != 2:
            return jsonify({"error": "bounds must be [a, b]"}), 400
        
        a, b = bounds
        
        # Create function from string
        safe_globals = {
            'np': np,
            'sin': np.sin,
            'cos': np.cos,
            'tan': np.tan,
            'exp': np.exp,
            'log': np.log,
            'sqrt': np.sqrt,
            'abs': np.abs,
            'pi': np.pi,
            'e': np.e
        }
        
        function_code = f"lambda x: {function_str}"
        try:
            f = eval(function_code, safe_globals)
        except Exception as e:
            return jsonify({"error": f"Invalid function syntax: {str(e)}"}), 400
        
        warning = None
        diverged = False
        error_estimate = 0
        
        if method == 'quad':
            # Adaptive quadrature with error estimation
            try:
                result, error_estimate = integrate.quad(f, a, b)
                
                # Check for convergence issues
                if error_estimate > abs(result) * 0.01:  # Error > 1% of result
                    warning = "Large integration error; result may be inaccurate"
                
                # Check for infinite/NaN
                if not np.isfinite(result):
                    diverged = True
                    warning = "Integral diverges or is undefined"
                    
            except integrate.IntegrationWarning:
                diverged = True
                warning = "Integration warning: possible divergence or singularity"
                result = np.nan
                
        elif method == 'trapezoid':
            # Trapezoidal rule
            x = np.linspace(a, b, 1000)
            y = f(x)
            result = integrate.trapezoid(y, x)
            
            if not np.all(np.isfinite(y)):
                diverged = True
                warning = "Function has infinite or undefined values in integration range"
                
        elif method == 'simpson':
            # Simpson's rule
            x = np.linspace(a, b, 1001)  # Must be odd number of points
            y = f(x)
            result = integrate.simpson(y, x)
            
            if not np.all(np.isfinite(y)):
                diverged = True
                warning = "Function has infinite or undefined values in integration range"
                
        elif method == 'romberg':
            # Romberg integration
            try:
                result = integrate.romberg(f, a, b)
            except Exception as e:
                diverged = True
                warning = f"Romberg integration failed: {str(e)}"
                result = np.nan
        else:
            return jsonify({"error": f"Unknown method: {method}"}), 400
        
        return jsonify({
            "result": float(result) if np.isfinite(result) else None,
            "error_estimate": float(error_estimate) if error_estimate else None,
            "warning": warning,
            "diverged": diverged
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@integrate_bp.route('/multi', methods=['POST'])
def integrate_multi():
    """
    Perform multi-dimensional Monte Carlo integration.
    
    Request JSON:
    {
        "function": "x**2 + y**2",
        "bounds": [[0, 1], [0, 1]],  // [[x_min, x_max], [y_min, y_max], ...]
        "condition": null,  // Optional: e.g., "x**2 + y**2 < 1" for circular region
        "num_samples": 100000
    }
    
    Response JSON:
    {
        "result": 0.667,
        "error_estimate": 0.002,
        "volume": 1.0
    }
    """
    try:
        data = request.get_json()
        
        function_str = data.get('function', '')
        bounds = data.get('bounds', [])
        condition_str = data.get('condition')
        num_samples = data.get('num_samples', 100000)
        
        if not function_str:
            return jsonify({"error": "function is required"}), 400
        
        if not bounds:
            return jsonify({"error": "bounds are required"}), 400
        
        ndim = len(bounds)
        
        if ndim < 2:
            return jsonify({"error": "Use /1d endpoint for 1D integration"}), 400
        
        # Create variable names
        var_names = ['x', 'y', 'z', 'w', 'v', 'u'][:ndim]
        
        safe_globals = {
            'np': np,
            'sin': np.sin,
            'cos': np.cos,
            'tan': np.tan,
            'exp': np.exp,
            'log': np.log,
            'sqrt': np.sqrt,
            'abs': np.abs,
            'pi': np.pi,
            'e': np.e
        }
        
        # For 2D or 3D, try using scipy's nquad for better accuracy
        if ndim <= 3 and not condition_str:
            try:
                # Build function for nquad
                var_str = ', '.join(var_names)
                function_code = f"lambda {var_str}: {function_str}"
                f = eval(function_code, safe_globals)
                
                # nquad expects bounds in reverse order
                result, error = integrate.nquad(f, bounds)
                
                volume = np.prod([b[1] - b[0] for b in bounds])
                
                return jsonify({
                    "result": float(result),
                    "error_estimate": float(error),
                    "volume": float(volume),
                    "method": "nquad"
                })
            except Exception:
                # Fall back to Monte Carlo
                pass
        
        # Monte Carlo integration
        # Generate random samples in the bounding box
        samples = []
        for dim_bounds in bounds:
            samples.append(np.random.uniform(dim_bounds[0], dim_bounds[1], num_samples))
        samples = np.array(samples).T  # Shape: (num_samples, ndim)
        
        # Evaluate function at sample points
        function_code = f"lambda sample: {function_str}"
        # Replace variable names with indexed access
        for i, var in enumerate(var_names):
            function_code = function_code.replace(var, f"sample[{i}]")
        
        try:
            f = eval(function_code, safe_globals)
        except Exception as e:
            return jsonify({"error": f"Invalid function syntax: {str(e)}"}), 400
        
        # Apply condition if provided
        if condition_str:
            condition_code = f"lambda sample: {condition_str}"
            for i, var in enumerate(var_names):
                condition_code = condition_code.replace(var, f"sample[{i}]")
            
            try:
                cond = eval(condition_code, safe_globals)
            except Exception as e:
                return jsonify({"error": f"Invalid condition syntax: {str(e)}"}), 400
            
            # Filter samples by condition
            mask = np.array([cond(s) for s in samples])
            valid_samples = samples[mask]
            
            if len(valid_samples) == 0:
                return jsonify({"error": "No samples satisfy the condition"}), 400
            
            # Evaluate function on valid samples
            values = np.array([f(s) for s in valid_samples])
            
            # Volume of bounding box * fraction that satisfies condition
            box_volume = np.prod([b[1] - b[0] for b in bounds])
            effective_volume = box_volume * len(valid_samples) / num_samples
            
            # Integral estimate
            result = np.mean(values) * effective_volume
            error_estimate = np.std(values) * effective_volume / np.sqrt(len(valid_samples))
        else:
            # No condition - integrate over entire box
            values = np.array([f(s) for s in samples])
            box_volume = np.prod([b[1] - b[0] for b in bounds])
            
            result = np.mean(values) * box_volume
            error_estimate = np.std(values) * box_volume / np.sqrt(num_samples)
            effective_volume = box_volume
        
        return jsonify({
            "result": float(result),
            "error_estimate": float(error_estimate),
            "volume": float(effective_volume),
            "method": "monte_carlo"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@integrate_bp.route('/methods', methods=['GET'])
def get_methods():
    """Get available integration methods"""
    return jsonify({
        "1d_methods": [
            {"name": "quad", "description": "Adaptive quadrature (recommended)"},
            {"name": "trapezoid", "description": "Trapezoidal rule"},
            {"name": "simpson", "description": "Simpson's rule"},
            {"name": "romberg", "description": "Romberg integration"}
        ],
        "multi_methods": [
            {"name": "nquad", "description": "N-dimensional adaptive quadrature (2D-3D)"},
            {"name": "monte_carlo", "description": "Monte Carlo integration (any dimension)"}
        ]
    })
