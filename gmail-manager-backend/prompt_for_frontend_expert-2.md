# Prompt for Frontend Development: Advanced Gmail Interface

## 1. Project Overview

We are upgrading our custom Gmail interface to include advanced filtering, pagination, a dynamic sidebar, and a full email-viewing experience. The backend has been enhanced with new and updated API endpoints to support these features. Your task is to implement the corresponding UI/UX components.

## 2. Core Feature Upgrades

### A. Dynamic Sidebar
*   **User Story:** As a user, I want the sidebar to automatically show all of my actual Gmail folders and labels, not a static list.
*   **Requirements:**
    *   On application load, fetch all labels from the new `GET /labels` endpoint.
    *   The sidebar should be divided into two sections: "Folders" and "Labels".
    *   The "Folders" section should display system labels like `INBOX`, `SENT`, `SPAM`, and `TRASH`.
    *   **Special Inbox Handling:** The "INBOX" folder should be broken down into sub-categories: `Primary`, `Promotions`, and `Social`. Clicking on one of these should filter the inbox accordingly.
    *   The "Labels" section should display all user-created labels returned from the API.
    *   Clicking any folder or label should trigger a call to the `GET /emails` endpoint with the appropriate filter.

### B. Advanced Filtering Panel
*   **User Story:** As a user, I want to be able to search for specific emails using multiple criteria.
*   **Requirements:**
    *   Above the email list, create a collapsible panel labeled "Filters".
    *   This panel should contain the following input fields:
        *   `From:` (text input for sender's email)
        *   `To:` (text input for recipient's email)
        *   `Subject:` (text input for subject line)
        *   `After:` (date picker)
        *   `Before:` (date picker)
    *   A "Search" button should apply the filters by making a request to the `GET /emails` endpoint with the values as query parameters (e.g., `?from_sender=...&subject=...`).
    *   A "Clear" button should reset all filter fields.

### C. Pagination Controls
*   **User Story:** As a user, I want to navigate through pages of my emails instead of seeing only the first 20.
*   **Requirements:**
    *   The `GET /emails` API response now includes `next_page_token` and `total_estimate`.
    *   At the bottom of the email list, display pagination controls.
    *   These controls should include "Previous" and "Next" buttons.
    *   Show the current email count (e.g., "Showing 1-25 of ~5,300").
    *   Clicking "Next" should re-fetch emails using the `next_page_token` from the previous response (`?page_token=...`).
    *   The "Previous" button should be managed client-side by storing the history of page tokens.

### D. Email Content Modal
*   **User Story:** As a user, I want to click on an email to read its full content in a pop-up without leaving the list view.
*   **Requirements:**
    *   When an email in the list is clicked, open a modal.
    *   Fetch the full email data by calling the new `GET /emails/{email_id}` endpoint.
    *   The modal should display the **Subject**, **Sender**, **Recipients**, and **Date**.
    *   The main area of the modal must render the HTML `body` of the email. **This must be done safely to prevent XSS attacks** (e.g., using a library like `DOMPurify` or an `iframe` with a `srcDoc` attribute).
    *   The modal must have an action bar at the top or bottom with the following buttons:
        *   `Assign Label` (opens the existing label assignment modal).
        *   `Move to Trash` (calls `POST /emails/{email_id}/trash` and then closes the modal and refreshes the email list).
        *   `Close` (closes the modal).

### E. Enhanced Multi-Select Actions
*   **User Story:** As a user, I want to be able to delete multiple selected emails at once.
*   **Requirements:**
    *   The action bar that appears when multiple emails are checked should now include a "Move to Trash" button.
    *   When clicked, this button should iterate through the set of selected email IDs and call the `POST /emails/{email_id}/trash` endpoint for each one.
    *   After the action is complete, the email list should be refreshed.

## 3. Updated API Endpoints

*   `GET /labels`: **(NEW)** Fetches all user folders and labels for the sidebar.
*   `GET /emails`: **(UPDATED)** Now accepts filter and pagination parameters:
    *   `?folder={name}` or `?label={name}`
    *   `?from_sender={email}`
    *   `?to_recipient={email}`
    *   `?subject={text}`
    *   `?after_date={YYYY-MM-DD}`
    *   `?before_date={YYYY-MM-DD}`
    *   `?page_token={token}`
*   `GET /emails/{email_id}`: **(NEW)** Fetches the full, parsed content of a single email.
*   `POST /emails/{email_id}/trash`: **(NEW)** Moves a specific email to the trash.
*   The existing endpoints for `archive` and `assign-labels` remain unchanged.