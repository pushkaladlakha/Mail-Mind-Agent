"""
attachment_analyzer.py — Rule-based attachment classifier, text extractor,
                          and personal-entry finder.

For each attachment the email_reader passes in, this module:
  1. Detects attachment category (marks, seating, timetable, notice, result, etc.)
  2. Extracts readable text from PDF, Excel (.xlsx/.xls), and CSV files
  3. Searches the extracted content for the student's entry number or name
     and returns the exact matched row(s) with surrounding context
  4. Produces a structured AttachmentInfo dataclass per file
  5. Provides helper functions for ai_analyzer to consume
"""

from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Category detection — keyword sets (all lowercase)
# ---------------------------------------------------------------------------

_CATEGORY_RULES: dict[str, list[str]] = {
    "marks_sheet": [
        "marks", "mark sheet", "marksheet", "grades", "grade sheet",
        "result", "scorecard", "score card", "cgpa", "sgpa", "gpa",
        "midsem", "endsem", "mid semester", "end semester", "quiz",
        "internal assessment", "ia marks", "assignment marks",
        "minor", "major exam", "out of", "obtained",
    ],
    "seating_arrangement": [
        "seating", "seat", "seating plan", "seating arrangement",
        "roll no", "roll number", "examination hall", "exam hall",
        "bench", "room allot", "room allocation", "seat allot",
        "centre", "center", "venue", "invigilator", "hall no",
        "room no", "block", "seat no",
    ],
    "timetable": [
        "timetable", "time table", "schedule", "class schedule",
        "lecture schedule", "exam schedule", "examination schedule",
        "date sheet", "datesheet", "slot", "timing", "period",
    ],
    "fee_challan": [
        "fee", "challan", "payment", "dues", "tuition",
        "hostel fee", "mess", "fine", "penalty", "outstanding",
    ],
    "notice_circular": [
        "notice", "circular", "announcement", "notification",
        "advisory", "memo", "memorandum", "important notice",
        "office order",
    ],
    "admit_card": [
        "admit card", "hall ticket", "roll slip", "permission slip",
        "admit slip", "examination permission",
    ],
    "attendance": [
        "attendance", "absent", "shortage", "short attendance",
        "leave", "present", "proxy", "lectures attended",
        "percentage", "attendance percentage",
    ],
    "certificate": [
        "certificate", "bonafide", "noc", "no objection",
        "character certificate", "tc", "transfer certificate",
    ],
    "other": [],
}

# Categories that a student MUST open and review personally
_MUST_CHECK: set[str] = {
    "marks_sheet",
    "seating_arrangement",
    "timetable",
    "fee_challan",
    "admit_card",
    "attendance",
}


def _detect_category(filename: str, extracted_text: str) -> str:
    """
    Return the best-matching category string for the attachment.
    Scores against filename first (higher weight) then extracted text body.
    """
    fname_lower = filename.lower()
    text_lower = extracted_text[:3000].lower()
    best_cat = "other"
    best_score = 0
    for cat, keywords in _CATEGORY_RULES.items():
        if cat == "other":
            continue
        # Filename matches count double — they are the most reliable signal
        score = (
            sum(2 for kw in keywords if kw in fname_lower)
            + sum(1 for kw in keywords if kw in text_lower)
        )
        if score > best_score:
            best_score = score
            best_cat = cat
    return best_cat


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------


def _extract_pdf_text(data: bytes) -> str:
    """Extract plain text from PDF bytes using pypdf (optional dependency)."""
    try:
        import pypdf  # type: ignore

        reader = pypdf.PdfReader(io.BytesIO(data))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n".join(pages)
    except ImportError:
        logger.debug("pypdf not installed — PDF text extraction skipped.")
        return ""
    except Exception as exc:
        logger.warning("PDF text extraction failed: %s", exc)
        return ""


def _extract_excel_text(data: bytes, extension: str) -> str:
    """
    Extract plain text from Excel (.xlsx/.xls) or CSV bytes.
    Returns a tab-separated, newline-joined representation of all sheets.
    """
    try:
        import openpyxl  # type: ignore

        if extension in (".xlsx", ".xlsm", ".xltx"):
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            lines = []
            for sheet in wb.worksheets:
                lines.append(f"[Sheet: {sheet.title}]")
                for row in sheet.iter_rows(values_only=True):
                    cells = [str(c) if c is not None else "" for c in row]
                    if any(c.strip() for c in cells):
                        lines.append("\t".join(cells))
            return "\n".join(lines)
    except ImportError:
        logger.debug("openpyxl not installed — xlsx extraction skipped.")
    except Exception as exc:
        logger.warning("Excel (openpyxl) extraction failed: %s", exc)

    # Fallback: try xlrd for .xls
    if extension == ".xls":
        try:
            import xlrd  # type: ignore

            wb = xlrd.open_workbook(file_contents=data)
            lines = []
            for sheet in wb.sheets():
                lines.append(f"[Sheet: {sheet.name}]")
                for rx in range(sheet.nrows):
                    cells = [str(sheet.cell_value(rx, cx)) for cx in range(sheet.ncols)]
                    if any(c.strip() for c in cells):
                        lines.append("\t".join(cells))
            return "\n".join(lines)
        except ImportError:
            logger.debug("xlrd not installed — xls extraction skipped.")
        except Exception as exc:
            logger.warning("Excel (xlrd) extraction failed: %s", exc)

    return ""


def _extract_csv_text(data: bytes) -> str:
    """Decode CSV bytes and return first 5000 chars."""
    try:
        text = data.decode("utf-8", errors="replace")
        return text[:5000]
    except Exception as exc:
        logger.warning("CSV decode failed: %s", exc)
        return ""


def _extract_text(filename: str, data: bytes) -> str:
    """Dispatch to the correct extractor based on file extension."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == ".pdf":
        return _extract_pdf_text(data)
    if ext in (".xlsx", ".xlsm", ".xltx", ".xls"):
        return _extract_excel_text(data, ext)
    if ext == ".csv":
        return _extract_csv_text(data)
    if ext in (".txt", ".log"):
        return data.decode("utf-8", errors="replace")[:5000]
    return ""


# ---------------------------------------------------------------------------
# Personal entry finder
# ---------------------------------------------------------------------------


@dataclass
class PersonalMatch:
    """Result of searching for the student's entry in an attachment."""
    found: bool
    entry_no_found: bool          # True if matched by entry number
    name_found: bool              # True if matched by name
    matched_rows: List[str]       # The actual data rows that matched
    header_row: Optional[str]     # Column headers (if detected)
    context: str                  # Human-readable summary for logging / prompt
    confidence: str               # "high" | "medium" | "low"


def _build_entry_patterns(entry_no: str, name: str) -> dict[str, list[re.Pattern]]:
    """
    Build a dict of compiled regex patterns for entry number and name matching.

    Handles all realistic variations:
      - Entry number: case-insensitive, optional separators (spaces / hyphens)
        e.g.  2024tt10708  /  2024TT10708  /  2024 TT 10708  /  2024-TT-10708
      - Name: all tokens present in any order (handles "SINHA ABHAS KUMAR" etc.)
        with a tighter 3-token requirement so partial hits don't false-positive
    """
    patterns: dict[str, list[re.Pattern]] = {"entry": [], "name": []}

    # ── Entry number patterns ───────────────────────────────────────────────
    if entry_no:
        # Strip to alphanumeric core then build flex pattern
        core = re.sub(r"[^a-z0-9]", "", entry_no.lower())
        # Allow optional non-alphanumeric separators between any two chars
        flex = r"[\s\-_./]*".join(re.escape(c) for c in core)
        patterns["entry"].append(re.compile(flex, re.IGNORECASE))

        # Also match partial: just the numeric suffix (last 5 digits) preceded
        # by the department code — e.g. "TT10708" within a larger string
        match_dept = re.match(r"(\d{4})([a-z]+)(\d+)", core)
        if match_dept:
            year, dept, num = match_dept.groups()
            # e.g. pattern: TT\W*10708  or  10708
            patterns["entry"].append(
                re.compile(rf"\b{re.escape(dept)}[\s\-]*{re.escape(num)}\b", re.IGNORECASE)
            )
            # bare number match (only if ≥ 5 digits to avoid noise)
            if len(num) >= 5:
                patterns["entry"].append(
                    re.compile(rf"\b{re.escape(num)}\b")
                )

    # ── Name patterns ───────────────────────────────────────────────────────
    if name:
        name_tokens = [t.strip() for t in name.lower().split() if len(t.strip()) >= 3]
        if name_tokens:
            # All tokens must appear in the line (any order), each as whole word
            token_patterns = [
                re.compile(rf"\b{re.escape(tok)}\b", re.IGNORECASE)
                for tok in name_tokens
            ]
            patterns["name"].append(token_patterns)  # type: ignore[arg-type]

            # Partial: at least 2 of the longest tokens (handles truncated names)
            if len(name_tokens) >= 2:
                longest = sorted(name_tokens, key=len, reverse=True)[:2]
                partial_patterns = [
                    re.compile(rf"\b{re.escape(tok)}\b", re.IGNORECASE)
                    for tok in longest
                ]
                patterns["name"].append(partial_patterns)  # type: ignore[arg-type]

    return patterns


def _line_matches_entry(line: str, entry_patterns: list) -> bool:
    """True if the line matches any entry-number pattern."""
    for pat in entry_patterns:
        if pat.search(line):
            return True
    return False


def _line_matches_name(line: str, name_pattern_groups: list) -> bool:
    """
    True if the line satisfies any name-pattern group.
    A group is a list of patterns that ALL must match within the same line.
    """
    for group in name_pattern_groups:
        if all(pat.search(line) for pat in group):
            return True
    return False


def _detect_header_row(lines: list[str], max_scan: int = 20) -> Optional[str]:
    """
    Heuristic: find a header row in the first max_scan lines.
    A header row contains ≥ 3 of these keywords and no numeric-only cells.
    """
    header_keywords = {
        "name", "entry", "roll", "marks", "seat", "room", "hall",
        "subject", "course", "grade", "score", "attendance", "total",
        "sl", "s.no", "sno", "sr", "no.", "id", "student", "dept",
    }
    best_line: Optional[str] = None
    best_score = 0
    for i, line in enumerate(lines[:max_scan]):
        cells = re.split(r"[\t|,;]+", line.strip())
        lower_cells = [c.strip().lower() for c in cells if c.strip()]
        score = sum(1 for c in lower_cells if c in header_keywords)
        # Penalise if most cells look purely numeric
        numeric_count = sum(1 for c in lower_cells if re.fullmatch(r"[\d.]+", c))
        if len(lower_cells) > 0 and numeric_count / len(lower_cells) > 0.6:
            score -= 2
        if score > best_score and score >= 2:
            best_score = score
            best_line = line.strip()
    return best_line


def find_personal_entry(
    extracted_text: str,
    entry_no: str,
    name: str,
    category: str,
) -> PersonalMatch:
    """
    Search `extracted_text` for the student's entry number or name.

    Strategy:
    1. Split text into lines.
    2. Try to detect a header row (column names).
    3. For each line, test against all entry-number and name patterns.
    4. Collect matching rows and up to 1 line of context before/after.
    5. Determine confidence: high (entry match), medium (name match), low (none).

    Returns a PersonalMatch summarising what was found.
    """
    if not extracted_text or not (entry_no or name):
        return PersonalMatch(
            found=False, entry_no_found=False, name_found=False,
            matched_rows=[], header_row=None,
            context="No identity configured or no text to search.",
            confidence="low",
        )

    patterns = _build_entry_patterns(entry_no, name)
    entry_pats = patterns["entry"]
    name_pat_groups = patterns["name"]

    lines = extracted_text.splitlines()
    header_row = _detect_header_row(lines)

    matched_rows: List[str] = []
    entry_no_found = False
    name_found = False

    for i, line in enumerate(lines):
        clean_line = line.strip()
        if not clean_line:
            continue

        hit_entry = bool(entry_pats) and _line_matches_entry(clean_line, entry_pats)
        hit_name = bool(name_pat_groups) and _line_matches_name(clean_line, name_pat_groups)

        if hit_entry or hit_name:
            if hit_entry:
                entry_no_found = True
            if hit_name:
                name_found = True

            # Collect the line plus 1 line of context each side
            ctx_lines = []
            if i > 0 and lines[i - 1].strip():
                ctx_lines.append(f"  [prev] {lines[i - 1].strip()}")
            ctx_lines.append(f"  [MATCH] {clean_line}")
            if i + 1 < len(lines) and lines[i + 1].strip():
                ctx_lines.append(f"  [next] {lines[i + 1].strip()}")

            matched_rows.append("\n".join(ctx_lines))

            # Cap at 5 matches to keep prompt manageable
            if len(matched_rows) >= 5:
                break

    found = bool(matched_rows)

    # Build human-readable context string
    if found:
        parts = []
        if header_row:
            parts.append(f"Headers: {header_row}")
        parts.extend(matched_rows)
        context = "\n".join(parts)
        confidence = "high" if entry_no_found else "medium"
    else:
        context = (
            f"No entry found for entry_no='{entry_no}' or name='{name}' "
            f"in attachment (category={category})."
        )
        confidence = "low"

    return PersonalMatch(
        found=found,
        entry_no_found=entry_no_found,
        name_found=name_found,
        matched_rows=matched_rows,
        header_row=header_row,
        context=context,
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Data structure
# ---------------------------------------------------------------------------


@dataclass
class AttachmentInfo:
    filename: str
    content_type: str             # MIME type, e.g. "application/pdf"
    size_bytes: int
    category: str                 # detected category string
    must_check: bool              # True if student/user must review this
    extracted_text: str           # up to 5000 chars of extracted text (or "")
    snippet: str                  # ≤ 400-char summary snippet shown in prompt
    personal_match: PersonalMatch # result of identity search
    data: bytes = field(repr=False)  # raw bytes (not included in logs)

    @property
    def ext(self) -> str:
        return "." + self.filename.rsplit(".", 1)[-1].lower() if "." in self.filename else ""

    def to_prompt_block(self) -> str:
        """Compact text block injected into the Gemini prompt."""
        pm = self.personal_match
        lines = [
            f"  Filename   : {self.filename}",
            f"  Type       : {self.content_type}  ({self.size_bytes:,} bytes)",
            f"  Category   : {self.category.replace('_', ' ').title()}",
            f"  MustCheck  : {'YES — student should open this' if self.must_check else 'no'}",
            f"  StudentFound: {'YES (confidence=' + pm.confidence + ')' if pm.found else 'NOT FOUND in this file'}",
        ]
        if pm.found:
            lines.append(f"  StudentData:\n{pm.context}")
        elif self.snippet:
            lines.append(f"  Preview    : {self.snippet}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_READABLE_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "text/plain",
}
_READABLE_EXTS = {".pdf", ".xlsx", ".xlsm", ".xls", ".csv", ".txt"}


def analyze_attachments(
    raw_attachments: list[dict],
    student_entry_no: str = "",
    student_name: str = "",
) -> List[AttachmentInfo]:
    """
    Process a list of raw attachment dicts (from email_reader) and return
    a list of AttachmentInfo objects with categories, extracted text,
    and personal-entry match results.

    raw_attachments item keys: filename, content_type, data (bytes)
    student_entry_no: e.g. "2024tt10708"
    student_name    : e.g. "Abhas Kumar Sinha"
    """
    results: List[AttachmentInfo] = []

    for att in raw_attachments:
        filename: str = att.get("filename") or "unknown"
        content_type: str = att.get("content_type") or "application/octet-stream"
        data: bytes = att.get("data") or b""

        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        # Text extraction
        if content_type in _READABLE_TYPES or ext in _READABLE_EXTS:
            extracted = _extract_text(filename, data)
        else:
            extracted = ""

        category = _detect_category(filename, extracted)
        must_check = category in _MUST_CHECK

        # Personal match — only for categories where it makes sense
        _PERSONAL_SEARCH_CATS = {
            "marks_sheet", "seating_arrangement", "attendance",
            "admit_card", "fee_challan",
        }
        if category in _PERSONAL_SEARCH_CATS and (student_entry_no or student_name):
            personal_match = find_personal_entry(
                extracted, student_entry_no, student_name, category
            )
        else:
            personal_match = PersonalMatch(
                found=False, entry_no_found=False, name_found=False,
                matched_rows=[], header_row=None,
                context="Personal search not applicable for this category.",
                confidence="low",
            )

        # Build a readable snippet (≤400 chars) for non-matched files
        snippet = " ".join(extracted.split())[:400] if extracted and not personal_match.found else ""

        info = AttachmentInfo(
            filename=filename,
            content_type=content_type,
            size_bytes=len(data),
            category=category,
            must_check=must_check,
            extracted_text=extracted[:5000],
            snippet=snippet,
            personal_match=personal_match,
            data=data,
        )

        logger.info(
            "Attachment: %s | category=%s | must_check=%s | student_found=%s (confidence=%s) | size=%d bytes",
            filename,
            category,
            must_check,
            personal_match.found,
            personal_match.confidence,
            len(data),
        )
        results.append(info)

    return results


def attachment_summary_for_prompt(infos: List[AttachmentInfo]) -> str:
    """
    Return a multi-line block describing all attachments, ready to embed
    in a Gemini prompt. Returns empty string if no attachments.
    """
    if not infos:
        return ""
    blocks = [f"Attachment {i + 1}:\n{info.to_prompt_block()}" for i, info in enumerate(infos)]
    return "\n\n".join(blocks)


def any_must_check(infos: List[AttachmentInfo]) -> bool:
    """True if at least one attachment is categorized as must-check."""
    return any(i.must_check for i in infos)


def any_personal_found(infos: List[AttachmentInfo]) -> bool:
    """True if the student's entry was found in at least one attachment."""
    return any(i.personal_match.found for i in infos)


def personal_match_summary(infos: List[AttachmentInfo]) -> str:
    """
    Build a consolidated human-readable summary of all personal matches
    for DB storage / logging.
    """
    hits = [i for i in infos if i.personal_match.found]
    if not hits:
        return ""
    parts = []
    for info in hits:
        pm = info.personal_match
        parts.append(
            f"[{info.filename} / {info.category}] "
            f"confidence={pm.confidence} | "
            f"entry_no={pm.entry_no_found} name={pm.name_found}\n"
            + pm.context
        )
    return "\n\n".join(parts)
