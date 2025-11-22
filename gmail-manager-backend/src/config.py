import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Defines the permissions the application will request from the user.
# 'gmail.modify' is a broad scope that allows reading and modifying emails.
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

# File paths for Google API credentials.
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'

# Frontend URL for CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3123")