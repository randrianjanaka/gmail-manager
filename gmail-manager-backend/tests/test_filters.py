import pytest
from unittest.mock import MagicMock
from src.gmail_service import GmailService

class TestGmailServiceFilters:
    
    @pytest.fixture
    def service_instance(self, mock_google_service):
        # We need to mock credentials loading too since __init__ calls it
        with patch('src.gmail_service.Credentials') as mock_creds:
            with patch('src.gmail_service.GmailService._get_labels', return_value=({}, [])):
                 service = GmailService()
                 # Replace the internal service with our mock
                 service.service = mock_google_service
                 return service

    # Note: Constructing GmailService is tricky because of __init__ side effects (API calls).
    # Ideally we refactor GmailService to verify logic, but for now we'll mock heavy methods.
    # Actually, simpler is to just test the logic logic, but most logic is "call API".
    # So we verify the API calls are constructed correctly.

    def test_list_filters(self, mock_google_service):
        # Setup
        # Avoid instantiating real GmailService, just test the method if possible of usage
        # Or mock the whole class but call method? No.
        
        # Let's mock the internal service calls
        mock_filters = mock_google_service.users().settings().filters()
        mock_filters.list().execute.return_value = {'filter': [{'id': '123'}]}
        
        # Instantiate with mocks
        with patch('src.gmail_service.GmailService._get_gmail_service', return_value=mock_google_service):
            with patch('src.gmail_service.GmailService._get_labels', return_value=({}, [])):
                 service = GmailService()
        
        # Action
        filters = service.list_filters()
        
        # Assert
        assert filters == [{'id': '123'}]
        mock_filters.list.assert_called_with(userId='me')

    def test_create_filter(self, mock_google_service):
        mock_filters = mock_google_service.users().settings().filters()
        mock_filters.create().execute.return_value = {'id': 'new_filter'}
        
        with patch('src.gmail_service.GmailService._get_gmail_service', return_value=mock_google_service):
             with patch('src.gmail_service.GmailService._get_labels', return_value=({}, [])):
                 service = GmailService()
        
        filter_obj = {'criteria': {'from': 'test@example.com'}}
        result = service.create_filter(filter_obj)
        
        assert result == {'id': 'new_filter'}
        mock_filters.create.assert_called_with(userId='me', body=filter_obj)

from unittest.mock import patch
