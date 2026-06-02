"""
email_reader.py — IMAP connection and email fetching.

Connects via IMAP4_SSL, searches for UNSEEN emails, parses each one,
and returns a list of dicts. Single-email parse failures are isolated
so one bad email never crashes the whole polling cycle.

Each email dict now includes an "attachments" key — a list of raw
attachment dicts (filename, content_type, data) for further processing.
"""

import email
import email.message
import imaplib
import logging
import re
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parsedate_to_datetime
from typing import List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Header decoding helper
# ---------------------------------------------------------------------------


def _decode_header_value(raw: Optional[str]) -> str:
    """Safely decode a possibly-encoded email header (MIME encoded-words)."""
    if raw is None:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw or ""


# ---------------------------------------------------------------------------
# Body extraction
# ---------------------------------------------------------------------------


def _decode_payload(part) -> str:
    """Decode the payload bytes of a single MIME part with encoding fallback."""
    payload = part.get_payload(decode=True)
    if not payload:
        return ""
    charset = part.get_content_charset() or "utf-8"
    for enc in (charset, "utf-8", "latin-1", "ascii"):
        try:
            return payload.decode(enc, errors="replace")
        except (LookupError, UnicodeDecodeError):
            continue
    return payload.decode("latin-1", errors="replace")


def extract_body(msg: Message, max_chars: int = 3000) -> str:
    """
    Extract plain-text body from a (possibly multipart) email message.

    Strategy:
    1. If multipart, walk parts and collect text/plain payloads.
    2. If not multipart, decode the single payload.
    3. Strip excessive whitespace.
    4. Truncate to max_chars.
    """
    text_parts: List[str] = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            # Skip attachments
            if "attachment" in content_disposition:
                continue
            if content_type == "text/plain":
                text_parts.append(_decode_payload(part))
    else:
        text_parts.append(_decode_payload(msg))

    body = "\n".join(text_parts)

    # Collapse runs of blank lines / leading spaces
    body = re.sub(r"\n{3,}", "\n\n", body)
    body = body.strip()

    if len(body) > max_chars:
        body = body[:max_chars] + f"\n\n[... truncated at {max_chars} chars]"

    return body


# ---------------------------------------------------------------------------
# Attachment extraction
# ---------------------------------------------------------------------------

# Maximum single attachment size we'll read into memory (10 MB)
_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

# MIME types we consider worth reading / storing
_INTERESTING_TYPES = {
    # Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "application/vnd.ms-excel",                                           # .xls
    "text/csv",
    "text/plain",
    # Images (we store metadata but not data for bandwidth)
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    # Word documents
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    # Fallback octet-stream caught by extension below
    "application/octet-stream",
}

_INTERESTING_EXTS = {
    ".pdf", ".xlsx", ".xlsm", ".xls", ".csv", ".txt",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".doc", ".docx",
}


def extract_attachments(msg: Message) -> List[dict]:
    """
    Walk the MIME tree and return a list of attachment dicts:
        {
            "filename"    : str,
            "content_type": str,
            "data"        : bytes,   # raw bytes (empty bytes for oversized/skipped)
            "size_bytes"  : int,     # actual size before any truncation
            "skipped"     : bool,    # True if we chose not to load the data
        }

    Only attachments with interesting MIME types or file extensions are
    returned. Inline images (Content-Disposition: inline) are also captured.
    """
    attachments: List[dict] = []
    seen_filenames: set = set()

    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition", "")).lower()
        content_type = part.get_content_type() or "application/octet-stream"

        # Determine filename
        filename = part.get_filename()
        if filename:
            filename = _decode_header_value(filename)
        else:
            # Guess from Content-Type param
            filename = part.get_param("name") or ""
            if filename:
                filename = _decode_header_value(filename)

        is_attachment = "attachment" in content_disposition
        is_inline_with_name = bool(filename) and "inline" in content_disposition

        if not (is_attachment or is_inline_with_name):
            continue

        if not filename:
            continue

        # De-duplicate identical filenames
        if filename in seen_filenames:
            continue
        seen_filenames.add(filename)

        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        # Filter to interesting types / extensions
        if content_type not in _INTERESTING_TYPES and ext not in _INTERESTING_EXTS:
            logger.debug("Skipping uninteresting attachment: %s (%s)", filename, content_type)
            continue

        raw_data = part.get_payload(decode=True) or b""
        size_bytes = len(raw_data)

        skipped = False
        if size_bytes > _MAX_ATTACHMENT_BYTES:
            logger.warning(
                "Attachment %s is %d bytes — too large to load into memory, skipping data.",
                filename, size_bytes,
            )
            raw_data = b""
            skipped = True

        attachments.append({
            "filename": filename,
            "content_type": content_type,
            "data": raw_data,
            "size_bytes": size_bytes,
            "skipped": skipped,
        })
        logger.debug(
            "Found attachment: %s | type=%s | size=%d bytes | skipped=%s",
            filename, content_type, size_bytes, skipped,
        )

    return attachments


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse an RFC 2822 date header into an aware datetime (UTC)."""
    if not date_str:
        return None
    try:
        dt = parsedate_to_datetime(date_str)
        # Ensure timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def fetch_new_emails(
    host: str,
    port: int,
    user: str,
    password: str,
    mailbox: str = "INBOX",
    max_chars: int = 3000,
) -> List[dict]:
    """
    Connect to the IMAP server, search for UNSEEN messages, parse each,
    and return a list of email dicts.

    Raises on connection/login failure so the caller can log and skip the cycle.
    Per-email parse errors are caught and logged individually.

    Returns:
        List of dicts with keys:
            uid, subject, sender, date, body,
            attachments (list of raw attachment dicts)
    """
    logger.info("Connecting to IMAP server %s:%d …", host, port)

    # Connection errors bubble up to the caller
    import ssl
    try:
        context = ssl._create_unverified_context()
    except AttributeError:
        context = None
    conn = imaplib.IMAP4_SSL(host, port, ssl_context=context)
    conn.login(user, password)
    conn.select(mailbox, readonly=False)

    logger.info("Logged in. Searching for UNSEEN emails in %s …", mailbox)

    status, uid_data = conn.uid("SEARCH", None, "UNSEEN")
    if status != "OK":
        conn.logout()
        raise RuntimeError(f"IMAP SEARCH failed with status: {status}")

    uid_list = uid_data[0].split() if uid_data and uid_data[0] else []
    logger.info("Found %d unseen email(s).", len(uid_list))

    results: List[dict] = []

    for raw_uid in uid_list:
        uid_str = raw_uid.decode() if isinstance(raw_uid, bytes) else str(raw_uid)
        try:
            status, msg_data = conn.uid("FETCH", raw_uid, "(RFC822)")
            if status != "OK" or not msg_data or msg_data[0] is None:
                logger.warning("Failed to fetch email UID=%s, skipping.", uid_str)
                continue

            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = _decode_header_value(msg.get("Subject"))
            sender = _decode_header_value(msg.get("From"))
            date_str = msg.get("Date")
            parsed_date = _parse_date(date_str)
            body = extract_body(msg, max_chars=max_chars)
            attachments = extract_attachments(msg)

            results.append(
                {
                    "uid": uid_str,
                    "subject": subject,
                    "sender": sender,
                    "date": parsed_date,
                    "body": body,
                    "attachments": attachments,
                }
            )
            logger.debug(
                "Parsed email UID=%s | Subject=%s | From=%s | Attachments=%d",
                uid_str,
                subject,
                sender,
                len(attachments),
            )

        except Exception as exc:
            logger.error(
                "Error parsing email UID=%s: %s — skipping this email.",
                uid_str,
                exc,
                exc_info=True,
            )
            continue

    conn.logout()
    return results
