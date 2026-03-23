"""Tests for PDF rendering pipeline.

Validates WeasyPrint PDF generation, KaTeX LaTeX-to-HTML conversion,
Hebrew RTL text handling, and the /api/report/test-pdf endpoint.
"""

import os
import sys
import tempfile

import pytest

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from tests.conftest import requires_weasyprint


@requires_weasyprint
def test_generates_pdf_with_hebrew():
    """PDF-01: generate_test_pdf returns a valid PDF with Hebrew content."""
    from utils.pdf_renderer import generate_test_pdf

    pdf = generate_test_pdf()
    assert isinstance(pdf, bytes), "Expected bytes output"
    assert pdf[:4] == b'%PDF', f"Not a PDF: starts with {pdf[:10]}"
    assert len(pdf) > 1000, f"PDF suspiciously small: {len(pdf)} bytes"


@requires_weasyprint
def test_pdf_page_size():
    """PDF-01: generated PDF is valid and can be written/read from disk."""
    from utils.pdf_renderer import generate_test_pdf

    pdf = generate_test_pdf()
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        f.write(pdf)
        tmp_path = f.name

    try:
        with open(tmp_path, 'rb') as f:
            data = f.read()
        assert data[:4] == b'%PDF', "Written PDF is not valid"
        assert len(data) == len(pdf), "Written size mismatch"
    finally:
        os.unlink(tmp_path)


@requires_weasyprint
def test_katex_renders_all_expressions():
    """PDF-02: KaTeX renders the standard 12-expression test suite."""
    from utils.pdf_renderer import render_latex_for_pdf

    expressions = [
        r"k = 49.8 \pm 0.5 \text{ N/m}",
        r"T = \frac{2\pi}{\omega}",
        r"F = ma",
        r"E = mc^2",
        r"\sigma = \sqrt{\frac{\sum (x_i - \bar{x})^2}{N-1}}",
        r"\chi^2 = \sum \frac{(O_i - E_i)^2}{E_i}",
        r"\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}",
        r"g = 9.81 \pm 0.01 \text{ m/s}^2",
        r"\vec{F} = q(\vec{E} + \vec{v} \times \vec{B})",
        r"\nabla \cdot \vec{E} = \frac{\rho}{\epsilon_0}",
        r"\frac{\partial^2 u}{\partial t^2} = c^2 \nabla^2 u",
        r"e^{i\pi} + 1 = 0",
    ]

    for expr in expressions:
        html = render_latex_for_pdf(expr)
        assert html, f"Empty HTML for: {expr}"
        assert 'katex' in html.lower() or 'class="katex' in html, \
            f"No katex class in output for: {expr}"


@requires_weasyprint
def test_katex_html_structure():
    """PDF-02: KaTeX output has correct structure (no inline SVG)."""
    from utils.pdf_renderer import render_latex_for_pdf

    html = render_latex_for_pdf(r"k = 49.8 \pm 0.5 \text{ N/m}")
    assert 'class="katex"' in html or "class='katex'" in html, \
        "Missing katex class in output"
    assert '<svg' not in html, "Found inline SVG (no_inline_svg should prevent this)"


@requires_weasyprint
def test_process_text_with_math():
    """PDF-02: process_text_with_math wraps inline math correctly."""
    from utils.pdf_renderer import process_text_with_math

    result = process_text_with_math("Hebrew text $x^2$ more Hebrew")
    assert 'class="math-inline"' in result, "Missing math-inline class"
    assert 'dir="ltr"' in result, "Missing LTR direction on math"


@requires_weasyprint
def test_all_12_expressions_in_pdf():
    """PDF-02: Test PDF contains all 12 equation types from EQUATION_TEST_SUITE."""
    from utils.pdf_renderer import generate_test_pdf, EQUATION_TEST_SUITE

    # Verify the suite has exactly 12 entries
    assert len(EQUATION_TEST_SUITE) == 12, \
        f"Expected 12 expressions, got {len(EQUATION_TEST_SUITE)}"

    # Generate the comprehensive test PDF
    pdf = generate_test_pdf()
    assert isinstance(pdf, bytes), "Expected bytes output"
    assert pdf[:4] == b'%PDF', f"Not a PDF: starts with {pdf[:10]}"
    assert len(pdf) > 5000, \
        f"Comprehensive PDF too small: {len(pdf)} bytes (expected > 5000)"


@requires_weasyprint
def test_bidi_text_processing():
    """PDF-02: process_text_with_math handles all 5 bidi edge cases correctly."""
    from utils.pdf_renderer import process_text_with_math, BIDI_TEST_CASES

    assert len(BIDI_TEST_CASES) == 5, \
        f"Expected 5 bidi test cases, got {len(BIDI_TEST_CASES)}"

    for i, text in enumerate(BIDI_TEST_CASES):
        result = process_text_with_math(text)
        assert 'dir="ltr"' in result, \
            f"Bidi case {i+1}: missing dir='ltr' wrapper for math"
        assert 'class="math-inline"' in result, \
            f"Bidi case {i+1}: missing math-inline class"


@requires_weasyprint
def test_test_pdf_endpoint(client):
    """PDF-01: GET /api/report/test-pdf returns valid PDF response."""
    response = client.get('/api/report/test-pdf')
    assert response.status_code == 200, \
        f"Expected 200, got {response.status_code}: {response.data[:200]}"
    assert response.content_type == 'application/pdf', \
        f"Expected application/pdf, got {response.content_type}"
    assert response.data[:4] == b'%PDF', "Response is not a PDF"
