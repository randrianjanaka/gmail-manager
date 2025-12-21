import pytest
from unittest.mock import MagicMock, patch
from src.gmail_service import GmailService
from src.main import app
from fastapi.testclient import TestClient

@pytest.fixture
def mock_gmail_service():
    with patch('src.main.gmail_service') as mock:
        yield mock

@pytest.fixture
def client(mock_gmail_service):
    """
    Test client for FastAPI app.
    Dependencies are mocked by default.
    """
    return TestClient(app)

@pytest.fixture
def mock_google_service():
    """
    Mocks the underlying googleapiclient service object.
    Used when testing GmailService directly.
    """
    with patch('src.gmail_service.build') as mock_build:
        mock_service = MagicMock()
        mock_build.return_value = mock_service
        yield mock_service
