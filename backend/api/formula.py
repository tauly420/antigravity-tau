"""
Formula Calculator API
Handles expression evaluation and uncertainty propagation
"""

from flask import Blueprint, request, jsonify
from utils.calculations import propagate_uncertainty_independent, scientific_round

formula_bp = Blueprint('formula', __name__)


@formula_bp.route('/evaluate', methods=['POST'])
def evaluate():
    """
    Evaluate mathematical expression with uncertainty propagation.
    
    Request JSON:
    {
        "expression": "a*x**2 + b",
        "is_latex": false,
        "variables": {"a": 1.5, "x": 2.0, "b": 3.0},
        "uncertainties": {"a": 0.1, "x": 0.05, "b": 0.2}
    }
    
    Response JSON:
    {
        "value": 9.0,
        "uncertainty": 0.447,
        "formatted": "9.00 ± 0.45",
        "error": null
    }
    """
    try:
        data = request.get_json()
        
        expression = data.get('expression', '')
        is_latex = data.get('is_latex', False)
        variables = data.get('variables', {})
        uncertainties = data.get('uncertainties', {})
        
        if not expression:
            return jsonify({"error": "Expression is required"}), 400
        
        # Evaluate and propagate uncertainty
        value, uncertainty, error = propagate_uncertainty_independent(
            expression, variables, uncertainties, is_latex
        )
        
        if error:
            return jsonify({"error": error}), 400
        
        # Format result
        formatted = scientific_round(value, uncertainty)
        
        return jsonify({
            "value": value,
            "uncertainty": uncertainty,
            "formatted": formatted,
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
