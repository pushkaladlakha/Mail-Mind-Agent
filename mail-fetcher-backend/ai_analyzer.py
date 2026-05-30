"""
ai_analyzer.py — Gemini AI analysis with model cascade, retry logic,
                  and attachment-aware prompt construction.

On a 429 (ResourceExhausted) the agent automatically falls back through
the model cascade. NotFound (404) models are also skipped gracefully.
"""

import json
import logging
import time
from typing import List, Optional, Tuple

from google import genai
from google.api_core.exceptions import NotFound, ResourceExhausted

from attachment_analyzer import (
    AttachmentInfo,
    attachment_summary_for_prompt,
    any_must_check,
    any_personal_found,
    personal_match_summary,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model cascade — ordered by preference / daily budget
# ---------------------------------------------------------------------------

MODEL_CASCADE = [
    "gemini-2.5-flash",   # standard production model
    "gemini-2.5-flash-lite", # fallback low-cost model
]

_RATE_LIMIT_BACKOFF_SECONDS = 5

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

# Base prompt (no attachments)
_BASE_PROMPT = """\
You are an advanced agentic email assistant for a university student. 
Student Name: {student_name}
Student Entry Number: {student_entry_no}

A custom Machine Learning classification model has pre-classified this email as: **{predicted_category}** (where "important" is non-spam/priority and "low_priority" is spam/noise).

Analyze this email step-by-step. First, write your detailed reasoning in the "reasoning" field, then fill out the rest of the valid JSON object.
No markdown fences, no explanation outside the JSON — raw JSON only.

JSON schema:
{{
  "reasoning"             : "<Step-by-step analysis of the email content, urgency, and any attachments>",
  "is_important"          : <true|false>,
  "priority"              : "<high|medium|low>",
  "is_reschedule"         : <true|false>,
  "event_title"           : "<concise event title or null>",
  "event_date"            : "<ISO 8601 YYYY-MM-DDTHH:MM:SS or null>",
  "original_event_date"   : "<If this is a reschedule, the previous ISO 8601 date, else null>",
  "event_location"        : "<location string or null>",
  "action_required"       : "<what needs to be done, or null>",
  "summary"               : "<summary of the email>",
  "has_attachment"        : <true|false>,
  "attachment_must_check" : <true|false>,
  "attachment_summary"    : "<one sentence about what attachments contain, or null>",
  "attachment_action"     : "<what student should do with the attachment, or null>",
  "student_entry_found"   : <true|false>,
  "student_entry_detail"  : "<exact data from the attachment relevant to the student, or null>"
}}

Rules for is_important and summarization:
1. If predicted_category is "low_priority" (noise/spam):
   - Set "is_important" to false.
   - Strictly filter the email content and write a highly condensed summary restricted to exactly 1 or 2 lines.
   - For "event_title", return a very brief, compact title. Keep "event_date" as null (do not sync spam/noise events to the student's calendar).
   
2. If predicted_category is "important" (non-spam/priority):
   - Set "is_important" to true.
   - Provide a rich, moderate-length summary explaining course track announcements, syllabus, guidelines, or details.
   - If there is an associated academic deadline, display of papers, midsem, endsem, or exam date, extract it as an event:
     - Set "event_title" to a concise event name (e.g. "CS301 Midsem Exam").
     - Set "event_date" to the exact ISO 8601 YYYY-MM-DDTHH:MM:SS format (or null if no date).
     - Set "event_location" to the venue (e.g. "LH-3" or null).

Rules for attachment_must_check = true:
- Attachment is a marks sheet, result, grade card, or scorecard
- Attachment is a seating / examination hall arrangement
- Attachment is a timetable or date sheet
- Attachment is an admit card or hall ticket
- Attachment is a fee challan or dues notice
- Attachment is an attendance report with shortage warning

Rules for student_entry_found = true:
- The attachment data above contains a row/entry marked [MATCH] for the student
- Set student_entry_detail to the exact values from that matched row
  (e.g. "Marks: 45/60, Grade: B+" or "Seat: Block A, Row 3, Seat 12")

Subject : {subject}
From    : {sender}
Date    : {date}
Body    :
{body}
"""

# Additional section appended when attachments are present
_ATTACHMENT_SECTION = """
--- ATTACHMENTS ({count}) ---
{attachment_blocks}
--- END ATTACHMENTS ---

Given the attachments above, fill attachment_* fields carefully.
If any attachment is marked MustCheck=YES, set attachment_must_check=true.
"""

# ---------------------------------------------------------------------------
# Safe defaults
# ---------------------------------------------------------------------------

_SAFE_DEFAULT = {
    "reasoning": "Parse error — fallback used.",
    "is_important": False,
    "priority": "low",
    "is_reschedule": False,
    "event_title": None,
    "event_date": None,
    "original_event_date": None,
    "event_location": None,
    "action_required": None,
    "summary": "Parse error — could not analyze email.",
    "has_attachment": False,
    "attachment_must_check": False,
    "attachment_summary": None,
    "attachment_action": None,
    "student_entry_found": False,
    "student_entry_detail": None,
}

_REQUIRED_KEYS = {"is_important", "summary"}

# ---------------------------------------------------------------------------
# Gemini client (cached per api_key)
# ---------------------------------------------------------------------------

_clients: dict = {}


def _get_client(api_key: str) -> genai.Client:
    if api_key not in _clients:
        _clients[api_key] = genai.Client(api_key=api_key)
    return _clients[api_key]


# ---------------------------------------------------------------------------
# Gemini call with model cascade
# ---------------------------------------------------------------------------


def call_gemini_with_cascade(prompt: str, api_key: str) -> Tuple[str, str]:
    """
    Try each model in MODEL_CASCADE in order.

    Skips a model on 429 (ResourceExhausted) or 404 (NotFound).
    Any other exception is propagated immediately.

    Returns:
        (response_text, model_name_used)

    Raises:
        RuntimeError if all models are exhausted.
    """
    client = _get_client(api_key)
    last_exc: Optional[Exception] = None

    for model_name in MODEL_CASCADE:
        try:
            logger.debug("Trying Gemini model: %s", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            logger.info("Gemini responded using model: %s", model_name)
            
            # Safely extract text to avoid warnings
            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                texts = []
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "text") and part.text:
                        texts.append(part.text)
                return "".join(texts), model_name
            else:
                return response.text, model_name

        except ResourceExhausted as exc:
            logger.warning(
                "Model %s rate-limited (429). Waiting %ds before next model…",
                model_name, _RATE_LIMIT_BACKOFF_SECONDS,
            )
            last_exc = exc
            time.sleep(_RATE_LIMIT_BACKOFF_SECONDS)

        except NotFound as exc:
            logger.warning("Model %s not found (404), skipping. Detail: %s", model_name, exc)
            last_exc = exc

        except Exception as exc:
            logger.error("Unexpected error from model %s: %s", model_name, exc, exc_info=True)
            raise

    raise RuntimeError(
        f"All Gemini models in cascade are unavailable. Last error: {last_exc}"
    )


# ---------------------------------------------------------------------------
# JSON parsing
# ---------------------------------------------------------------------------


def _parse_gemini_json(raw: str) -> dict:
    """
    Strip markdown fences and parse JSON from Gemini response.
    Raises ValueError on failure so caller can attempt self-correction.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        result = json.loads(cleaned)
        if not isinstance(result, dict):
            raise ValueError("Expected JSON object, got: " + type(result).__name__)
        if not _REQUIRED_KEYS.issubset(result.keys()):
            missing = _REQUIRED_KEYS - result.keys()
            raise ValueError(f"JSON missing required keys: {missing}")
        return result
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error(
            "Failed to parse Gemini JSON: %s\nRaw (first 500 chars):\n%s",
            exc, raw[:500],
        )
        raise ValueError(f"JSON parse error: {exc}")


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------


def _build_prompt(
    subject: str,
    sender: str,
    date: str,
    body: str,
    predicted_category: str,
    attachment_infos: List[AttachmentInfo],
    student_name: str,
    student_entry_no: str,
) -> str:
    """Construct the full prompt, injecting attachment blocks if present."""
    base = _BASE_PROMPT.format(
        student_name=student_name or "Unknown Student",
        student_entry_no=student_entry_no or "Unknown Entry No",
        predicted_category=predicted_category,
        subject=subject,
        sender=sender,
        date=date,
        body=body,
    )
    if not attachment_infos:
        return base

    att_block = attachment_summary_for_prompt(attachment_infos)
    att_section = _ATTACHMENT_SECTION.format(
        count=len(attachment_infos),
        attachment_blocks=att_block,
    )
    return base + att_section


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def analyze_email(
    email_data: dict,
    api_key: str,
    category: str,
    attachment_infos: Optional[List[AttachmentInfo]] = None,
    student_name: str = "",
    student_entry_no: str = "",
) -> Tuple[dict, str]:
    """
    Analyze a single email dict and return (analysis_dict, model_used).
    Includes agentic self-correction if the JSON output is invalid.
    """
    subject = email_data.get("subject", "(no subject)")
    sender  = email_data.get("sender",  "(unknown sender)")
    date    = str(email_data.get("date", "(unknown date)"))
    body    = email_data.get("body", "")
    infos   = attachment_infos or []

    prompt = _build_prompt(
        subject=subject,
        sender=sender,
        date=date,
        body=body,
        predicted_category=category,
        attachment_infos=infos,
        student_name=student_name,
        student_entry_no=student_entry_no,
    )

    raw_response, model_used = call_gemini_with_cascade(prompt, api_key)
    
    try:
        analysis = _parse_gemini_json(raw_response)
    except ValueError as e:
        logger.warning("Agentic Self-Correction triggered: JSON parse failed. Asking LLM to fix it...")
        correction_prompt = (
            f"Your previous response was invalid JSON. Error: {e}\n\n"
            f"Raw Response:\n{raw_response}\n\n"
            f"Please fix the errors and return ONLY a valid JSON object matching the requested schema."
        )
        try:
            raw_response_fixed, _ = call_gemini_with_cascade(correction_prompt, api_key)
            analysis = _parse_gemini_json(raw_response_fixed)
            logger.info("Agentic Self-Correction successful.")
        except Exception as retry_exc:
            logger.error("Agentic Self-Correction failed: %s", retry_exc)
            analysis = dict(_SAFE_DEFAULT)

    # -----------------------------------------------------------------------
    # Post-process: rule-based overrides are authoritative over AI output.
    # -----------------------------------------------------------------------
    if infos:
        analysis["has_attachment"] = True
        # Rule-based must_check overrides AI (AI may under-report)
        if any_must_check(infos):
            analysis["attachment_must_check"] = True
        # Personal entry: if rule-based found the student, override AI
        if any_personal_found(infos):
            analysis["student_entry_found"] = True
            # Provide the exact matched data to the DB/caller
            detail = personal_match_summary(infos)
            # Prefer AI's phrasing if it already extracted it; fall back to raw
            if not analysis.get("student_entry_detail"):
                analysis["student_entry_detail"] = detail[:1000] if detail else None

    logger.info(
        "Analysis done | UID=%s | important=%s | has_att=%s | must_check=%s "
        "| student_found=%s | model=%s",
        email_data.get("uid"),
        analysis.get("is_important"),
        analysis.get("has_attachment"),
        analysis.get("attachment_must_check"),
        analysis.get("student_entry_found"),
        model_used,
    )
    return analysis, model_used
