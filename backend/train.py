import os
import joblib
import pandas as pd

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier, AdaBoostClassifier, BaggingClassifier

from preprocessing import EmailPreprocessor


_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(_CURRENT_DIR, "data", "train.csv")
MODEL_DIR = os.path.join(_CURRENT_DIR, "models")


def train_model(model_name):
    df = pd.read_csv(DATA_PATH)

    X = df[["Subject", "From", "Body", "Date", "Urgency"]]
    y = df["Classification"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    models = {
        "nb_bow": Pipeline([
            ("preprocessor", EmailPreprocessor()),
            ("vectorizer", CountVectorizer(max_features=10000, stop_words="english")),
            ("model", MultinomialNB())
        ]),

        "svm_tfidf": Pipeline([
            ("preprocessor", EmailPreprocessor()),
            ("vectorizer", TfidfVectorizer(max_features=15000, stop_words="english")),
            ("model", LinearSVC())
        ]),

        "random_forest_tfidf": Pipeline([
            ("preprocessor", EmailPreprocessor()),
            ("vectorizer", TfidfVectorizer(max_features=8000, stop_words="english")),
            ("model", RandomForestClassifier(n_estimators=200, random_state=42))
        ]),

        "adaboost_tfidf": Pipeline([
            ("preprocessor", EmailPreprocessor()),
            ("vectorizer", TfidfVectorizer(max_features=8000, stop_words="english")),
            ("model", AdaBoostClassifier(n_estimators=100, random_state=42))
        ]),

        "bagging_tfidf": Pipeline([
            ("preprocessor", EmailPreprocessor()),
            ("vectorizer", TfidfVectorizer(max_features=8000, stop_words="english")),
            ("model", BaggingClassifier(n_estimators=50, random_state=42))
        ])
    }

    pipeline = models[model_name]

    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)

    print("Model:", model_name)
    print("Accuracy:", accuracy_score(y_test, preds))
    print(classification_report(y_test, preds))

    os.makedirs(MODEL_DIR, exist_ok=True)

    model_path = os.path.join(MODEL_DIR, f"{model_name}.joblib")
    joblib.dump(pipeline, model_path)

    print(f"Model saved to: {model_path}")


if __name__ == "__main__":
    train_model("random_forest_tfidf")