import os
import logging
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from .schemas import (
    EmailListResponse, UniqueSubjectsResponse, ModifyLabelsRequest,
    LabelListResponse, EmailDetails, BatchActionRequest, EmailIdListResponse,
    SubjectCountListResponse, FullDashboardResponse
)
from .gmail_service import GmailService
from .config import FRONTEND_URL

# --- Logging Configuration ---
# This sets up a basic logger that prints timestamped messages to the console.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(module)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
# --- End Logging Configuration ---

app = FastAPI(
    title="Gmail Interaction API",
    description="An API to interact with a Gmail account for custom interfaces.",
    version="1.0.0"
)

# CORS (Cross-Origin Resource Sharing) Middleware
# This allows the frontend application to communicate with the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Gmail Service
# This will handle the authentication flow on the first API call.
gmail_service = GmailService()

@app.get("/labels", response_model=LabelListResponse, tags=["Labels"])
def get_all_user_labels():
    """
    Retrieves a list of all user-defined and system labels/folders.
    """
    try:
        labels = gmail_service.get_all_labels()
        return {"labels": labels}
    except Exception as e:
        logging.error(f"Error in get_all_user_labels: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve labels.")

@app.get("/emails", response_model=EmailListResponse, tags=["Emails"])
def list_emails(
    folder: Optional[str] = Query(None, description="A standard folder (e.g., INBOX, SENT)."),
    inbox_filter: Optional[str] = Query(None, description="Specific inbox category (e.g., Primary)."),
    label: Optional[str] = Query(None, description="A specific user label to filter by."),
    page_token: Optional[str] = Query(None, description="Token for pagination."),
    max_results: int = Query(25, description="Maximum number of emails per page.", ge=1, le=500),
    from_sender: Optional[str] = Query(None, description="Filter emails from a specific sender."),
    to_recipient: Optional[str] = Query(None, description="Filter emails to a specific recipient."),
    subject: Optional[str] = Query(None, description="Filter emails by subject line."),
    after_date: Optional[str] = Query(None, description="Filter emails after this date (YYYY-MM-DD)."),
    before_date: Optional[str] = Query(None, description="Filter emails before this date (YYYY-MM-DD).")
):
    """
    Lists emails with advanced filtering and pagination.
    """
    label_ids = []
    # Handle special inbox categories
    inbox_categories = {
        "PRIMARY": "CATEGORY_PERSONAL",
        "PROMOTIONS": "CATEGORY_PROMOTIONS",
        "SOCIAL": "CATEGORY_SOCIAL",
    }
    
    if label:
        # For user labels, we need to look up their ID
        label_id = gmail_service.labels_map.get(label.upper())
        if label_id:
            label_ids.append(label_id)
    elif folder and folder.upper() == 'INBOX' and inbox_filter and inbox_filter.upper() in inbox_categories:
        label_ids.append('INBOX')
        label_ids.append(inbox_categories[inbox_filter.upper()])
    elif folder:
        label_ids.append(folder.upper())

    try:
        result = gmail_service.list_emails(
            label_ids=label_ids,
            page_token=page_token,
            max_results=max_results,
            from_sender=from_sender,
            to_recipient=to_recipient,
            subject=subject,
            after_date=after_date,
            before_date=before_date
        )
        return result
    except Exception as e:
        logging.error(f"Error in list_emails endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/emails/ids", response_model=EmailIdListResponse, tags=["Emails"])
def list_email_ids(
    folder: Optional[str] = Query(None),
    inbox_filter: Optional[str] = Query(None),
    label: Optional[str] = Query(None),
    from_sender: Optional[str] = Query(None),
    to_recipient: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    after_date: Optional[str] = Query(None),
    before_date: Optional[str] = Query(None)
):
    """
    Retrieves a list of ALL email IDs matching the criteria, across all pages.
    Used for client-side batch processing.
    """
    label_ids = []
    inbox_categories = {
        "PRIMARY": "CATEGORY_PERSONAL",
        "PROMOTIONS": "CATEGORY_PROMOTIONS",
        "SOCIAL": "CATEGORY_SOCIAL",
    }
    
    if label:
        label_id = gmail_service.labels_map.get(label.upper())
        if label_id: label_ids.append(label_id)
    elif folder and folder.upper() == 'INBOX' and inbox_filter and inbox_filter.upper() in inbox_categories:
        label_ids.append('INBOX')
        label_ids.append(inbox_categories[inbox_filter.upper()])
    elif folder:
        label_ids.append(folder.upper())

    try:
        ids = gmail_service.get_email_ids(
            label_ids=label_ids,
            from_sender=from_sender,
            to_recipient=to_recipient,
            subject=subject,
            after_date=after_date,
            before_date=before_date
        )
        return {"ids": ids}
    except Exception as e:
        logging.error(f"Error in list_email_ids endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/emails/{email_id}", response_model=EmailDetails, tags=["Emails"])
def get_email_content(email_id: str):
    """
    Retrieves the full content and details of a single email.
    """
    try:
        email_details = gmail_service.get_email_details(email_id)
        if not email_details:
            raise HTTPException(status_code=404, detail="Email not found.")
        return email_details
    except Exception as e:
        logging.error(f"Error getting content for email '{email_id}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve email content.")

@app.post("/emails/{email_id}/trash", status_code=204, tags=["Actions"])
def trash_email(email_id: str):
    """
    Moves a specific email to the trash.
    """
    try:
        gmail_service.trash_email(email_id)
        return
    except Exception as e:
        logging.error(f"Error in trash_email '{email_id}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to move email to trash.")

@app.get("/subjects/unique", response_model=UniqueSubjectsResponse, tags=["Emails"])
def get_unique_subjects(
    folder: Optional[str] = Query(None),
    inbox_filter: Optional[str] = Query(None),
    label: Optional[str] = Query(None)
):
    label_ids = []
    inbox_categories = {
        "PRIMARY": "CATEGORY_PERSONAL",
        "PROMOTIONS": "CATEGORY_PROMOTIONS",
        "SOCIAL": "CATEGORY_SOCIAL",
    }

    if label:
        # Note: For user labels, the service needs the ID, not the name.
        # Assuming the service method can handle looking up ID if not passed, 
        # but main.py usually does the lookup. 
        # Let's lookup the ID here to be consistent with list_emails
        label_id = gmail_service.labels_map.get(label.upper())
        if label_id: 
            label_ids.append(label_id)
        else:
            # Fallback or if it's a system label passed as 'label'
            label_ids.append(label.upper())
    elif folder and folder.upper() == 'INBOX' and inbox_filter and inbox_filter.upper() in inbox_categories:
        label_ids.append('INBOX')
        label_ids.append(inbox_categories[inbox_filter.upper()])
    elif folder:
        label_ids.append(folder.upper())
    
    # Default to INBOX if nothing provided
    if not label_ids:
        label_ids.append('INBOX')

    try:
        subjects = gmail_service.get_unique_subjects(label_ids=label_ids)
        return {"subjects": list(subjects)}
    except Exception as e:
        logging.error(f"Error in get_unique_subjects: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/assign-labels", status_code=204, tags=["Actions"])
def assign_labels_to_email(email_id: str, request: ModifyLabelsRequest):
    """
    Assigns or removes labels for a specific email using label names.
    """
    try:
        gmail_service.modify_email_by_name(
            email_id,
            add_label_names=request.add_label_names,
            remove_label_names=request.remove_label_names
        )
        return
    except Exception as e:
        logging.error(f"Error in assign_labels '{email_id}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/archive", status_code=204, tags=["Actions"])
def archive_email(email_id: str):
    """
    Archives a specific email by removing the 'INBOX' label.
    """
    try:
        gmail_service.archive_email(email_id)
        return
    except Exception as e:
        logging.error(f"Error in archive_email '{email_id}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/actions/batch", status_code=204, tags=["Actions"])
def perform_batch_action(request: BatchActionRequest):
    """
    Performs a batch action (archive, trash, assign labels) on selected emails.
    Expects a list of IDs. Filtering logic is now client-side (fetching IDs first).
    """
    try:
        # We now expect IDs to be provided by the client even for "All Matching"
        if not request.ids:
             raise HTTPException(status_code=400, detail="No IDs provided for batch action.")

        gmail_service.perform_batch_action(
            action=request.action,
            ids=request.ids,
            query_params=None, # Deprecated for this endpoint logic
            add_labels=request.add_label_names,
            remove_labels=request.remove_label_names
        )
        return
    except Exception as e:
        logging.error(f"Error in perform_batch_action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to perform batch action.")

# --- Placeholder Endpoints ---

@app.get("/dashboard/summary", tags=["Dashboard"])
def get_dashboard_summary():
    """
    Placeholder endpoint for a future dashboard.
    Updated to match the data structure expected by the frontend.
    """
    stats = gmail_service.get_dashboard_stats()
    return {
        "message": "Dashboard data loaded.",
        "total_emails": stats.get("total_emails", 0),
        "unread_emails": stats.get("unread_emails", 0)
    }

@app.get("/dashboard/subjects", response_model=SubjectCountListResponse, tags=["Dashboard"])
def get_dashboard_subjects(
    folder: Optional[str] = Query(None),
    inbox_filter: Optional[str] = Query(None),
    label: Optional[str] = Query(None)
):
    """
    Retrieves subject counts for a specific folder/label.
    Defaults to INBOX -> Primary if nothing specified.
    """
    label_ids = []
    inbox_categories = {
        "PRIMARY": "CATEGORY_PERSONAL",
        "PROMOTIONS": "CATEGORY_PROMOTIONS",
        "SOCIAL": "CATEGORY_SOCIAL",
    }

    if label:
        label_id = gmail_service.labels_map.get(label.upper())
        if label_id: 
            label_ids.append(label_id)
        else:
            label_ids.append(label.upper())
    elif folder and folder.upper() == 'INBOX' and inbox_filter and inbox_filter.upper() in inbox_categories:
        label_ids.append('INBOX')
        label_ids.append(inbox_categories[inbox_filter.upper()])
    elif folder:
        label_ids.append(folder.upper())
    
    # Default to INBOX -> Primary if nothing provided
    if not label_ids:
        label_ids.append('INBOX')
        label_ids.append('CATEGORY_PERSONAL')

    try:
        # Limit to 500 for performance
        counts = gmail_service.get_subject_counts(label_ids=label_ids, limit=500)
        return {"subjects": counts}
    except Exception as e:
        logging.error(f"Error in get_dashboard_subjects: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/full", response_model=FullDashboardResponse, tags=["Dashboard"])
def get_full_dashboard():
    """
    Retrieves all dashboard data (Total, Unread, Subjects) for INBOX -> Primary in one go.
    """
    try:
        # INBOX + CATEGORY_PERSONAL
        label_ids = ['INBOX', 'CATEGORY_PERSONAL']
        data = gmail_service.get_full_dashboard_data(label_ids=label_ids)
        return data
    except Exception as e:
        logging.error(f"Error in get_full_dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/alerts/custom", tags=["Alerts"])
def create_custom_alert():
    """
    Placeholder endpoint for creating custom alerts.
    """
    raise HTTPException(status_code=501, detail="Feature not implemented yet.")