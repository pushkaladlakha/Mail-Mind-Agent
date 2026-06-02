import os
import joblib
import pandas as pd

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(_CURRENT_DIR, "models", "random_forest_tfidf.joblib")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(_CURRENT_DIR, "model.joblib")


def load_model():
    return joblib.load(MODEL_PATH)


def predict_single_email(subject, sender, body, date="", urgency="normal"):
    model = load_model()

    email_df = pd.DataFrame([{
        "Subject": subject,
        "From": sender,
        "Body": body,
        "Date": date,
        "Urgency": urgency
    }])

    prediction = model.predict(email_df)[0]

    result = {
        "subject": subject,
        "from": sender,
        "classification": prediction
    }

    if hasattr(model.named_steps["model"], "decision_function"):
        try:
            score = model.decision_function(email_df)
            result["confidence_score"] = score.tolist()
        except Exception:
            pass

    return result


def predict_batch(emails):
    model = load_model()

    df = pd.DataFrame(emails)
    predictions = model.predict(df)

    df["Predicted Classification"] = predictions

    return df


if __name__ == "__main__":
    test_email = {
        "subject": "Urgent deadline for assignment submission",
        "sender": "Professor ABC <abc@iitd.ac.in>",
        "body": "Please submit your assignment before 11:59 PM tonight.",
        "date": "",
        "urgency": "urgent"
    }

    result = predict_single_email(**test_email)

    print(result)