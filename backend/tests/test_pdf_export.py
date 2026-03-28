"""Tests for the PDF export endpoint and report HTML assembly."""
import pytest

# Minimal 1x1 red PNG as base64 for plot testing
TINY_PNG_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

SAMPLE_SECTIONS = {
    "theory": "According to Hooke's law, $F = -kx$, where $k$ is the spring constant.\n\nThe restoring force is proportional to displacement.",
    "method": "We measured force vs displacement using a spring and force sensor.\n\nMasses from 50g to 500g were applied.",
    "discussion": "The measured value $k = 49.8 \\pm 0.5 \\text{ N/m}$ agrees with the expected value.\n\nError sources include friction.",
    "conclusions": "The spring constant was measured as $k = 49.8 \\pm 0.5 \\text{ N/m}$, consistent with theory.",
}

SAMPLE_TITLE_PAGE = {
    "studentName": "Test Student",
    "studentId": "123456789",
    "labPartner": "Partner Name",
    "courseName": "Physics Lab 1",
    "experimentTitle": "Hooke's Law",
    "date": "2026-03-27",
}

SAMPLE_ANALYSIS_DATA = {
    "fit": {
        "modelName": "linear",
        "parameters": [
            {"name": "k", "value": 49.8, "uncertainty": 0.5, "rounded": "49.8 +/- 0.5", "latex": "k"},
            {"name": "b", "value": 0.12, "uncertainty": 0.03, "rounded": "0.12 +/- 0.03", "latex": "b"},
        ],
        "goodnessOfFit": {
            "chiSquaredReduced": 1.23,
            "rSquared": 0.9987,
            "pValue": 0.45,
            "dof": 8,
        },
    },
}


class TestAssembleReportHtml:
    """Tests for the assemble_report_html function."""

    def test_israeli_template_has_title_page(self):
        from utils.pdf_renderer import assemble_report_html
        html = assemble_report_html(SAMPLE_SECTIONS, SAMPLE_TITLE_PAGE, {}, SAMPLE_ANALYSIS_DATA, 'israeli', 'he')
        assert 'title-page' in html
        assert 'Test Student' in html
        assert "Hooke's Law" in html
        assert 'template-israeli' in html

    def test_minimal_template_no_title_page_div(self):
        from utils.pdf_renderer import assemble_report_html
        html = assemble_report_html(SAMPLE_SECTIONS, SAMPLE_TITLE_PAGE, {}, SAMPLE_ANALYSIS_DATA, 'minimal', 'he')
        assert 'title-page' not in html
        assert 'template-minimal' in html
        assert 'Test Student' in html

    def test_academic_template_class(self):
        from utils.pdf_renderer import assemble_report_html
        html = assemble_report_html(SAMPLE_SECTIONS, SAMPLE_TITLE_PAGE, {}, SAMPLE_ANALYSIS_DATA, 'academic', 'en')
        assert 'template-academic' in html

    def test_hebrew_section_headers(self):
        from utils.pdf_renderer import assemble_report_html
        html = assemble_report_html(SAMPLE_SECTIONS, SAMPLE_TITLE_PAGE, {}, SAMPLE_ANALYSIS_DATA, 'israeli', 'he')
        assert '\u05e8\u05e7\u05e2 \u05ea\u05d9\u05d0\u05d5\u05e8\u05d8\u05d9' in html
        assert '\u05e9\u05d9\u05d8\u05ea \u05de\u05d3\u05d9\u05d3\u05d4' in html
        assert '\u05ea\u05d5\u05e6\u05d0\u05d5\u05ea' in html
        assert '\u05d3\u05d9\u05d5\u05df' in html
        assert '\u05de\u05e1\u05e7\u05e0\u05d5\u05ea' in html

    def test_english_section_headers(self):
        from utils.pdf_renderer import assemble_report_html
        html = assemble_report_html(SAMPLE_SECTIONS, SAMPLE_TITLE_PAGE, {}, SAMPLE_ANALYSIS_DATA, 'israeli', 'en')
        assert 'Theoretical Background' in html
        assert 'Measurement Method' in html

    def test_parameter_table_rendered(self):
        from utils.pdf_renderer import assemble_report_html
        html = assemble_report_html(SAMPLE_SECTIONS, SAMPLE_TITLE_PAGE, {}, SAMPLE_ANALYSIS_DATA, 'israeli', 'he')
        assert 'param-table' in html
        assert '49.8 +/- 0.5' in html
        assert 'linear' in html

    def test_plot_image_embedded(self):
        from utils.pdf_renderer import assemble_report_html, _cleanup_temp_images
        plots = {"fit": TINY_PNG_B64}
        html = assemble_report_html(SAMPLE_SECTIONS, SAMPLE_TITLE_PAGE, plots, SAMPLE_ANALYSIS_DATA, 'israeli', 'he')
        assert 'plot-image' in html
        assert 'figure-caption' in html
        assert '.png' in html  # temp file reference
        _cleanup_temp_images()

    def test_empty_sections_handled(self):
        from utils.pdf_renderer import assemble_report_html
        html = assemble_report_html({}, SAMPLE_TITLE_PAGE, {}, {}, 'israeli', 'he')
        assert 'template-israeli' in html
        assert '\u05ea\u05d5\u05e6\u05d0\u05d5\u05ea' in html


@pytest.mark.requires_weasyprint
class TestExportPdfEndpoint:
    """Integration tests for POST /api/report/export-pdf.

    Skipped when WeasyPrint system libraries are unavailable.
    """

    def test_basic_pdf_generation(self, client):
        resp = client.post('/api/report/export-pdf', json={
            'sections': SAMPLE_SECTIONS,
            'title_page': SAMPLE_TITLE_PAGE,
            'plots': {},
            'template': 'israeli',
            'language': 'he',
            'analysis_data': SAMPLE_ANALYSIS_DATA,
        })
        assert resp.status_code == 200
        assert resp.content_type == 'application/pdf'
        assert resp.data[:4] == b'%PDF'

    def test_title_page_in_pdf(self, client):
        resp = client.post('/api/report/export-pdf', json={
            'sections': SAMPLE_SECTIONS,
            'title_page': SAMPLE_TITLE_PAGE,
            'plots': {},
            'template': 'israeli',
            'language': 'he',
            'analysis_data': {},
        })
        assert resp.status_code == 200
        assert resp.data[:4] == b'%PDF'

    def test_all_templates_produce_pdf(self, client):
        for tmpl in ['israeli', 'minimal', 'academic']:
            resp = client.post('/api/report/export-pdf', json={
                'sections': SAMPLE_SECTIONS,
                'title_page': SAMPLE_TITLE_PAGE,
                'plots': {},
                'template': tmpl,
                'language': 'he',
                'analysis_data': SAMPLE_ANALYSIS_DATA,
            })
            assert resp.status_code == 200, f"Template {tmpl} failed"
            assert resp.data[:4] == b'%PDF', f"Template {tmpl} invalid PDF"

    def test_plot_embedding(self, client):
        resp = client.post('/api/report/export-pdf', json={
            'sections': SAMPLE_SECTIONS,
            'title_page': SAMPLE_TITLE_PAGE,
            'plots': {'fit': TINY_PNG_B64, 'residuals': TINY_PNG_B64},
            'template': 'israeli',
            'language': 'he',
            'analysis_data': SAMPLE_ANALYSIS_DATA,
        })
        assert resp.status_code == 200
        assert resp.data[:4] == b'%PDF'

    def test_missing_student_name_returns_400(self, client):
        resp = client.post('/api/report/export-pdf', json={
            'sections': SAMPLE_SECTIONS,
            'title_page': {'studentName': '', 'experimentTitle': 'Test'},
            'plots': {},
            'template': 'israeli',
            'language': 'he',
        })
        assert resp.status_code == 400

    def test_english_language_ltr(self, client):
        resp = client.post('/api/report/export-pdf', json={
            'sections': SAMPLE_SECTIONS,
            'title_page': SAMPLE_TITLE_PAGE,
            'plots': {},
            'template': 'israeli',
            'language': 'en',
            'analysis_data': SAMPLE_ANALYSIS_DATA,
        })
        assert resp.status_code == 200
        assert resp.data[:4] == b'%PDF'
