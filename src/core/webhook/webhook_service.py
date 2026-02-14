from flask import Flask, request, jsonify, abort
import requests
import google.auth
from google.auth.transport.requests import Request
from dotenv import load_dotenv
import os
import logging
import hmac
import hashlib
import base64


# Load .env
load_dotenv()

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# ====== CONFIG FROM ENV ======
CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET")
PROJECT_ID = os.getenv("DF_PROJECT_ID")
AGENT_ID = os.getenv("DF_AGENT_ID")
LOCATION = os.getenv("DF_LOCATION", "global")
LANGUAGE_CODE = os.getenv("DF_LANGUAGE_CODE", "en")

# ====== Dialogflow helper ======
def get_access_token():
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    credentials.refresh(Request())
    return credentials.token


def detect_intent(session_id, text):
    access_token = get_access_token()

    url = (
        f"https://dialogflow.googleapis.com/v3/"
        f"projects/{PROJECT_ID}/locations/{LOCATION}/agents/{AGENT_ID}/"
        f"sessions/{session_id}:detectIntent"
    )

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    body = {
        "queryInput": {
            "text": {"text": text},
            "languageCode": LANGUAGE_CODE,
        }
    }

    r = requests.post(url, headers=headers, json=body)
    logging.info(f"DF response: {r.text}")

    data = r.json()

    try:
        return data["queryResult"]["responseMessages"][0]["text"]["text"][0]
    except Exception:
        return "Sorry, I couldn't understand."
    
def verify_line_signature(request):
    signature = request.headers.get("X-Line-Signature")

    # Allow LINE verify requests that may not include signature
    if not signature:
        return

    body = request.get_data(as_text=True)

    hash = hmac.new(
        CHANNEL_SECRET.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    computed_signature = base64.b64encode(hash).decode("utf-8")

    if signature != computed_signature:
        abort(400, description="Invalid LINE signature")


# ====== LINE webhook ======
@app.route("/webhook", methods=["POST"])
def webhook():
    verify_line_signature(request)

    body = request.get_json(silent=True) or {}
    logging.info(f"LINE body: {body}")

    for event in body.get("events", []):
        if event.get("type") != "message":
            continue

        if event["message"]["type"] != "text":
            continue

        user_text = event["message"]["text"]
        reply_token = event["replyToken"]
        user_id = event["source"]["userId"]

        bot_reply = detect_intent(user_id, user_text)

        reply_url = "https://api.line.me/v2/bot/message/reply"
        headers = {
            "Authorization": f"Bearer {CHANNEL_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }

        payload = {
            "replyToken": reply_token,
            "messages": [{"type": "text", "text": bot_reply}],
        }

        requests.post(reply_url, headers=headers, json=payload)

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(port=5000, debug=True)