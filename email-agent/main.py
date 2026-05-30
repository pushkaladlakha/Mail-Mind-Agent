"""
main.py — Entry point for the Email AI Agent daemon.

Startup sequence:
  1. Load and validate config
  2. init_db()
  3. Schedule run_agent() every POLL_INTERVAL_MINUTES minutes
  4. Run once immediately, then sit in the schedule loop
"""

import logging
import sys

import schedule
import time

# ---------------------------------------------------------------------------
# Logging — must be configured before any other imports use the logger
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Local imports (after logging is configured)
# ---------------------------------------------------------------------------

from config import load_config
from db import init_db, is_processed, log_run, save_email, set_database_url
from email_reader import fetch_new_emails
from ai_analyzer import analyze_email
from calendar_sync import create_or_update_calendar_event, should_create_event, CalendarAuthError
from attachment_analyzer import analyze_attachments

# ---------------------------------------------------------------------------
# Global config (populated in main())
# ---------------------------------------------------------------------------

_cfg: dict = {}


# ---------------------------------------------------------------------------
# Agent run logic
# ---------------------------------------------------------------------------


def run_agent() -> None:
    """
    One polling cycle:
    - Fetch unseen emails
    - Skip already-processed ones
    - Analyze each with Gemini
    - Optionally create Calendar event
    - Save to DB
    - Log the run summary
    """
    logger.info("=" * 60)
    logger.info("Polling cycle started.")

    emails_found = 0
    emails_processed = 0
    events_created = 0
    errors = 0
    model_used = "none"

    try:
        emails = fetch_new_emails(
            host=_cfg["IMAP_HOST"],
            port=_cfg["IMAP_PORT"],
            user=_cfg["IMAP_USER"],
            password=_cfg["IMAP_PASSWORD"],
            mailbox=_cfg["IMAP_MAILBOX"],
            max_chars=_cfg["EMAIL_BODY_MAX_CHARS"],
        )
        emails_found = len(emails)
        logger.info("Emails found this cycle: %d", emails_found)

        for email_data in emails:
            uid = email_data["uid"]

            # Deduplication check against DB
            if is_processed(uid):
                logger.info("Email UID=%s already processed — skipping.", uid)
                continue

            try:
                # ── Attachment processing (rule-based, before AI) ──────────
                raw_attachments = email_data.get("attachments", [])
                attachment_infos = []
                if raw_attachments:
                    try:
                        attachment_infos = analyze_attachments(
                            raw_attachments,
                            student_entry_no=_cfg.get("STUDENT_ENTRY_NO", ""),
                            student_name=_cfg.get("STUDENT_NAME", ""),
                        )
                        found_personal = any(a.personal_match.found for a in attachment_infos)
                        logger.info(
                            "Attachments for UID=%s: %d file(s) | must_check=%s | student_found=%s",
                            uid,
                            len(attachment_infos),
                            any(a.must_check for a in attachment_infos),
                            found_personal,
                        )
                    except Exception as att_exc:
                        logger.error(
                            "Attachment analysis failed for UID=%s: %s",
                            uid, att_exc, exc_info=True,
                        )

                analysis, model_used = analyze_email(
                    email_data,
                    api_key=_cfg["GEMINI_API_KEY"],
                    attachment_infos=attachment_infos,
                    student_name=_cfg.get("STUDENT_NAME", ""),
                    student_entry_no=_cfg.get("STUDENT_ENTRY_NO", ""),
                )
                calendar_event_id = None

                if should_create_event(analysis):
                    try:
                        calendar_event_id = create_or_update_calendar_event(
                            analysis=analysis,
                            calendar_id=_cfg["GOOGLE_CALENDAR_ID"],
                            credentials_json=_cfg["GOOGLE_CREDENTIALS_JSON"],
                            token_json=_cfg["GOOGLE_TOKEN_JSON"],
                        )
                        events_created += 1
                    except Exception as cal_exc:
                        # Calendar failure should NOT prevent saving the email
                        if isinstance(cal_exc, CalendarAuthError):
                            logger.error("Calendar event creation failed for UID=%s: %s", uid, cal_exc)
                        else:
                            logger.error(
                                "Calendar event creation failed for UID=%s: %s",
                                uid,
                                cal_exc,
                                exc_info=True,
                            )
                        errors += 1

                # Parse event_date back to datetime if present
                event_date_dt = None
                if analysis.get("event_date"):
                    try:
                        from datetime import datetime
                        event_date_dt = datetime.fromisoformat(analysis["event_date"])
                    except (ValueError, TypeError):
                        pass

                save_email(
                    email_uid=uid,
                    subject=email_data.get("subject"),
                    sender=email_data.get("sender"),
                    received_at=email_data.get("date"),
                    is_important=analysis.get("is_important", False),
                    ai_summary=analysis.get("summary"),
                    event_title=analysis.get("event_title"),
                    event_date=event_date_dt,
                    calendar_event_id=calendar_event_id,
                    error_message=None,
                    has_attachment=analysis.get("has_attachment", False),
                    attachment_must_check=analysis.get("attachment_must_check", False),
                    attachment_summary=analysis.get("attachment_summary"),
                    attachment_action=analysis.get("attachment_action"),
                    student_entry_found=analysis.get("student_entry_found", False),
                    student_entry_detail=analysis.get("student_entry_detail"),
                )
                emails_processed += 1
                logger.info(
                    "Processed UID=%s | important=%s | event=%s | student_found=%s",
                    uid,
                    analysis.get("is_important"),
                    calendar_event_id is not None,
                    analysis.get("student_entry_found", False),
                )

            except Exception as email_exc:
                errors += 1
                logger.error(
                    "Failed to process email UID=%s: %s",
                    uid,
                    email_exc,
                    exc_info=True,
                )
                # Save a partial record with the error message so we don't retry
                # endlessly and can debug from the DB
                try:
                    save_email(
                        email_uid=uid,
                        subject=email_data.get("subject"),
                        sender=email_data.get("sender"),
                        received_at=email_data.get("date"),
                        is_important=False,
                        ai_summary=None,
                        event_title=None,
                        event_date=None,
                        calendar_event_id=None,
                        error_message=str(email_exc),
                    )
                except Exception as db_exc:
                    logger.error(
                        "Could not save error record for UID=%s: %s", uid, db_exc
                    )

    except Exception as cycle_exc:
        errors += 1
        logger.error("Polling cycle failed: %s", cycle_exc, exc_info=True)

    finally:
        try:
            log_run(
                emails_found=emails_found,
                emails_processed=emails_processed,
                events_created=events_created,
                errors=errors,
                model_used=model_used,
            )
        except Exception as log_exc:
            logger.error("Failed to log run to DB: %s", log_exc)

        logger.info(
            "Cycle done | found=%d processed=%d events=%d errors=%d model=%s",
            emails_found,
            emails_processed,
            events_created,
            errors,
            model_used,
        )
        logger.info("=" * 60)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    logger.info("Email AI Agent starting up…")

    # 1. Load and validate config (crash-fast if vars missing)
    global _cfg
    _cfg = load_config()
    logger.info("Config loaded. Poll interval: %d min.", _cfg["POLL_INTERVAL_MINUTES"])

    # 2. Set DB URL and create tables
    set_database_url(_cfg["NEON_DATABASE_URL"])
    init_db()

    # 3. Run once immediately on startup
    run_agent()

    # 4. Schedule recurring runs
    schedule.every(_cfg["POLL_INTERVAL_MINUTES"]).minutes.do(run_agent)
    logger.info(
        "Scheduler active. Next run in %d minutes.", _cfg["POLL_INTERVAL_MINUTES"]
    )

    while True:
        schedule.run_pending()
        time.sleep(30)  # Check every 30 seconds — fine-grained enough, low CPU


if __name__ == "__main__":
    main()
