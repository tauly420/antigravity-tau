"""
Safe Expression Evaluation Module

Replaces eval() with input validation + sympify + lambdify for secure
mathematical expression parsing. Used by ODE solver and Integration solver.

Two-layer security:
  1. Regex-based input validation rejects non-mathematical tokens BEFORE sympify
  2. SymPy sympify() with restricted local_dict parses into symbolic expressions
  3. lambdify() converts to efficient numpy callables

WARNING: sympify() calls eval() internally -- that's why Layer 1 is critical.
"""

import re
import sympy
from sympy import sympify, lambdify, symbols, IndexedBase
import numpy as np


# ============================================================
# Layer 1: Input validation (regex-based)
# ============================================================

_FORBIDDEN_PATTERNS = [
    r'__',          # dunder access (__import__, __class__, etc.)
    r'\bimport\b',  # import statements
    r'\beval\b',    # eval/exec
    r'\bexec\b',
    r'\bopen\b',    # file access
    r'\bos\b',      # os module
    r'\bsys\b',     # sys module
    r'\bgetattr\b', # attribute introspection
    r'\bsetattr\b',
    r'\bglobals\b',
    r'\blocals\b',
    r'\bcompile\b',
    r'\bbreakpoint\b',
    r'\blambda\b',  # no lambda definitions
    r'\bclass\b',
    r'\bdef\b',
    r'\bfor\b',
    r'\bwhile\b',
    r'\breturn\b',
    r'\byield\b',
    r'\braise\b',
    r'\btry\b',
    r'\bwith\b',
    r'\bdel\b',
    r'\bprint\b',
]

_ALLOWED_CHARS = re.compile(r'^[a-zA-Z0-9\s\+\-\*/\(\)\[\]\.\,\^\_]+$')
_ALLOWED_CHARS_WITH_COMPARISONS = re.compile(
    r'^[a-zA-Z0-9\s\+\-\*/\(\)\[\]\.\,\^\_\<\>\=\!]+$'
)


# ============================================================
# Layer 2: SymPy math namespace
# ============================================================

_SYMPY_MATH = {
    'sin': sympy.sin, 'cos': sympy.cos, 'tan': sympy.tan,
    'asin': sympy.asin, 'acos': sympy.acos, 'atan': sympy.atan,
    'atan2': sympy.atan2, 'arctan2': sympy.atan2,
    'exp': sympy.exp, 'log': sympy.log,
    'log10': lambda x: sympy.log(x, 10),
    'sqrt': sympy.sqrt, 'abs': sympy.Abs,
    'pi': sympy.pi, 'e': sympy.E,
    'sinh': sympy.sinh, 'cosh': sympy.cosh, 'tanh': sympy.tanh,
    'sign': sympy.sign, 'floor': sympy.floor, 'ceil': sympy.ceiling,
    'heaviside': sympy.Heaviside,
}


# ============================================================
# Public API
# ============================================================

def validate_math_input(expr_str: str) -> str:
    """Reject non-mathematical input. Returns stripped string or raises ValueError."""
    stripped = expr_str.strip()
    if not stripped:
        raise ValueError("Empty expression")
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, stripped):
            raise ValueError("Expression contains forbidden pattern")
    if not _ALLOWED_CHARS.match(stripped):
        raise ValueError("Expression contains disallowed characters")
    return stripped


def _validate_math_input_with_comparisons(expr_str: str) -> str:
    """Like validate_math_input but allows comparison operators (< > = !)."""
    stripped = expr_str.strip()
    if not stripped:
        raise ValueError("Empty expression")
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, stripped):
            raise ValueError("Expression contains forbidden pattern")
    if not _ALLOWED_CHARS_WITH_COMPARISONS.match(stripped):
        raise ValueError("Expression contains disallowed characters")
    return stripped


def safe_build_ode_func(function_str: str, num_components: int):
    """Build callable f(t, y) -> np.array from validated ODE expression string.

    function_str: comma-separated components like 'y[1], -9.81*sin(y[0])'
    num_components: number of state variables (len of y)
    Returns: function(t_val, y_val) -> np.array
    """
    validated = validate_math_input(function_str)

    y = IndexedBase('y')
    t = symbols('t')
    local_dict = dict(_SYMPY_MATH, y=y, t=t)

    parsed = sympify(validated, locals=local_dict)
    components = list(parsed) if isinstance(parsed, tuple) else [parsed]

    # Substitute y[i] -> plain symbols for lambdify compatibility
    y_syms = [symbols(f'_y{i}') for i in range(num_components)]
    subs = {y[i]: y_syms[i] for i in range(num_components)}

    funcs = []
    for comp in components:
        comp_sub = comp.subs(subs)
        f = lambdify([t] + y_syms, comp_sub, modules='numpy')
        funcs.append(f)

    def ode_func(t_val, y_val):
        return np.array([f(t_val, *y_val) for f in funcs])

    return ode_func


def safe_build_1d_func(function_str: str):
    """Build callable f(x) from validated single-variable expression string."""
    validated = validate_math_input(function_str)
    x = symbols('x')
    local_dict = dict(_SYMPY_MATH, x=x)
    parsed = sympify(validated, locals=local_dict)
    return lambdify(x, parsed, modules='numpy')


def safe_build_multi_func(function_str: str, var_names: list):
    """Build callable f(x, y, ...) from validated multi-variable expression string."""
    validated = validate_math_input(function_str)
    syms = {name: symbols(name) for name in var_names}
    local_dict = dict(_SYMPY_MATH, **syms)
    parsed = sympify(validated, locals=local_dict)
    sym_list = [syms[name] for name in var_names]
    return lambdify(sym_list, parsed, modules='numpy')


def safe_build_condition_func(condition_str: str, var_names: list):
    """Build callable f(x, y, ...) -> bool from validated condition expression."""
    validated = _validate_math_input_with_comparisons(condition_str)
    syms = {name: symbols(name) for name in var_names}
    local_dict = dict(_SYMPY_MATH, **syms)
    parsed = sympify(validated, locals=local_dict)
    return lambdify([syms[name] for name in var_names], parsed, modules='numpy')
