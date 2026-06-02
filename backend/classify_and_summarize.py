import sys
import json
import os
from dotenv import load_dotenv
import concurrent.futures
import pandas as pd

# Ensure the backend directory is in the path
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if _CURRENT_DIR not in sys.path:
    sys.path.append(_CURRENT_DIR)

load_dotenv()

from ml_classifier import predict_email_category, load_custom_model, _infer_urgency
from ai_analyzer import analyze_email

def process_email_details(item, api_key, student_name, student_entry_no):
    subject = item.get("subject", "")
    sender = item.get("sender", "")
    body = item.get("body", "")
    email_id = item.get("id", "")
    
    # 1. Run local custom Random Forest prediction with metrics
    category = "low_priority"
    ml_prediction = "Unknown"
    ml_confidence = None
    ml_model_loaded = False
    
    try:
        model = load_custom_model()
        if model is not None:
            ml_model_loaded = True
            email_df = pd.DataFrame([{
                "Subject": subject,
                "From": sender,
                "Body": body,
                "Urgency": _infer_urgency(subject, body),
                "Date": ""
            }])
            
            # Predict raw label (e.g. 'Not Spam' or 'Spam')
            raw_pred = model.predict(email_df)[0]
            ml_prediction = str(raw_pred)
            
            # Map raw label to standard UI category
            pred_str = ml_prediction.lower().strip()
            if pred_str in ("important", "1", "non-spam", "priority", "academic", "true", "yes", "not spam", "not_spam", "ham"):
                category = "important"
            else:
                category = "low_priority"
                
            # Get probability confidence if supported
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(email_df)[0]
                classes = list(model.classes_)
                try:
                    class_idx = classes.index(raw_pred)
                    ml_confidence = int(round(float(proba[class_idx]) * 100))
                except Exception:
                    pass
        else:
            # Fallback keyword classification if model file missing
            category = "important" if "exam" in subject.lower() or "quiz" in subject.lower() else "low_priority"
            ml_prediction = "Keyword Fallback"
    except Exception as e:
        category = "low_priority"
        ml_prediction = f"Error: {str(e)}"
        
    # Check if Gemini key is available
    if not api_key or "your_gemini_api_key" in api_key:
        return {
            "id": email_id,
            "category": category,
            "summary": body[:180] + "..." if len(body) > 180 else body,
            "is_important": category == "important",
            "extracted_dates": [],
            "tags": ["NO API KEY"],
            "kind": "academic",
            "priorityScore": 75 if category == "important" else 25,
            "ml_prediction": ml_prediction,
            "ml_confidence": ml_confidence,
            "ml_model_loaded": ml_model_loaded
        }
        
    # Prepare email_data structure for ai_analyzer
    email_data = {
        "subject": subject,
        "sender": sender,
        "body": body,
        "date": ""
    }
    
    try:
        analysis, model_used = analyze_email(
            email_data=email_data,
            api_key=api_key,
            category=category,
            student_name=student_name,
            student_entry_no=student_entry_no
        )
        
        return {
            "id": email_id,
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
        # fallback in case of Gemini quota limit or failure
        err_msg = str(e)
        fallback_tag = "Fallback Keyword"
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
            fallback_tag = "QUOTA EXCEEDED"
            
        return {
            "id": email_id,
            "category": category,
            "summary": body[:180] + "..." if len(body) > 180 else body,
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

def main():
    try:
        # Read JSON string from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Load API key from environment first
        api_key = os.getenv("GEMINI_API_KEY")
        
        emails_list = []
        
        # Check if the inputs are formatted as a dictionary (new structure) or raw list (legacy structure)
        if isinstance(input_data, dict):
            emails_list = input_data.get("emails", [])
            # Override api key if the user has passed their custom Google Gemini Key from the frontend
            custom_key = input_data.get("gemini_api_key", "").strip()
            if custom_key:
                api_key = custom_key
        elif isinstance(input_data, list):
            emails_list = input_data
            
        # Determine if batch or single
        if isinstance(input_data, list) or (isinstance(input_data, dict) and "emails" in input_data):
            # Batch processing
            results = []
            
            # Eagerly load custom model once to avoid multi-thread loading race conditions
            load_custom_model()
            
            # Extract common student info from the first item or defaults
            first_item = emails_list[0] if emails_list else {}
            student_name = first_item.get("student_name", "")
            student_entry_no = first_item.get("student_entry_no", "")
            
            # Use ThreadPoolExecutor to classify and summarize in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(emails_list), 10)) as executor:
                futures = {
                    executor.submit(
                        process_email_details, 
                        item, 
                        api_key, 
                        item.get("student_name", student_name), 
                        item.get("student_entry_no", student_entry_no)
                    ): item for item in emails_list
                }
                
                results_map = {}
                for future in concurrent.futures.as_completed(futures):
                    item = futures[future]
                    email_id = item.get("id")
                    try:
                        res = future.result()
                        results_map[email_id] = res
                    except Exception as e:
                        results_map[email_id] = {
                            "id": email_id,
                            "category": "low_priority",
                            "summary": item.get("body", "")[:180] + "...",
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
            
            # Return ordered list of results matching the input order
            ordered_results = []
            for item in emails_list:
                email_id = item.get("id")
                ordered_results.append(results_map.get(email_id))
                
            print(json.dumps({"success": True, "results": ordered_results}))
            
        else:
            # Single email processing (legacy support)
            subject = input_data.get("subject", "")
            sender = input_data.get("sender", "")
            body = input_data.get("body", "")
            student_name = input_data.get("student_name", "")
            student_entry_no = input_data.get("student_entry_no", "")
            
            res = process_email_details(input_data, api_key, student_name, student_entry_no)
            print(json.dumps({"success": True, **res}))
            
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
