// ============================================================
// Голосовой канал (WebRTC, управление микрофоном/наушниками)
// ============================================================
import {
    getCurrentUser,
    loadMicMuted,
    saveMicMuted,
    loadHeadphonesMuted,
    saveHeadphonesMuted,
    loadVolumes,
    saveVolumes
} from './utils.js';
import { showVolumeModal, getGlobalVolume } from './ui.js';

let socket = null;
let currentUser = getCurrentUser();
let micMuted = loadMicMuted();
let headphonesMuted = loadHeadphonesMuted();
let volumes = loadVolumes();
let globalVolume = getGlobalVolume();

let myStream = null;
let isInVoiceRoom = false;
let isJoining = false;
let peers = {};
let audioElements = {};

const voiceToggleBtn = document.getElementById('voiceToggleBtn');
const voiceParticipantsList = document.getElementById('voiceParticipants');
const micControlBtn = document.getElementById('micControlBtn');
const headphonesControlBtn = document.getElementById('headphonesControlBtn');
const selfControls = document.getElementById('selfControls');

// === Получение локального потока ===
async function getLocalStream() {
    if (!myStream) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia не поддерживается.');
        }
        try {
            myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (micMuted) {
                myStream.getAudioTracks().forEach(track => track.enabled = false);
            }
            analyzeOwnVoice(myStream);
        } catch (e) {
            throw new Error('Не удалось получить доступ к микрофону: ' + e.message);
        }
    }
    return myStream;
}

// === Анализ собственного голоса ===
function analyzeOwnVoice(stream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    let isSpeaking = false;
    let speakTimeout = null;

    function checkOwnVolume() {
        if (!isInVoiceRoom) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const threshold = 25;

        const li = document.querySelector(`.voice-participants li[data-sid="${socket.id}"]`);
        if (li) {
            if (avg > threshold && !micMuted) {
                if (!isSpeaking) {
                    isSpeaking = true;
                    li.classList.add('active-speaker');
                }
                if (speakTimeout) {
                    clearTimeout(speakTimeout);
                    speakTimeout = null;
                }
            } else {
                if (isSpeaking) {
                    if (!speakTimeout) {
                        speakTimeout = setTimeout(() => {
                            li.classList.remove('active-speaker');
                            isSpeaking = false;
                            speakTimeout = null;
                        }, 300);
                    }
                }
            }
        }
        requestAnimationFrame(checkOwnVolume);
    }
    setTimeout(checkOwnVolume, 500);
}

// === Управление микрофоном и наушниками ===
function toggleMic() {
    micMuted = !micMuted;
    saveMicMuted(micMuted);
    if (myStream) {
        myStream.getAudioTracks().forEach(track => track.enabled = !micMuted);
    }
    updateSelfControls();
    socket.emit('voice_state_update', { mic: micMuted, headphones: headphonesMuted });
}

function toggleHeadphones() {
    headphonesMuted = !headphonesMuted;
    saveHeadphonesMuted(headphonesMuted);
    for (let sid in audioElements) {
        const audio = audioElements[sid];
        if (audio) {
            const userVol = volumes[sid] !== undefined ? volumes[sid] : 1.0;
            audio.volume = globalVolume * userVol * (headphonesMuted ? 0 : 1);
        }
    }
    updateSelfControls();
    socket.emit('voice_state_update', { mic: micMuted, headphones: headphonesMuted });
}

function updateSelfControls() {
    if (micControlBtn) {
        micControlBtn.textContent = micMuted ? '🎤❌' : '🎤';
        micControlBtn.className = micMuted ? 'mic-btn muted' : 'mic-btn active';
    }
    if (headphonesControlBtn) {
        headphonesControlBtn.textContent = headphonesMuted ? '🎧❌' : '🎧';
        headphonesControlBtn.className = headphonesMuted ? 'headphones-btn muted' : 'headphones-btn active';
    }
}

// === Создание Peer-соединения ===
function createPeer(targetSid, initiator = false) {
    const stream = myStream;
    if (!stream) {
        console.error('Нет локального потока для создания peer');
        return;
    }

    if (peers[targetSid]) {
        peers[targetSid].destroy();
        delete peers[targetSid];
        if (audioElements[targetSid]) {
            audioElements[targetSid].pause();
            audioElements[targetSid].remove();
            delete audioElements[targetSid];
        }
    }

    const peer = new SimplePeer({
        initiator: initiator,
        trickle: true,
        stream: stream,
        config: { iceServers: [] }
    });

    peer.on('signal', (data) => {
        if (data.type === 'offer') {
            socket.emit('voice_offer', { target_sid: targetSid, sdp: data });
        } else if (data.type === 'answer') {
            socket.emit('voice_answer', { target_sid: targetSid, sdp: data });
        } else if (data.candidate) {
            socket.emit('voice_ice', { target_sid: targetSid, candidate: data });
        }
    });

    peer.on('stream', (remoteStream) => {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.srcObject = remoteStream;
        const userVol = volumes[targetSid] !== undefined ? volumes[targetSid] : 1.0;
        audio.volume = globalVolume * userVol * (headphonesMuted ? 0 : 1);
        audioElements[targetSid] = audio;
        document.body.appendChild(audio);
        audio.play().catch(e => console.warn('Автовоспроизведение заблокировано', e));

        // Анализ громкости для других участников
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(remoteStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        let isSpeaking = false;
        let speakTimeout = null;

        function checkVolume() {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const threshold = 25;
            const li = document.querySelector(`.voice-participants li[data-sid="${targetSid}"]`);
            if (li) {
                if (avg > threshold) {
                    if (!isSpeaking) {
                        isSpeaking = true;
                        li.classList.add('active-speaker');
                    }
                    if (speakTimeout) {
                        clearTimeout(speakTimeout);
                        speakTimeout = null;
                    }
                } else {
                    if (isSpeaking) {
                        if (!speakTimeout) {
                            speakTimeout = setTimeout(() => {
                                li.classList.remove('active-speaker');
                                isSpeaking = false;
                                speakTimeout = null;
                            }, 300);
                        }
                    }
                }
            }
            requestAnimationFrame(checkVolume);
        }
        setTimeout(checkVolume, 500);
    });

    peer.on('error', (err) => {
        console.error(`Peer error для ${targetSid}:`, err);
        if (peers[targetSid]) {
            peers[targetSid].destroy();
            delete peers[targetSid];
            if (audioElements[targetSid]) {
                audioElements[targetSid].pause();
                audioElements[targetSid].remove();
                delete audioElements[targetSid];
            }
        }
    });

    peer.on('close', () => {
        if (peers[targetSid]) {
            delete peers[targetSid];
        }
        if (audioElements[targetSid]) {
            audioElements[targetSid].pause();
            audioElements[targetSid].remove();
            delete audioElements[targetSid];
        }
    });

    peers[targetSid] = peer;
    return peer;
}

// === Вход/выход из голосового канала ===
async function joinVoiceRoom() {
    if (isInVoiceRoom) return;
    try {
        await getLocalStream();
        isInVoiceRoom = true;
        isJoining = true;
        voiceToggleBtn.textContent = 'Покинуть канал';
        voiceToggleBtn.classList.add('in-room');
        if (selfControls) selfControls.style.display = 'flex';
        socket.emit('voice_join');
        socket.emit('voice_state_update', { mic: micMuted, headphones: headphonesMuted });
    } catch (e) {
        alert('Не удалось войти в голосовой канал: ' + e.message);
    }
}

function leaveVoiceRoom() {
    if (!isInVoiceRoom) return;
    isInVoiceRoom = false;
    isJoining = false;
    voiceToggleBtn.textContent = 'Войти';
    voiceToggleBtn.classList.remove('in-room');
    if (selfControls) selfControls.style.display = 'none';

    for (let sid in peers) {
        peers[sid].destroy();
        delete peers[sid];
        if (audioElements[sid]) {
            audioElements[sid].pause();
            audioElements[sid].remove();
            delete audioElements[sid];
        }
    }
    peers = {};
    audioElements = {};

    if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
        myStream = null;
    }

    socket.emit('voice_leave');
    voiceParticipantsList.innerHTML = '';
}

voiceToggleBtn.addEventListener('click', () => {
    if (isInVoiceRoom) {
        leaveVoiceRoom();
    } else {
        joinVoiceRoom();
    }
});

micControlBtn.addEventListener('click', toggleMic);
headphonesControlBtn.addEventListener('click', toggleHeadphones);

// === Инициализация голосового модуля ===
export function initVoice(socketInstance) {
    socket = socketInstance;

    document.addEventListener('globalVolumeChanged', (e) => {
        globalVolume = e.detail.globalVolume;
        for (let sid in audioElements) {
            const audio = audioElements[sid];
            if (audio) {
                const userVol = volumes[sid] !== undefined ? volumes[sid] : 1.0;
                audio.volume = globalVolume * userVol * (headphonesMuted ? 0 : 1);
            }
        }
    });

    socket.on('voice_room_users', (participants) => {
        voiceParticipantsList.innerHTML = '';
        participants.forEach(p => {
            const li = document.createElement('li');
            li.dataset.sid = p.sid;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'participant-name';
            nameSpan.textContent = p.username;
            if (p.username === currentUser) {
                nameSpan.style.color = '#ff8c00';
                nameSpan.style.fontWeight = 'bold';
            }
            li.appendChild(nameSpan);

            const states = p.states || { mic: false, headphones: false };
            const statesDiv = document.createElement('span');
            statesDiv.className = 'participant-states';
            let micIcon = states.mic ? '🎤❌' : '🎤';
            let headIcon = states.headphones ? '🎧❌' : '🎧';
            statesDiv.innerHTML = `<span class="${states.mic ? 'state-muted' : ''}">${micIcon}</span><span class="${states.headphones ? 'state-muted' : ''}">${headIcon}</span>`;
            li.appendChild(statesDiv);

            if (p.sid !== socket.id) {
                const vol = volumes[p.sid] !== undefined ? Math.round(volumes[p.sid] * 100) : 100;
                const volIndicator = document.createElement('span');
                volIndicator.className = 'volume-indicator';
                volIndicator.textContent = `🔊 ${vol}%`;
                li.appendChild(volIndicator);

                li.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showVolumeModal(p.sid, p.username, volumes, audioElements);
                });
            } else {
                li.style.cursor = 'default';
            }

            voiceParticipantsList.appendChild(li);
        });

        if (isJoining && isInVoiceRoom) {
            participants.forEach(p => {
                if (p.sid !== socket.id && !peers[p.sid]) {
                    createPeer(p.sid, true);
                }
            });
            isJoining = false;
        }
    });

    socket.on('voice_state_changed', (data) => {
        const sid = data.sid;
        const states = data.states;
        const li = document.querySelector(`.voice-participants li[data-sid="${sid}"]`);
        if (li) {
            const statesDiv = li.querySelector('.participant-states');
            if (statesDiv) {
                let micIcon = states.mic ? '🎤❌' : '🎤';
                let headIcon = states.headphones ? '🎧❌' : '🎧';
                statesDiv.innerHTML = `<span class="${states.mic ? 'state-muted' : ''}">${micIcon}</span><span class="${states.headphones ? 'state-muted' : ''}">${headIcon}</span>`;
            }
        }
    });

    socket.on('voice_user_joined', (data) => {
        if (isInVoiceRoom && data.sid !== socket.id) {
            if (!peers[data.sid]) {
                createPeer(data.sid, false);
            }
        }
    });

    socket.on('voice_offer', (data) => {
        if (!isInVoiceRoom) return;
        const fromSid = data.from_sid;
        const sdp = data.sdp;
        if (fromSid === socket.id) return;
        if (!peers[fromSid]) {
            createPeer(fromSid, false);
        }
        const peer = peers[fromSid];
        if (peer) {
            peer.signal(sdp);
        }
    });

    socket.on('voice_answer', (data) => {
        const fromSid = data.from_sid;
        const sdp = data.sdp;
        if (fromSid === socket.id) return;
        const peer = peers[fromSid];
        if (peer) {
            peer.signal(sdp);
        }
    });

    socket.on('voice_ice', (data) => {
        const fromSid = data.from_sid;
        const candidate = data.candidate;
        if (fromSid === socket.id) return;
        const peer = peers[fromSid];
        if (peer) {
            peer.signal(candidate);
        }
    });

    socket.on('voice_user_left', (data) => {
        const sid = data.sid;
        if (peers[sid]) {
            peers[sid].destroy();
            delete peers[sid];
            if (audioElements[sid]) {
                audioElements[sid].pause();
                audioElements[sid].remove();
                delete audioElements[sid];
            }
        }
    });

    updateSelfControls();
    console.log('Voice module initialized');
}