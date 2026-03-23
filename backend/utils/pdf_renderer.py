"""
PDF rendering pipeline for lab reports.

Converts LaTeX math expressions to HTML via KaTeX, processes mixed
Hebrew/math text, and generates PDF output via WeasyPrint.
"""

import os
import re
import subprocess
import logging

logger = logging.getLogger(__name__)

# Full 12-expression equation test suite covering intro-physics-level LaTeX.
# Matches D-04 (intro physics level) and D-05 (text-in-math attention).
EQUATION_TEST_SUITE = [
    # 1. Spring constant with units (text-in-math, per D-05)
    r"k = 49.8 \pm 0.5 \text{ N/m}",
    # 2. Period formula (fraction)
    r"T = \frac{2\pi}{\omega}",
    # 3. Gravitational acceleration with units
    r"g = 9.81 \pm 0.01 \text{ m/s}^2",
    # 4. Chi-squared per degree of freedom
    r"\frac{\chi^2}{\text{dof}} = 1.23",
    # 5. R-squared
    r"R^2 = 0.9987",
    # 6. Greek letters with sum and subscripts
    r"\sigma_{\alpha} = \sqrt{\frac{\sum_{i=1}^{N}(x_i - \bar{x})^2}{N-1}}",
    # 7. Simple fraction
    r"\frac{F}{m} = a",
    # 8. Integral
    r"\int_0^L F(x) \, dx = W",
    # 9. Superscripts (E=mc^2)
    r"E = mc^2",
    # 10. Damped oscillation (complex)
    r"x(t) = A e^{-\gamma t} \cos(\omega t + \phi)",
    # 11. Plus-minus with units
    r"v = 3.42 \pm 0.08 \text{ m/s}",
    # 12. Sinc function (optics)
    r"I(\theta) = I_0 \left(\frac{\sin \alpha}{\alpha}\right)^2",
]

# Bidirectional text test cases: Hebrew RTL with inline LTR math
BIDI_TEST_CASES = [
    # Math at START of Hebrew sentence
    r"$k = 50 \text{ N/m}$ הוא קבוע הקפיץ שנמדד בניסוי.",
    # Math at END of Hebrew sentence
    r"קבוע הקפיץ שנמדד בניסוי הוא $k = 50 \text{ N/m}$",
    # Math in MIDDLE of Hebrew sentence
    r"ערך קבוע הקפיץ $k = 49.8 \pm 0.5 \text{ N/m}$ נמצא תואם לערך התיאורטי.",
    # Multiple math in one sentence
    r"הפרמטרים שנמדדו הם $A = 5.2 \pm 0.3$ ו-$\omega = 2.51 \pm 0.04 \text{ rad/s}$",
    # Complex expression in Hebrew context
    r"לפי חוק הוק, $F = -kx$, כאשר $k = 49.8 \pm 0.5 \text{ N/m}$",
]

# Resolve paths relative to the backend/ directory
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES_DIR = os.path.join(BACKEND_DIR, 'templates')


def render_latex_for_pdf(latex_expr: str, display_mode: bool = False) -> str:
    """Convert a LaTeX expression to HTML using KaTeX.

    Tries markdown_katex first, falls back to npx katex subprocess.

    Args:
        latex_expr: Raw LaTeX string (without $ delimiters).
        display_mode: If True, render in display mode (block-level).

    Returns:
        HTML string with KaTeX markup.
    """
    try:
        from markdown_katex.extension import tex2html
        options = {'no_inline_svg': True, 'insert_fonts_css': False}
        if display_mode:
            options['displayMode'] = True
        return tex2html(latex_expr, options)
    except (ImportError, Exception) as e:
        logger.debug(f"markdown_katex failed ({e}), falling back to npx katex")

    # Fallback: call npx katex directly
    try:
        cmd = ['npx', 'katex', '--no-throw-on-error']
        if display_mode:
            cmd.append('--display-mode')
        result = subprocess.run(
            cmd,
            input=latex_expr,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        else:
            logger.warning(f"KaTeX subprocess returned: {result.stderr}")
            # Return escaped text as fallback
            return f'<span class="katex-error">{latex_expr}</span>'
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.warning(f"KaTeX subprocess failed: {e}")
        return f'<span class="katex-error">{latex_expr}</span>'


def process_text_with_math(text: str) -> str:
    """Process text containing LaTeX math delimiters.

    Finds $$...$$ (display math) and $...$ (inline math) and converts
    each expression to KaTeX HTML, wrapped in appropriate containers.

    Display math is processed first to avoid conflicts with inline regex.

    Args:
        text: Text with LaTeX $ and $$ delimiters.

    Returns:
        HTML string with math expressions rendered.
    """
    # Step 1: Process display math $$...$$
    def replace_display(match):
        latex = match.group(1).strip()
        html = render_latex_for_pdf(latex, display_mode=True)
        return f'<div class="math-display">{html}</div>'

    text = re.sub(r'\$\$([\s\S]*?)\$\$', replace_display, text)

    # Step 2: Process inline math $...$
    def replace_inline(match):
        latex = match.group(1).strip()
        html = render_latex_for_pdf(latex, display_mode=False)
        return f'<span class="math-inline" dir="ltr">{html}</span>'

    text = re.sub(r'(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)', replace_inline, text)

    return text


def generate_pdf(html_body: str) -> bytes:
    """Generate a PDF from an HTML body string.

    Reads the CSS and HTML templates, injects the body content,
    and uses WeasyPrint to produce PDF bytes.

    Args:
        html_body: HTML content to place inside <body>.

    Returns:
        PDF file contents as bytes.
    """
    import weasyprint
    from weasyprint.text.fonts import FontConfiguration

    # Read CSS
    css_path = os.path.join(TEMPLATES_DIR, 'report_styles.css')
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()

    # Read HTML template
    template_path = os.path.join(TEMPLATES_DIR, 'report_base.html')
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    # Simple Jinja2-style substitution (avoiding Jinja2 dependency)
    full_html = template.replace('{{ css_content }}', css_content)
    full_html = full_html.replace('{{ body_content }}', html_body)

    # Generate PDF
    font_config = FontConfiguration()
    html_doc = weasyprint.HTML(string=full_html, base_url=BACKEND_DIR)
    pdf_bytes = html_doc.write_pdf(font_config=font_config)

    return pdf_bytes


def generate_test_pdf() -> bytes:
    """Generate a comprehensive test PDF with Hebrew text and math expressions.

    Includes all 12 expressions from EQUATION_TEST_SUITE and 5 bidirectional
    text edge cases. Used by the /api/report/test-pdf endpoint to validate
    the PDF infrastructure (fonts, KaTeX rendering, RTL layout).

    Returns:
        PDF file contents as bytes.
    """
    sections = []

    # Section C: Title heading
    sections.append('<h1>דוח מעבדה - בדיקת תשתית PDF</h1>')

    # Section A: Equation Tests
    sections.append('<h2>בדיקת משוואות</h2>')
    for i, expr in enumerate(EQUATION_TEST_SUITE, 1):
        sections.append(f'<p>משוואה {i}:</p>')
        sections.append(f'$${expr}$$')

    # Section B: Bidirectional Text Tests
    sections.append('<h2>בדיקת טקסט דו-כיווני</h2>')
    bidi_labels = [
        "משוואה בתחילת משפט:",
        "משוואה בסוף משפט:",
        "משוואה באמצע משפט:",
        "מספר משוואות במשפט אחד:",
        "ביטוי מורכב בהקשר עברי:",
    ]
    for label, text in zip(bidi_labels, BIDI_TEST_CASES):
        sections.append(f'<p><strong>{label}</strong></p>')
        sections.append(f'<p>{text}</p>')

    test_body = '\n'.join(sections)
    processed_body = process_text_with_math(test_body)
    return generate_pdf(processed_body)
