"""Shared test fixtures and markers for backend tests."""

import os
import sys
import pytest


def _weasyprint_available():
    """Check if WeasyPrint and its system libraries are installed."""
    try:
        import weasyprint  # noqa: F401
        return True
    except (ImportError, OSError):
        return False


requires_weasyprint = pytest.mark.skipif(
    not _weasyprint_available(),
    reason="WeasyPrint system libraries not installed"
)


@pytest.fixture
def app():
    """Create Flask test app."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from app import create_app
    app = create_app()
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    """Create Flask test client."""
    return app.test_client()
