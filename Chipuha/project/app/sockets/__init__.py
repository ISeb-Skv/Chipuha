from . import chat, voice, video

def register_socket_handlers(socketio):
    chat.register_handlers(socketio)
    voice.register_handlers(socketio)
    video.register_handlers(socketio)