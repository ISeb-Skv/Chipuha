from app.models.message import messages, save_messages
from app.models.room_state import active_users, voice_room, voice_states, video_room
from app.utils.time import get_current_time
from app.extensions import socketio
import uuid

def register_handlers(socketio):
    
    @socketio.on('message')
    def handle_message(data):
        if 'time' not in data:
            data['time'] = get_current_time()
        data['isFile'] = False
        data['isSystem'] = False
        if 'id' not in data:
            data['id'] = str(uuid.uuid4())
        messages.append(data)
        save_messages(messages)
        socketio.emit('message', data)

    @socketio.on('connect')
    def handle_connect(auth=None):
        from flask import session, request
        username = session.get('username')
        if username:
            active_users[request.sid] = username
            socketio.emit('users_online', list(active_users.values()))
            limit = 30
            start = max(0, len(messages) - limit)
            chunk = messages[start:]
            socketio.emit('initial_messages', chunk, to=request.sid)

    @socketio.on('disconnect')
    def handle_disconnect():
        from flask import request
        if request.sid in active_users:
            del active_users[request.sid]
            socketio.emit('users_online', list(active_users.values()))
        if request.sid in voice_room:
            username = voice_room[request.sid]
            del voice_room[request.sid]
            if request.sid in voice_states:
                del voice_states[request.sid]
            # emit voice_user_left будет в voice.py
        if request.sid in video_room['viewers']:
            video_room['viewers'].remove(request.sid)
            # emit video_viewers_update будет в video.py

    @socketio.on('load_more')
    def handle_load_more(data):
        from flask import request
        offset = data.get('offset', 0)
        limit = 30
        total = len(messages)
        start = max(0, total - offset - limit)
        end = total - offset
        if end <= start:
            socketio.emit('load_more_result', {'messages': [], 'has_more': False}, to=request.sid)
            return
        chunk = messages[start:end]
        has_more = start > 0
        socketio.emit('load_more_result', {'messages': chunk, 'has_more': has_more}, to=request.sid)

    @socketio.on('delete_message')
    def handle_delete_message(data):
        from flask import request, session
        message_id = data.get('message_id')
        username = session.get('username')
        if not message_id or not username:
            return
        for i, msg in enumerate(messages):
            if msg.get('id') == message_id:
                if msg.get('username') == username:
                    del messages[i]
                    save_messages(messages)
                    socketio.emit('message_deleted', {'id': message_id})
                    return