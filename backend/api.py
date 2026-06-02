import os
import sys
import json
import logging
import threading
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import re
import imaplib
import email
from email_reader import _decode_header_value, extract_body, _parse_date
from datetime import datetime, timezone

# Ensure the backend directory is in the path
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if _CURRENT_DIR not in sys.path:
    sys.path.append(_CURRENT_DIR)

load_dotenv()

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

from ml_classifier import predict_email_category, load_custom_model, _infer_urgency
from ai_analyzer import analyze_email
from main import run_agent, load_config
import schedule

app = FastAPI(title="Mail Mind Agent API")

# Initialize and cache ML model at startup
try:
    load_custom_model()
except Exception as e:
    logger.error("Failed to pre-load custom ML model: %s", e)

# Background worker thread for continuous polling
def run_polling_loop():
    logger.info("Starting background IMAP polling loop...")
    # Load configuration
    try:
        cfg = load_config()
        interval = int(cfg.get("POLL_INTERVAL_MINUTES", 10))
    except Exception:
        interval = 10
        
    # Run once immediately
    try:
        run_agent()
    except Exception as e:
        logger.error("Error running initial agent polling: %s", e)
        
    # Schedule loop
    schedule.every(interval).minutes.do(run_agent)
    while True:
        try:
            schedule.run_pending()
        except Exception as e:
            logger.error("Error in scheduler loop: %s", e)
        time.sleep(1)

# Start thread on app start
@app.on_event("startup")
def startup_event():
    # Only start background polling if credentials are set (prevents crashing on incomplete deploys)
    imap_user = os.getenv("IMAP_USER")
    if imap_user and imap_user != "ee1240730":
        t = threading.Thread(target=run_polling_loop, daemon=True)
        t.start()
    else:
        logger.warning("IMAP_USER not configured or using default template. Background polling daemon disabled.")

def parse_single_message(uid: int, msg: email.message.Message) -> dict:
    subject = _decode_header_value(msg.get("Subject"))
    sender_raw = _decode_header_value(msg.get("From"))
    
    sender_name = sender_raw
    sender_email = "unknown@iitd.ac.in"
    if "<" in sender_raw and ">" in sender_raw:
        match = re.match(r"^(.*?)\s*<(.*?)>", sender_raw)
        if match:
            sender_name = match.group(1).strip() or match.group(2).strip()
            sender_email = match.group(2).strip()
            
    date_str = msg.get("Date")
    parsed_date = _parse_date(date_str)
    received_at = parsed_date.isoformat() if parsed_date else datetime.now(timezone.utc).isoformat()
    
    body = extract_body(msg, max_chars=3000)
    
    return {
        "id": f"live-{uid}",
        "uid": uid,
        "sender": sender_name or sender_raw or "Unknown",
        "senderEmail": sender_email,
        "subject": subject or "(No Subject)",
        "body": body or "(No content preview)",
        "receivedAt": received_at
    }

def fetch_emails_via_imap(host: str, port: int, user: str, password: str, mode: str = "latest_count", last_uid: Optional[int] = None, count: int = 15, skip_count: int = 0):
    username = user.split("@")[0]
    
    conn = imaplib.IMAP4_SSL(host, port)
    conn.login(username, password)
    try:
        status, select_data = conn.select("INBOX", readonly=True)
        if status != "OK":
            raise RuntimeError(f"Select INBOX failed with status: {status}")
            
        total_inbox = int(select_data[0])
        emails_list = []
        highest_uid = last_uid or 0
        
        if mode == "since_last" and last_uid and last_uid > 0:
            status, search_data = conn.uid("SEARCH", None, f"UID {last_uid + 1}:*")
            if status == "OK" and search_data[0]:
                uid_bytes = search_data[0].split()
                uids = [int(u) for u in uid_bytes if int(u) > last_uid]
                
                for uid in uids:
                    status, fetch_data = conn.uid("FETCH", str(uid), "(RFC822)")
                    if status == "OK" and fetch_data[0]:
                        msg = email.message_from_bytes(fetch_data[0][1])
                        parsed = parse_single_message(uid, msg)
                        emails_list.append(parsed)
                        if uid > highest_uid:
                            highest_uid = uid
        else:
            remaining = max(0, total_inbox - skip_count)
            fetch_count = min(count, remaining)
            
            if fetch_count > 0:
                start_seq = max(1, remaining - fetch_count + 1)
                end_seq = remaining
                
                status, fetch_data = conn.fetch(f"{start_seq}:{end_seq}", "(UID RFC822)")
                if status == "OK":
                    for item in fetch_data:
                        if isinstance(item, tuple):
                            meta = item[0].decode()
                            uid_match = re.search(r"UID\s+(\d+)", meta)
                            uid = int(uid_match.group(1)) if uid_match else 0
                            
                            msg = email.message_from_bytes(item[1])
                            parsed = parse_single_message(uid, msg)
                            
                            if last_uid and uid <= last_uid and skip_count == 0:
                                continue
                                
                            emails_list.append(parsed)
                            if uid > highest_uid:
                                highest_uid = uid
                                
        emails_list.sort(key=lambda x: x["uid"], reverse=True)
        return emails_list, highest_uid, total_inbox
    finally:
        try:
            conn.logout()
        except Exception:
            pass

# Request schemas
class EmailItem(BaseModel):
    id: str
    subject: str
    sender: str
    body: str
    studentName: Optional[str] = ""
    studentEntryNo: Optional[str] = ""

class BatchRequest(BaseModel):
    emails: List[EmailItem]
    geminiApiKey: Optional[str] = ""

class IMAPLoginRequest(BaseModel):
    email: str
    password: str
    imapHost: str = "mailstore.iitd.ac.in"
    imapPort: int = 993

class IMAPFetchRequest(BaseModel):
    email: str
    password: str
    imapHost: str = "mailstore.iitd.ac.in"
    imapPort: int = 993
    mode: str = "latest_count"
    lastUid: Optional[int] = None
    count: int = 15
    skipCount: int = 0

# Local processing function
def process_single_email(item: EmailItem, api_key: str):
    # 1. Predict ML category
    category = "low_priority"
    ml_prediction = "Unknown"
    ml_confidence = None
    ml_model_loaded = False
    
    try:
        model = load_custom_model()
        if model is not None:
            ml_model_loaded = True
            import pandas as pd
            email_df = pd.DataFrame([{
                "Subject": item.subject,
                "From": item.sender,
                "Body": item.body,
                "Urgency": _infer_urgency(item.subject, item.body),
                "Date": ""
            }])
            
            raw_pred = model.predict(email_df)[0]
            ml_prediction = str(raw_pred)
            
            pred_str = ml_prediction.lower().strip()
            if pred_str in ("important", "1", "non-spam", "priority", "academic", "true", "yes", "not spam", "not_spam", "ham"):
                category = "important"
            else:
                category = "low_priority"
                
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(email_df)[0]
                classes = list(model.classes_)
                try:
                    class_idx = classes.index(raw_pred)
                    ml_confidence = int(round(float(proba[class_idx]) * 100))
                except Exception:
                    pass
        else:
            category = "important" if "exam" in item.subject.lower() or "quiz" in item.subject.lower() else "low_priority"
            ml_prediction = "Keyword Fallback"
    except Exception as e:
        category = "low_priority"
        ml_prediction = f"Error: {str(e)}"
        
    if not api_key or "your_gemini_api_key" in api_key:
        return {
            "id": item.id,
            "category": category,
            "summary": item.body[:180] + "..." if len(item.body) > 180 else item.body,
            "is_important": category == "important",
            "extracted_dates": [],
            "tags": ["NO API KEY"],
            "kind": "academic",
            "priorityScore": 75 if category == "important" else 25,
            "ml_prediction": ml_prediction,
            "ml_confidence": ml_confidence,
            "ml_model_loaded": ml_model_loaded
        }
        
    email_data = {
        "subject": item.subject,
        "sender": item.sender,
        "body": item.body,
        "date": ""
    }
    
    try:
        analysis, model_used = analyze_email(
            email_data=email_data,
            api_key=api_key,
            category=category,
            student_name=item.studentName,
            student_entry_no=item.studentEntryNo
        )
        
        return {
            "id": item.id,
            "category": category,
            "summary": analysis.get("summary", ""),
            "is_important": analysis.get("is_important", category == "important"),
            "extracted_dates": [{"date": analysis.get("event_date"), "label": analysis.get("event_title"), "location": analysis.get("event_location")}] if analysis.get("event_date") else [],
            "tags": [analysis.get("priority", "medium").upper()],
            "kind": "exam" if "exam" in (analysis.get("event_title") or "").lower() or "quiz" in (analysis.get("event_title") or "").lower() else "academic",
            "priorityScore": 90 if analysis.get("priority") == "high" else (50 if analysis.get("priority") == "medium" else 20),
            "ml_prediction": ml_prediction,
            "ml_confidence": ml_confidence,
            "ml_model_loaded": ml_model_loaded
        }
    except Exception as e:
        err_msg = str(e)
        fallback_tag = "Fallback Keyword"
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
            fallback_tag = "QUOTA EXCEEDED"
            
        return {
            "id": item.id,
            "category": category,
            "summary": item.body[:180] + "..." if len(item.body) > 180 else item.body,
            "is_important": category == "important",
            "extracted_dates": [],
            "tags": [fallback_tag],
            "kind": "academic",
            "priorityScore": 75 if category == "important" else 25,
            "error": err_msg,
            "ml_prediction": ml_prediction,
            "ml_confidence": ml_confidence,
            "ml_model_loaded": ml_model_loaded
        }

@app.get("/")
@app.head("/")
def read_root():
    return {"status": "healthy", "service": "Mail Mind Agent REST API"}

@app.post("/api/classify")
def classify_emails_endpoint(request: BatchRequest):
    api_key = request.geminiApiKey or os.getenv("GEMINI_API_KEY")
    results = []
    
    # Process all emails in parallel using ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(request.emails), 10)) as executor:
        futures = {
            executor.submit(
                process_single_email, 
                item, 
                api_key
            ): item for item in request.emails
        }
        
        results_map = {}
        for future in concurrent.futures.as_completed(futures):
            item = futures[future]
            try:
                res = future.result()
                results_map[item.id] = res
            except Exception as e:
                results_map[item.id] = {
                    "id": item.id,
                    "category": "low_priority",
                    "summary": item.body[:180] + "...",
                    "is_important": False,
                    "extracted_dates": [],
                    "tags": ["Error"],
                    "kind": "academic",
                    "priorityScore": 25,
                    "error": str(e),
                    "ml_prediction": "Error",
                    "ml_confidence": None,
                    "ml_model_loaded": False
                }
                
    ordered_results = [results_map.get(item.id) for item in request.emails]
    return {"success": True, "results": ordered_results}

@app.post("/api/imap/login")
def imap_login_endpoint(request: IMAPLoginRequest):
    username = request.email.split("@")[0]
    
    # Bypass for test accounts
    if username == "admin" and request.password == "admin123":
        return {"success": True}
    if username == "newinbox" and request.password == "admin123":
        return {"success": True}
        
    try:
        conn = imaplib.IMAP4_SSL(request.imapHost, request.imapPort)
        conn.login(username, request.password)
        conn.logout()
        return {"success": True}
    except Exception as e:
        logger.error("IMAP login verification failed for user %s: %s", username, e)
        return {"success": False, "error": str(e)}

@app.post("/api/imap/fetch")
def imap_fetch_endpoint(request: IMAPFetchRequest):
    username = request.email.split("@")[0]
    
    # Bypass for admin test account
    if username == "admin" and request.password == "admin123":
        admin_emails = [
            {
                "id": "live-1001",
                "uid": 1001,
                "sender": "Office of Academic Affairs",
                "senderEmail": "academics@iitd.ac.in",
                "subject": "Course Registration Guidelines Autumn 2026",
                "body": "Dear Students,\n\nPlease note that the course registration portal will open on June 1st. Make sure to clear all your dues before registering.\n\nBest regards,\nOffice of Academic Affairs.",
                "receivedAt": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": "live-1002",
                "uid": 1002,
                "sender": "CSC Helpdesk",
                "senderEmail": "csc_help@iitd.ac.in",
                "subject": "Scheduled Network Maintenance this Sunday",
                "body": "Hello All,\n\nThere will be a scheduled network maintenance on Sunday between 2:00 AM and 6:00 AM. Intranet and internet services may be briefly interrupted.\n\nThanks,\nCSC Team.",
                "receivedAt": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        # Filter since_last
        if request.mode == "since_last" and request.lastUid:
            filtered = [e for e in admin_emails if e["uid"] > request.lastUid]
        else:
            filtered = admin_emails
            
        return {
            "success": True,
            "emails": filtered,
            "highestUid": max([e["uid"] for e in admin_emails]) if admin_emails else 0,
            "totalInbox": len(admin_emails)
        }
        
    if username == "newinbox" and request.password == "admin123":
        return {
            "success": True,
            "emails": [],
            "highestUid": 0,
            "totalInbox": 0
        }
        
    try:
        emails, highest_uid, total_inbox = fetch_emails_via_imap(
            host=request.imapHost,
            port=request.imapPort,
            user=request.email,
            password=request.password,
            mode=request.mode,
            last_uid=request.lastUid,
            count=request.count,
            skip_count=request.skipCount
        )
        return {
            "success": True,
            "emails": emails,
            "highestUid": highest_uid,
            "totalInbox": total_inbox
        }
    except Exception as e:
        logger.error("IMAP email fetch failed for user %s: %s", username, e, exc_info=True)
        return {"success": False, "error": str(e)}

# Make concurrent.futures available in module namespace
import concurrent.futures
