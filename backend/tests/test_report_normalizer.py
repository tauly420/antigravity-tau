"""Tests for report_normalizer.normalize_autolab_result()."""
import math
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.report_normalizer import normalize_autolab_result


FULL_STATE = {
    "parsed": {
        "columns": ["x", "y"], "x_data": [1, 2, 3], "y_data": [2, 4, 6],
        "y_errors": [0.1, 0.1, 0.1], "x_errors": None, "x_col": "x", "y_col": "y"
    },
    "fit": {
        "parameters": [2.0, 0.01], "uncertainties": [0.05, 0.02],
        "parameter_names": ["a", "b"],
        "chi_squared": 3.5, "reduced_chi_squared": 0.875, "p_value": 0.52,
        "r_squared": 0.999, "dof": 4,
        "model_name": "linear",
        "x_data": [1, 2, 3], "y_data": [2, 4, 6],
        "x_fit": [1, 1.5, 2, 2.5, 3], "y_fit": [2, 3, 4, 5, 6],
        "residuals": [0.01, -0.02, 0.01],
        "y_errors": [0.1, 0.1, 0.1], "x_errors": None
    },
    "formula": {
        "value": 9.81, "uncertainty": 0.10,
        "formatted": "9.81 +/- 0.10", "expression": "2*a"
    },
    "nsigma": {
        "n_sigma": 0.5, "verdict": "Excellent agreement",
        "theoretical_value": 9.81, "theoretical_uncertainty": 0.01
    }
}

FULL_STEPS = [
    {"step": "parse", "tool": "parse_file", "result": {}, "success": True},
    {"step": "fit", "tool": "fit_data", "result": {}, "success": True},
    {"step": "summary", "message": "The analysis shows a linear relationship."}
]


def test_full_normalization():
    result = normalize_autolab_result(FULL_STATE, FULL_STEPS, "Fit linearly", "data.csv")
    assert result["fit"] is not None
    assert result["formula"] is not None
    assert result["nsigma"] is not None
    assert result["summary"] == "The analysis shows a linear relationship."
    assert result["instructions"] == "Fit linearly"
    assert result["filename"] == "data.csv"
    assert result["fit"]["modelName"] == "linear"
    assert len(result["fit"]["parameters"]) == 2
    assert result["fit"]["goodnessOfFit"]["chiSquaredReduced"] == 0.875


def test_partial_fit_only():
    state = {
        "parsed": FULL_STATE["parsed"],
        "fit": FULL_STATE["fit"],
        "formula": None,
        "nsigma": None
    }
    result = normalize_autolab_result(state, FULL_STEPS, "Fit only", "data.csv")
    assert result["fit"] is not None
    assert result["formula"] is None
    assert result["nsigma"] is None


def test_empty_state():
    result = normalize_autolab_result({}, [], "", "")
    assert result["fit"] is None
    assert result["formula"] is None
    assert result["nsigma"] is None
    assert result["summary"] is None


def test_nan_handling():
    state = dict(FULL_STATE)
    state["fit"] = dict(FULL_STATE["fit"])
    state["fit"]["reduced_chi_squared"] = float('nan')
    state["fit"]["p_value"] = float('inf')
    result = normalize_autolab_result(state, FULL_STEPS, "", "")
    assert result["fit"]["goodnessOfFit"]["chiSquaredReduced"] is None
    assert result["fit"]["goodnessOfFit"]["pValue"] is None


def test_camel_case_keys():
    result = normalize_autolab_result(FULL_STATE, FULL_STEPS, "", "")

    def check_no_snake(d, path=""):
        if isinstance(d, dict):
            for k, v in d.items():
                assert "_" not in k, f"Snake case key '{k}' found at {path}"
                check_no_snake(v, f"{path}.{k}")
        elif isinstance(d, list):
            for i, item in enumerate(d):
                check_no_snake(item, f"{path}[{i}]")

    check_no_snake(result)


def test_parameter_latex():
    result = normalize_autolab_result(FULL_STATE, FULL_STEPS, "", "")
    param = result["fit"]["parameters"][0]
    assert param["name"] == "a"
    assert "latex" in param
    # Should contain the parameter name and \\pm
    assert "a" in param["latex"]
    assert "\\pm" in param["latex"]
    assert param["latex"].startswith("$")
    assert param["latex"].endswith("$")


def test_summary_extraction():
    steps = [
        {"step": "parse", "tool": "parse_file", "result": {}, "success": True},
        {"step": "summary", "message": "Final summary text."}
    ]
    result = normalize_autolab_result(FULL_STATE, steps, "", "")
    assert result["summary"] == "Final summary text."

    # No summary step
    result2 = normalize_autolab_result(FULL_STATE, [steps[0]], "", "")
    assert result2["summary"] is None


def test_raw_data_arrays():
    result = normalize_autolab_result(FULL_STATE, FULL_STEPS, "", "")
    fit = result["fit"]
    assert fit["xData"] == [1, 2, 3]
    assert fit["yData"] == [2, 4, 6]
    assert fit["xErrors"] is None
    assert fit["yErrors"] == [0.1, 0.1, 0.1]
    assert fit["xFit"] == [1, 1.5, 2, 2.5, 3]
    assert fit["yFit"] == [2, 3, 4, 5, 6]
    assert fit["residuals"] == [0.01, -0.02, 0.01]
