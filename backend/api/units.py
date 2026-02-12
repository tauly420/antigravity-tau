"""
Unit Conversion API
Handles conversions between various units
"""

from flask import Blueprint, request, jsonify
from utils.calculations import convert_units, UNIT_CATEGORIES

units_bp = Blueprint('units', __name__)


@units_bp.route('/convert', methods=['POST'])
def convert():
    """
    Convert value from one unit to another.
    
    Request JSON:
    {
        "value": 100,
        "from_unit": "cm",
        "to_unit": "m"
    }
    
    Response JSON:
    {
        "result": 1.0,
        "error": null
    }
    """
    try:
        data = request.get_json()
        
        value = data.get('value')
        from_unit = data.get('from_unit')
        to_unit = data.get('to_unit')
        
        if None in [value, from_unit, to_unit]:
            return jsonify({"error": "value, from_unit, and to_unit are required"}), 400
        
        result, error = convert_units(float(value), from_unit, to_unit)
        
        if error:
            return jsonify({"error": error}), 400
        
        return jsonify({
            "result": result,
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@units_bp.route('/categories', methods=['GET'])
def get_categories():
    """
    Get all available unit categories and their units.
    
    Response JSON:
    {
        "Length": ["m", "km", "cm", ...],
        "Mass": ["kg", "g", ...],
        ...
    }
    """
    try:
        categories = {}
        for category, units in UNIT_CATEGORIES.items():
            if isinstance(units, dict):
                categories[category] = list(units.keys())
            else:  # Temperature special case
                categories[category] = units
        
        return jsonify(categories)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
