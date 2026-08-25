import { initUI } from './modules/ui.js';
import { getGlobalVolume } from './modules/ui.js';
import { initVoiceRecording } from './modules/audio.js';
import { initChat } from './modules/chat.js';
import { initVoice } from './modules/voice.js';
import { initVideoRoom } from './modules/video.js';
import { getCurrentUser } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const currentUser = getCurrentUser();
    console.log('Текущий пользователь:', currentUser);

    initUI();

    window.socket = io();
    const socket = window.socket;

    initChat(socket);
    initVoice(socket);
    initVideoRoom(socket);

    const uploadFile = (file, duration) => {
        if (file.size > 5 * 1024 * 1024 * 1024) {
            alert('Файл слишком большой. Максимальный размер 5 ГБ.');
            return;
        }

        const uploadProgress = document.getElementById('uploadProgress');
        const uploadProgressBar = document.getElementById('uploadProgressBar');
        const uploadPercent = document.getElementById('uploadPercent');
        const uploadFileName = document.getElementById('uploadFileName');

        if (uploadProgress) uploadProgress.style.display = 'flex';
        if (uploadFileName) uploadFileName.textContent = 'Загрузка: ' + file.name;
        if (uploadProgressBar) uploadProgressBar.value = 0;
        if (uploadPercent) uploadPercent.textContent = '0%';

        const formData = new FormData();
        formData.append('file', file);
        if (duration) formData.append('duration', duration);

        fetch('/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Статус ${response.status}: ${text}`);
                    });
                }
                if (uploadProgress) uploadProgress.style.display = 'none';
            })
            .catch(err => {
                alert('Ошибка загрузки: ' + err.message);
                if (uploadProgress) uploadProgress.style.display = 'none';
            });
    };

    initVoiceRecording(uploadFile);

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files.length === 0) return;
            uploadFile(this.files[0]);
            this.value = '';
        });
    }

    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            chatContainer.classList.add('drag-over');
        });
        chatContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            chatContainer.classList.remove('drag-over');
        });
        chatContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            chatContainer.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadFile(files[0]);
            }
        });
    }

    document.getElementById('changeNickBtn')?.addEventListener('click', function () {
        const newNick = document.getElementById('newNickInput').value.trim();
        if (!newNick) {
            alert('Введите новый ник');
            return;
        }
        if (newNick === currentUser) {
            alert('Это ваше текущее имя');
            return;
        }
        fetch('/change_nick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'new_nick=' + encodeURIComponent(newNick)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Ник успешно изменён! Страница будет обновлена.');
                    location.reload();
                } else {
                    alert('Ошибка: ' + data.error);
                }
            })
            .catch(err => alert('Ошибка: ' + err));
    });

    socket.on('users_online', (users) => {
        const list = document.getElementById('onlineUsers');
        if (!list) return;
        list.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user;
            li.addEventListener('click', () => {
                import('./modules/ui.js').then(module => {
                    module.showNickHistory(user);
                });
            });
            list.appendChild(li);
        });
    });
});