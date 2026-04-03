/**
 * Normalize raw AutoLab results to ReportAnalysisData shape (camelCase).
 * The backend prompt builder reads camelCase keys. If we send snake_case,
 * analysis context injection is empty and AI hallucates values.
 */
export function normalizeAnalysisData(raw: Record<string, unknown>): Record<string, unknown> {
    // If data already has camelCase keys (e.g., fit.modelName), return as-is
    const state = (raw as Record<string, any>)?.state ?? raw;
    const fit = state?.fit;
    if (!fit) return raw;

    // Check if already normalized (camelCase)
    if (fit.modelName !== undefined) return raw;

    // Needs normalization: snake_case -> camelCase
    const params = fit.parameter_names ?? [];
    const values = fit.parameters ?? [];
    const uncertainties = fit.uncertainties ?? [];
    const roundedArr = fit.rounded ?? [];
    const latexArr = fit.latex_names ?? params;

    const normalizedFit: Record<string, unknown> = {
        modelName: fit.model_name ?? 'unknown',
        parameters: params.map((name: string, i: number) => ({
            name,
            value: values[i] ?? 0,
            uncertainty: uncertainties[i] ?? 0,
            rounded: roundedArr[i] ?? `${values[i]} +/- ${uncertainties[i]}`,
            latex: latexArr[i] ?? name,
        })),
        goodnessOfFit: {
            chiSquaredReduced: fit.reduced_chi_squared ?? null,
            rSquared: fit.r_squared ?? null,
            pValue: fit.p_value ?? null,
            dof: fit.dof ?? null,
        },
        xData: fit.x_data ?? [],
        yData: fit.y_data ?? [],
        xErrors: fit.x_errors ?? null,
        yErrors: fit.y_errors ?? null,
        xFit: fit.x_fit ?? [],
        yFit: fit.y_fit ?? [],
        residuals: fit.residuals ?? [],
    };

    const result: Record<string, unknown> = { ...raw, fit: normalizedFit };

    // Normalize formula if present
    const formula = state?.formula;
    if (formula && formula.expression !== undefined) {
        result.formula = {
            expression: formula.expression,
            value: formula.value ?? formula.result,
            uncertainty: formula.uncertainty,
            formatted: formula.formatted ?? `${formula.value} +/- ${formula.uncertainty}`,
            latex: formula.latex ?? formula.expression,
        };
    }

    // Normalize nsigma if present
    const nsigma = state?.nsigma;
    if (nsigma) {
        result.nsigma = {
            nSigma: nsigma.n_sigma ?? nsigma.nSigma,
            verdict: nsigma.verdict,
            theoreticalValue: nsigma.theoretical_value ?? nsigma.theoreticalValue,
            theoreticalUncertainty: nsigma.theoretical_uncertainty ?? nsigma.theoreticalUncertainty,
        };
    }

    // Copy summary if present
    if (state?.summary) result.summary = state.summary;

    return result;
}
