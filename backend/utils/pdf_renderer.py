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
        logger.warning(f"markdown_katex failed for '{latex_expr[:60]}': {e}, falling back to npx katex")

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
            return f'<code class="katex-fallback">{latex_expr}</code>'
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.warning(f"KaTeX subprocess also failed for '{latex_expr[:60]}': {e}")
        return f'<code class="katex-fallback">{latex_expr}</code>'


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


def generate_pdf(html_body: str, direction: str = 'rtl', lang: str = 'he') -> bytes:
    """Generate a PDF from an HTML body string.

    Reads the CSS and HTML templates, injects the body content,
    and uses WeasyPrint to produce PDF bytes.

    Args:
        html_body: HTML content to place inside <body>.
        direction: Text direction ('rtl' or 'ltr').
        lang: Language code ('he' or 'en').

    Returns:
        PDF file contents as bytes.
    """
    try:
        import weasyprint
        from weasyprint.text.fonts import FontConfiguration
    except ImportError:
        raise ImportError(
            "WeasyPrint not installed. Install with: pip install weasyprint"
        )

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
    full_html = full_html.replace('{{ direction }}', direction)
    full_html = full_html.replace('{{ lang }}', lang)

    # Generate PDF
    font_config = FontConfiguration()
    try:
        html_doc = weasyprint.HTML(string=full_html, base_url=BACKEND_DIR)
        pdf_bytes = html_doc.write_pdf(font_config=font_config)
    except Exception as e:
        logger.error(
            f"WeasyPrint PDF generation failed (version {weasyprint.__version__}). "
            f"HTML preview (first 500 chars): {full_html[:500]!r}"
        )
        raise RuntimeError(
            f"WeasyPrint PDF generation failed (v{weasyprint.__version__}): {e}"
        ) from e

    return pdf_bytes


def _cleanup_temp_images():
    """Remove temporary plot image files from templates directory."""
    import glob
    for f in glob.glob(os.path.join(TEMPLATES_DIR, 'tmp*.png')):
        try:
            os.unlink(f)
        except OSError:
            pass


def assemble_report_html(sections, title_page, plots, analysis_data, template='israeli', language='he'):
    """Build full report HTML from structured data.

    Args:
        sections: dict with keys: theory, method, discussion, conclusions (raw text with LaTeX $/$$ delimiters)
        title_page: dict with keys: studentName, studentId, labPartner, courseName, experimentTitle, date
        plots: dict with keys: fit (base64 str or None), residuals (base64 str or None)
        analysis_data: dict with normalized fit data (camelCase keys)
        template: 'israeli' | 'minimal' | 'academic'
        language: 'he' | 'en'

    Returns:
        HTML string for the full report body (before math processing).
    """
    import base64
    import tempfile

    html_parts = []

    # Template class on wrapper div
    html_parts.append(f'<div class="template-{template}">')

    # Section headers per language
    headers = {
        'he': {
            'theory': '1. רקע תיאורטי',
            'method': '2. שיטת מדידה',
            'results': '3. תוצאות',
            'discussion': '4. דיון',
            'conclusions': '5. מסקנות',
        },
        'en': {
            'theory': '1. Theoretical Background',
            'method': '2. Measurement Method',
            'results': '3. Results',
            'discussion': '4. Discussion',
            'conclusions': '5. Conclusions',
        },
    }
    h = headers.get(language, headers['he'])

    # --- Title Page ---
    name = title_page.get('studentName', '')
    student_id = title_page.get('studentId', '')
    partner = title_page.get('labPartner', '')
    partner_id = title_page.get('labPartnerId', '')
    course = title_page.get('courseName', '')
    exp_title = title_page.get('experimentTitle', '')
    date_str = title_page.get('date', '')

    if template == 'minimal':
        # Minimal: title as first-page header, no separate title page
        html_parts.append(f'<h1 class="report-title">{exp_title}</h1>')
        details = []
        if name:
            details.append(name)
        if student_id:
            details.append(student_id)
        if partner:
            lbl = 'שותף/ה: ' if language == 'he' else 'Partner: '
            partner_str = partner
            if partner_id:
                partner_str += f' ({partner_id})'
            details.append(f'{lbl}{partner_str}')
        if course:
            details.append(course)
        if date_str:
            details.append(date_str)
        if details:
            html_parts.append(f'<p class="title-details">{" | ".join(details)}</p>')
    else:
        # Israeli and Academic: full title page
        html_parts.append('<div class="title-page">')
        html_parts.append(f'<h1 class="report-title">{exp_title}</h1>')
        # Student details table
        name_lbl = 'שם' if language == 'he' else 'Name'
        id_lbl = 'ת.ז.' if language == 'he' else 'ID'
        partner_lbl = 'שותף/ה למעבדה' if language == 'he' else 'Lab Partner'
        course_lbl = 'קורס' if language == 'he' else 'Course'
        date_lbl = 'תאריך' if language == 'he' else 'Date'

        html_parts.append('<table class="title-table">')
        if name:
            html_parts.append(f'<tr><td class="label">{name_lbl}</td><td>{name}</td></tr>')
        if student_id:
            html_parts.append(f'<tr><td class="label">{id_lbl}</td><td>{student_id}</td></tr>')
        if partner:
            partner_display = partner
            if partner_id:
                partner_id_lbl = 'ת.ז.' if language == 'he' else 'ID'
                partner_display += f' ({partner_id_lbl}: {partner_id})'
            html_parts.append(f'<tr><td class="label">{partner_lbl}</td><td>{partner_display}</td></tr>')
        if course:
            html_parts.append(f'<tr><td class="label">{course_lbl}</td><td>{course}</td></tr>')
        if date_str:
            html_parts.append(f'<tr><td class="label">{date_lbl}</td><td>{date_str}</td></tr>')
        html_parts.append('</table>')
        html_parts.append('</div>')

    # --- Content Sections ---
    for section_key in ['theory', 'method']:
        content = sections.get(section_key, '')
        if content.strip():
            html_parts.append(f'<h2>{h[section_key]}</h2>')
            # Wrap paragraphs
            for para in content.split('\n\n'):
                para = para.strip()
                if para:
                    html_parts.append(f'<p>{para}</p>')

    # --- Results Section ---
    html_parts.append(f'<h2>{h["results"]}</h2>')

    # Parameter table from analysis_data
    fit = analysis_data.get('fit', None) if analysis_data else None
    if fit and isinstance(fit, dict):
        params = fit.get('parameters', [])
        gof = fit.get('goodnessOfFit', {})
        model = fit.get('modelName', '')

        if model:
            model_lbl = 'מודל התאמה' if language == 'he' else 'Fit Model'
            html_parts.append(f'<p><strong>{model_lbl}:</strong> {model}</p>')

        if params:
            param_lbl = 'פרמטר' if language == 'he' else 'Parameter'
            value_lbl = 'ערך' if language == 'he' else 'Value'
            html_parts.append('<table class="param-table">')
            html_parts.append(f'<thead><tr><th>{param_lbl}</th><th>{value_lbl}</th></tr></thead>')
            html_parts.append('<tbody>')
            for p in params:
                pname = p.get('name', '')
                rounded = p.get('rounded', f"{p.get('value', '')} +/- {p.get('uncertainty', '')}")
                html_parts.append(f'<tr><td>{pname}</td><td>{rounded}</td></tr>')
            html_parts.append('</tbody></table>')

        # Goodness-of-fit stats
        gof_parts = []
        if gof.get('chiSquaredReduced') is not None:
            gof_parts.append(f"$\\chi^2/\\text{{dof}} = {gof['chiSquaredReduced']:.4f}$")
        if gof.get('rSquared') is not None:
            gof_parts.append(f"$R^2 = {gof['rSquared']:.6f}$")
        if gof.get('pValue') is not None:
            gof_parts.append(f"$P = {gof['pValue']:.4f}$")
        if gof_parts:
            html_parts.append(f'<p>{", ".join(gof_parts)}</p>')

    # Formula result
    formula = analysis_data.get('formula') if analysis_data else None
    if formula and isinstance(formula, dict):
        expr = formula.get('expression', '')
        formatted = formula.get('formatted', '')
        if expr and formatted:
            formula_lbl = 'חישוב נוסחה' if language == 'he' else 'Formula Calculation'
            html_parts.append(f'<p><strong>{formula_lbl}:</strong> ${expr} = {formatted}$</p>')

    # N-sigma comparison
    nsigma = analysis_data.get('nsigma') if analysis_data else None
    if nsigma and isinstance(nsigma, dict):
        ns = nsigma.get('nSigma', '')
        verdict = nsigma.get('verdict', '')
        if ns != '' and verdict:
            nsigma_lbl = 'השוואת N-sigma' if language == 'he' else 'N-sigma Comparison'
            html_parts.append(f'<p><strong>{nsigma_lbl}:</strong> $N_\\sigma = {ns}$ ({verdict})</p>')

    # Plot images
    fig_num = 1
    for plot_key, caption_he, caption_en in [
        ('fit', 'גרף התאמה', 'Fit Plot'),
        ('residuals', 'שאריות', 'Residuals'),
    ]:
        img_data = plots.get(plot_key) if plots else None
        if img_data and isinstance(img_data, str) and img_data.startswith('data:image'):
            # Write to temp file for WeasyPrint compatibility (per Research pitfall 6)
            b64_str = img_data.split(',', 1)[1] if ',' in img_data else img_data
            img_bytes = base64.b64decode(b64_str)
            tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir=TEMPLATES_DIR)
            tmp.write(img_bytes)
            tmp.close()
            fig_path = os.path.basename(tmp.name)
            caption_text = caption_he if language == 'he' else caption_en
            fig_label = 'איור' if language == 'he' else 'Figure'
            html_parts.append(f'<div class="figure">')
            html_parts.append(f'<img src="{fig_path}" class="plot-image" />')
            html_parts.append(f'<p class="figure-caption">{fig_label} {fig_num}: {caption_text}</p>')
            html_parts.append(f'</div>')
            fig_num += 1

    # --- Discussion and Conclusions ---
    for section_key in ['discussion', 'conclusions']:
        content = sections.get(section_key, '')
        if content.strip():
            html_parts.append(f'<h2>{h[section_key]}</h2>')
            for para in content.split('\n\n'):
                para = para.strip()
                if para:
                    html_parts.append(f'<p>{para}</p>')

    html_parts.append('</div>')  # Close template wrapper

    return '\n'.join(html_parts)


def assemble_results_html(analysis_data, plots, summary='', language='he'):
    """Build results-only HTML for a lightweight PDF (no AI sections, no title page).

    Args:
        analysis_data: dict with normalized fit data (camelCase keys).
            Expected shape: {fit: {parameters: [...], goodnessOfFit: {...}, modelName: str},
                             formula: {expression, formatted}, nsigma: {nSigma, verdict}}
        plots: dict with keys: fit (base64 str or None), residuals (base64 str or None)
        summary: AI-generated summary text to display at top.
        language: 'he' | 'en'

    Returns:
        HTML string for the results body (before math processing).
    """
    import base64
    import tempfile

    html_parts = []
    html_parts.append('<div class="template-minimal">')

    # Heading
    heading = 'Analysis Results' if language == 'en' else '\u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05e0\u05d9\u05ea\u05d5\u05d7'
    html_parts.append(f'<h1 class="report-title">{heading}</h1>')

    # Summary box
    if summary and summary.strip():
        html_parts.append(f'<div class="results-summary"><p>{summary.strip()}</p></div>')

    # Parameter table
    fit = analysis_data.get('fit', None) if analysis_data else None
    if fit and isinstance(fit, dict):
        params = fit.get('parameters', [])
        gof = fit.get('goodnessOfFit', {})
        model = fit.get('modelName', '')

        if model:
            model_lbl = '\u05de\u05d5\u05d3\u05dc \u05d4\u05ea\u05d0\u05de\u05d4' if language == 'he' else 'Fit Model'
            html_parts.append(f'<p><strong>{model_lbl}:</strong> {model}</p>')

        if params:
            param_lbl = '\u05e4\u05e8\u05de\u05d8\u05e8' if language == 'he' else 'Parameter'
            value_lbl = '\u05e2\u05e8\u05da' if language == 'he' else 'Value'
            latex_lbl = 'LaTeX'
            html_parts.append('<table class="param-table">')
            html_parts.append(f'<thead><tr><th>{param_lbl}</th><th>{value_lbl}</th><th>{latex_lbl}</th></tr></thead>')
            html_parts.append('<tbody>')
            for p in params:
                pname = p.get('name', '')
                rounded = p.get('rounded', f"{p.get('value', '')} +/- {p.get('uncertainty', '')}")
                latex_name = p.get('latex', pname)
                latex_cell = f'${latex_name}$' if latex_name else ''
                html_parts.append(f'<tr><td>{pname}</td><td>{rounded}</td><td>{latex_cell}</td></tr>')
            html_parts.append('</tbody></table>')

        # Goodness-of-fit stats
        gof_parts = []
        if gof.get('chiSquaredReduced') is not None:
            dof = gof.get('dof', '')
            chi_str = f"$\\chi^2/\\text{{dof}} = {gof['chiSquaredReduced']:.4f}$"
            if dof:
                chi_str += f" (dof = {dof})"
            gof_parts.append(chi_str)
        if gof.get('rSquared') is not None:
            gof_parts.append(f"$R^2 = {gof['rSquared']:.6f}$")
        if gof.get('pValue') is not None:
            gof_parts.append(f"$P = {gof['pValue']:.4f}$")
        if gof_parts:
            html_parts.append(f'<p>{", ".join(gof_parts)}</p>')

    # Formula calculation
    formula = analysis_data.get('formula') if analysis_data else None
    if formula and isinstance(formula, dict):
        expr = formula.get('expression', '')
        formatted = formula.get('formatted', '')
        if expr and formatted:
            formula_lbl = '\u05d7\u05d9\u05e9\u05d5\u05d1 \u05e0\u05d5\u05e1\u05d7\u05d4' if language == 'he' else 'Formula Calculation'
            html_parts.append(f'<h2>{formula_lbl}</h2>')
            html_parts.append(f'<p>${expr} = {formatted}$</p>')

    # N-sigma comparison
    nsigma = analysis_data.get('nsigma') if analysis_data else None
    if nsigma and isinstance(nsigma, dict):
        ns = nsigma.get('nSigma', '')
        verdict = nsigma.get('verdict', '')
        if ns != '' and verdict:
            nsigma_lbl = '\u05d4\u05e9\u05d5\u05d5\u05d0\u05ea N-sigma' if language == 'he' else 'N-sigma Comparison'
            # Color coding
            try:
                ns_val = float(ns)
                if ns_val <= 2:
                    color = '#2e7d32'
                elif ns_val <= 3:
                    color = '#f57c00'
                else:
                    color = '#d32f2f'
            except (ValueError, TypeError):
                color = '#333'
            html_parts.append(f'<h2>{nsigma_lbl}</h2>')
            html_parts.append(f'<p style="color: {color}; font-weight: 700;">$N_\\sigma = {ns}$ \u2014 {verdict}</p>')

    # Plot images
    fig_num = 1
    for plot_key, caption_he, caption_en in [
        ('fit', '\u05d2\u05e8\u05e3 \u05d4\u05ea\u05d0\u05de\u05d4', 'Fit Plot'),
        ('residuals', '\u05e9\u05d0\u05e8\u05d9\u05d5\u05ea', 'Residuals'),
    ]:
        img_data = plots.get(plot_key) if plots else None
        if img_data and isinstance(img_data, str):
            b64_str = img_data
            if ',' in img_data:
                b64_str = img_data.split(',', 1)[1]
            try:
                img_bytes = base64.b64decode(b64_str)
                tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False, dir=TEMPLATES_DIR)
                tmp.write(img_bytes)
                tmp.close()
                fig_path = os.path.basename(tmp.name)
                caption_text = caption_he if language == 'he' else caption_en
                fig_label = '\u05d0\u05d9\u05d5\u05e8' if language == 'he' else 'Figure'
                html_parts.append(f'<div class="figure">')
                html_parts.append(f'<img src="{fig_path}" class="plot-image" />')
                html_parts.append(f'<p class="figure-caption">{fig_label} {fig_num}: {caption_text}</p>')
                html_parts.append(f'</div>')
                fig_num += 1
            except Exception:
                pass  # Skip invalid image data

    html_parts.append('</div>')  # Close template wrapper
    return '\n'.join(html_parts)


def generate_minimal_test_pdf() -> bytes:
    """Generate a bare-minimum PDF with no KaTeX processing.

    Used to isolate whether a 500 error is from WeasyPrint itself
    or from KaTeX rendering. No math, no Hebrew -- just plain HTML.

    Returns:
        PDF file contents as bytes.
    """
    html_body = '<h1>PDF Infrastructure Test</h1><p>If you can read this, WeasyPrint works.</p>'
    return generate_pdf(html_body, direction='ltr', lang='en')


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
