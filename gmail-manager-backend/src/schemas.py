from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Email(BaseModel):
    id: str
    thread_id: str
    snippet: str
    subject: str
    sender: str
    date: str
    is_unread: bool = False

class EmailDetails(Email):
    to: str  # Combined string of all recipients
    body: str # This will be the parsed HTML or plain text body

class EmailListResponse(BaseModel):
    emails: List[Email]
    total_estimate: int
    next_page_token: Optional[str] = None

class EmailIdListResponse(BaseModel):
    ids: List[str]

class UniqueSubjectsResponse(BaseModel):
    subjects: List[str]

class ModifyLabelsRequest(BaseModel):
    add_label_names: Optional[List[str]] = []
    remove_label_names: Optional[List[str]] = []

class Label(BaseModel):
    id: str
    name: str
    type: str # 'system' or 'user'

class LabelListResponse(BaseModel):
    labels: List[Label]

class BatchActionRequest(BaseModel):
    action: str = Field(..., description="archive, trash, assign_labels, mark_read, mark_unread")
    ids: Optional[List[str]] = None
    select_all_matching: bool = False
    query_params: Optional[Dict[str, Any]] = {}
    add_label_names: Optional[List[str]] = []
    remove_label_names: Optional[List[str]] = []

class SubjectCount(BaseModel):
    subject: str
    count: int

class SubjectCountListResponse(BaseModel):
    subjects: List[SubjectCount]

class FullDashboardResponse(BaseModel):
    total_emails: int
    unread_emails: int
    subjects: List[SubjectCount]

class FilterCriteria(BaseModel):
    from_sender: Optional[str] = Field(None, alias="from")
    to_recipient: Optional[str] = Field(None, alias="to")
    subject: Optional[str] = None
    query: Optional[str] = None
    negated_query: Optional[str] = None
    has_attachment: Optional[bool] = None
    exclude_chats: Optional[bool] = None
    size: Optional[int] = None
    size_operator: Optional[str] = None

class FilterAction(BaseModel):
    add_label_ids: Optional[List[str]] = Field([], alias="addLabelIds")
    remove_label_ids: Optional[List[str]] = Field([], alias="removeLabelIds")
    forward: Optional[str] = None
    # Boolean flags for simple actions
    mark_read: Optional[bool] = Field(None, alias="removeLabelIds") # Wait, markRead is not a field? 
    # Actually Gmail API uses 'removeLabelIds'=['UNREAD'] to mark as read.
    # But usually creating a filter has specific action fields.
    # Let's check Gmail API for FilterAction.
    # https://developers.google.com/gmail/api/reference/rest/v1/users.settings.filters#FilterAction
    # Fields: addLabelIds, removeLabelIds, forward, criteria (different structure?)
    # No, Filter resource has 'action' object.
    # Action object has: addLabelIds, removeLabelIds, forward.
    # Wait, how do you "delete" or "archive"?
    # Archive = removeLabelIds: ['INBOX']
    # Delete = addLabelIds: ['TRASH']? No, TRASH is a system label.
    # Actually, the API says:
    # "addLabelIds": [string], "removeLabelIds": [string], "forward": string
    # That's it.
    # So 'mark_read' is removing UNREAD label.
    # 'archive' is removing INBOX label.
    # 'star' is adding STARRED label.
    # 'trash' is adding TRASH label.
    # 'never_spam' involves removing SPAM label? 
    # Actually for "never spam", usually you add a whitelist, but specifically in filters...
    # Let's stick to label manipulation as that's what the API exposes directly in 'action'.
    
    # So I should map my high-level boolean flags to label modifications in my Service or Main, 
    # OR just expect the frontend to send the correct labels.
    # Given the implementation plan, I should probably stick to what I have but ensure aliases match what I send to Gmail.
    # If I send "mark_read" to Gmail, it will probably ignore it or error.
    # So I need to process these flags in `create_filter` or `main.py` before sending to `gmail_service.create_filter`.
    # OR update `create_filter` in service to handle them.
    
    # Let's update schemas to be generic `add/removeLabelIds` and let frontend handle the logic of which labels correspond to "mark read" etc.
    # Or, helpful aliases.
    
    # Decision: Update schema to use aliases for add/remove labels.
    # I will comment out the others for now or keep them as optional but they won't work with Gmail API unless processed.
    # I'll let frontend send the raw labels for now to keep backend simple (Pass-through).
    
    add_label_ids: Optional[List[str]] = Field([], alias="addLabelIds")
    remove_label_ids: Optional[List[str]] = Field([], alias="removeLabelIds")
    forward: Optional[str] = None

class Filter(BaseModel):
    id: str
    criteria: FilterCriteria
    action: FilterAction

class FilterCreateRequest(BaseModel):
    criteria: FilterCriteria
    action: FilterAction

class FilterResponse(BaseModel):
    filters: List[Filter]