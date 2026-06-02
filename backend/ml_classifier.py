"""
ml_classifier.py — Custom Machine Learning Model Loader and Classification.

This module acts as the triage gatekeeper for all incoming emails.
It attempts to load your teammate's trained ML model file (model.joblib or model.pkl).
* If a model file is found, it uses it to classify emails as "important" (non-spam)
  or "low_priority" (spam/noise).
* If no model file is found yet, it falls back to a smart, rule-based keyword classifier
  and logs instructions for your teammate on how to export and drop in their model.
"""

import logging
import os
import re
import sys
from typing import Optional, Any

# Ensure the backend directory is in sys.path so unpickling the custom class EmailPreprocessor succeeds
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if _CURRENT_DIR not in sys.path:
    sys.path.append(_CURRENT_DIR)

try:
    import preprocessing
except ImportError:
    pass

import pandas as pd

logger = logging.getLogger(__name__)

# Paths for serialized ML models
_MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
_JOBLIB_PATH = os.path.join(_MODEL_DIR, "model.joblib")
_PICKLE_PATH = os.path.join(_MODEL_DIR, "model.pkl")

# Cached model instance
_loaded_model: Optional[Any] = None
_model_format: Optional[str] = None


def load_custom_model() -> Optional[Any]:
    """
    Attempt to load a trained ML model file (joblib first, fallback to pickle).
    Returns the loaded model, or None if no file is present.
    """
    global _loaded_model, _model_format

    if _loaded_model is not None:
        return _loaded_model

    # Check candidate paths:
    # 1. backend/models/random_forest_tfidf.joblib (trained model location)
    # 2. backend/model.joblib
    # 3. backend/model.pkl
    candidates = [
        (os.path.join(_MODEL_DIR, "models", "random_forest_tfidf.joblib"), "joblib"),
        (os.path.join(_MODEL_DIR, "model.joblib"), "joblib"),
        (os.path.join(_MODEL_DIR, "model.pkl"), "pickle"),
    ]

    for path, fmt in candidates:
        if os.path.exists(path):
            try:
                if fmt == "joblib":
                    import joblib
                    _loaded_model = joblib.load(path)
                else:
                    import pickle
                    with open(path, "rb") as f:
                        _loaded_model = pickle.load(f)
                _model_format = fmt
                logger.info("Successfully loaded custom ML model from %s!", path)
                return _loaded_model
            except Exception as e:
                logger.error("Failed to load model from %s: %s", path, e)

    # 3. No model file found. Log drop-in instructions for the teammate.
    logger.warning(
        "\n========================================================================\n"
        "📢 NO CUSTOM ML CLASSIFIER MODEL DETECTED!\n"
        "------------------------------------------------------------------------\n"
        "Your pipeline is running in Keyword Fallback Mode.\n"
        "To activate your custom ML classification, your teammate can export\n"
        "their trained Scikit-Learn Pipeline (Vectorization + Classifier) like this:\n\n"
        "    import joblib\n"
        "    # Save your fully fitted pipeline\n"
        "    joblib.dump(fitted_pipeline, 'model.joblib')\n\n"
        "Then simply copy the 'model.joblib' file into this folder:\n"
        f"👉 {_MODEL_DIR}/\n"
        "========================================================================\n"
    )
    return None


# ---------------------------------------------------------------------------
# Fallback Rule-Based Keyword Classifier
# ---------------------------------------------------------------------------

# Keywords indicating a core, important academic email
_IMPORTANT_KEYWORDS = [
    r"\bexam(s|ination)?\b",
    r"\bquiz(zes)?\b",
    r"\bmid-?sem(ester)?\b",
    r"\bend-?sem(ester)?\b",
    r"\bsubmission(s)?\b",
    r"\bdeadline(s)?\b",
    r"\bregistration(s)?\b",
    r"\bplacement(s)?\b",
    r"\binterview(s)?\b",
    r"\bshortlist(ed|ing)?\b",
    r"\burgent\b",
    r"\brequired\b",
    r"\bmandatory\b",
    r"\bcompulsory\b",
    r"\boffice of\b",
    r"\bdean\b",
    r"\bprofessor\b",
    r"\bprof\b",
    r"\bsyllabus\b",
]

# Keywords indicating high priority sender handles
_IMPORTANT_SENDERS = [
    "iitd.ac.in",
    "placement",
    "academic",
    "registrar",
    "dean",
    "warden",
]


def _fallback_keyword_predict(subject: str, sender: str, body: str) -> str:
    """
    Classifies the email based on robust keyword scans.
    Returns "important" (non-spam) or "low_priority" (spam/noise).
    """
    text = f"{subject} {body}".lower()
    sender_lower = sender.lower()

    # Rule 1: High priority senders are auto-classified as important
    if any(keyword in sender_lower for keyword in _IMPORTANT_SENDERS):
        return "important"

    # Rule 2: Keyword scans across subject and body
    if any(re.search(pattern, text) for pattern in _IMPORTANT_KEYWORDS):
        return "important"

    # Default: low priority (unimportant activities, socials, fests, fads)
    return "low_priority"


# ---------------------------------------------------------------------------
# Public Prediction API
# ---------------------------------------------------------------------------


def _infer_urgency(subject: str, body: str) -> str:
    """
    Infers whether an email is urgent based on keyword presence.
    Matches the training preprocessing schema.
    """
    text = f"{subject} {body}".lower()
    urgent_words = [
        "urgent",
        "asap",
        "immediately",
        "important",
        "deadline",
        "last date",
        "action required",
        "mandatory"
    ]
    for word in urgent_words:
        if word in text:
            return "urgent"
    return "normal"


def predict_email_category(subject: str, sender: str, body: str) -> str:
    """
    Predicts the classification category of an incoming email using the trained ML model.
    Keyword fallback classification is fully disabled.
    """
    model = load_custom_model()
    
    if model is None:
        raise RuntimeError("ML Classifier Error: Custom ML model (random_forest_tfidf.joblib) could not be loaded!")
        
    try:
        # Construct the single-row Pandas DataFrame matching custom preprocessor schema
        email_df = pd.DataFrame([{
            "Subject": subject,
            "From": sender,
            "Body": body,
            "Urgency": _infer_urgency(subject, body),
            "Date": ""
        }])
        
        # Predict using teammate's pipeline (expects DataFrame input)
        prediction = model.predict(email_df)[0]
        
        # Map predictions dynamically to our two UI streams.
        # Handles teammate's string labels ("Spam", "Not Spam") as well as fallback strings/numbers.
        pred_str = str(prediction).lower().strip()
        
        # "not spam", "not_spam", "ham", "important", "priority" are all mapped to "important"
        if pred_str in ("important", "1", "non-spam", "priority", "academic", "true", "yes", "not spam", "not_spam", "ham"):
            return "important"
        else:
            return "low_priority"
            
    except Exception as e:
        logger.error("Custom ML model prediction failed: %s", e)
        raise RuntimeError(f"ML Classifier Error: Prediction failed on loaded model: {e}")
