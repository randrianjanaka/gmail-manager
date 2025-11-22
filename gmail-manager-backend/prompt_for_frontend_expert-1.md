# Prompt for Frontend Development: Gmail Custom Interface

## 1. Project Overview

We are building a clean, modern, and intuitive web interface to interact with a user's Gmail account. The backend is a Python FastAPI application that provides a set of RESTful API endpoints for all required actions. Your task is to design and build the frontend that consumes this API to deliver a seamless user experience.

## 2. Core Features & User Stories

### A. Dashboard (Monitoring)
*   **User Story:** As a user, I want a dashboard where I can see a quick overview of my email status.
*   **Requirements:**
    *   Display key metrics like "Total Emails in Inbox," "Unread Emails," and "Emails in Sent Folder."
    *   This data will be fetched from a `/dashboard/summary` endpoint.
    *   Include a placeholder section or component for "Custom Alerts," which will be implemented in the future.

### B. Email Viewer
*   **User Story:** As a user, I want to be able to select a folder (e.g., Inbox, Sent) or a custom label and see all the emails within it.
*   **Requirements:**
    *   A navigation element (sidebar or dropdown) to list and select available Gmail folders/labels. The primary ones are `INBOX`, `SENT`, `SPAM`, `TRASH`.
    *   When a folder/label is selected, the frontend should call the `GET /emails?folder={folder_name}` API endpoint.
    *   Display the list of emails in a clean, readable format (e.g., a table or a list).
    *   Each email in the list should display the **Sender**, **Subject**, and a short **Snippet** of the content.
    *   Implement checkboxes next to each email to allow for multi-selection.

### C. Email Actions
*   **User Story:** As a user, I want to perform actions on one or more selected emails, such as archiving them or moving them to a different folder/label.
*   **Requirements:**
    *   When one or more emails are selected, action buttons like "Archive" and "Assign Label" should become active.
    *   **Archive:** Clicking this should call the `POST /emails/{email_id}/archive` endpoint for each selected email.
    *   **Assign Label:** Clicking this should open a modal or dropdown allowing the user to select one or more labels to apply. The frontend will then call the `POST /emails/{email_id}/assign-labels` endpoint with the appropriate label IDs.

### D. Unique Subjects List
*   **User Story:** As a user, I want to quickly see a list of all the unique subjects from the emails in my currently viewed folder/label to identify recurring topics.
*   **Requirements:**
    *   A button or tab in the Email Viewer section labeled "Show Unique Subjects."
    *   Clicking this should call the `GET /subjects/unique?folder={folder_name}` endpoint and display the returned list of unique subject lines.

## 3. Technical & Design Guidelines

*   **Framework:** You have the freedom to choose a modern JavaScript framework like **React, Vue, or Svelte**.
*   **API Consumption:** The frontend will be purely a client for the backend API. All data and actions are handled via HTTP requests. The base URL for the API will be `http://127.0.0.1:8123`.
*   **Design:** The design should be clean, responsive, and user-friendly. A minimalist aesthetic is preferred.
*   **State Management:** Use a robust state management solution (e.g., Redux, Vuex, Context API) to handle application state, especially for the email list and user selections.

## 4. API Endpoints to Use

*   `GET /emails?folder={name}`: Fetches emails for a given folder.
*   `GET /subjects/unique?folder={name}`: Fetches unique subjects for a folder.
*   `POST /emails/{email_id}/archive`: Archives an email.
*   `POST /emails/{email_id}/assign-labels`: Adds/removes labels from an email.
*   `GET /dashboard/summary`: Gets placeholder data for the dashboard.
*   `POST /alerts/custom`: Placeholder for creating custom alerts.

The backend provides interactive API documentation at `http://127.0.0.1:8123/docs` where you can see detailed request/response models.