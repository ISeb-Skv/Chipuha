// ============================================================
// Чат: сообщения, контекстное меню, ответы, пагинация, кеширование
// ============================================================
import {
    getCurrentUser,
    getCurrentTime,
    generateId,
    loadHiddenMessages,
    saveHiddenMessages,
    loadCachedMessages,
    saveCachedMessages
} from './utils.js';
import { playNotificationSound } from './ui.js';
import { initAudioPlayer } from './audio.js';

let socket = null;
let currentUser = getCurrentUser();
let hiddenMessages = loadHiddenMessages();
let cachedMessages = loadCachedMessages();
let messageOffset = 0;
let hasMoreMessages = false;
let isLoadingMore = false;
let replyToId = null;

const messagesContainer = document.getElementById('messagesContainer');
const messagesWrapper = document.getElementById('messagesWrapper');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');

function isMessageHidden(id) {
    return hiddenMessages.includes(id);
}

// === Добавление сообщения ===
function addMessage(data, prepend = false) {
    if (data.id && isMessageHidden(data.id)) return;

    const div = document.createElement('div');
    div.className = 'message';
    if (data.id) {
        div.dataset.id = data.id;
    } else {
        data.id = generateId();
        div.dataset.id = data.id;
    }

    if (data.isSystem) {
        div.classList.add('system-message');
        div.innerHTML = `<div class="message-body"><em>${data.text}</em> <span class="time">${data.time}</span></div>`;
    } else {
        let headerHtml = `<div class="message-header">
            <span class="username">${data.username}</span>
            <span class="time">${data.time}</span>
        </div>`;
        let bodyHtml = '';

        let quotedHtml = '';
        if (data.quoted) {
            quotedHtml = `<div class="quoted-block" data-quote-id="${data.quoted.id || data.quoteId || ''}">
                <span class="quote-author">${data.quoted.username}</span>: ${data.quoted.text}
            </div>`;
        }

        if (data.isFile) {
            let isAudio = data.isAudio || false;
            let isImage = data.isImage || false;
            if (!isAudio && !isImage && data.filename) {
                const ext = data.filename.split('.').pop().toLowerCase();
                isAudio = ['webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext);
                isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
            }

            if (isAudio) {
                const audioId = 'audio_' + generateId();
                const displayDuration = data.duration || '0:00';
                bodyHtml = `<div class="message-body">
                    <div class="custom-audio-player" data-audio-id="${audioId}">
                        <button class="play-btn" data-audio-id="${audioId}">▶</button>
                        <div class="progress-container">
                            <div class="progress-bar" data-audio-id="${audioId}">
                                <div class="progress-fill" data-audio-id="${audioId}" style="width:0%"></div>
                            </div>
                            <span class="time-display" data-audio-id="${audioId}">${displayDuration}</span>
                        </div>
                    </div>
                    <audio id="${audioId}" src="${data.fileUrl}" preload="metadata" style="display:none;"></audio>
                </div>`;
                div.classList.add('file-message', 'message-audio');
                setTimeout(() => initAudioPlayer(audioId), 200);
            } else if (isImage) {
                bodyHtml = `<div class="message-body"><img src="${data.fileUrl}" alt="${data.filename}" title="${data.filename}"></div>`;
                div.classList.add('file-message');
            } else {
                bodyHtml = `<div class="message-body"><a href="${data.fileUrl}" class="file-link" target="_blank">📁 ${data.filename}</a></div>`;
                div.classList.add('file-message');
            }
        } else {
            bodyHtml = `<div class="message-body">${data.text}</div>`;
        }

        if (quotedHtml) {
            bodyHtml += quotedHtml;
        }

        div.innerHTML = headerHtml + bodyHtml;

        if (data.username.trim() === currentUser.trim()) {
            div.classList.add('my-message');
        }

        const isOwn = data.username.trim() === currentUser.trim();
        div.addEventListener('contextmenu', function (e) {
            showContextMenu(e, this.dataset.id, isOwn);
        });
    }

    if (prepend) {
        messagesContainer.prepend(div);
    } else {
        messagesContainer.appendChild(div);
    }

    if (!data.isSystem) {
        const existing = cachedMessages.findIndex(m => m.id === data.id);
        if (existing !== -1) {
            cachedMessages[existing] = data;
        } else {
            cachedMessages.push(data);
        }
        saveCachedMessages(cachedMessages);
    }
}

// === Контекстное меню ===
const contextMenu = document.getElementById('contextMenu');
let currentContextMessageId = null;

function showContextMenu(e, messageId, isOwn) {
    e.preventDefault();
    e.stopPropagation();
    currentContextMessageId = messageId;
    const replyItem = contextMenu.querySelector('[data-action="reply"]');
    const deleteAllItem = contextMenu.querySelector('[data-action="delete-all"]');
    const deleteSelfItem = contextMenu.querySelector('[data-action="delete-self"]');

    if (replyItem) replyItem.style.display = 'block';
    if (isOwn) {
        if (deleteAllItem) deleteAllItem.style.display = 'block';
        if (deleteSelfItem) deleteSelfItem.style.display = 'block';
    } else {
        if (deleteAllItem) deleteAllItem.style.display = 'none';
        if (deleteSelfItem) deleteSelfItem.style.display = 'none';
    }

    contextMenu.style.display = 'block';
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
}

contextMenu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function (e) {
        e.stopPropagation();
        const action = this.dataset.action;
        const messageId = currentContextMessageId;
        if (!messageId) {
            contextMenu.style.display = 'none';
            return;
        }
        contextMenu.style.display = 'none';

        if (action === 'reply') {
            replyToMessage(messageId);
        } else if (action === 'delete-all') {
            socket.emit('delete_message', { message_id: messageId });
        } else if (action === 'delete-self') {
            const msgElement = document.querySelector(`.message[data-id="${messageId}"]`);
            if (msgElement) {
                msgElement.remove();
                if (!hiddenMessages.includes(messageId)) {
                    hiddenMessages.push(messageId);
                    saveHiddenMessages(hiddenMessages);
                }
            }
        }
    });
});

// === Ответ на сообщение ===
function replyToMessage(messageId) {
    const msgElement = document.querySelector(`.message[data-id="${messageId}"]`);
    if (!msgElement) return;
    let quoteText = '';
    const username = msgElement.querySelector('.username')?.textContent || 'Пользователь';
    const body = msgElement.querySelector('.message-body');
    if (body) {
        const img = body.querySelector('img');
        if (img) {
            quoteText = `📷 Изображение от ${username}`;
        } else {
            const link = body.querySelector('.file-link');
            if (link) {
                quoteText = `📎 ${link.textContent.trim()}`;
            } else {
                const text = body.textContent.trim();
                if (text) {
                    const lines = text.split('\n');
                    quoteText = lines[0].substring(0, 60) + (lines[0].length > 60 ? '...' : '');
                    if (lines.length > 1) quoteText += ' …';
                }
            }
        }
    }
    if (!quoteText) quoteText = `Сообщение от ${username}`;

    const quoteBlock = document.getElementById('replyQuote');
    const quoteTextSpan = document.getElementById('quoteText');
    if (quoteTextSpan) {
        quoteTextSpan.innerHTML = `<span class="quote-author">${username}</span>: ${quoteText}`;
    }
    if (quoteBlock) quoteBlock.style.display = 'flex';
    replyToId = messageId;
    messageInput.focus();
}

// === Прокрутка к цитате ===
function highlightMessage(messageId) {
    const target = document.querySelector(`.message[data-id="${messageId}"]`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.backgroundColor = '#4a3a2a';
        target.style.transition = 'background-color 0.5s ease';
        setTimeout(() => {
            target.style.backgroundColor = '';
        }, 2000);
    } else {
        alert('Сообщение пока не загружено. Прокрутите вверх для загрузки истории.');
    }
}

// === Инициализация чата ===
export function initChat(socketInstance) {
    socket = socketInstance;

    socket.on('initial_messages', (msgs) => {
        if (cachedMessages.length > 0) {
            messagesContainer.innerHTML = '';
        }
        msgs.forEach(msg => {
            if (!msg.id) msg.id = generateId();
            addMessage(msg);
        });
        if (msgs.length >= 30) {
            loadMoreBtn.style.display = 'block';
            hasMoreMessages = true;
            messageOffset = msgs.length;
        } else {
            loadMoreBtn.style.display = 'none';
            hasMoreMessages = false;
        }
        messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
    });

    socket.on('message', (data) => {
        if (!data.id) data.id = generateId();
        const isOwn = data.username.trim() === currentUser.trim();
        addMessage(data);
        if (!data.isSystem && !isOwn) {
            if (document.hidden) {
                let unreadCount = parseInt(document.title.match(/\d+/)?.[0] || 0);
                document.title = `Чипуха (${unreadCount + 1})`;
            }
            playNotificationSound();
        }
        if (isOwn && !data.isSystem) {
            messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
        }
    });

    socket.on('message_deleted', (data) => {
        const msgId = data.id;
        const msgElement = document.querySelector(`.message[data-id="${msgId}"]`);
        if (msgElement) msgElement.remove();
        const index = hiddenMessages.indexOf(msgId);
        if (index !== -1) {
            hiddenMessages.splice(index, 1);
            saveHiddenMessages(hiddenMessages);
        }
        const cacheIdx = cachedMessages.findIndex(m => m.id === msgId);
        if (cacheIdx !== -1) {
            cachedMessages.splice(cacheIdx, 1);
            saveCachedMessages(cachedMessages);
        }
    });

    socket.on('load_more_result', (data) => {
        isLoadingMore = false;
        loadMoreBtn.classList.remove('active');
        const chunk = data.messages;
        if (chunk.length === 0) {
            hasMoreMessages = false;
            loadMoreBtn.style.display = 'none';
            return;
        }
        hasMoreMessages = data.has_more;
        messageOffset += chunk.length;
        for (let i = chunk.length - 1; i >= 0; i--) {
            const msg = chunk[i];
            if (!msg.id) msg.id = generateId();
            addMessage(msg, true);
        }
        if (!hasMoreMessages) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = messageInput.selectionStart;
            const end = messageInput.selectionEnd;
            messageInput.value = messageInput.value.substring(0, start) + '\t' + messageInput.value.substring(end);
            messageInput.selectionStart = messageInput.selectionEnd = start + 1;
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        }
    });

    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    messagesWrapper.addEventListener('scroll', () => {
        if (messagesWrapper.scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
            loadMoreMessages();
        }
    });
    loadMoreBtn.addEventListener('click', loadMoreMessages);

    document.getElementById('replyQuote')?.addEventListener('click', function (e) {
        if (e.target.classList.contains('quote-close')) return;
        if (replyToId) highlightMessage(replyToId);
    });

    document.addEventListener('click', function (e) {
        const quotedBlock = e.target.closest('.quoted-block');
        if (quotedBlock) {
            const quotedId = quotedBlock.dataset.quoteId;
            if (quotedId) highlightMessage(quotedId);
        }
    });

    if (cachedMessages.length > 0) {
        cachedMessages.forEach(msg => addMessage(msg));
        messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
    }

    function sendMessage() {
        let text = messageInput.value.trim();
        if (!text && !replyToId) return;

        let finalText = text;
        let quotedData = null;
        let quoteId = null;

        if (replyToId) {
            const quotedMsg = document.querySelector(`.message[data-id="${replyToId}"]`);
            if (quotedMsg) {
                const username = quotedMsg.querySelector('.username')?.textContent || 'Пользователь';
                const body = quotedMsg.querySelector('.message-body');
                let quote = '';
                if (body) {
                    const img = body.querySelector('img');
                    if (img) {
                        quote = '📷 Изображение';
                    } else {
                        const link = body.querySelector('.file-link');
                        if (link) {
                            quote = link.textContent.trim();
                        } else {
                            quote = body.textContent.trim().split('\n')[0];
                        }
                    }
                }
                quotedData = {
                    id: replyToId,
                    username: username,
                    text: quote || 'Сообщение'
                };
                quoteId = replyToId;
            }
            document.getElementById('replyQuote').style.display = 'none';
            replyToId = null;
        }

        if (!finalText && !quotedData) return;

        const msgData = {
            id: generateId(),
            username: currentUser,
            text: finalText || '',
            time: getCurrentTime(),
            isFile: false,
            isSystem: false,
            quoted: quotedData,
            quoteId: quoteId
        };
        socket.emit('message', msgData);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messageInput.focus();
    }

    function loadMoreMessages() {
        if (isLoadingMore || !hasMoreMessages) return;
        isLoadingMore = true;
        loadMoreBtn.classList.add('active');
        socket.emit('load_more', { offset: messageOffset });
    }

    return socket;
}