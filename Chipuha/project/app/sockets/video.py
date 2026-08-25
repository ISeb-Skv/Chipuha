from app.models.room_state import video_room, active_users
from app.utils.time import get_current_time
from app.extensions import socketio

def register_handlers(socketio):
    
    def emit_video_viewers():
        viewers = []
        for sid in video_room['viewers']:
            username = active_users.get(sid, 'Unknown')
            viewers.append({'sid': sid, 'username': username})
        socketio.emit('video_viewers_update', viewers)

    @socketio.on('video_join')
    def handle_video_join():
        from flask import request
        if request.sid not in video_room['viewers']:
            video_room['viewers'].append(request.sid)
        emit_video_viewers()
        if video_room['current_video']:
            socketio.emit('video_state', {
                'video_url': video_room['current_video'],
                'is_playing': video_room['is_playing'],
                'current_time': video_room['current_time']
            }, to=request.sid)
        if video_room['video_chat']:
            socketio.emit('video_chat_history', video_room['video_chat'][-20:], to=request.sid)
        if video_room['video_queue']:
            socketio.emit('video_queue_update', video_room['video_queue'], to=request.sid)

    @socketio.on('video_leave')
    def handle_video_leave():
        from flask import request
        if request.sid in video_room['viewers']:
            video_room['viewers'].remove(request.sid)
        emit_video_viewers()

    @socketio.on('video_load')
    def handle_video_load(data):
        video_url = data.get('video_url')
        if not video_url:
            return
        video_room['current_video'] = video_url
        video_room['is_playing'] = True
        video_room['current_time'] = 0
        socketio.emit('video_state', {
            'video_url': video_url,
            'is_playing': True,
            'current_time': 0
        })

    @socketio.on('video_sync')
    def handle_video_sync(data):
        from flask import request
        action = data.get('action')
        current_time = data.get('current_time', 0)
        if action == 'play':
            video_room['is_playing'] = True
        elif action == 'pause':
            video_room['is_playing'] = False
        socketio.emit('video_sync', {
            'action': action,
            'current_time': current_time
        }, skip_sid=request.sid)

    @socketio.on('video_chat_message')
    def handle_video_chat_message(data):
        from flask import session
        username = session.get('username', 'Unknown')
        text = data.get('text', '')
        msg = {'username': username, 'text': text, 'time': get_current_time()}
        video_room['video_chat'].append(msg)
        socketio.emit('video_chat_message', msg)

    @socketio.on('video_queue_update')
    def handle_video_queue_update(data):
        from flask import request
        video_room['video_queue'] = data
        socketio.emit('video_queue_update', data, skip_sid=request.sid)

    @socketio.on('video_queue_remove')
    def handle_video_queue_remove(data):
        index = data.get('index')
        if index is not None and 0 <= index < len(video_room['video_queue']):
            video_room['video_queue'].pop(index)
            socketio.emit('video_queue_remove', {'index': index})