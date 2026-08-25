from flask import Flask, redirect, request
from app.config import Config
from app.extensions import socketio
from app.routes import register_blueprints
from app.sockets import register_socket_handlers
from app.utils.file_cleaner import clean_old_files
import os

def create_app():
    app = Flask(__name__,
                template_folder='../templates',
                static_folder='../static')
    app.config.from_object(Config)

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Используем threading для простоты
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')

    register_blueprints(app)
    register_socket_handlers(socketio)

    clean_old_files(app.config['UPLOAD_FOLDER'])

    # Временно отключаем редирект на HTTPS для теста
    # @app.before_request
    # def before_request():
    #     if not request.is_secure:
    #         url = request.url.replace('http://', 'https://', 1)
    #         return redirect(url, code=301)

    return app