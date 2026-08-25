from app.models.room_state import voice_room, voice_states, active_users
from app.extensions import socketio

def register_handlers(socketio):
    
    @socketio.on('voice_join')
    def handle_voice_join():
        from flask import request, session
        username = session.get('username')
        if not username:
            return
        voice_room[request.sid] = username
        voice_states[request.sid] = {'mic': False, 'headphones': False}
        emit_voice_room_users()
        socketio.emit('voice_user_joined', {
            'sid': request.sid,
            'username': username,
            'states': voice_states[request.sid]
        })

    @socketio.on('voice_state_update')
    def handle_voice_state_update(data):
        from flask import request
        sid = request.sid
        if sid in voice_states:
            mic = data.get('mic')
            headphones = data.get('headphones')
            if mic is not None:
                voice_states[sid]['mic'] = mic
            if headphones is not None:
                voice_states[sid]['headphones'] = headphones
            socketio.emit('voice_state_changed', {'sid': sid, 'states': voice_states[sid]})

    @socketio.on('voice_leave')
    def handle_voice_leave():
        from flask import request
        if request.sid in voice_room:
            username = voice_room[request.sid]
            del voice_room[request.sid]
            if request.sid in voice_states:
                del voice_states[request.sid]
            emit_voice_room_users()
            socketio.emit('voice_user_left', {'sid': request.sid, 'username': username})

    @socketio.on('voice_offer')
    def handle_voice_offer(data):
        from flask import request
        target_sid = data['target_sid']
        sdp = data['sdp']
        socketio.emit('voice_offer', {'from_sid': request.sid, 'sdp': sdp}, to=target_sid)

    @socketio.on('voice_answer')
    def handle_voice_answer(data):
        from flask import request
        target_sid = data['target_sid']
        sdp = data['sdp']
        socketio.emit('voice_answer', {'from_sid': request.sid, 'sdp': sdp}, to=target_sid)

    @socketio.on('voice_ice')
    def handle_voice_ice(data):
        from flask import request
        target_sid = data['target_sid']
        candidate = data['candidate']
        socketio.emit('voice_ice', {'from_sid': request.sid, 'candidate': candidate}, to=target_sid)

def emit_voice_room_users():
    participants = []
    for sid, username in voice_room.items():
        states = voice_states.get(sid, {'mic': False, 'headphones': False})
        participants.append({
            'sid': sid,
            'username': username,
            'states': states
        })
    socketio.emit('voice_room_users', participants)