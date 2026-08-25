import json
import os
import uuid
from app.config import Config

MESSAGES_FILE = Config.MESSAGES_FILE

def load_messages():
    if os.path.exists(MESSAGES_FILE):
        try:
            with open(MESSAGES_FILE, 'r', encoding='utf-8') as f:
                msgs = json.load(f)
                for msg in msgs:
                    if 'id' not in msg:
                        msg['id'] = str(uuid.uuid4())
                return msgs
        except:
            return []
    return []

def save_messages(messages):
    with open(MESSAGES_FILE, 'w', encoding='utf-8') as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

messages = load_messages()