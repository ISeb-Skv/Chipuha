import os

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-change-it'
    UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'uploads')
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024 * 1024  # 5 ГБ
    USERS_FILE = os.path.join(BASE_DIR, '..', 'users.json')
    MESSAGES_FILE = os.path.join(BASE_DIR, '..', 'messages.json')