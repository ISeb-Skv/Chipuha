from flask import Blueprint, request, jsonify, session, render_template, send_from_directory, current_app, redirect, url_for
from app.models.user import users, save_users
from app.models.message import messages, save_messages
from app.models.room_state import active_users, voice_room, voice_states, video_room
from app.extensions import socketio
from app.utils.time import get_current_time
from functools import wraps
import uuid
import os

main_bp = Blueprint('main', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

@main_bp.route('/')
@login_required
def index():
    return render_template('index.html', username=session['username'])

@main_bp.route('/change_nick', methods=['POST'])
@login_required
def change_nick():
    try:
        new_nick = request.form.get('new_nick')
        if not new_nick:
            return jsonify({'error': 'Новое имя не может быть пустым'}), 400
        old_nick = session['username']
        if new_nick in users and new_nick != old_nick:
            return jsonify({'error': 'Это имя уже занято'}), 400
        if new_nick == old_nick:
            return jsonify({'error': 'Это ваше текущее имя'}), 400
        if old_nick not in users:
            return jsonify({'error': 'Ваш аккаунт не найден.'}), 400

        user_data = users[old_nick]
        password_hash = user_data['password']
        previous_nicks = user_data.get('previous_nicks', [])
        if old_nick not in previous_nicks:
            previous_nicks.append(old_nick)
            if len(previous_nicks) > 5:
                previous_nicks = previous_nicks[-5:]

        users[new_nick] = {
            'password': password_hash,
            'previous_nicks': previous_nicks
        }
        del users[old_nick]
        save_users(users)

        for msg in messages:
            if msg.get('username') == old_nick and not msg.get('isSystem'):
                msg['username'] = new_nick
        save_messages(messages)

        session['username'] = new_nick

        for sid, username in list(active_users.items()):
            if username == old_nick:
                active_users[sid] = new_nick
        for sid, username in list(voice_room.items()):
            if username == old_nick:
                voice_room[sid] = new_nick

        system_msg = {
            'id': str(uuid.uuid4()),
            'username': 'Система',
            'text': f'Пользователь {old_nick} сменил имя на {new_nick}',
            'time': get_current_time(),
            'isSystem': True
        }
        messages.append(system_msg)
        save_messages(messages)
        socketio.emit('message', system_msg)

        socketio.emit('users_online', list(active_users.values()))
        from app.sockets.voice import emit_voice_room_users
        emit_voice_room_users()

        return jsonify({'success': True, 'new_nick': new_nick})
    except Exception as e:
        return jsonify({'error': 'Ошибка: ' + str(e)}), 500

@main_bp.route('/uploads/<filename>')
def uploaded_file(filename):
    upload_folder = current_app.config['UPLOAD_FOLDER']
    if not os.path.exists(upload_folder):
        return 'Upload folder not found', 404
    return send_from_directory(upload_folder, filename)

@main_bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
    if file:
        duration = request.form.get('duration', '0:00')
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        unique_name = str(uuid.uuid4()) + ('.' + ext if ext else '')
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        file_path = os.path.join(upload_folder, unique_name)
        file.save(file_path)
        if not os.path.exists(file_path):
            return 'Failed to save file', 500

        is_audio = ext in ['webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac']
        is_image = ext in ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']

        msg = {
            'id': str(uuid.uuid4()),
            'username': session['username'],
            'filename': file.filename,
            'fileUrl': f"/uploads/{unique_name}",
            'time': get_current_time(),
            'isFile': True,
            'isAudio': is_audio,
            'isImage': is_image,
            'isSystem': False,
            'duration': duration
        }
        messages.append(msg)
        save_messages(messages)
        socketio.emit('message', msg)
        return '', 204
    return 'Ошибка загрузки', 500

@main_bp.route('/get_nick_history/<username>')
@login_required
def get_nick_history(username):
    if username not in users:
        return jsonify({'error': 'Пользователь не найден'}), 404
    history = users[username].get('previous_nicks', [])
    return jsonify({'history': history})