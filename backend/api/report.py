"""
Report blueprint - PDF generation endpoints.

Provides test endpoint for infrastructure validation and will
serve as the base for full report generation in later phases.
"""

from flask import Blueprint, Response, request, jsonify
from utils.file_parser import extract_pdf_text, extract_docx_text

report_bp = Blueprint('report', __name__)


@report_bp.route('/test-pdf', methods=['GET'])
def test_pdf():
    """Infrastructure spike: generate test PDF with Hebrew + math.
    Per D-02: kept as permanent debug endpoint."""
    try:
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
        import traceback
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
