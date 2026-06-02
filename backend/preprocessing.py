import re
import string
import emoji
import pandas as pd
from bs4 import BeautifulSoup

from sklearn.base import BaseEstimator, TransformerMixin


ABBREVIATIONS = {
    "asap": "as soon as possible",
    "fyi": "for your information",
    "pls": "please",
    "plz": "please",
    "dept": "department",
    "info": "information",
    "msg": "message",
    "u": "you",
    "ur": "your",
}


def remove_html(text):
    if pd.isna(text):
        return ""
    return BeautifulSoup(str(text), "html.parser").get_text(" ")


def clean_from(sender):
    if pd.isna(sender):
        return ""

    sender = str(sender)

    sender = re.sub(r"<.*?>", " ", sender)
    sender = re.sub(r"\S+@\S+", " ", sender)
    sender = re.sub(r"[^a-zA-Z\s]", " ", sender)
    sender = re.sub(r"\s+", " ", sender)

    return sender.strip()


def expand_abbreviations(text):
    words = text.split()
    expanded = [ABBREVIATIONS.get(word, word) for word in words]
    return " ".join(expanded)


def normalize_text(text):
    if pd.isna(text):
        return ""

    text = str(text)

    text = remove_html(text)
    text = emoji.demojize(text, delimiters=(" ", " "))
    text = text.lower()

    text = re.sub(r"http\S+|www\S+", " ", text)
    text = re.sub(r"\S+@\S+", " ", text)

    text = expand_abbreviations(text)

    text = text.translate(str.maketrans("", "", string.punctuation))
    text = re.sub(r"\d+", " ", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


class EmailPreprocessor(BaseEstimator, TransformerMixin):
    def __init__(self):
        pass

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        df = X.copy()

        required_cols = ["Subject", "From", "Body", "Urgency"]

        for col in required_cols:
            if col not in df.columns:
                df[col] = ""

        df["Subject"] = df["Subject"].apply(normalize_text)
        df["Body"] = df["Body"].apply(normalize_text)
        df["From"] = df["From"].apply(clean_from).apply(normalize_text)

        df["Urgency"] = df["Urgency"].fillna("").astype(str).apply(normalize_text)

        df["combined_text"] = (
            "subject: " + df["Subject"] + " "
            + "from: " + df["From"] + " "
            + "body: " + df["Body"] + " "
            + "urgency: " + df["Urgency"]
        )

        return df["combined_text"]