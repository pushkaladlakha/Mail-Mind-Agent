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

# Make concurrent.futures available in module namespace
import concurrent.futures
