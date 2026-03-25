"""Normalize AutoLab results into a guaranteed-shape dict for report generation."""
import math
from utils.calculations import scientific_round


def _safe_finite(v):
    """Return v if finite number, else None."""
    if v is None:
        return None
    try:
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def _normalize_fit(fit_dict):
    """Normalize fit state dict into camelCase FitSection."""
    if not fit_dict or "error" in fit_dict:
        return None

    names = fit_dict.get("parameter_names", [])
    values = fit_dict.get("parameters", [])
    uncertainties = fit_dict.get("uncertainties", [])

    parameters = []
    for name, val, unc in zip(names, values, uncertainties):
        rounded_str = scientific_round(val, unc)
        latex_str = f"${name} = {rounded_str.replace('+/-', '\\pm').replace('±', '\\pm')}$"
        parameters.append({
            "name": name,
            "value": val,
            "uncertainty": unc,
            "rounded": rounded_str,
            "latex": latex_str,
        })

    return {
        "modelName": fit_dict.get("model_name", ""),
        "parameters": parameters,
        "goodnessOfFit": {
            "chiSquaredReduced": _safe_finite(fit_dict.get("reduced_chi_squared")),
            "rSquared": _safe_finite(fit_dict.get("r_squared")),
            "pValue": _safe_finite(fit_dict.get("p_value")),
            "dof": fit_dict.get("dof"),
        },
        "xData": fit_dict.get("x_data", []),
        "yData": fit_dict.get("y_data", []),
        "xErrors": fit_dict.get("x_errors"),
        "yErrors": fit_dict.get("y_errors"),
        "xFit": fit_dict.get("x_fit", []),
        "yFit": fit_dict.get("y_fit", []),
        "residuals": fit_dict.get("residuals", []),
    }


def _normalize_formula(formula_dict):
    """Normalize formula state dict into camelCase FormulaSection."""
    if not formula_dict or "error" in formula_dict:
        return None

    formatted = formula_dict.get("formatted", "")
    expression = formula_dict.get("expression", "")
    latex_str = f"${expression} = {formatted.replace('+/-', '\\pm').replace('±', '\\pm')}$"

    return {
        "expression": expression,
        "value": formula_dict.get("value"),
        "uncertainty": formula_dict.get("uncertainty"),
        "formatted": formatted,
        "latex": latex_str,
    }


def _normalize_nsigma(nsigma_dict):
    """Normalize nsigma state dict into camelCase NSigmaSection."""
    if not nsigma_dict or "error" in nsigma_dict:
        return None

    return {
        "nSigma": nsigma_dict.get("n_sigma"),
        "verdict": nsigma_dict.get("verdict", ""),
        "theoreticalValue": nsigma_dict.get("theoretical_value"),
        "theoreticalUncertainty": nsigma_dict.get("theoretical_uncertainty"),
    }


def _extract_summary(steps):
    """Extract summary text from the last summary step."""
    for step in reversed(steps):
        if step.get("step") == "summary" and step.get("message"):
            return step["message"]
    return None


def normalize_autolab_result(state, steps, instructions, filename):
    """Normalize an AutoLab result into a guaranteed-shape dict.

    Args:
        state: AutoLab state dict with keys: parsed, fit, formula, nsigma
        steps: List of step dicts from orchestrator
        instructions: User's original instructions string
        filename: Uploaded filename string

    Returns:
        Dict matching ReportAnalysisData interface with camelCase keys.
    """
    return {
        "fit": _normalize_fit(state.get("fit")),
        "formula": _normalize_formula(state.get("formula")),
        "nsigma": _normalize_nsigma(state.get("nsigma")),
        "summary": _extract_summary(steps),
        "instructions": instructions,
        "filename": filename,
    }
