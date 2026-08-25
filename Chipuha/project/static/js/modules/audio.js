// ============================================================
// Аудиоплеер и запись голосовых сообщений
// ============================================================
import { generateId } from './utils.js';
import { getGlobalVolume } from './ui.js';

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// === Кастомный аудиоплеер (исправлен: повторная инициализация) ===
export function initAudioPlayer(audioId, maxAttempts = 5) {
    let attempts = 0;

    function tryInit() {
        const audio = document.getElementById(audioId);
        if (!audio) {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryInit, 100);
                return;
            }
            console.warn('Audio element not found after', maxAttempts, 'attempts:', audioId);
            return;
        }

        const globalVol = getGlobalVolume();
        audio.volume = globalVol;
        audio.preload = 'metadata';

        const playBtn = document.querySelector(`.play-btn[data-audio-id="${audioId}"]`);
        const progressFill = document.querySelector(`.progress-fill[data-audio-id="${audioId}"]`);
        const progressBar = document.querySelector(`.progress-bar[data-audio-id="${audioId}"]`);
        const timeDisplay = document.querySelector(`.time-display[data-audio-id="${audioId}"]`);

        if (!playBtn || !progressFill || !progressBar || !timeDisplay) {
            console.warn('Audio player controls not found for:', audioId);
            return;
        }

        let isPlaying = false;
        let isDragging = false;

        function updateProgress() {
            if (audio.duration && isFinite(audio.duration)) {
                const percent = (audio.currentTime / audio.duration) * 100;
                progressFill.style.width = percent + '%';
                timeDisplay.textContent = formatDuration(audio.currentTime);
            }
            if (isPlaying && !isDragging) {
                requestAnimationFrame(updateProgress);
            }
        }

        playBtn.addEventListener('click', function () {
            if (audio.paused) {
                audio.play().catch(e => console.warn('Playback error:', e));
                isPlaying = true;
                playBtn.textContent = '⏹';
                updateProgress();
            } else {
                audio.pause();
                isPlaying = false;
                playBtn.textContent = '▶';
            }
        });

        audio.addEventListener('ended', function () {
            isPlaying = false;
            playBtn.textContent = '▶';
            progressFill.style.width = '0%';
            timeDisplay.textContent = formatDuration(audio.duration || 0);
        });

        audio.addEventListener('timeupdate', function () {
            if (audio.duration && isFinite(audio.duration) && !isDragging) {
                const percent = (audio.currentTime / audio.duration) * 100;
                progressFill.style.width = percent + '%';
                timeDisplay.textContent = formatDuration(audio.currentTime);
            }
        });

        const startDrag = (e) => {
            if (!audio.duration || !isFinite(audio.duration)) return;
            isDragging = true;
            const rect = progressBar.getBoundingClientRect();
            const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            audio.currentTime = x * audio.duration;
            updateProgress();
        };

        const moveDrag = (e) => {
            if (!isDragging || !audio.duration || !isFinite(audio.duration)) return;
            const rect = progressBar.getBoundingClientRect();
            const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            audio.currentTime = x * audio.duration;
            updateProgress();
        };

        const endDrag = () => {
            if (isDragging) {
                isDragging = false;
                if (isPlaying) updateProgress();
            }
        };

        progressBar.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('mouseup', endDrag);

        audio.addEventListener('loadedmetadata', function () {
            if (audio.duration && isFinite(audio.duration)) {
                timeDisplay.textContent = formatDuration(audio.duration);
            }
        });

        document.addEventListener('globalVolumeChanged', (e) => {
            audio.volume = e.detail.globalVolume;
        });
    }

    tryInit();
}

// === Запись голосовых сообщений (без изменений) ===
export function initVoiceRecording(uploadFile) {
    const voiceRecordBtn = document.getElementById('voiceRecordBtn');
    if (!voiceRecordBtn) return;

    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let hasRecordedAudio = false;
    let tempAudioContainer = document.getElementById('tempAudioContainer');
    let tempAudioElement = null;
    let tempAudioBlob = null;
    let stream = null;
    let mimeType = 'audio/webm';
    let recordStartTime = 0;

    const clearTempAudio = () => {
        if (tempAudioContainer) tempAudioContainer.innerHTML = '';
        if (tempAudioElement) {
            tempAudioElement.pause();
            tempAudioElement.src = '';
            tempAudioElement = null;
        }
        tempAudioBlob = null;
        hasRecordedAudio = false;
        voiceRecordBtn.classList.remove('recording', 'recording-stopped');
        isRecording = false;
        recordedChunks = [];
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try { mediaRecorder.stop(); } catch (e) { }
        }
        mediaRecorder = null;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    };

    voiceRecordBtn.addEventListener('click', async () => {
        if (hasRecordedAudio && !isRecording) {
            return;
        }

        if (isRecording) {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            isRecording = false;
            voiceRecordBtn.classList.remove('recording');
            voiceRecordBtn.classList.add('recording-stopped');
            return;
        }

        clearTempAudio();

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const types = ['audio/webm', 'audio/mp4', 'audio/ogg'];
            mimeType = 'audio/webm';
            for (const type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
            recordedChunks = [];
            recordStartTime = Date.now();

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const recordDuration = (Date.now() - recordStartTime) / 1000;
                console.log('⏱ Длительность записи:', recordDuration, 'секунд');

                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }

                if (recordedChunks.length === 0) {
                    clearTempAudio();
                    return;
                }

                const blob = new Blob(recordedChunks, { type: mimeType });

                if (blob.size === 0) {
                    clearTempAudio();
                    return;
                }

                tempAudioBlob = blob;
                hasRecordedAudio = true;

                const url = URL.createObjectURL(blob);
                tempAudioElement = document.createElement('audio');
                tempAudioElement.controls = false;
                tempAudioElement.src = url;
                tempAudioElement.preload = 'metadata';

                if (tempAudioContainer) {
                    tempAudioContainer.innerHTML = '';
                    const wrapper = document.createElement('div');
                    wrapper.className = 'temp-audio-player';

                    const playBtn = document.createElement('button');
                    playBtn.className = 'play-btn-temp';
                    playBtn.textContent = '▶';
                    playBtn.addEventListener('click', () => {
                        if (tempAudioElement.paused) {
                            tempAudioElement.play();
                            playBtn.textContent = '⏹';
                        } else {
                            tempAudioElement.pause();
                            playBtn.textContent = '▶';
                        }
                    });
                    tempAudioElement.addEventListener('ended', () => { playBtn.textContent = '▶'; });

                    const sendBtn = document.createElement('button');
                    sendBtn.textContent = '📤 Отправить';
                    sendBtn.style.background = '#5cb85c';
                    sendBtn.style.color = '#fff';
                    sendBtn.addEventListener('click', () => {
                        if (tempAudioBlob.size === 0) {
                            alert('Запись пустая!');
                            return;
                        }

                        const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
                        const file = new File([tempAudioBlob], 'voice_message.' + ext, { type: mimeType });

                        const durationFormatted = formatDuration(recordDuration);
                        console.log('📤 Отправка. Длительность:', durationFormatted);

                        uploadFile(file, durationFormatted);
                        clearTempAudio();
                    });

                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = '❌ Отменить';
                    cancelBtn.className = 'cancel-btn';
                    cancelBtn.addEventListener('click', clearTempAudio);

                    wrapper.appendChild(playBtn);
                    wrapper.appendChild(tempAudioElement);
                    wrapper.appendChild(sendBtn);
                    wrapper.appendChild(cancelBtn);
                    tempAudioContainer.appendChild(wrapper);
                }

                voiceRecordBtn.classList.remove('recording-stopped');
                isRecording = false;
                mediaRecorder = null;
            };

            mediaRecorder.start(500);
            isRecording = true;
            voiceRecordBtn.classList.add('recording');
            voiceRecordBtn.classList.remove('recording-stopped');
            console.log('🔴 Запись началась');
        } catch (err) {
            console.error('❌ Ошибка:', err);
            alert('Не удалось получить доступ к микрофону: ' + err.message);
        }
    });
}