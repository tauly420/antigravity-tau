"""
Tests for the safe expression evaluation module.
Covers security rejection (validate_math_input), ODE function building
(safe_build_ode_func), integration function building (safe_build_1d_func,
safe_build_multi_func), and condition function building (safe_build_condition_func).
"""

import pytest
import numpy as np
from utils.safe_eval import (
    validate_math_input,
    safe_build_ode_func,
    safe_build_1d_func,
    safe_build_multi_func,
    safe_build_condition_func,
)


# ============================================================
# Security tests: validate_math_input
# ============================================================

class TestValidateMathInput:
    """Tests that malicious input is rejected before reaching sympify."""

    def test_rejects_dunder_access(self):
        with pytest.raises(ValueError):
            validate_math_input("__import__('os')")

    def test_rejects_import(self):
        with pytest.raises(ValueError):
            validate_math_input("import os")

    def test_rejects_eval(self):
        with pytest.raises(ValueError):
            validate_math_input("eval('1+1')")

    def test_rejects_exec(self):
        with pytest.raises(ValueError):
            validate_math_input("exec('pass')")

    def test_rejects_open(self):
        with pytest.raises(ValueError):
            validate_math_input("open('/etc/passwd')")

    def test_rejects_os(self):
        with pytest.raises(ValueError):
            validate_math_input("os.system('ls')")

    def test_rejects_empty(self):
        with pytest.raises(ValueError):
            validate_math_input("")

    def test_rejects_disallowed_chars(self):
        with pytest.raises(ValueError):
            validate_math_input("x; rm -rf /")

    def test_accepts_math_expr(self):
        result = validate_math_input("sin(x) + cos(y)")
        assert result == "sin(x) + cos(y)"

    def test_accepts_array_indexing(self):
        result = validate_math_input("y[0] + y[1]")
        assert result == "y[0] + y[1]"


# ============================================================
# ODE function tests: safe_build_ode_func
# ============================================================

class TestSafeBuildOdeFunc:
    """Tests for ODE system expression parsing, covering all 8 presets."""

    def test_simple_pendulum(self):
        f = safe_build_ode_func("y[1], -9.81/1.0*sin(y[0])", 2)
        result = f(0, [0.5, 0])
        expected = np.array([0, -9.81 * np.sin(0.5)])
        np.testing.assert_allclose(result, expected, atol=1e-10)

    def test_damped_oscillator(self):
        f = safe_build_ode_func("y[1], -2*0.1*2*y[1] - 4*y[0]", 2)
        result = f(0, [1, 0])
        expected = np.array([0, -4.0])
        np.testing.assert_allclose(result, expected, atol=1e-10)

    def test_lotka_volterra(self):
        f = safe_build_ode_func(
            "1.5*y[0] - 1.0*y[0]*y[1], -0.75*y[1] + 0.5*y[0]*y[1]", 2
        )
        result = f(0, [10, 5])
        expected = np.array([-35.0, 21.25])
        np.testing.assert_allclose(result, expected, atol=1e-10)

    def test_lorenz(self):
        f = safe_build_ode_func(
            "10*(y[1]-y[0]), y[0]*(28-y[2])-y[1], y[0]*y[1]-(8/3)*y[2]", 3
        )
        result = f(0, [1, 1, 1])
        expected = np.array([0, 26, -5.0 / 3.0])
        np.testing.assert_allclose(result, expected, atol=1e-10)

    def test_4component_orbit(self):
        f = safe_build_ode_func(
            "y[1], y[0]*y[3]**2 - 1.0/y[0]**2, y[3], -2*y[1]*y[3]/y[0]", 4
        )
        result = f(0, [1.0, 0, 0, 1.2])
        # y[1]=0, y[0]*y[3]**2 - 1/y[0]**2 = 1*1.44 - 1 = 0.44
        # y[3]=1.2, -2*0*1.2/1.0 = 0
        expected = np.array([0, 0.44, 1.2, 0])
        np.testing.assert_allclose(result, expected, atol=1e-10)

    def test_projectile_drag(self):
        expr = (
            "y[2], y[3], "
            "-0.01*y[2]*sqrt(y[2]**2+y[3]**2), "
            "-9.81 - 0.01*y[3]*sqrt(y[2]**2+y[3]**2)"
        )
        f = safe_build_ode_func(expr, 4)
        result = f(0, [0, 0, 30, 40])
        assert np.all(np.isfinite(result))

    def test_van_der_pol(self):
        f = safe_build_ode_func("y[1], 2.0*(1 - y[0]**2)*y[1] - y[0]", 2)
        result = f(0, [2, 0])
        # y[1]=0, 2*(1-4)*0 - 2 = -2
        expected = np.array([0, -2.0])
        np.testing.assert_allclose(result, expected, atol=1e-10)

    def test_double_pendulum(self):
        expr = (
            "y[2], y[3], "
            "(-9.81*(2*1)*sin(y[0]) - 1*9.81*sin(y[0]-2*y[1]) "
            "- 2*1*1*(y[3]**2 + y[2]**2*cos(y[0]-y[1]))*sin(y[0]-y[1])) "
            "/ (1*(2*1 - 1*cos(y[0]-y[1])**2)), "
            "(2*sin(y[0]-y[1])*(1*1*y[2]**2 + 9.81*1*cos(y[0]) "
            "+ 1*1*y[3]**2*cos(y[0]-y[1]))) "
            "/ (1*(2*1 - 1*cos(y[0]-y[1])**2))"
        )
        f = safe_build_ode_func(expr, 4)
        result = f(0, [2.0, 2.5, 0, 0])
        assert np.all(np.isfinite(result))


# ============================================================
# Integration function tests: safe_build_1d_func
# ============================================================

class TestSafeBuild1dFunc:
    """Tests for single-variable expression parsing."""

    def test_1d_polynomial(self):
        f = safe_build_1d_func("x**2")
        assert f(3.0) == pytest.approx(9.0)

    def test_1d_trig(self):
        f = safe_build_1d_func("sin(x)")
        np.testing.assert_allclose(f(np.pi / 2), 1.0, atol=1e-10)

    def test_1d_exponential(self):
        f = safe_build_1d_func("exp(x)")
        assert f(0.0) == pytest.approx(1.0)


# ============================================================
# Multi-variable function tests: safe_build_multi_func
# ============================================================

class TestSafeBuildMultiFunc:
    """Tests for multi-variable expression parsing."""

    def test_multi_2d(self):
        f = safe_build_multi_func("x**2 + y**2", ["x", "y"])
        assert f(1, 1) == pytest.approx(2.0)

    def test_multi_3d(self):
        f = safe_build_multi_func("x + y + z", ["x", "y", "z"])
        assert f(1, 2, 3) == pytest.approx(6.0)


# ============================================================
# Condition function tests: safe_build_condition_func
# ============================================================

class TestSafeBuildConditionFunc:
    """Tests for condition expression parsing (with comparison operators)."""

    def test_condition_circle(self):
        f = safe_build_condition_func("x**2 + y**2 < 1", ["x", "y"])
        assert f(0.5, 0.5) is True or f(0.5, 0.5) == True
        assert f(1, 1) is False or f(1, 1) == False
