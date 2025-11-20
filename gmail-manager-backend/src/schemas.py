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