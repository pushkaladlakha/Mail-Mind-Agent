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
from typing import Optional, Any

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

    # 1. Try loading model.joblib
    if os.path.exists(_JOBLIB_PATH):
        try:
            import joblib
            _loaded_model = joblib.load(_JOBLIB_PATH)
            _model_format = "joblib"
            logger.info("Successfully loaded custom ML model from model.joblib!")
            return _loaded_model
        except Exception as e:
            logger.error("Failed to load model.joblib: %s", e)

    # 2. Try loading model.pkl
    if os.path.exists(_PICKLE_PATH):
        try:
            import pickle
            with open(_PICKLE_PATH, "rb") as f:
                _loaded_model = pickle.load(f)
            _model_format = "pickle"
            logger.info("Successfully loaded custom ML model from model.pkl!")
            return _loaded_model
        except Exception as e:
            logger.error("Failed to load model.pkl: %s", e)

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


def predict_email_category(subject: str, sender: str, body: str) -> str:
    """
    Predicts the classification category of an incoming email.
    Uses the loaded ML model if present; falls back to the keyword rules otherwise.

    Returns:
        "important" (non-spam / priority) or "low_priority" (spam / noise)
    """
    model = load_custom_model()
    
    if model is not None:
        try:
            # Prepare the input text by joining subject and body
            email_text = f"{subject} {body}"
            
            # Predict using teammate's pipeline.
            # Handles Scikit-Learn single predictions: expects a list/array of texts
            prediction = model.predict([email_text])[0]
            
            # Map predictions dynamically to our two UI streams.
            # Handles string predictions (e.g. "important", "spam", "non-spam", "priority")
            # and numeric predictions (e.g. 1 for important/non-spam, 0 for spam/noise)
            pred_str = str(prediction).lower().strip()
            
            if pred_str in ("important", "1", "non-spam", "priority", "academic", "true", "yes"):
                return "important"
            else:
                return "low_priority"
                
        except Exception as e:
            logger.error("Custom ML model prediction failed (falling back): %s", e)

    # Fallback keyword rules
    return _fallback_keyword_predict(subject, sender, body)
