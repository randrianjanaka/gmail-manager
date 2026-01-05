import pytest
import sys
import os

# Ensure src is in path for tests
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.schemas import FilterAction

def test_filter_action_schema_alias_conflict():
    """
    Verifies that FilterAction can correctly parse 'removeLabelIds' 
    without conflicting with other fields (like the removed mark_read).
    """
    data = {
        "removeLabelIds": ["UNREAD"],
        "addLabelIds": ["STARRED"]
    }
    # This should not raise ValidationError
    action = FilterAction(**data)
    
    assert action.remove_label_ids == ["UNREAD"]
    assert action.add_label_ids == ["STARRED"]
