"""
Calculation Utilities
Ported from the original Streamlit app.py
"""

import math
import re
from typing import Dict, Tuple
import numpy as np
from sympy import sympify, symbols, lambdify, diff
import ast

DEFAULT_SIG_DIGITS = 2


def scientific_round(value: float, uncertainty: float, sig_digits: int = DEFAULT_SIG_DIGITS) -> str:
    """
    Round value and uncertainty to the specified number of significant digits.
    Returns formatted string like "1.23 ± 0.04"
    """
    if uncertainty == 0 or not math.isfinite(uncertainty):
        return f"{value:.{sig_digits}g}"
    
    # Determine the order of magnitude of the uncertainty
    u_order = math.floor(math.log10(abs(uncertainty)))
    # Round uncertainty to sig_digits significant figures
    u_rounded = round(uncertainty, -u_order + sig_digits - 1)
    # Round value to the same decimal place
    v_rounded = round(value, -u_order + sig_digits - 1)
    
    # Format with appropriate precision
    if u_order >= 0:
        return f"{v_rounded:.0f} ± {u_rounded:.0f}"
    else:
        decimals = -u_order + sig_digits - 1
        return f"{v_rounded:.{decimals}f} ± {u_rounded:.{decimals}f}"


def format_sig(x: float, sig: int = 2) -> str:
    """Format number to significant figures"""
    if not math.isfinite(x) or x == 0:
        return str(x)
    return f"{x:.{sig}g}"


def parse_num_expr(s: str) -> float:
    """
    Safely parse a numerical expression string.
    Supports basic arithmetic and common functions.
    """
    s = s.strip()
    if not s:
        raise ValueError("Empty expression")
    
    # Replace common symbols
    s = s.replace('^', '**').replace('π', 'pi').replace('е', 'e')
    
    # Allowed names for eval
    safe_dict = {
        'pi': math.pi,
        'e': math.e,
        'sqrt': math.sqrt,
        'sin': math.sin,
        'cos': math.cos,
        'tan': math.tan,
        'exp': math.exp,
        'log': math.log,
        'log10': math.log10,
        'abs': abs,
    }
    
    try:
        # Parse as AST and evaluate safely
        node = ast.parse(s, mode='eval')
        
        def _eval(n):
            if isinstance(n, ast.Expression):
                return _eval(n.body)
            elif isinstance(n, ast.Num):
                return n.n
            elif isinstance(n, ast.BinOp):
                left = _eval(n.left)
                right = _eval(n.right)
                if isinstance(n.op, ast.Add):
                    return left + right
                elif isinstance(n.op, ast.Sub):
                    return left - right
                elif isinstance(n.op, ast.Mult):
                    return left * right
                elif isinstance(n.op, ast.Div):
                    return left / right
                elif isinstance(n.op, ast.Pow):
                    return left ** right
                else:
                    raise ValueError(f"Unsupported operator: {n.op}")
            elif isinstance(n, ast.UnaryOp):
                operand = _eval(n.operand)
                if isinstance(n.op, ast.USub):
                    return -operand
                elif isinstance(n.op, ast.UAdd):
                    return operand
                else:
                    raise ValueError(f"Unsupported unary operator: {n.op}")
            elif isinstance(n, ast.Call):
                func_name = n.func.id
                if func_name not in safe_dict:
                    raise ValueError(f"Unknown function: {func_name}")
                args = [_eval(arg) for arg in n.args]
                return safe_dict[func_name](*args)
            elif isinstance(n, ast.Name):
                if n.id in safe_dict:
                    return safe_dict[n.id]
                raise ValueError(f"Unknown name: {n.id}")
            else:
                raise ValueError(f"Unsupported syntax: {type(n)}")
        
        return float(_eval(node))
    except Exception as e:
        raise ValueError(f"Failed to parse expression: {e}")


def relative_error_percent(value: float, uncertainty: float, sig: int = 2) -> str:
    """Calculate relative error as percentage"""
    if value == 0:
        return "N/A"
    rel_err = abs(uncertainty / value) * 100
    return f"{rel_err:.{sig}f}%"


def n_sigma(v1, u1, v2, u2):
    """
    Calculate n-sigma difference between two measurements.
    Returns the number of standard deviations between measurements.
    """
    try:
        v1, u1, v2, u2 = float(v1), float(u1), float(v2), float(u2)
        if u1 <= 0 or u2 <= 0:
            return None, "Uncertainties must be positive"
        
        combined_uncertainty = math.sqrt(u1**2 + u2**2)
        if combined_uncertainty == 0:
            return None, "Combined uncertainty is zero"
        
        n_sig = abs(v1 - v2) / combined_uncertainty
        return n_sig, None
    except (ValueError, TypeError) as e:
        return None, str(e)


def _strip_latex_wrappers(s: str) -> str:
    """Remove LaTeX delimiters"""
    s = s.strip()
    if s.startswith('$') and s.endswith('$'):
        s = s[1:-1]
    if s.startswith('$$') and s.endswith('$$'):
        s = s[2:-2]
    return s.strip()


def _expand_frac_once(s: str) -> str:
    """Expand one \frac{a}{b} to (a)/(b)"""
    pattern = r'\\frac\{([^{}]+)\}\{([^{}]+)\}'
    return re.sub(pattern, r'((\1)/(\2))', s)


def _expand_all_frac(s: str) -> str:
    """Recursively expand all \frac"""
    prev = ''
    while prev != s:
        prev = s
        s = _expand_frac_once(s)
    return s


def _expand_sqrt(s: str) -> str:
    """Expand \sqrt{x} to sqrt(x) and \sqrt[n]{x} to x**(1/n)"""
    # \sqrt[n]{x} -> x**(1/n)
    s = re.sub(r'\\sqrt\[(\d+)\]\{([^{}]+)\}', r'((\2)**(1/\1))', s)
    # \sqrt{x} -> sqrt(x)
    s = re.sub(r'\\sqrt\{([^{}]+)\}', r'sqrt(\1)', s)
    return s


def latex_to_sympy(latex_str: str) -> str:
    """
    Convert LaTeX expression to SymPy-compatible string.
    Handles fractions, square roots, and common patterns.
    """
    s = _strip_latex_wrappers(latex_str)
    s = _expand_all_frac(s)
    s = _expand_sqrt(s)
    
    # Replace common LaTeX patterns
    s = s.replace('\\cdot', '*')
    s = s.replace('\\times', '*')
    s = s.replace('\\div', '/')
    s = s.replace('\\pm', '+')  # simplified
    s = s.replace('{', '(').replace('}', ')')
    s = s.replace('^', '**')
    
    return s


def _preprocess_for_sympy(expr: str) -> str:
    """Add implicit multiplication for patterns like 2x -> 2*x"""
    # Add * between number and letter
    expr = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', expr)
    # Add * between ) and (
    expr = re.sub(r'\)\s*\(', r')*(', expr)
    return expr


def normalize_user_expr(expr_text: str, is_latex: bool) -> str:
    """
    Normalize user expression (LaTeX or SymPy syntax) to SymPy format.
    """
    if is_latex:
        expr_text = latex_to_sympy(expr_text)
    else:
        expr_text = _preprocess_for_sympy(expr_text)
    return expr_text


def propagate_uncertainty_independent(
    expr_str: str,
    variables: Dict[str, float],
    uncertainties: Dict[str, float],
    is_latex: bool = False
) -> Tuple[float, float, str]:
    """
    Evaluate expression and propagate uncertainties.
    
    Args:
        expr_str: Expression string (LaTeX or SymPy syntax)
        variables: Dictionary of variable values
        uncertainties: Dictionary of variable uncertainties
        is_latex: Whether expression is in LaTeX format
    
    Returns:
        (result_value, result_uncertainty, error_message)
    """
    try:
        # Normalize expression
        normalized = normalize_user_expr(expr_str, is_latex)
        
        # Parse with SymPy
        expr = sympify(normalized)
        
        # Extract free symbols
        free_vars = expr.free_symbols
        
        # Ensure all variables are provided
        for var in free_vars:
            var_name = str(var)
            if var_name not in variables:
                return 0, 0, f"Missing value for variable: {var_name}"
            if var_name not in uncertainties:
                uncertainties[var_name] = 0
        
        # Evaluate expression
        result_value = float(expr.subs(variables))
        
        # Calculate uncertainty using partial derivatives
        uncertainty_squared = 0
        for var in free_vars:
            var_name = str(var)
            partial = diff(expr, var)
            partial_value = float(partial.subs(variables))
            uncertainty_squared += (partial_value * uncertainties[var_name]) ** 2
        
        result_uncertainty = math.sqrt(uncertainty_squared)
        
        return result_value, result_uncertainty, None
    
    except Exception as e:
        return 0, 0, f"Error: {str(e)}"


def _convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    """Convert temperature between Celsius, Fahrenheit, and Kelvin"""
    # Convert to Celsius first
    if from_unit == 'F':
        celsius = (value - 32) * 5/9
    elif from_unit == 'K':
        celsius = value - 273.15
    else:  # C
        celsius = value
    
    # Convert from Celsius to target
    if to_unit == 'F':
        return celsius * 9/5 + 32
    elif to_unit == 'K':
        return celsius + 273.15
    else:  # C
        return celsius


# Unit conversion factors (to base SI unit)
UNIT_CATEGORIES = {
    'Length': {
        'm': 1.0,
        'km': 1000.0,
        'cm': 0.01,
        'mm': 0.001,
        'um': 1e-6,
        'nm': 1e-9,
        'angstrom': 1e-10,
        'in': 0.0254,
        'ft': 0.3048,
        'yd': 0.9144,
        'mi': 1609.344,
        'nautical_mi': 1852.0,
        'au': 1.496e11,
        'light_year': 9.461e15,
        'parsec': 3.086e16,
    },
    'Mass': {
        'kg': 1.0,
        'g': 0.001,
        'mg': 1e-6,
        'ug': 1e-9,
        'tonne': 1000.0,
        'lb': 0.453592,
        'oz': 0.0283495,
        'slug': 14.5939,
        'atomic_mass_unit': 1.66054e-27,
        'electron_mass': 9.10938e-31,
    },
    'Time': {
        's': 1.0,
        'ms': 0.001,
        'us': 1e-6,
        'ns': 1e-9,
        'min': 60.0,
        'h': 3600.0,
        'day': 86400.0,
        'week': 604800.0,
        'year': 3.156e7,
    },
    'Force': {
        'N': 1.0,
        'kN': 1000.0,
        'dyne': 1e-5,
        'lbf': 4.44822,
        'kgf': 9.80665,
    },
    'Energy': {
        'J': 1.0,
        'kJ': 1000.0,
        'MJ': 1e6,
        'erg': 1e-7,
        'cal': 4.184,
        'kcal': 4184.0,
        'eV': 1.60218e-19,
        'keV': 1.60218e-16,
        'MeV': 1.60218e-13,
        'kWh': 3.6e6,
        'BTU': 1055.06,
    },
    'Power': {
        'W': 1.0,
        'kW': 1000.0,
        'MW': 1e6,
        'erg_per_s': 1e-7,
        'hp': 745.7,
        'BTU_per_h': 0.293071,
    },
    'Pressure': {
        'Pa': 1.0,
        'kPa': 1000.0,
        'MPa': 1e6,
        'bar': 1e5,
        'mbar': 100.0,
        'atm': 101325.0,
        'torr': 133.322,
        'mmHg': 133.322,
        'psi': 6894.76,
        'dyne_per_cm2': 0.1,
        'barye': 0.1,
    },
    'Speed': {
        'm_per_s': 1.0,
        'km_per_h': 0.277778,
        'cm_per_s': 0.01,
        'mph': 0.44704,
        'knot': 0.514444,
        'ft_per_s': 0.3048,
        'c': 2.998e8,
    },
    'Area': {
        'm2': 1.0,
        'cm2': 1e-4,
        'mm2': 1e-6,
        'km2': 1e6,
        'in2': 6.4516e-4,
        'ft2': 0.092903,
        'acre': 4046.86,
        'hectare': 1e4,
        'barn': 1e-28,
    },
    'Volume': {
        'm3': 1.0,
        'cm3': 1e-6,
        'mm3': 1e-9,
        'L': 0.001,
        'mL': 1e-6,
        'gal_US': 3.78541e-3,
        'fl_oz': 2.95735e-5,
        'ft3': 0.0283168,
        'in3': 1.6387e-5,
    },
    'Angle': {
        'rad': 1.0,
        'deg': 0.0174533,
        'arcmin': 2.90888e-4,
        'arcsec': 4.84814e-6,
        'mrad': 0.001,
        'revolution': 6.28318,
    },
    'Frequency': {
        'Hz': 1.0,
        'kHz': 1000.0,
        'MHz': 1e6,
        'GHz': 1e9,
        'rpm': 0.0166667,
    },
    'Electric_Charge': {
        'C': 1.0,
        'mC': 0.001,
        'uC': 1e-6,
        'nC': 1e-9,
        'e': 1.60218e-19,
        'statcoulomb': 3.33564e-10,
        'Ah': 3600.0,
    },
    'Magnetic_Field': {
        'T': 1.0,
        'mT': 0.001,
        'uT': 1e-6,
        'gauss': 1e-4,
        'Oe': 79.5775,
    },
    'Viscosity': {
        'Pa_s': 1.0,
        'poise': 0.1,
        'centipoise': 0.001,
    },
    'Temperature': ['C', 'F', 'K']  # Special handling
}


def convert_units(value: float, from_unit: str, to_unit: str) -> Tuple[float, str]:
    """
    Convert value from one unit to another.
    Returns (converted_value, error_message)
    """
    try:
        # Check temperature
        if from_unit in ['C', 'F', 'K'] and to_unit in ['C', 'F', 'K']:
            return _convert_temperature(value, from_unit, to_unit), None
        
        # Find category
        category = None
        for cat, units in UNIT_CATEGORIES.items():
            if isinstance(units, dict) and from_unit in units and to_unit in units:
                category = cat
                break
        
        if category is None:
            return 0, f"Cannot convert from {from_unit} to {to_unit}"
        
        # Convert via base unit
        units = UNIT_CATEGORIES[category]
        base_value = value * units[from_unit]
        result = base_value / units[to_unit]
        
        return result, None
    
    except Exception as e:
        return 0, str(e)
