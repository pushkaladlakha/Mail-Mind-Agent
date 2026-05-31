"""
config.py — Load and validate all environment variables.
Crashes immediately on startup if any required var is missing.
"""

import os
from dotenv import load_dotenv

load_dotenv()

REQUIRED_VARS = [
    "IMAP_HOST",
    "IMAP_PORT",
    "IMAP_USER",
    "IMAP_PASSWORD",
    "GEMINI_API_KEY",
    "NEON_DATABASE_URL",
    "GOOGLE_CALENDAR_ID",
    "GOOGLE_CREDENTIALS_JSON",
]

# Optional vars with defaults
OPTIONAL_VARS = {
    "IMAP_MAILBOX": "INBOX",
    "POLL_INTERVAL_MINUTES": "10",
    "EMAIL_BODY_MAX_CHARS": "3000",
    "GOOGLE_TOKEN_JSON": "token.json",
    "STUDENT_ENTRY_NO": "",   # e.g. 2024tt10708
    "STUDENT_NAME": "",       # e.g. Abhas Kumar Sinha
}


def load_config() -> dict:
    """
    Load all config from environment. Raises EnvironmentError if any
    required variable is missing. Returns a flat dict of all config values.
    """
    missing = [v for v in REQUIRED_VARS if not os.getenv(v)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {missing}\n"
            "Please populate your .env file before starting the agent."
        )

    config = {k: os.getenv(k) for k in REQUIRED_VARS}

    # Merge in optional vars (use env value if set, else default)
    for key, default in OPTIONAL_VARS.items():
        config[key] = os.getenv(key, default)

    # Type coercions
    config["IMAP_PORT"] = int(config["IMAP_PORT"])
    config["POLL_INTERVAL_MINUTES"] = int(config["POLL_INTERVAL_MINUTES"])
    config["EMAIL_BODY_MAX_CHARS"] = int(config["EMAIL_BODY_MAX_CHARS"])

    return config
