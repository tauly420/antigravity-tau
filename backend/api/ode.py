"""
ODE Solver API — Enhanced
Supports Cartesian & polar coordinate systems, energy computation,
event detection, and parametric (x-y) output.
"""

from flask import Blueprint, request, jsonify
import numpy as np
from scipy.integrate import solve_ivp
from utils.safe_eval import safe_build_ode_func

ode_bp = Blueprint('ode', __name__)


@ode_bp.route('/solve', methods=['POST'])
def solve():
    """
    Solve ODE system.

    Extra fields (all optional):
      coordinate_system: "cartesian" | "polar"
      compute_energy: bool – if true & 2-component, returns KE, PE, total
      energy_expr: str – custom energy expression (uses y, t)
      events: list[{expression, terminal, direction}]
    """
    try:
        data = request.get_json()

        function_str = data.get('function', '')
        y0 = data.get('initial_conditions', [])
        t_span = data.get('t_span', [0, 10])
        num_points = data.get('num_points', 300)
        method = data.get('method', 'RK45')
        coord = data.get('coordinate_system', 'cartesian')
        compute_energy = data.get('compute_energy', False)
        energy_expr_str = data.get('energy_expr', '')

        if not function_str:
            return jsonify({"error": "function is required"}), 400
        if not y0:
            return jsonify({"error": "initial_conditions are required"}), 400

        y0_list = y0
        num_components = len(y0_list)

        # Build the ODE function using safe expression parser
        try:
            f = safe_build_ode_func(function_str, num_components)
        except ValueError as e:
            return jsonify({"error": f"Invalid function: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": f"Invalid function syntax: {str(e)}"}), 400

        y0 = np.array(y0_list, dtype=float)
        t_eval = np.linspace(t_span[0], t_span[1], num_points)

        # ── Solve ──
        sol = solve_ivp(
            f, t_span, y0,
            method=method,
            t_eval=t_eval,
            dense_output=True,
            max_step=float(data.get('max_step', 0)) or np.inf,
            rtol=float(data.get('rtol', 1e-8)),
            atol=float(data.get('atol', 1e-10)),
        )

        if not sol.success:
            return jsonify({"error": f"Solver failed: {sol.message}"}), 400

        result = {
            "t": sol.t.tolist(),
            "y": sol.y.tolist(),
            "message": sol.message,
            "error": None,
        }

        # ── Polar → Cartesian conversion ──
        if coord == 'polar' and sol.y.shape[0] >= 2:
            r = sol.y[0]
            theta = sol.y[1]
            x_cart = (r * np.cos(theta)).tolist()
            y_cart = (r * np.sin(theta)).tolist()
            result["x_cartesian"] = x_cart
            result["y_cartesian"] = y_cart
            result["r"] = r.tolist()
            result["theta"] = theta.tolist()

        # ── Energy computation ──
        if compute_energy and sol.y.shape[0] >= 2:
            if energy_expr_str.strip():
                # Custom energy expression (uses same t, y variables as ODE)
                try:
                    e_func = safe_build_ode_func(energy_expr_str, num_components)
                    energy_vals = np.array([
                        e_func(sol.t[i], sol.y[:, i])[0]
                        for i in range(len(sol.t))
                    ])
                    result["energy"] = energy_vals.tolist()
                except Exception as e:
                    result["energy_error"] = str(e)
            else:
                # Default: assume y[0]=position, y[1]=velocity → KE + PE
                # KE = 0.5*v^2, PE = 0.5*x^2 (harmonic approx)
                vel = sol.y[1]
                pos = sol.y[0]
                ke = 0.5 * vel ** 2
                pe = 0.5 * pos ** 2
                result["kinetic_energy"] = ke.tolist()
                result["potential_energy"] = pe.tolist()
                result["total_energy"] = (ke + pe).tolist()

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ode_bp.route('/methods', methods=['GET'])
def get_methods():
    """Get available ODE solver methods."""
    methods = [
        {"name": "RK45", "description": "Explicit Runge-Kutta 5(4) — general purpose [default]"},
        {"name": "RK23", "description": "Explicit Runge-Kutta 3(2) — fast, lower accuracy"},
        {"name": "DOP853", "description": "Explicit Runge-Kutta 8 — high precision"},
        {"name": "Radau", "description": "Implicit Runge-Kutta — stiff problems"},
        {"name": "BDF", "description": "Backward differentiation — stiff problems"},
        {"name": "LSODA", "description": "Auto stiffness detection — best for unknowns"},
    ]
    return jsonify({"methods": methods})
