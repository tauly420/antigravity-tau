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
 * Convert basic Markdown formatting to HTML.
 * Supports: **bold**, *italic*, numbered lists (1. ...), bullet lists (- ...).
 */
function markdownToHtml(text: string): string {
    // Split into lines, process block-level elements
    const lines = text.split('\n');
    const out: string[] = [];
    let inList: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Numbered list: 1. item, 2. item
        const olMatch = line.match(/^\s*(\d+)\.\s+(.+)/);
        // Bullet list: - item or * item (but not **bold**)
        const ulMatch = !olMatch ? line.match(/^\s*[-]\s+(.+)/) : null;

        if (olMatch) {
            if (inList !== 'ol') {
                if (inList) out.push(`</${inList}>`);
                out.push('<ol>');
                inList = 'ol';
            }
            out.push(`<li>${olMatch[2]}</li>`);
            continue;
        }
        if (ulMatch) {
            if (inList !== 'ul') {
                if (inList) out.push(`</${inList}>`);
                out.push('<ul>');
                inList = 'ul';
            }
            out.push(`<li>${ulMatch[1]}</li>`);
            continue;
        }

        // Close any open list
        if (inList) {
            out.push(inList === 'ul' ? '</ul>' : '</ol>');
            inList = null;
        }
        out.push(line);
    }
    if (inList) {
        out.push(inList === 'ul' ? '</ul>' : '</ol>');
    }

    let result = out.join('\n');

    // Inline formatting: **bold** and *italic*
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    return result;
}

/**
 * Render LaTeX delimiters ($$...$$ and $...$) via KaTeX,
 * convert remaining backslash notations to Unicode,
 * and process basic Markdown formatting.
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

    // Process Markdown formatting (bold, italic, lists)
    result = markdownToHtml(result);

    return result;
}
