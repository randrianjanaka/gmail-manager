# Gmail API Backend (Full-Stack Edition)

This project provides a Python-based backend using FastAPI to interact with the Gmail API. It is designed to work with the provided Next.js frontend to list, modify, and monitor emails from a user's Gmail account.

## Features

- List emails from any folder or label.
- Get a list of unique email subjects.
- Archive emails.
- Assign or remove labels from emails by name.
- CORS support for the frontend application.

---

## Full-Stack Setup Guide

Follow these steps to get both the backend and frontend running locally.

### Prerequisites

-   **Python 3.8+** and `pip`
-   **Node.js 18+** and `pnpm` (or `npm`/`yarn`)
    -   To install `pnpm`, run: `npm install -g pnpm`

### Step 1: Google Cloud & Gmail API Setup

1.  **Go to the Google Cloud Console:** [https://console.cloud.google.com/](https://console.cloud.google.com/)
2.  **Create a new project** (or select an existing one).
3.  **Enable the Gmail API:**
    -   In the search bar, type "Gmail API" and select it.
    -   Click the "Enable" button.
4.  **Create OAuth 2.0 Credentials:**
    -   Go to "APIs & Services" > "Credentials".
    -   Click "+ CREATE CREDENTIALS" and select "OAuth client ID".
    -   If prompted, configure the OAuth consent screen. Choose "External" and provide an app name, user support email, and developer contact information. You can skip scopes for now. Add your Google account as a test user.
    -   For the "Application type", select **"Desktop app"**.
    -   Give it a name (e.g., "Gmail Backend Client").
    -   Click "Create".
5.  **Download Credentials:**
    -   A popup will show your Client ID and Client Secret. Click **"DOWNLOAD JSON"**.
    -   Rename the downloaded file to `credentials.json` and place it in the **root of this `gmail-manager-backend` directory**.

### Step 2: Backend Setup & Launch

1.  **Navigate to the backend directory:**
    ```bash
    cd gmail-manager-backend
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    # For macOS/Linux
    python3 -m venv venv
    source venv/bin/activate

    # For Windows
    python -m venv venv
    venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Start the backend server:**
    ```bash
    uvicorn src.main:app --reload
    ```
    The server will be running at `http://127.0.0.1:8123`.

5.  **First-time Authentication:**
    -   The very first time the frontend makes an API call, the backend will detect that you are not authenticated.
    -   It will print a URL in your console and automatically open a new tab in your web browser.
    -   **Log in** with the Google account you want to manage and grant the application permissions.
    -   After you approve, a `token.json` file will be created in this directory. You won't have to log in again.

### Step 3: Frontend Setup & Launch

1.  **Open a new terminal window.**

2.  **Navigate to the frontend directory:**
    ```bash
    cd gmail-manager-frontend
    ```

3.  **Install dependencies using pnpm:**
    ```bash
    pnpm install
    ```

4.  **Start the frontend development server:**
    ```bash
    pnpm dev
    ```
    The frontend will be running at `http://localhost:3123`.

### Step 4: Access the Application

-   Open your browser and go to **`http://localhost:3123`**.
-   The frontend interface will load and will start making requests to your backend server running on port 8123.