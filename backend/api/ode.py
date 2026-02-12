"""
ODE Solver API
NEW FEATURE: Solve ordinary differential equations using scipy
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy.integrate import solve_ivp

ode_bp = Blueprint('ode', __name__)


@ode_bp.route('/solve', methods=['POST'])
def solve():
    """
    Solve ODE using scipy's solve_ivp.
    
    For first-order ODE: dy/dt = f(t, y)
    For higher-order: convert to system of first-order ODEs
    
    Request JSON:
    {
        "function": "y[1], -y[0]",  // For second-order: y'' = -y
        "initial_conditions": [1.0, 0.0],  // [y(0), y'(0)]
        "t_span": [0, 10],
        "num_points": 100,
        "method": "RK45"  // RK45, RK23, DOP853, Radau, BDF, LSODA
    }
    
    Response JSON:
    {
        "t": [0, 0.1, 0.2, ...],
        "y": [[1.0, ...], [0, ...]],  // Each row is one component
        "error": null
    }
    """
    try:
        data = request.get_json()
        
        function_str = data.get('function', '')
        y0 = data.get('initial_conditions', [])
        t_span = data.get('t_span', [0, 10])
        num_points = data.get('num_points', 100)
        method = data.get('method', 'RK45')
        
        if not function_str:
            return jsonify({"error": "function is required"}), 400
        
        if not y0:
            return jsonify({"error": "initial_conditions are required"}), 400
        
        # Create function from string
        # The function should be in the form: "expr1, expr2, ..." for system
        # Variables available: t (time), y (state vector)
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
        
        # Build the ODE function
        function_code = f"lambda t, y: np.array([{function_str}])"
        try:
            f = eval(function_code, safe_globals)
        except Exception as e:
            return jsonify({"error": f"Invalid function syntax: {str(e)}"}), 400
        
        # Convert initial conditions to numpy array
        y0 = np.array(y0, dtype=float)
        
        # Solve the ODE
        t_eval = np.linspace(t_span[0], t_span[1], num_points)
        
        solution = solve_ivp(
            f,
            t_span,
            y0,
            method=method,
            t_eval=t_eval,
            dense_output=True
        )
        
        if not solution.success:
            return jsonify({"error": f"Solver failed: {solution.message}"}), 400
        
        return jsonify({
            "t": solution.t.tolist(),
            "y": solution.y.tolist(),  # Each row is one component of the solution
            "message": solution.message,
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ode_bp.route('/methods', methods=['GET'])
def get_methods():
    """
    Get available ODE solver methods.
    
    Response JSON:
    {
        "methods": [
            {"name": "RK45", "description": "Explicit Runge-Kutta (default)"},
            ...
        ]
    }
    """
    methods = [
        {"name": "RK45", "description": "Explicit Runge-Kutta method of order 5(4) [default]"},
        {"name": "RK23", "description": "Explicit Runge-Kutta method of order 3(2)"},
        {"name": "DOP853", "description": "Explicit Runge-Kutta method of order 8"},
        {"name": "Radau", "description": "Implicit Runge-Kutta method (stiff problems)"},
        {"name": "BDF", "description": "Backward differentiation formula (stiff problems)"},
        {"name": "LSODA", "description": "Automatic stiffness detection and switching"}
    ]
    
    return jsonify({"methods": methods})
