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
 * Round value and uncertainty the physics way:
 * - Round uncertainty to 2 significant figures
 * - Round value to the same number of decimal places as the rounded uncertainty
 *
 * Example: value=100.1543, uncertainty=0.1412 → rounded: "100.15 ± 0.14"
 */
export function roundWithUncertainty(
    value: number,
    uncertainty: number
): { rounded: string; unrounded: string } {
    const unrounded = `${smartFormat(value)} ± ${smartFormat(uncertainty)}`;
    if (!isFinite(uncertainty) || uncertainty <= 0) {
        return { rounded: unrounded, unrounded };
    }
    const order = Math.floor(Math.log10(Math.abs(uncertainty)));
    const decimals = Math.max(0, -order + 1); // gives 2 sig figs on uncertainty
    const uRounded = uncertainty.toFixed(decimals);
    const vRounded = value.toFixed(decimals);
    return {
        rounded: `${vRounded} ± ${uRounded}`,
        unrounded,
    };
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
