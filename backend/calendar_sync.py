"""
calendar_sync.py — Google Calendar OAuth2 auth and event creation.

Run with --auth flag once on the server to generate token.json:
    python3 calendar_sync.py --auth
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.exceptions import RefreshError

class CalendarAuthError(Exception):
    """Raised when Google Calendar authentication fails or token is revoked."""
    pass

logger = logging.getLogger(__name__)

# Scopes required for reading/writing calendar events
SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

# IST timezone offset
_IST_OFFSET = timedelta(hours=5, minutes=30)
_IST = timezone(_IST_OFFSET)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def get_calendar_service(
    credentials_json: str,
    token_json: str,
):
    """
    Build and return an authenticated Google Calendar API service.

    Flow:
    1. Check if token content environment variable is present, or check if token.json file exists.
    2. If credentials are valid -> use them.
    3. If token is expired but has a refresh token -> refresh automatically.
    4. If no valid token -> run InstalledAppFlow using credentials.json content or file.
    5. Save refreshed/new token back to token_json path.
    """
    creds: Optional[Credentials] = None
    import json

    token_content = os.getenv("GOOGLE_TOKEN_JSON_CONTENT")
    if token_content:
        try:
            info = json.loads(token_content)
            creds = Credentials.from_authorized_user_info(info, SCOPES)
            logger.info("Loaded Google OAuth token from environment variable.")
        except Exception as e:
            logger.error("Failed to parse token content environment variable: %s", e)

    if not creds and os.path.exists(token_json):
        creds = Credentials.from_authorized_user_file(token_json, SCOPES)
        logger.debug("Loaded existing token from %s", token_json)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Access token expired — refreshing…")
            try:
                creds.refresh(Request())
            except RefreshError as e:
                logger.error("Refresh token is invalid or revoked. Deleting token.json.")
                if os.path.exists(token_json):
                    try:
                        os.remove(token_json)
                    except OSError:
                        pass
                raise CalendarAuthError(
                    "Calendar authentication required. Please run 'python calendar_sync.py --auth' to generate a new token."
                ) from e
        else:
            logger.info(
                "No valid token found. Starting OAuth2 InstalledAppFlow…"
            )
            creds_content = os.getenv("GOOGLE_CREDENTIALS_JSON_CONTENT")
            if creds_content:
                try:
                    info = json.loads(creds_content)
                    flow = InstalledAppFlow.from_client_config(info, SCOPES)
                except Exception as e:
                    logger.error("Failed to parse credentials content environment variable: %s", e)
                    raise CalendarAuthError("Google credentials configuration missing or invalid.")
            else:
                if not os.path.exists(credentials_json):
                    raise CalendarAuthError(f"Missing Google credentials: {credentials_json} file or GOOGLE_CREDENTIALS_JSON_CONTENT environment variable not found.")
                flow = InstalledAppFlow.from_client_secrets_file(
                    credentials_json, SCOPES
                )
            
            # Note: run_local_server will fail in headless hosted environments
            try:
                creds = flow.run_local_server(port=0)
            except Exception as e:
                raise CalendarAuthError(
                    f"Headless server authentication failed. First perform local authentication with 'python calendar_sync.py --auth' and copy the token.json contents to the GOOGLE_TOKEN_JSON_CONTENT environment variable on Render. Detail: {e}"
                )

        # Persist the (refreshed) token for next run
        try:
            # Update local file if writable
            with open(token_json, "w") as f:
                f.write(creds.to_json())
            logger.info("Token saved to %s", token_json)
        except OSError:
            pass

    service = build("calendar", "v3", credentials=creds)
    logger.debug("Google Calendar service ready.")
    return service


# ---------------------------------------------------------------------------
# Guard condition
# ---------------------------------------------------------------------------


def should_create_event(analysis: dict) -> bool:
    """
    Return True only when all three conditions are met:
    - is_important is True
    - event_date is not None
    - event_date is in the future
    """
    if not analysis.get("is_important"):
        return False
    event_date_str = analysis.get("event_date")
    if not event_date_str:
        return False
    try:
        event_dt = datetime.fromisoformat(event_date_str)
        # Make timezone-aware if naive (assume IST)
        if event_dt.tzinfo is None:
            event_dt = event_dt.replace(tzinfo=_IST)
        now = datetime.now(tz=timezone.utc)
        if event_dt <= now:
            logger.info(
                "Event date %s is in the past — skipping calendar creation.",
                event_date_str,
            )
            return False
        return True
    except (ValueError, TypeError) as exc:
        logger.warning("Could not parse event_date '%s': %s", event_date_str, exc)
        return False


# ---------------------------------------------------------------------------
# Event creation
# ---------------------------------------------------------------------------


def create_or_update_calendar_event(
    analysis: dict,
    calendar_id: str,
    credentials_json: str,
    token_json: str,
) -> str:
    """
    Create or Update a Google Calendar event from the AI analysis dict.
    If 'is_reschedule' is true, attempts to find the existing event and update it.

    Returns the created/updated event ID string.
    Raises HttpError on Calendar API failure.
    """
    event_date_str = analysis["event_date"]
    event_dt = datetime.fromisoformat(event_date_str)
    if event_dt.tzinfo is None:
        event_dt = event_dt.replace(tzinfo=_IST)

    end_dt = event_dt + timedelta(hours=1)

    # Format as RFC3339 strings expected by the Calendar API
    def to_rfc3339(dt: datetime) -> str:
        return dt.isoformat()

    event_body = {
        "summary": analysis.get("event_title") or "Email Event",
        "description": analysis.get("summary") or "",
        "start": {
            "dateTime": to_rfc3339(event_dt),
            "timeZone": "Asia/Kolkata",
        },
        "end": {
            "dateTime": to_rfc3339(end_dt),
            "timeZone": "Asia/Kolkata",
        },
        "location": analysis.get("event_location") or "",
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 60},    # 1 hour before
                {"method": "popup", "minutes": 1440},  # 24 hours before
            ],
        },
    }

    service = get_calendar_service(credentials_json, token_json)

    is_reschedule = analysis.get("is_reschedule", False)
    existing_event_id = None

    if is_reschedule:
        try:
            # Search for an event with matching title in the future or around original date
            now_str = datetime.now(timezone.utc).isoformat()
            search_query = analysis.get("event_title", "").split()[0] if analysis.get("event_title") else "Event"
            
            events_result = (
                service.events()
                .list(
                    calendarId=calendar_id,
                    timeMin=now_str,
                    q=search_query,
                    maxResults=5,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
            events = events_result.get("items", [])
            if events:
                existing_event_id = events[0]["id"]
                logger.info("Found existing event '%s' (ID=%s) to update.", events[0].get("summary"), existing_event_id)
        except HttpError as exc:
            logger.warning("Search for existing event failed: %s", exc)

    try:
        if existing_event_id:
            updated_event = (
                service.events()
                .update(calendarId=calendar_id, eventId=existing_event_id, body=event_body)
                .execute()
            )
            event_id = updated_event.get("id", "")
            logger.info(
                "Updated Calendar event: '%s' to %s (ID=%s)",
                event_body["summary"],
                event_date_str,
                event_id,
            )
            return event_id
        else:
            created_event = (
                service.events()
                .insert(calendarId=calendar_id, body=event_body)
                .execute()
            )
            event_id = created_event.get("id", "")
            logger.info(
                "Created Calendar event: '%s' on %s (ID=%s)",
                event_body["summary"],
                event_date_str,
                event_id,
            )
            return event_id

    except HttpError as exc:
        logger.error("Google Calendar API error: %s", exc, exc_info=True)
        raise


# ---------------------------------------------------------------------------
# One-time auth entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv

    load_dotenv()

    if "--auth" in sys.argv:
        credentials_path = os.getenv("GOOGLE_CREDENTIALS_JSON", "credentials.json")
        token_path = os.getenv("GOOGLE_TOKEN_JSON", "token.json")

        logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
        print(f"Using credentials: {credentials_path}")
        print(f"Will save token to: {token_path}")

        svc = get_calendar_service(credentials_path, token_path)
        print("Auth successful. token.json has been created/refreshed.")
        print("You can now start the daemon: python3 main.py")
    else:
        print("Usage: python3 calendar_sync.py --auth")
