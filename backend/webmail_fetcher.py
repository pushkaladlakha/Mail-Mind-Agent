import os
import email
from dotenv import load_dotenv
from imapclient import IMAPClient
from email.header import decode_header
from bs4 import BeautifulSoup


load_dotenv()


IMAP_SERVER = os.getenv("IMAP_SERVER")
IMAP_PORT = int(os.getenv("IMAP_PORT", 993))
WEBMAIL_EMAIL = os.getenv("WEBMAIL_EMAIL")
WEBMAIL_PASSWORD = os.getenv("WEBMAIL_PASSWORD")


def decode_mime_words(value):
    if not value:
        return ""

    decoded_parts = decode_header(value)
    result = ""

    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            result += part.decode(encoding or "utf-8", errors="ignore")
        else:
            result += part

    return result


def extract_body(msg):
    body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if "attachment" in content_disposition:
                continue

            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue

                text = payload.decode(errors="ignore")

                if content_type == "text/plain":
                    body += text + " "

                elif content_type == "text/html":
                    body += BeautifulSoup(text, "html.parser").get_text(" ") + " "

            except Exception:
                continue

    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode(errors="ignore")

    return body.strip()


def fetch_latest_emails(limit=10, unread_only=False):
    emails = []

    with IMAPClient(IMAP_SERVER, port=IMAP_PORT, ssl=True) as client:
        client.login(WEBMAIL_EMAIL, WEBMAIL_PASSWORD)
        client.select_folder("INBOX")

        if unread_only:
            message_ids = client.search(["UNSEEN"])
        else:
            message_ids = client.search(["ALL"])

        message_ids = message_ids[-limit:]

        messages = client.fetch(message_ids, ["RFC822"])

        for msg_id, data in messages.items():
            raw_email = data[b"RFC822"]
            msg = email.message_from_bytes(raw_email)

            subject = decode_mime_words(msg.get("Subject"))
            sender = decode_mime_words(msg.get("From"))
            date = msg.get("Date", "")
            body = extract_body(msg)

            emails.append({
                "Subject": subject,
                "From": sender,
                "Body": body,
                "Date": date,
                "Urgency": infer_urgency(subject, body)
            })

    return emails


def infer_urgency(subject, body):
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


if __name__ == "__main__":
    mails = fetch_latest_emails(limit=5, unread_only=False)

    for mail in mails:
        print("=" * 80)
        print("Subject:", mail["Subject"])
        print("From:", mail["From"])
        print("Date:", mail["Date"])
        print("Urgency:", mail["Urgency"])
        print("Body:", mail["Body"][:500])