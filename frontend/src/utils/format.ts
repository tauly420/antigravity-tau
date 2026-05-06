/**
 * Smart number formatting:
 * - Use decimal notation for numbers between 1e-5 and 1e5
 * - Use scientific notation otherwise
 * - Shows appropriate significant figures
 */
export function smartFormat(value: number | null | undefined, sigFigs: number = 6): string {
    if (value === null || value === undefined) return '—';
    if (!isFinite(value)) return String(value);
    if (value === 0) return '0';

    const abs = Math.abs(value);

    // Very small or very large → scientific notation
    if (abs < 1e-5 || abs >= 1e5) {
        return value.toExponential(Math.max(sigFigs - 1, 2));
    }

    // Decimal range — figure out how many decimals we need
    // e.g. 0.00123 needs more decimals than 1234.5
    const orderOfMagnitude = Math.floor(Math.log10(abs));
    const decimals = Math.max(0, sigFigs - 1 - orderOfMagnitude);
    return value.toFixed(decimals);
}

/**
 * Scientific rounding: round uncertainty to 2 sig figs,
 * then round the value to the same decimal place.
 * Returns both a rounded string and an unrounded string.
 */
export function roundWithUncertainty(value: number, uncertainty: number): { rounded: string; unrounded: string } {
    const unrounded = `${value} \u00B1 ${uncertainty}`;
    if (!isFinite(value) || !isFinite(uncertainty) || uncertainty <= 0) {
        return { rounded: `${smartFormat(value)} \u00B1 ${smartFormat(uncertainty)}`, unrounded };
    }
    const o = Math.floor(Math.log10(Math.abs(uncertainty)));
    let decimals = Math.max(0, 1 - o);
    let roundedUnc = parseFloat(uncertainty.toFixed(decimals));
    // If rounding bumped the magnitude (e.g. 0.0995 -> 0.10), recompute decimals
    if (roundedUnc > 0) {
        const o2 = Math.floor(Math.log10(roundedUnc));
        if (o2 > o) {
            decimals = Math.max(0, 1 - o2);
            roundedUnc = parseFloat(uncertainty.toFixed(decimals));
        }
    }
    const roundedValue = parseFloat(value.toFixed(decimals));
    return {
        rounded: `${roundedValue.toFixed(decimals)} \u00B1 ${roundedUnc.toFixed(decimals)}`,
        unrounded,
    };
}

/**
 * Format relative uncertainty (uncertainty / |value|) as a percentage
 * rounded to 2 significant figures. Returns "\u2014" if not computable.
 */
export function formatRelativeError(value: number, uncertainty: number): string {
    if (!isFinite(value) || !isFinite(uncertainty) || uncertainty <= 0 || value === 0) return '\u2014';
    const pct = (uncertainty / Math.abs(value)) * 100;
    if (!isFinite(pct)) return '\u2014';
    const o = Math.floor(Math.log10(pct));
    const decimals = Math.max(0, 1 - o);
    return `${pct.toFixed(decimals)}%`;
}

/**
 * Format P-value with appropriate notation:
 * Very small → scientific, otherwise show as percentage context
 */
export function formatPValue(p: number | null | undefined): string {
    if (p === null || p === undefined) return '—';
    if (p < 1e-10) return '< 1e-10';
    if (p < 0.001) return p.toExponential(2);
    return p.toFixed(4);
}
