// ============================================================
// Управление интерфейсом (модалки, громкость, уведомления, кнопки)
// ============================================================
import {
    getCurrentUser,
    loadGlobalVolume,
    saveGlobalVolume,
    loadVolumes,
    saveVolumes
} from './utils.js';

let currentUser = getCurrentUser();
let volumes = loadVolumes();
let globalVolume = loadGlobalVolume();
let soundEnabled = true; // глобальная переменная

// === Модалка истории ников ===
export function initUI() {
    // Глобальная громкость – применяется ко всему
    const slider = document.getElementById('globalVolumeSlider');
    const label = document.getElementById('globalVolumeLabel');
    if (slider && label) {
        slider.value = Math.round(globalVolume * 100);
        label.textContent = Math.round(globalVolume * 100) + '%';
        slider.addEventListener('input', function () {
            globalVolume = parseInt(this.value) / 100;
            saveGlobalVolume(globalVolume);
            label.textContent = Math.round(globalVolume * 100) + '%';
            // Применяем ко всем аудио-элементам
            document.dispatchEvent(new CustomEvent('globalVolumeChanged', { detail: { globalVolume } }));
            // Также применяем к аудиоплеерам в чате
            document.querySelectorAll('audio').forEach(audio => {
                if (!audio.dataset.userSid) { // не голосовой канал
                    audio.volume = globalVolume;
                }
            });
        });
    }

    // Кнопка уведомлений (колокольчик)
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
        soundBtn.addEventListener('click', function () {
            soundEnabled = !soundEnabled;
            this.textContent = soundEnabled ? '🔔' : '🔕';
        });
        // Устанавливаем начальное состояние
        soundBtn.textContent = soundEnabled ? '🔔' : '🔕';
    }

    // Модалка истории ников
    const modal = document.getElementById('nickHistoryModal');
    const closeModalBtn = document.getElementById('closeHistoryModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Модалка громкости участника
    const volumeModal = document.getElementById('volumeModal');
    const closeVolumeBtn = document.getElementById('closeVolumeModal');
    if (closeVolumeBtn) {
        closeVolumeBtn.addEventListener('click', () => volumeModal.classList.remove('active'));
    }
    volumeModal.addEventListener('click', (e) => {
        if (e.target === volumeModal) volumeModal.classList.remove('active');
    });

    // Контекстное меню
    const contextMenu = document.getElementById('contextMenu');
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });
    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.context-menu')) {
            contextMenu.style.display = 'none';
        }
    });

    // Кнопка прикрепления файла
    const fileUploadBtn = document.getElementById('fileUploadBtn');
    const fileInput = document.getElementById('fileInput');
    if (fileUploadBtn && fileInput) {
        fileUploadBtn.addEventListener('click', () => fileInput.click());
    }

    // Закрытие цитаты
    const quoteClose = document.getElementById('quoteClose');
    if (quoteClose) {
        quoteClose.addEventListener('click', function () {
            document.getElementById('replyQuote').style.display = 'none';
            window.replyToId = null;
        });
    }

    console.log('UI initialized');
}

// === Отображение истории ников (исправлен URL) ===
export function showNickHistory(username) {
    const modal = document.getElementById('nickHistoryModal');
    const title = document.getElementById('historyModalTitle');
    const list = document.getElementById('historyList');
    if (!modal || !title || !list) return;

    title.textContent = `История ников: ${username}`;
    list.innerHTML = '<li class="no-history">Загрузка...</li>';
    modal.classList.add('active');

    fetch(`/api/get_nick_history/${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                list.innerHTML = `<li class="no-history">${data.error}</li>`;
                return;
            }
            const history = data.history || [];
            if (history.length === 0) {
                list.innerHTML = '<li class="no-history">Нет предыдущих ников</li>';
            } else {
                list.innerHTML = history.map(nick => `<li>${nick}</li>`).join('');
            }
        })
        .catch(() => {
            list.innerHTML = '<li class="no-history">Ошибка загрузки</li>';
        });
}

// === Модалка громкости участника ===
export function showVolumeModal(sid, username, volumes, audioElements) {
    const modal = document.getElementById('volumeModal');
    const title = document.getElementById('volumeModalTitle');
    const slider = document.getElementById('volumeSlider');
    const label = document.getElementById('volumeLabel');
    if (!modal || !title || !slider || !label) return;

    title.textContent = `Громкость: ${username}`;
    const currentVol = volumes[sid] !== undefined ? volumes[sid] : 1.0;
    const percent = Math.round(currentVol * 100);
    slider.value = percent;
    label.textContent = percent + '%';

    modal.dataset.sid = sid;
    modal.classList.add('active');

    slider.oninput = function () {
        const val = parseInt(this.value);
        label.textContent = val + '%';
        const vol = val / 100;
        if (modal.dataset.sid) {
            volumes[modal.dataset.sid] = vol;
            saveVolumes(volumes);
            if (audioElements && audioElements[modal.dataset.sid]) {
                const audio = audioElements[modal.dataset.sid];
                const globalVol = globalVolume;
                const headphonesMuted = window.headphonesMuted || false;
                audio.volume = vol * globalVol * (headphonesMuted ? 0 : 1);
            }
            const li = document.querySelector(`.voice-participants li[data-sid="${modal.dataset.sid}"]`);
            if (li) {
                const indicator = li.querySelector('.volume-indicator');
                if (indicator) {
                    indicator.textContent = `🔊 ${val}%`;
                }
            }
        }
    };
}

// === Уведомления (исправлено: используется глобальная переменная) ===
export function playNotificationSound() {
    if (!soundEnabled) return;
    try {
        let audioCtx = window.__audioCtx;
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            window.__audioCtx = audioCtx;
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => playBeep(audioCtx)).catch(e => console.warn(e));
        } else {
            playBeep(audioCtx);
        }
    } catch (e) {
        console.warn('Web Audio не поддерживается', e);
    }
}

function playBeep(audioCtx) {
    try {
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 800;
        gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(audioCtx.currentTime);
        osc1.stop(audioCtx.currentTime + 0.1);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1000;
        gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(audioCtx.currentTime + 0.12);
        osc2.stop(audioCtx.currentTime + 0.22);
    } catch (e) {
        console.warn('Ошибка воспроизведения звука:', e);
    }
}

export function getGlobalVolume() { return globalVolume; }
export function setGlobalVolume(val) { globalVolume = val; }
export function getVolumes() { return volumes; }
export function setVolumes(v) { volumes = v; }