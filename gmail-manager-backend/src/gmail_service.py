import random
import os.path
import logging
import time
import ssl
import base64
from functools import wraps
import httplib2
from google.auth.transport.requests import Request
from google_auth_httplib2 import AuthorizedHttp
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .config import SCOPES, CREDENTIALS_FILE, TOKEN_FILE

# --- Retry Decorator ---
def retry_on_network_error(max_retries=3, delay=1):
    """
    A decorator to retry a function call on specific network errors.
    Uses exponential backoff for delays.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (BrokenPipeError, ssl.SSLError) as e:
                    logging.warning(
                        f"Network error in '{func.__name__}': {e}. "
                        f"Attempt {attempt + 1} of {max_retries}."
                    )
                    if attempt + 1 == max_retries:
                        logging.error(f"Function '{func.__name__}' failed after {max_retries} attempts.")
                        raise
                    
                    # Exponential backoff
                    backoff_delay = delay * (2 ** attempt)
                    logging.info(f"Retrying in {backoff_delay} seconds...")
                    time.sleep(backoff_delay)
        return wrapper
    return decorator
# --- End Retry Decorator ---

class GmailService:
    def __init__(self):
        self.service = self._get_gmail_service()
        self.labels_map, self.all_labels_list = self._get_labels()

    @retry_on_network_error()
    def _get_gmail_service(self):
        """Authenticates with the Gmail API and returns the service object."""
        creds = None
        try:
            if os.path.exists(TOKEN_FILE):
                creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
            
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    logging.info("Refreshing expired credentials.")
                    creds.refresh(Request())
                else:
                    logging.info("Performing new user authentication.")
                    if not os.path.exists(CREDENTIALS_FILE):
                        logging.error(f"CRITICAL: Credentials file '{CREDENTIALS_FILE}' not found.")
                        raise FileNotFoundError(
                            f"Error: '{CREDENTIALS_FILE}' not found. "
                            "Please download it from the Google Cloud Console and place it in the root directory."
                        )
                    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
                    creds = flow.run_local_server(port=0)
                
                with open(TOKEN_FILE, 'w') as token:
                    token.write(creds.to_json())
            
            # Create an HTTP object with a timeout
            # This ensures that if a batch request hangs (e.g. lost packets), it will eventually timeout and fail
            # allowing the application to recover or retry, rather than freezing indefinitely.
            http = httplib2.Http(timeout=30)
            authed_http = AuthorizedHttp(creds, http=http)
            
            return build('gmail', 'v1', http=authed_http, cache_discovery=False)
        except Exception as e:
            logging.error(f"An unexpected error occurred during service initialization: {e}", exc_info=True)
            return None
            
    @retry_on_network_error()
    def _get_labels(self) -> tuple[dict, list]:
        """Fetches all user labels and returns both a map and a list."""
        try:
            logging.info("Fetching user labels from Gmail API.")
            results = self.service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])
            labels_map = {label['name'].upper(): label['id'] for label in labels}
            structured_labels = [{"id": l["id"], "name": l["name"], "type": l.get("type", "user")} for l in labels]
            return labels_map, structured_labels
        except HttpError as error:
            logging.error(f"An HttpError occurred while fetching labels: {error.content}", exc_info=True)
            return {}, []

    @retry_on_network_error()
    def get_all_labels(self) -> list:
        """Returns the structured list of all labels."""
        return self.all_labels_list
    
    def _get_accurate_label_count(self, label_id: str) -> int:
        """Fetches the accurate message count for a specific label."""
        try:
            label = self.service.users().labels().get(userId='me', id=label_id).execute()
            return label.get('messagesTotal', 0)
        except Exception:
            return 0

    def _construct_query(self, filters: dict) -> str:
        query_parts = []
        if filters.get("from_sender"): query_parts.append(f'from:({filters["from_sender"]})')
        if filters.get("to_recipient"): query_parts.append(f'to:({filters["to_recipient"]})')
        if filters.get("subject"): query_parts.append(f'subject:({filters["subject"]})')
        if filters.get("after_date"): query_parts.append(f'after:{filters["after_date"].replace("-", "/")}')
        if filters.get("before_date"): query_parts.append(f'before:{filters["before_date"].replace("-", "/")}')
        return " ".join(query_parts)

    @retry_on_network_error()
    def list_emails(self, label_ids: list, page_token: str = None, max_results: int = 25, **filters) -> dict:
        """Lists emails with filtering, pagination, and query construction using batch requests."""
        try:
            query = self._construct_query(filters)
            logging.info(f"Executing search with query: '{query}', labels: {label_ids}")

            results = self.service.users().messages().list(
                userId='me',
                labelIds=label_ids,
                q=query,
                pageToken=page_token,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            total_estimate = results.get('resultSizeEstimate', 0)
            next_page_token = results.get('nextPageToken')
            
            # Accurate count logic:
            # If we have a simple label view, get the label count (fast).
            if not query and len(label_ids) == 1:
                 accurate_count = self._get_accurate_label_count(label_ids[0])
                 if accurate_count > 0:
                     total_estimate = accurate_count
            # If we have a query and there's a next page, the estimate is likely inaccurate.
            # We traverse IDs to count the real total. This can be slow for huge result sets,
            # but provides the accurate pagination user requested.
            elif query or next_page_token:
                # Start with current page count
                total_count = len(messages) if not page_token else 0 # If page_token exists, we are mid-stream, count is tricky without full re-scan.
                
                # Actually, for consistent "1-25 of X", X needs to be the global total. 
                # If we are on page 1 (no page_token) and there is a next page, we count.
                if not page_token and next_page_token:
                    logging.info("Counting remaining messages for accurate pagination...")
                    temp_token = next_page_token
                    while temp_token:
                        # Fetch minimal fields for speed
                        cnt_res = self.service.users().messages().list(
                            userId='me', labelIds=label_ids, q=query, pageToken=temp_token, maxResults=500, fields="nextPageToken,messages(id)"
                        ).execute()
                        total_count += len(cnt_res.get('messages', []))
                        temp_token = cnt_res.get('nextPageToken')
                    
                    total_estimate = total_count
            
            # Pre-allocate list
            emails = [None] * len(messages)
            
            if messages:
                # Callback function for batch processing
                def batch_callback(request_id, response, exception):
                    idx = int(request_id)
                    if exception:
                        logging.warning(f"Error fetching details for message index {idx}: {exception}")
                        return

                    headers = response.get('payload', {}).get('headers', [])
                    label_ids_list = response.get('labelIds', [])
                    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                    sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
                    date = next((h['value'] for h in headers if h['name'] == 'Date'), '')
                    
                    emails[idx] = {
                        "id": response['id'], 
                        "thread_id": response['threadId'], 
                        "snippet": response['snippet'],
                        "subject": subject, 
                        "sender": sender,
                        "date": date,
                        "is_unread": 'UNREAD' in label_ids_list
                    }

                # Reduced chunk size to 10 to strictly avoid concurrency limits
                chunk_size = 10
                for i in range(0, len(messages), chunk_size):
                    batch = self.service.new_batch_http_request(callback=batch_callback)
                    chunk = messages[i:i + chunk_size]
                    
                    for j, message in enumerate(chunk):
                        # request_id stores the global index to place the result back correctly
                        global_index = i + j
                        batch.add(
                            self.service.users().messages().get(
                                userId='me', 
                                id=message['id'], 
                                format='metadata', 
                                metadataHeaders=['Subject', 'From', 'Date']
                            ),
                            request_id=str(global_index)
                        )
                    
                    logging.info(f"Executing batch request for messages {i} to {i + len(chunk)}...")
                    try:
                        batch.execute()
                        # Add delay to respect rate limits
                        time.sleep(0.1)
                    except Exception as e:
                        logging.error(f"Batch execution failed for list_emails chunk {i}: {e}")

            # Filter out any emails that failed to load (None entries)
            valid_emails = [e for e in emails if e is not None]
            
            return {
                "emails": valid_emails,
                "total_estimate": total_estimate,
                "next_page_token": next_page_token
            }
        except HttpError as error:
            logging.error(f"HttpError in list_emails: {error.content}", exc_info=True)
            raise Exception(f"Failed to fetch emails: {error}")

    def get_email_ids(self, label_ids: list, **filters) -> list:
        """Fetches ONLY email IDs for a given query. Used for batch actions."""
        try:
            query = self._construct_query(filters)
            logging.info(f"Fetching all IDs for query: '{query}', labels: {label_ids}")

            all_ids = []
            page_token = None
            
            while True:
                # Fetch only IDs to be fast
                results = self.service.users().messages().list(
                    userId='me',
                    labelIds=label_ids,
                    q=query,
                    pageToken=page_token,
                    maxResults=500,
                    fields="nextPageToken,messages(id)",
                    includeSpamTrash=False
                ).execute()
                
                messages = results.get('messages', [])
                all_ids.extend([m['id'] for m in messages])
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            
            return all_ids
        except HttpError as error:
            logging.error(f"HttpError in get_email_ids: {error.content}", exc_info=True)
            raise Exception(f"Failed to fetch email IDs: {error}")
        
    def _parse_email_body(self, payload) -> str:
        """Recursively parses the email payload to find the HTML or plain text body."""
        if "parts" in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/html':
                    data = part['body'].get('data')
                    if data:
                        return base64.urlsafe_b64decode(data.encode('ASCII')).decode('utf-8')
                # Recurse for multipart messages
                body = self._parse_email_body(part)
                if body:
                    return body
        elif payload['mimeType'] == 'text/html':
             data = payload['body'].get('data')
             if data:
                return base64.urlsafe_b64decode(data.encode('ASCII')).decode('utf-8')
        # Fallback to plain text
        elif payload['mimeType'] == 'text/plain' and 'data' in payload['body']:
            data = payload['body'].get('data')
            if data:
                 return base64.urlsafe_b64decode(data.encode('ASCII')).decode('utf-8').replace('\n', '<br>')
        return ""

    @retry_on_network_error()
    def get_email_details(self, email_id: str) -> dict:
        """Gets the full details of a single email, including a parsed body."""
        try:
            msg = self.service.users().messages().get(userId='me', id=email_id, format='full').execute()
            headers = msg.get('payload', {}).get('headers', [])
            label_ids_list = msg.get('labelIds', [])
            
            details = {
                "id": msg['id'],
                "thread_id": msg['threadId'],
                "snippet": msg['snippet'],
                "subject": next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject'),
                "sender": next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender'),
                "to": ", ".join([h['value'] for h in headers if h['name'] in ['To', 'Cc', 'Bcc']]),
                "date": next((h['value'] for h in headers if h['name'] == 'Date'), ''),
                "body": self._parse_email_body(msg.get('payload', {})),
                "is_unread": 'UNREAD' in label_ids_list
            }
            return details
        except HttpError as error:
            logging.error(f"HttpError getting details for email '{email_id}': {error.content}", exc_info=True)
            raise Exception("Failed to get email details.")

    @retry_on_network_error()
    def trash_email(self, email_id: str):
        """Moves an email to the trash."""
        try:
            logging.info(f"Moving email '{email_id}' to trash.")
            service = self._get_gmail_service() # Use new service instance
            service.users().messages().trash(userId='me', id=email_id).execute()
            logging.info(f"Successfully moved email '{email_id}' to trash.")
        except HttpError as error:
            logging.error(f"HttpError trashing email '{email_id}': {error.content}", exc_info=True)
            raise Exception("Failed to move email to trash.")


    def get_unique_subjects(self, label_ids: list) -> set:
        """
        Gets a set of unique subjects from emails with the given labels.
        """
        emails_data = self.list_emails(label_ids=label_ids, max_results=500)
        return {email['subject'] for email in emails_data['emails'] if email['subject']}

    @retry_on_network_error()
    def modify_email(self, email_id: str, add_label_ids: list, remove_label_ids: list):
        """
        Modifies the labels of a specific email.
        """
        try:
            logging.info(f"Modifying email '{email_id}': ADD {add_label_ids}, REMOVE {remove_label_ids}")
            service = self._get_gmail_service() # Use new service instance
            body = {
                'addLabelIds': add_label_ids,
                'removeLabelIds': remove_label_ids
            }
            service.users().messages().modify( # Use new service instance
                userId='me', id=email_id, body=body
            ).execute()
            logging.info(f"Successfully modified labels for email '{email_id}'.")
        except HttpError as error:
            logging.error(f"HttpError modifying email '{email_id}': {error.content}", exc_info=True)
            raise Exception(f"Failed to modify email labels: {error}")

    def modify_email_by_name(self, email_id: str, add_label_names: list, remove_label_names: list):
        """
        Modifies labels by name by translating them to IDs first.
        Also marks the email as read by removing the 'UNREAD' label.
        """
        add_label_ids = [self.labels_map.get(name.upper()) for name in add_label_names if self.labels_map.get(name.upper())]
        remove_label_ids = [self.labels_map.get(name.upper()) for name in remove_label_names if self.labels_map.get(name.upper())]
        
        if 'UNREAD' not in remove_label_ids:
             remove_label_ids.append('UNREAD')
        
        self.modify_email(email_id, add_label_ids, remove_label_ids)


    def archive_email(self, email_id: str):
        """
        Archives an email by removing the 'INBOX' label and marks it as read.
        """
        logging.info(f"Archiving email '{email_id}'.")
        self.modify_email(email_id, add_label_ids=[], remove_label_ids=['INBOX', 'UNREAD'])

    def perform_batch_action(self, action: str, ids: list = None, query_params: dict = None, add_labels: list = None, remove_labels: list = None):
        # NOTE: Logic for fetching IDs based on query has been moved to get_email_ids 
        # and is now handled by the frontend calling that endpoint first.
        # This method now expects a list of IDs.
        
        if not ids:
            logging.warning("Batch Action: No emails found to process.")
            return

        logging.info(f"Batch Action: Processing {len(ids)} emails with action '{action}'")

        def batch_callback(request_id, response, exception):
            if exception:
                logging.error(f"Error in batch action for id {request_id}: {exception}")

        service = self._get_gmail_service() # Use new service instance
        # Reduced chunk size to 10 for modification operations to ensure high stability
        chunk_size = 10
        for i in range(0, len(ids), chunk_size):
            chunk = ids[i:i + chunk_size]
            batch = service.new_batch_http_request(callback=batch_callback) # Use new service instance
            
            for email_id in chunk:
                if action == 'trash':
                    batch.add(service.users().messages().trash(userId='me', id=email_id)) # Use new service instance
                elif action == 'archive':
                     batch.add(service.users().messages().modify( # Use new service instance
                        userId='me', id=email_id, body={'removeLabelIds': ['INBOX', 'UNREAD']}
                    ))
                elif action == 'assign_labels':
                    add_ids = [self.labels_map.get(n.upper()) for n in (add_labels or []) if self.labels_map.get(n.upper())]
                    remove_ids = [self.labels_map.get(n.upper()) for n in (remove_labels or []) if self.labels_map.get(n.upper())]
                    if 'UNREAD' not in remove_ids: remove_ids.append('UNREAD')
                    batch.add(service.users().messages().modify( # Use new service instance
                        userId='me', id=email_id, body={'addLabelIds': add_ids, 'removeLabelIds': remove_ids}
                    ))
                elif action == 'mark_read':
                    batch.add(service.users().messages().modify( # Use new service instance
                        userId='me', id=email_id, body={'removeLabelIds': ['UNREAD']}
                    ))
                elif action == 'mark_unread':
                    batch.add(service.users().messages().modify( # Use new service instance
                        userId='me', id=email_id, body={'addLabelIds': ['UNREAD']}
                    ))
            
            try:
                batch.execute()
                # Add significant delay to respect rate limits and avoid 429 errors during heavy processing
                time.sleep(1.0)
            except Exception as e:
                 logging.error(f"Batch execution failed for chunk {i}: {e}")

    def _execute_with_retry(self, request, max_retries=5):
        """
        Executes a Google API request with exponential backoff retry logic.
        Handles 429 (Too Many Requests) and SSL errors.
        """
        for attempt in range(max_retries):
            try:
                return request.execute()
            except (HttpError, ssl.SSLError) as e:
                if isinstance(e, HttpError):
                    # If it's not a rate limit or server error, raise immediately
                    if e.resp.status not in [429, 500, 502, 503, 504]:
                        raise e
                
                if attempt == max_retries - 1:
                    logging.error(f"Max retries reached for request. Last error: {e}")
                    raise e
                
                # Exponential backoff: 2^attempt + random jitter
                sleep_time = (2 ** attempt) + random.uniform(0, 1)
                logging.warning(f"Request failed with {e}. Retrying in {sleep_time:.2f}s...")
                time.sleep(sleep_time)

    def _count_messages(self, query: str, label_ids: list = None) -> int:
        """
        Helper to accurately count messages by iterating through all pages.
        """
        total_count = 0
        page_token = None
        service = self._get_gmail_service() # Use new service instance
        
        while True:
            request = service.users().messages().list( # Use new service instance
                userId='me',
                labelIds=label_ids,
                q=query,
                pageToken=page_token,
                maxResults=500,
                fields="nextPageToken,messages(id)",
                includeSpamTrash=False
            )
            
            results = self._execute_with_retry(request)
            
            messages = results.get('messages', [])
            total_count += len(messages)
            
            page_token = results.get('nextPageToken')
            if not page_token:
                break
            
            # Small delay between pages to be nice to the API
            time.sleep(0.1)
            
        return total_count

    def get_dashboard_stats(self) -> dict:
        """
        Fetches dashboard statistics: Total and Unread counts for INBOX -> Primary.
        Uses accurate counting by traversing all pages (optimized to fetch IDs only).
        """
        try:
            # 1. Total Emails in Primary Inbox
            # We use _count_messages which is optimized to fetch only IDs
            total_emails = self._count_messages(query='category:primary', label_ids=['INBOX'])
            
            # 2. Unread Emails in Primary Inbox
            unread_emails = self._count_messages(query='category:primary is:unread', label_ids=['INBOX'])
            
            return {
                "total_emails": total_emails,
                "unread_emails": unread_emails
            }
        except Exception as e:
            logging.error(f"Error fetching dashboard stats: {e}", exc_info=True)
            return {"total_emails": 0, "unread_emails": 0}

    def get_subject_counts(self, label_ids: list, limit: int = 200) -> list:
        """
        Aggregates subject counts for the given labels.
        Iterates through pages to get accurate counts, up to a limit.
        Returns a list of dicts: [{'subject': '...', 'count': 10}, ...] sorted by count desc.
        """
        try:
            subject_counts = {}
            page_token = None
            total_processed = 0
            service = self._get_gmail_service() # Use new service instance
            
            # Batch request callback
            def batch_callback(request_id, response, exception):
                if exception:
                    logging.warning(f"Error fetching headers for msg {request_id}: {exception}")
                    return
                
                headers = response.get('payload', {}).get('headers', [])
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                if subject:
                    subject_counts[subject] = subject_counts.get(subject, 0) + 1

            while True:
                # Check limit
                if limit and total_processed >= limit:
                    break

                # 1. List IDs for current page
                request = service.users().messages().list(
                    userId='me',
                    labelIds=label_ids,
                    pageToken=page_token,
                    maxResults=500, # Max allowed for list
                    fields="nextPageToken,messages(id)"
                )
                
                results = self._execute_with_retry(request)
                
                messages = results.get('messages', [])
                
                if messages:
                    # 2. Batch fetch headers for these messages
                    # Batch size 10 for stability
                    chunk_size = 10
                    
                    # If adding this chunk exceeds limit, truncate
                    if limit and (total_processed + len(messages)) > limit:
                        messages = messages[:limit - total_processed]

                    for i in range(0, len(messages), chunk_size):
                        chunk = messages[i:i + chunk_size]
                        batch = service.new_batch_http_request(callback=batch_callback)
                        
                        for msg in chunk:
                            batch.add(
                                service.users().messages().get(
                                    userId='me', 
                                    id=msg['id'], 
                                    format='metadata', 
                                    metadataHeaders=['Subject']
                                )
                            )
                        try:
                            batch.execute()
                            time.sleep(0.1) # Short delay for smaller batches
                        except Exception as e:
                            logging.error(f"Batch execution failed during subject count: {e}")
                    
                    total_processed += len(messages)

                page_token = results.get('nextPageToken')
                if not page_token:
                    break
                
                # Small delay between pages
                time.sleep(0.1)
            
            # Convert to list of dicts
            result = [
                {"subject": subj, "count": count} 
                for subj, count in subject_counts.items()
            ]
            
            # Sort by count descending
            result.sort(key=lambda x: x['count'], reverse=True)
            
            return result
        except Exception as e:
            logging.error(f"Error calculating subject counts: {e}", exc_info=True)
            return []

    def get_full_dashboard_data(self, label_ids: list) -> dict:
        """
        Fetches all dashboard data (Total, Unread, Subject Counts) in a single pass.
        Uses a hybrid approach:
        1. Fast 'list' calls for Total and Unread counts (accurate, fast).
        2. Limited 'get' calls for Subject analysis (recent 1000 emails).
        """
        try:
            logging.info("Fetching full dashboard data with hybrid strategy.")
            
            # 1. Fast Total Count
            # Uses list() which only fetches IDs, very fast.
            total_emails = self._count_messages(query=None, label_ids=label_ids)
            
            # 2. Fast Unread Count
            # Uses list() with q='is:unread', very fast.
            unread_emails = self._count_messages(query="is:unread", label_ids=label_ids)
            
            # 3. Subject Analysis (Limited)
            # Only analyze the most recent 200 emails to keep it fast and avoid rate limits.
            subjects_list = self.get_subject_counts(label_ids=label_ids, limit=200)
            
            return {
                "total_emails": total_emails,
                "unread_emails": unread_emails,
                "subjects": subjects_list
            }
        except Exception as e:
            logging.error(f"Error fetching full dashboard data: {e}", exc_info=True)
            return {
                "total_emails": 0,
                "unread_emails": 0,
                "subjects": []
            }