"""
Report blueprint - PDF generation endpoints.

Provides test endpoint for infrastructure validation and will
serve as the base for full report generation in later phases.
"""

from flask import Blueprint, Response

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
