import katex from 'katex';
import 'katex/dist/katex.min.css';

const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Convert common backslash math notations to Unicode symbols as a fallback
 * for when KaTeX rendering is not used or as pre-processing.
 */
export function mathToUnicode(text: string): string {
    return text
        .replace(/\\pm/g, '±')
        .replace(/\\mp/g, '∓')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\approx/g, '≈')
        .replace(/\\neq/g, '≠')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥')
        .replace(/\\infty/g, '∞')
        .replace(/\\pi/g, 'π')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\chi\^2/g, 'χ²')
        .replace(/\\chi/g, 'χ')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\delta/g, 'δ')
        .replace(/\\Delta/g, 'Δ')
        .replace(/\\omega/g, 'ω')
        .replace(/\\mu/g, 'μ')
        .replace(/\\lambda/g, 'λ')
        .replace(/\\theta/g, 'θ')
        .replace(/\\phi/g, 'φ')
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\cdot/g, '·');
}

/**
 * Render LaTeX delimiters ($$...$$ and $...$) via KaTeX,
 * and convert remaining backslash notations to Unicode.
 * Returns HTML string safe for dangerouslySetInnerHTML.
 */
export function renderLatex(text: string): string {
    // First convert Unicode fallbacks for any remaining backslash notations
    let result = mathToUnicode(text);

    // Handle display math: $$...$$
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, latex) => {
        try {
            return katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false });
        } catch { return escapeHtml(_match); }
    });

    // Handle inline math: $...$ (but not $$)
    result = result.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_match, latex) => {
        try {
            return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
        } catch { return escapeHtml(_match); }
    });

    return result;
}
