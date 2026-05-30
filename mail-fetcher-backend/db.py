"""
db.py — Neon (PostgreSQL) connection and all database queries.

Design: Open, use, close per call. Never hold a persistent connection open —
Neon serverless drops idle connections and will silently fail.
"""

import logging
import os
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

_DATABASE_URL: Optional[str] = None


def set_database_url(url: str) -> None:
    """Set the database URL (called once during startup from config)."""
    global _DATABASE_URL
    _DATABASE_URL = url


@contextmanager
def _get_conn():
    """
    Context manager: open a fresh connection, yield it, then close it.
    Retries up to 3 times with 2s delay on connection failure.
    """
    if not _DATABASE_URL:
        raise RuntimeError("Database URL not set. Call set_database_url() first.")

    last_exc = None
    for attempt in range(1, 4):
        try:
            conn = psycopg2.connect(_DATABASE_URL)
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
            return  # success — exit the retry loop
        except psycopg2.OperationalError as e:
            last_exc = e
            logger.warning(
                "DB connection attempt %d/3 failed: %s. Retrying in 2s…", attempt, e
            )
            time.sleep(2)

    raise RuntimeError(f"Could not connect to Neon after 3 attempts: {last_exc}")


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_CREATE_PROCESSED_EMAILS = """
CREATE TABLE IF NOT EXISTS processed_emails (
    id                      SERIAL PRIMARY KEY,
    email_uid               TEXT NOT NULL UNIQUE,
    subject                 TEXT,
    sender                  TEXT,
    received_at             TIMESTAMPTZ,
    is_important            BOOLEAN DEFAULT FALSE,
    ai_summary              TEXT,
    event_title             TEXT,
    event_date              TIMESTAMPTZ,
    calendar_event_id       TEXT,
    has_attachment          BOOLEAN DEFAULT FALSE,
    attachment_must_check   BOOLEAN DEFAULT FALSE,
    attachment_summary      TEXT,
    attachment_action       TEXT,
    student_entry_found     BOOLEAN DEFAULT FALSE,
    student_entry_detail    TEXT,
    processed_at            TIMESTAMPTZ DEFAULT NOW(),
    error_message           TEXT
);
"""

_ALTER_PROCESSED_EMAILS = [
    "ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS has_attachment        BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS attachment_must_check BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS attachment_summary    TEXT;",
    "ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS attachment_action     TEXT;",
    "ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS student_entry_found   BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS student_entry_detail  TEXT;",
]

_CREATE_AGENT_RUNS = """
CREATE TABLE IF NOT EXISTS agent_runs (
    id                  SERIAL PRIMARY KEY,
    run_at              TIMESTAMPTZ DEFAULT NOW(),
    emails_found        INT DEFAULT 0,
    emails_processed    INT DEFAULT 0,
    events_created      INT DEFAULT 0,
    errors              INT DEFAULT 0,
    model_used          TEXT
);
"""


def init_db() -> None:
    """Create tables if they do not already exist. Called once on startup."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(_CREATE_PROCESSED_EMAILS)
            cur.execute(_CREATE_AGENT_RUNS)
            # Idempotent migration: add new columns to existing tables
            for stmt in _ALTER_PROCESSED_EMAILS:
                try:
                    cur.execute(stmt)
                except Exception as exc:
                    logger.debug("Migration stmt skipped (likely already applied): %s", exc)
    logger.info("Database tables verified / created.")


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


def is_processed(email_uid: str) -> bool:
    """Return True if this IMAP UID has already been processed."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM processed_emails WHERE email_uid = %s LIMIT 1;",
                (email_uid,),
            )
            return cur.fetchone() is not None


def save_email(
    email_uid: str,
    subject: Optional[str],
    sender: Optional[str],
    received_at: Optional[datetime],
    is_important: bool,
    ai_summary: Optional[str],
    event_title: Optional[str],
    event_date: Optional[datetime],
    calendar_event_id: Optional[str],
    error_message: Optional[str],
    has_attachment: bool = False,
    attachment_must_check: bool = False,
    attachment_summary: Optional[str] = None,
    attachment_action: Optional[str] = None,
    student_entry_found: bool = False,
    student_entry_detail: Optional[str] = None,
) -> None:
    """
    Upsert an email record. If the UID already exists (e.g. we stored a partial
    record during an error), update it. This prevents double-processing on retry.
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO processed_emails
                    (email_uid, subject, sender, received_at, is_important,
                     ai_summary, event_title, event_date, calendar_event_id,
                     error_message, has_attachment, attachment_must_check,
                     attachment_summary, attachment_action,
                     student_entry_found, student_entry_detail)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (email_uid) DO UPDATE SET
                    subject               = EXCLUDED.subject,
                    sender                = EXCLUDED.sender,
                    received_at           = EXCLUDED.received_at,
                    is_important          = EXCLUDED.is_important,
                    ai_summary            = EXCLUDED.ai_summary,
                    event_title           = EXCLUDED.event_title,
                    event_date            = EXCLUDED.event_date,
                    calendar_event_id     = EXCLUDED.calendar_event_id,
                    has_attachment        = EXCLUDED.has_attachment,
                    attachment_must_check = EXCLUDED.attachment_must_check,
                    attachment_summary    = EXCLUDED.attachment_summary,
                    attachment_action     = EXCLUDED.attachment_action,
                    student_entry_found   = EXCLUDED.student_entry_found,
                    student_entry_detail  = EXCLUDED.student_entry_detail,
                    processed_at          = NOW(),
                    error_message         = EXCLUDED.error_message;
                """,
                (
                    email_uid, subject, sender, received_at, is_important,
                    ai_summary, event_title, event_date, calendar_event_id,
                    error_message, has_attachment, attachment_must_check,
                    attachment_summary, attachment_action,
                    student_entry_found, student_entry_detail,
                ),
            )
    logger.debug("Saved email UID=%s to DB.", email_uid)


def log_run(
    emails_found: int,
    emails_processed: int,
    events_created: int,
    errors: int,
    model_used: str,
) -> None:
    """Append a row to agent_runs for observability / debugging."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_runs
                    (emails_found, emails_processed, events_created, errors, model_used)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (emails_found, emails_processed, events_created, errors, model_used),
            )
    logger.debug(
        "Logged run: found=%d processed=%d events=%d errors=%d model=%s",
        emails_found,
        emails_processed,
        events_created,
        errors,
        model_used,
    )
