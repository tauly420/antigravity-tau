"""Tests for file parser utilities and upload endpoint."""
import io
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.file_parser import extract_pdf_text, extract_docx_text


def make_test_pdf(text="Hello World"):
    import pymupdf
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def make_empty_pdf():
    import pymupdf
    doc = pymupdf.open()
    doc.new_page()
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def make_test_docx(text="Test paragraph"):
    from docx import Document
    doc = Document()
    doc.add_paragraph(text)
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


@pytest.fixture
def client():
    from app import create_app
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


def test_pdf_extraction():
    pdf_bytes = make_test_pdf("Hello World")
    text = extract_pdf_text(pdf_bytes)
    assert "Hello World" in text


def test_docx_extraction():
    docx_bytes = make_test_docx("Test paragraph")
    text = extract_docx_text(docx_bytes)
    assert "Test paragraph" in text


def test_empty_pdf():
    pdf_bytes = make_empty_pdf()
    text = extract_pdf_text(pdf_bytes)
    assert text.strip() == ""


def test_upload_endpoint_pdf(client):
    pdf_bytes = make_test_pdf("Upload test")
    data = {'file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    response = client.post('/api/report/upload-instructions', data=data, content_type='multipart/form-data')
    assert response.status_code == 200
    json_data = response.get_json()
    assert "text" in json_data
    assert json_data["error"] is None
    assert "Upload test" in json_data["text"]


def test_upload_endpoint_docx(client):
    docx_bytes = make_test_docx("Docx upload test")
    data = {'file': (io.BytesIO(docx_bytes), 'test.docx')}
    response = client.post('/api/report/upload-instructions', data=data, content_type='multipart/form-data')
    assert response.status_code == 200
    json_data = response.get_json()
    assert "text" in json_data
    assert json_data["error"] is None
    assert "Docx upload test" in json_data["text"]


def test_upload_unsupported_type(client):
    data = {'file': (io.BytesIO(b"plain text"), 'test.txt')}
    response = client.post('/api/report/upload-instructions', data=data, content_type='multipart/form-data')
    assert response.status_code == 400
    json_data = response.get_json()
    assert json_data["error"] == "Unsupported file type. Please upload a PDF or DOCX file."


def test_upload_no_file(client):
    response = client.post('/api/report/upload-instructions', content_type='multipart/form-data')
    assert response.status_code == 400
    json_data = response.get_json()
    assert json_data["error"] == "No file uploaded"


def test_empty_pdf_warning(client):
    pdf_bytes = make_empty_pdf()
    data = {'file': (io.BytesIO(pdf_bytes), 'empty.pdf')}
    response = client.post('/api/report/upload-instructions', data=data, content_type='multipart/form-data')
    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data["warning"] is not None
    assert "No text found" in json_data["warning"]
