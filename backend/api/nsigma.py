"""
N-Sigma Calculator API
Calculates statistical significance between two measurements
"""

from flask import Blueprint, request, jsonify
from utils.calculations import n_sigma, scientific_round

nsigma_bp = Blueprint('nsigma', __name__)


@nsigma_bp.route('/calculate', methods=['POST'])
def calculate():
    """
    Calculate n-sigma difference between two measurements.
    
    Request JSON:
    {
        "value1": 10.5,
        "uncertainty1": 0.3,
        "value2": 11.2,
        "uncertainty2": 0.4
    }
    
    Response JSON:
    {
        "n_sigma": 1.4,
        "interpretation": "Not significant",
        "error": null
    }
    """
    try:
        data = request.get_json()
        
        v1 = data.get('value1')
        u1 = data.get('uncertainty1')
        v2 = data.get('value2')
        u2 = data.get('uncertainty2')
        
        if None in [v1, u1, v2, u2]:
            return jsonify({"error": "All values and uncertainties are required"}), 400
        
        # Calculate n-sigma
        n_sig, error = n_sigma(v1, u1, v2, u2)
        
        if error:
            return jsonify({"error": error}), 400
        
        # Interpret result
        if n_sig < 1:
            interpretation = "Consistent (< 1σ)"
        elif n_sig < 2:
            interpretation = "Marginally significant (1-2σ)"
        elif n_sig < 3:
            interpretation = "Significant (2-3σ)"
        else:
            interpretation = "Highly significant (≥ 3σ)"
        
        return jsonify({
            "n_sigma": round(n_sig, 3),
            "interpretation": interpretation,
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
