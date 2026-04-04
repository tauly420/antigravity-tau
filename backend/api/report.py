"""
Report blueprint - PDF generation and AI content generation endpoints.

Provides:
- /test-pdf: Infrastructure validation endpoint (Phase 8)
- /analyze-context: AI follow-up question generation (Phase 10)
- /generate: AI report section generation (Phase 10)
- /export-pdf: Full report PDF export (Phase 11)
"""

import json
import os
import traceback

from flask import Blueprint, Response, request, jsonify
from utils.pdf_renderer import assemble_report_html, assemble_results_html, generate_pdf, process_text_with_math, _cleanup_temp_images
from openai import OpenAI
from utils.file_parser import extract_pdf_text, extract_docx_text

from prompts.report_system import build_report_system_prompt
from prompts.report_followup import build_followup_system_prompt

report_bp = Blueprint('report', __name__)


@report_bp.route('/debug-pdf', methods=['GET'])
def debug_pdf():
    """Diagnostic endpoint for PDF infrastructure on Railway.

    Returns JSON with import checks, font config status, template file
    existence, system library availability, and relevant env vars.
    """
    import ctypes.util
    diagnostics = {}

    # WeasyPrint import
    try:
        import weasyprint
        diagnostics['weasyprint'] = {'ok': True, 'version': weasyprint.__version__}
    except Exception as e:
        diagnostics['weasyprint'] = {'ok': False, 'error': str(e)}

    # Font config
    try:
        from weasyprint.text.fonts import FontConfiguration
        FontConfiguration()
        diagnostics['font_config'] = {'ok': True}
    except Exception as e:
        diagnostics['font_config'] = {'ok': False, 'error': str(e)}

    # KaTeX
    try:
        from markdown_katex.extension import tex2html
        result = tex2html("x^2", {})
        diagnostics['katex'] = {'ok': True, 'sample': result[:100]}
    except Exception as e:
        diagnostics['katex'] = {'ok': False, 'error': str(e)}

    # Template files
    from utils.pdf_renderer import TEMPLATES_DIR
    diagnostics['templates'] = {
        'dir': TEMPLATES_DIR,
        'base_html': os.path.exists(os.path.join(TEMPLATES_DIR, 'report_base.html')),
        'styles_css': os.path.exists(os.path.join(TEMPLATES_DIR, 'report_styles.css')),
    }

    # System libraries
    for lib in ['gobject-2.0', 'cairo', 'pango-1.0', 'pangocairo-1.0', 'gdk_pixbuf-2.0']:
        found = ctypes.util.find_library(lib)
        diagnostics[f'lib_{lib}'] = found or 'NOT FOUND'

    # Env vars
    diagnostics['env'] = {
        'GDK_PIXBUF_MODULE_FILE': os.environ.get('GDK_PIXBUF_MODULE_FILE', 'NOT SET'),
        'XDG_DATA_DIRS': os.environ.get('XDG_DATA_DIRS', 'NOT SET'),
        'LD_LIBRARY_PATH': os.environ.get('LD_LIBRARY_PATH', 'NOT SET'),
    }

    # Find actual library locations on disk
    import subprocess
    try:
        result = subprocess.run(
            ['find', '/nix', '-name', 'libgobject-2.0.so*', '-o', '-name', 'libcairo.so*', '-o', '-name', 'libpango-1.0.so*'],
            capture_output=True, text=True, timeout=10
        )
        diagnostics['nix_lib_search'] = result.stdout.strip().split('\n')[:20] if result.stdout.strip() else 'NONE FOUND'
    except Exception as e:
        diagnostics['nix_lib_search'] = f'search failed: {e}'

    # Check Nix profile lib directory
    nix_lib = '/root/.nix-profile/lib'
    diagnostics['nix_profile_lib'] = {
        'exists': os.path.exists(nix_lib),
        'is_symlink': os.path.islink(nix_lib),
    }
    if os.path.exists(nix_lib):
        try:
            so_files = [f for f in os.listdir(nix_lib) if '.so' in f][:20]
            diagnostics['nix_profile_lib']['so_files_sample'] = so_files
        except Exception as e:
            diagnostics['nix_profile_lib']['error'] = str(e)

    return diagnostics


@report_bp.route('/test-pdf', methods=['GET'])
def test_pdf():
    """Infrastructure spike: generate test PDF with Hebrew + math.
    Per D-02: kept as permanent debug endpoint.
    Supports ?minimal=1 to bypass KaTeX and test WeasyPrint alone."""
    try:
        minimal = request.args.get('minimal', '0') == '1'
        if minimal:
            from utils.pdf_renderer import generate_minimal_test_pdf
            pdf_bytes = generate_minimal_test_pdf()
        else:
            from utils.pdf_renderer import generate_test_pdf
            pdf_bytes = generate_test_pdf()
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': 'inline; filename="test-report.pdf"',
                'Content-Type': 'application/pdf'
            }
        )
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}, 500


@report_bp.route('/upload-instructions', methods=['POST'])
def upload_instructions():
    """Extract text from uploaded PDF or DOCX lab instruction file."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "No file uploaded"}), 400

    filename = file.filename.lower()
    file_bytes = file.read()

    if len(file_bytes) > 10 * 1024 * 1024:
        return jsonify({"error": "File is too large. Please upload a file under 10 MB."}), 400

    try:
        if filename.endswith('.pdf'):
            text = extract_pdf_text(file_bytes)
        elif filename.endswith('.docx'):
            text = extract_docx_text(file_bytes)
        else:
            return jsonify({"error": "Unsupported file type. Please upload a PDF or DOCX file."}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to extract text: {str(e)}"}), 500

    warning = None
    if not text.strip():
        warning = "No text found -- this may be a scanned/image PDF"

    return jsonify({"text": text, "warning": warning, "error": None})


def _get_openai_client():
    """Create OpenAI client from environment. Returns (client, model_name) or raises."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not configured")
    client = OpenAI(api_key=api_key)
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return client, model_name


@report_bp.route('/analyze-context', methods=['POST'])
def analyze_context():
    """Analyze available context and return follow-up questions.

    Accepts JSON with: context_form, instruction_text, analysis_data.
    Returns: {questions: [...], can_generate_without: bool, error: null}
    """
    try:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        context_form = body.get("context_form", {})
        instruction_text = body.get("instruction_text", "")
        analysis_data = body.get("analysis_data", {})

        client, model_name = _get_openai_client()

        system_prompt = build_followup_system_prompt(
            context_form=context_form,
            instruction_text=instruction_text,
            analysis_data=analysis_data,
        )

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Analyze the available context and return follow-up questions."},
            ],
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)

        return jsonify({
            "questions": result.get("questions", []),
            "can_generate_without": result.get("can_generate_without", True),
            "error": None,
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@report_bp.route('/generate', methods=['POST'])
def generate():
    """Generate AI report sections from context and analysis data.

    Accepts JSON with: context_form, instruction_text, analysis_data,
    answers, language (default "he").
    Returns: {sections: {theory, method, discussion, conclusions, warnings}, error: null}
    """
    try:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        context_form = body.get("context_form", {})
        instruction_text = body.get("instruction_text", "")
        analysis_data = body.get("analysis_data", {})
        answers = body.get("answers", [])
        language = body.get("language", "he")

        client, model_name = _get_openai_client()

        system_prompt = build_report_system_prompt(
            context_form=context_form,
            instruction_text=instruction_text,
            analysis_data=analysis_data,
            answers=answers,
            language=language,
        )

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the lab report sections based on the provided context and analysis results."},
            ],
            response_format={"type": "json_object"},
        )

        sections = json.loads(response.choices[0].message.content)

        # Validate required keys
        required_keys = {"theory", "method", "discussion", "conclusions"}
        missing = required_keys - set(sections.keys())
        if missing:
            return jsonify({
                "error": f"AI returned incomplete response. Missing sections: {', '.join(sorted(missing))}"
            }), 500

        return jsonify({
            "sections": {
                "theory": sections["theory"],
                "method": sections["method"],
                "discussion": sections["discussion"],
                "conclusions": sections["conclusions"],
                "warnings": sections.get("warnings", []),
            },
            "error": None,
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@report_bp.route('/export-pdf', methods=['POST'])
def export_pdf():
    """Generate and return a PDF lab report.

    Accepts JSON with:
        sections: {theory, method, discussion, conclusions} - raw text with LaTeX
        title_page: {studentName, studentId, labPartner, courseName, experimentTitle, date}
        plots: {fit: "data:image/png;base64,...", residuals: "data:image/png;base64,..."}
        template: 'israeli' | 'minimal' | 'academic' (default: 'israeli')
        language: 'he' | 'en' (default: 'he')
        analysis_data: {fit: {...}, formula: {...}, nsigma: {...}} - normalized report data

    Returns: PDF bytes with Content-Disposition attachment header.
    """
    try:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        sections = body.get('sections', {})
        title_page = body.get('title_page', {})
        plots = body.get('plots', {})
        template = body.get('template', 'israeli')
        language = body.get('language', 'he')
        analysis_data = body.get('analysis_data', {})

        # Validate template
        if template not in ('israeli', 'minimal', 'academic'):
            template = 'israeli'

        # Validate required title page fields (only experiment title is required)
        if not title_page.get('experimentTitle', '').strip():
            return jsonify({"error": "Experiment title is required"}), 400

        # Assemble HTML
        html_body = assemble_report_html(
            sections=sections,
            title_page=title_page,
            plots=plots,
            analysis_data=analysis_data,
            template=template,
            language=language,
        )

        # Process LaTeX math delimiters to KaTeX HTML
        processed = process_text_with_math(html_body)

        # Set direction based on language
        direction = 'rtl' if language == 'he' else 'ltr'

        # Generate PDF
        pdf_bytes = generate_pdf(processed, direction=direction, lang=language)

        # Cleanup temp plot images
        _cleanup_temp_images()

        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': 'attachment; filename="lab-report.pdf"',
                'Content-Type': 'application/pdf',
            }
        )

    except Exception as e:
        _cleanup_temp_images()
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500


@report_bp.route('/export-results-pdf', methods=['POST'])
def export_results_pdf():
    """Generate results-only PDF (no AI sections, no title page).

    Accepts JSON with:
        analysis_data: {fit: {...}, formula: {...}, nsigma: {...}} - normalized analysis results
        plots: {fit: "data:image/png;base64,...", residuals: "data:image/png;base64,..."}
        summary: AI-generated summary text
        language: 'he' | 'en' (default: 'he')

    Returns: PDF bytes with Content-Disposition attachment header.
    """
    try:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        analysis_data = body.get('analysis_data', {})
        plots = body.get('plots', {})
        summary = body.get('summary', '')
        language = body.get('language', 'he')

        # Assemble results-only HTML
        html_body = assemble_results_html(
            analysis_data=analysis_data,
            plots=plots,
            summary=summary,
            language=language,
        )

        # Process LaTeX math delimiters to KaTeX HTML
        processed = process_text_with_math(html_body)

        # Set direction based on language
        direction = 'rtl' if language == 'he' else 'ltr'

        # Generate PDF
        pdf_bytes = generate_pdf(processed, direction=direction, lang=language)

        # Cleanup temp plot images
        _cleanup_temp_images()

        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': 'attachment; filename="analysis-results.pdf"',
                'Content-Type': 'application/pdf',
            }
        )

    except Exception as e:
        _cleanup_temp_images()
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
