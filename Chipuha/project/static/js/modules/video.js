// ============================================================
// Видео-комната – с корректным ресайзом по всем сторонам
// ============================================================

let videoWindow = null;
let isVideoInitialized = false;

export function initVideoRoom(socket) {
    if (isVideoInitialized) {
        console.warn('⚠️ Видео-комната уже инициализирована');
        return;
    }

    const videoRoomToggle = document.getElementById('videoRoomToggle');
    if (!videoRoomToggle) {
        console.warn('⚠️ Кнопка видео-комнаты не найдена');
        return;
    }

    // Удаляем старое окно, если оно есть
    const oldWindow = document.getElementById('video-window');
    if (oldWindow) {
        oldWindow.remove();
        console.log('🗑 Старое видео-окно удалено');
    }

    // --- Создаём окно с полным HTML-контентом ---
    videoWindow = document.createElement('div');
    videoWindow.id = 'video-window';
    videoWindow.style.cssText = `
        position:fixed;
        top:50px;
        left:50px;
        width:800px;
        height:600px;
        min-width:400px;
        min-height:300px;
        max-width:calc(100vw - 20px);
        max-height:calc(100vh - 20px);
        background:#1a1a1a;
        border-radius:12px;
        box-shadow:0 8px 30px rgba(0,0,0,0.7);
        z-index:99999;
        display:none !important;
        flex-direction:column;
        overflow:hidden;
        border:2px solid #444;
        resize:both;
    `;

    videoWindow.innerHTML = `
        <div id="videoHeader" style="background:#2a2a2a;color:white;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;cursor:grab;user-select:none;min-height:40px;flex-shrink:0;border-radius:10px 10px 0 0;">
            <span style="pointer-events:none;font-size:14px;">🎬 Видео комната</span>
            <div style="display:flex;gap:4px;flex-shrink:0;">
                <button id="videoNextBtn" style="background:#FF9800;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;">⏭</button>
                <button id="videoQueueBtn" style="background:#444;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;">📋</button>
                <button id="videoToggleSidebarBtn" style="background:#444;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;">👥</button>
                <button id="videoHistoryBtn" style="background:#444;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;">📜</button>
                <button id="videoFullscreenBtn" style="background:#444;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;">⛶</button>
                <button id="videoCloseBtn" style="background:#444;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;">✕</button>
            </div>
        </div>
        <div style="display:flex;flex:1;min-height:0;">
            <div style="flex:3;display:flex;flex-direction:column;min-width:0;">
                <div id="video-container" style="flex:1;display:flex;align-items:center;justify-content:center;background:#000;min-height:0;overflow:hidden;">
                    <div style="color:#888;text-align:center;"><h3 style="color:#fff;">Нет видео</h3><p>Вставьте ссылку</p></div>
                </div>
                <div style="background:#2a2a2a;padding:6px;display:flex;gap:4px;border-top:1px solid #444;align-items:center;flex-wrap:wrap;border-radius:0 0 10px 10px;">
                    <input type="text" id="video-url-input" placeholder="Ссылка..." style="flex:1;min-width:80px;padding:6px 8px;border:1px solid #444;border-radius:4px;background:#333;color:white;font-size:12px;">
                    <button id="videoLoadBtn" style="background:#4CAF50;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:14px;">▶</button>
                    <button id="videoAddToQueueBtn" style="background:#FF9800;color:white;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;">+📋</button>
                </div>
            </div>
            <div id="video-sidebar" style="flex:1;display:flex;flex-direction:column;border-left:1px solid #444;min-width:150px;max-width:250px;background:#1a1a1a;">
                <div style="background:#2a2a2a;color:white;padding:6px 10px;font-size:12px;">👁 Зрители</div>
                <div id="video-viewers-list" style="padding:5px;font-size:11px;color:#ccc;flex:1;overflow-y:auto;"></div>
                <div style="background:#2a2a2a;color:white;padding:6px 10px;font-size:12px;border-top:1px solid #444;">💬 Чат</div>
                <div id="video-chat-messages" style="flex:1;padding:5px;font-size:11px;color:#ccc;overflow-y:auto;max-height:120px;"></div>
                <div style="padding:5px;display:flex;gap:3px;border-top:1px solid #444;">
                    <input type="text" id="video-chat-input" placeholder="Сообщение..." style="flex:1;padding:5px;border:1px solid #444;border-radius:3px;background:#333;color:white;font-size:11px;">
                    <button id="video-chat-send" style="background:#4CAF50;color:white;border:none;padding:5px 8px;border-radius:3px;cursor:pointer;font-size:12px;">➤</button>
                </div>
            </div>
        </div>
        <div id="video-queue-panel" style="display:none;position:absolute;top:40px;right:0;width:280px;max-height:300px;background:#1a1a1a;border:1px solid #444;overflow-y:auto;z-index:100;">
            <div style="background:#2a2a2a;color:white;padding:8px;font-size:13px;position:sticky;top:0;display:flex;justify-content:space-between;">
                <span>📋 Очередь</span>
                <button id="videoNextFromQueueBtn" style="background:#FF9800;color:white;border:none;padding:3px 8px;border-radius:3px;cursor:pointer;">⏭</button>
            </div>
            <div id="video-queue-list" style="padding:5px;"></div>
        </div>
        <div id="video-history-panel" style="display:none;position:absolute;top:40px;right:0;width:250px;max-height:300px;background:#1a1a1a;border:1px solid #444;overflow-y:auto;z-index:100;">
            <div style="background:#2a2a2a;color:white;padding:8px;font-size:13px;position:sticky;top:0;">📜 История</div>
            <div id="video-history-list" style="padding:5px;"></div>
        </div>
        <!-- Ручки для изменения размера -->
        <div class="resize-handle resize-top" style="position:absolute;top:-5px;left:0;right:0;height:10px;cursor:ns-resize;z-index:11;"></div>
        <div class="resize-handle resize-bottom" style="position:absolute;bottom:-5px;left:0;right:0;height:10px;cursor:ns-resize;z-index:11;"></div>
        <div class="resize-handle resize-left" style="position:absolute;left:-5px;top:0;bottom:0;width:10px;cursor:ew-resize;z-index:11;"></div>
        <div class="resize-handle resize-right" style="position:absolute;right:-5px;top:0;bottom:0;width:10px;cursor:ew-resize;z-index:11;"></div>
        <div class="resize-handle resize-top-left" style="position:absolute;top:-5px;left:-5px;width:15px;height:15px;cursor:nwse-resize;z-index:11;"></div>
        <div class="resize-handle resize-top-right" style="position:absolute;top:-5px;right:-5px;width:15px;height:15px;cursor:nesw-resize;z-index:11;"></div>
        <div class="resize-handle resize-bottom-left" style="position:absolute;bottom:-5px;left:-5px;width:15px;height:15px;cursor:nesw-resize;z-index:11;"></div>
        <div class="resize-handle resize-bottom-right" style="position:absolute;bottom:-5px;right:-5px;width:15px;height:15px;cursor:nwse-resize;z-index:11;"></div>
    `;

    document.body.appendChild(videoWindow);

    // Принудительное скрытие
    videoWindow.style.display = 'none';
    videoWindow.style.visibility = 'hidden';
    videoWindow.style.opacity = '0';
    videoWindow.setAttribute('style', videoWindow.getAttribute('style') + '; display:none !important; visibility:hidden !important; opacity:0 !important;');

    console.log('✅ Видео-окно создано и скрыто (двойная защита)');

    // ---- DOM-элементы ----
    const videoCloseBtn = document.getElementById('videoCloseBtn');
    const videoFullscreenBtn = document.getElementById('videoFullscreenBtn');
    const videoNextBtn = document.getElementById('videoNextBtn');
    const videoToggleSidebarBtn = document.getElementById('videoToggleSidebarBtn');
    const videoQueueBtn = document.getElementById('videoQueueBtn');
    const videoQueuePanel = document.getElementById('video-queue-panel');
    const videoQueueList = document.getElementById('video-queue-list');
    const videoNextFromQueueBtn = document.getElementById('videoNextFromQueueBtn');
    const videoHistoryBtn = document.getElementById('videoHistoryBtn');
    const videoHistoryPanel = document.getElementById('video-history-panel');
    const videoHistoryList = document.getElementById('video-history-list');
    const videoSidebar = document.getElementById('video-sidebar');
    const videoLoadBtn = document.getElementById('videoLoadBtn');
    const videoAddToQueueBtn = document.getElementById('videoAddToQueueBtn');
    const videoUrlInput = document.getElementById('video-url-input');
    const videoContainer = document.getElementById('video-container');
    const videoViewersList = document.getElementById('video-viewers-list');
    const videoChatMessages = document.getElementById('video-chat-messages');
    const videoChatInput = document.getElementById('video-chat-input');
    const videoChatSend = document.getElementById('video-chat-send');
    const videoHeader = document.getElementById('videoHeader');

    // ---- Состояние ----
    let videoRoomActive = false;
    let isFullscreen = false;
    let isSidebarVisible = true;
    let isHistoryVisible = false;
    let isQueueVisible = false;
    let currentVideoElement = null;
    let videoQueue = [];
    let isVideoPlaying = true;
    let lastKnownTime = 0;
    let syncInProgress = false;
    let syncInterval = null;
    let currentVideoUrl = null;
    let currentVideoTime = 0;

    let videoHistoryData = [];
    try { videoHistoryData = JSON.parse(localStorage.getItem('video_history') || '[]'); } catch (e) { }

    function saveHistory() {
        try { localStorage.setItem('video_history', JSON.stringify(videoHistoryData)); } catch (e) { }
    }

    // ---- Вспомогательные функции ----
    function getVideoInfo(url) {
        if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            let id = null;
            if (url.includes('youtube.com/watch')) {
                try { id = new URL(url).searchParams.get('v'); } catch (e) { }
            } else {
                id = url.split('youtu.be/')[1].split('?')[0];
            }
            return { type: 'youtube', id, title: '', thumb: `https://img.youtube.com/vi/${id}/mqdefault.jpg` };
        }
        return null;
    }

    function getYouTubeTitle(videoId, callback) {
        fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
            .then(res => res.json())
            .then(data => callback(data.title))
            .catch(() => callback('YouTube видео'));
    }

    function displayVideo(url, time) {
        const info = getVideoInfo(url);
        if (!info) return;
        if (currentVideoElement) {
            currentVideoElement.remove();
            currentVideoElement = null;
        }
        currentVideoUrl = url;
        currentVideoElement = document.createElement('iframe');
        currentVideoElement.src = `https://www.youtube.com/embed/${info.id}?autoplay=1&enablejsapi=1`;
        currentVideoElement.allow = 'autoplay';
        currentVideoElement.allowFullscreen = true;
        currentVideoElement.style.cssText = 'width:100%;height:100%;border:none;';
        videoContainer.innerHTML = '';
        videoContainer.appendChild(currentVideoElement);
        isVideoPlaying = true;
        lastKnownTime = time || 0;

        if (time && time > 0) {
            setTimeout(() => {
                if (currentVideoElement) {
                    currentVideoElement.contentWindow.postMessage(JSON.stringify({
                        event: 'command', func: 'seekTo', args: [time, true]
                    }), '*');
                }
            }, 1000);
        }

        getYouTubeTitle(info.id, function (title) {
            info.title = title;
            const exists = videoHistoryData.some(h => h.videoId === info.id);
            if (!exists) {
                videoHistoryData.unshift({ url, videoId: info.id, title: info.title, thumb: info.thumb });
                if (videoHistoryData.length > 10) videoHistoryData = videoHistoryData.slice(0, 10);
                saveHistory();
                renderHistory();
            }
        });
    }

    function renderQueue() {
        videoQueueList.innerHTML = '';
        if (videoQueue.length === 0) {
            videoQueueList.innerHTML = '<div style="color:#666;font-size:11px;padding:10px;">Очередь пуста</div>';
            return;
        }
        videoQueue.forEach((item, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;gap:6px;padding:5px;border-bottom:1px solid #333;align-items:center;';
            if (item.thumb) {
                const img = document.createElement('img');
                img.src = item.thumb;
                img.style.cssText = 'width:60px;height:34px;object-fit:cover;border-radius:3px;flex-shrink:0;';
                div.appendChild(img);
            }
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = 'font-size:11px;color:#fff;flex:1;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            titleDiv.textContent = (index + 1) + '. ' + (item.title || 'YouTube видео');
            titleDiv.addEventListener('click', function () {
                socket.emit('video_queue_remove', { index: index });
                displayVideo(item.url);
                socket.emit('video_load', { video_url: item.url });
            });
            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.style.cssText = 'background:#d9534f;color:white;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;flex-shrink:0;';
            delBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                socket.emit('video_queue_remove', { index: index });
            });
            div.appendChild(titleDiv);
            div.appendChild(delBtn);
            videoQueueList.appendChild(div);
        });
    }

    function renderHistory() {
        videoHistoryList.innerHTML = '';
        if (videoHistoryData.length === 0) {
            videoHistoryList.innerHTML = '<div style="color:#666;font-size:11px;padding:10px;">История пуста</div>';
            return;
        }
        videoHistoryData.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;gap:6px;padding:5px;cursor:pointer;border-bottom:1px solid #333;align-items:center;';
            div.addEventListener('click', function () {
                displayVideo(item.url);
                socket.emit('video_load', { video_url: item.url });
            });
            if (item.thumb) {
                const img = document.createElement('img');
                img.src = item.thumb;
                img.style.cssText = 'width:60px;height:34px;object-fit:cover;border-radius:3px;flex-shrink:0;';
                div.appendChild(img);
            }
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = 'font-size:11px;color:#fff;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            titleDiv.textContent = item.title || 'YouTube видео';
            div.appendChild(titleDiv);
            videoHistoryList.appendChild(div);
        });
    }

    function addToQueue(url) {
        const info = getVideoInfo(url);
        if (info) {
            getYouTubeTitle(info.id, function (title) {
                videoQueue.push({ url, videoId: info.id, title: title, thumb: info.thumb });
                socket.emit('video_queue_update', videoQueue);
                renderQueue();
            });
        }
    }

    function playNextVideo() {
        if (videoQueue.length > 0) {
            const next = videoQueue.shift();
            renderQueue();
            socket.emit('video_queue_update', videoQueue);
            displayVideo(next.url);
            socket.emit('video_load', { video_url: next.url });
        }
    }

    // ---- Обработчики UI (открытие/закрытие) ----
    videoRoomToggle.addEventListener('click', function () {
        if (videoWindow.style.display === 'flex') {
            videoCloseBtn.click();
        } else {
            videoWindow.style.display = 'flex';
            videoWindow.style.visibility = 'visible';
            videoWindow.style.opacity = '1';
            videoRoomToggle.style.background = '#4CAF50';
            socket.emit('video_join');
            videoRoomActive = true;
            renderHistory();
            if (!syncInterval) {
                syncInterval = setInterval(function () {
                    if (currentVideoElement && !syncInProgress) {
                        currentVideoElement.contentWindow.postMessage(JSON.stringify({
                            event: 'listening', id: 'sync'
                        }), '*');
                    }
                }, 3000);
            }
            console.log('🟢 Видео-окно открыто (по клику)');
        }
    });

    videoCloseBtn.addEventListener('click', function () {
        if (currentVideoElement) {
            currentVideoElement.remove();
            currentVideoElement = null;
        }
        videoContainer.innerHTML = '<div style="color:#888;"><h3 style="color:#fff;">Нет видео</h3></div>';
        videoWindow.style.cssText = `
            display:none !important;
            visibility:hidden !important;
            opacity:0 !important;
            position:fixed;
            top:50px;
            left:50px;
            width:800px;
            height:600px;
            min-width:400px;
            min-height:300px;
            max-width:calc(100vw - 20px);
            max-height:calc(100vh - 20px);
            background:#1a1a1a;
            border-radius:12px;
            box-shadow:0 8px 30px rgba(0,0,0,0.7);
            z-index:99999;
            flex-direction:column;
            overflow:hidden;
            border:2px solid #444;
            resize:both;
        `;
        videoRoomToggle.style.background = '#ff4444';
        if (videoRoomActive) {
            socket.emit('video_leave');
            videoRoomActive = false;
        }
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
        console.log('🔴 Видео-окно закрыто');
    });

    // ---- Остальные обработчики (кнопки, очередь, история, чат) ----
    videoFullscreenBtn.addEventListener('click', function () {
        isFullscreen = !isFullscreen;
        videoWindow.style.width = isFullscreen ? '100vw' : '800px';
        videoWindow.style.height = isFullscreen ? '100vh' : '600px';
        videoWindow.style.top = isFullscreen ? '0' : '50px';
        videoWindow.style.left = isFullscreen ? '0' : '50px';
    });

    videoToggleSidebarBtn.addEventListener('click', function () {
        isSidebarVisible = !isSidebarVisible;
        videoSidebar.style.display = isSidebarVisible ? 'flex' : 'none';
    });

    videoQueueBtn.addEventListener('click', function () {
        isQueueVisible = !isQueueVisible;
        videoQueuePanel.style.display = isQueueVisible ? 'block' : 'none';
        if (isQueueVisible) { videoHistoryPanel.style.display = 'none'; renderQueue(); }
    });

    videoHistoryBtn.addEventListener('click', function () {
        isHistoryVisible = !isHistoryVisible;
        videoHistoryPanel.style.display = isHistoryVisible ? 'block' : 'none';
        if (isHistoryVisible) { videoQueuePanel.style.display = 'none'; renderHistory(); }
    });

    videoNextBtn.addEventListener('click', playNextVideo);
    videoNextFromQueueBtn.addEventListener('click', playNextVideo);

    videoLoadBtn.addEventListener('click', function () {
        const url = videoUrlInput.value.trim();
        if (url) {
            displayVideo(url);
            socket.emit('video_load', { video_url: url });
            videoUrlInput.value = '';
        }
    });

    videoAddToQueueBtn.addEventListener('click', function () {
        const url = videoUrlInput.value.trim();
        if (url) { addToQueue(url); videoUrlInput.value = ''; }
    });

    videoUrlInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') videoLoadBtn.click();
    });

    videoChatSend.addEventListener('click', function () {
        const text = videoChatInput.value.trim();
        if (text) { socket.emit('video_chat_message', { text }); videoChatInput.value = ''; }
    });

    videoChatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            videoChatSend.click();
        }
    });

    // ---- События сокета ----
    socket.on('video_state', function (data) {
        if (data.video_url) {
            currentVideoUrl = data.video_url;
            currentVideoTime = data.current_time || 0;
            displayVideo(data.video_url, currentVideoTime);
            isVideoPlaying = data.is_playing !== undefined ? data.is_playing : true;
            if (!isVideoPlaying) {
                setTimeout(() => {
                    if (currentVideoElement) {
                        currentVideoElement.contentWindow.postMessage(JSON.stringify({
                            event: 'command', func: 'pauseVideo', args: []
                        }), '*');
                    }
                }, 500);
            }
        }
    });

    socket.on('video_queue_update', function (q) {
        videoQueue = q;
        renderQueue();
    });

    socket.on('video_queue_remove', function (d) {
        if (d.index !== undefined) {
            videoQueue.splice(d.index, 1);
            renderQueue();
        }
    });

    socket.on('video_viewers_update', function (v) {
        videoViewersList.innerHTML = '';
        if (v) {
            v.forEach(u => {
                const d = document.createElement('div');
                d.textContent = '👤 ' + u.username;
                videoViewersList.appendChild(d);
            });
        }
    });

    socket.on('video_chat_message', function (msg) {
        const d = document.createElement('div');
        d.innerHTML = `<strong style="color:#ff8c00;">${msg.username}:</strong> ${msg.text}`;
        videoChatMessages.appendChild(d);
        videoChatMessages.scrollTop = videoChatMessages.scrollHeight;
    });

    // ---- Синхронизация ----
    window.addEventListener('message', function (e) {
        if (syncInProgress || !currentVideoElement) return;
        try {
            const data = JSON.parse(e.data);
            if (data.event === 'infoDelivery' && data.info && data.info.currentTime !== undefined) {
                const newTime = data.info.currentTime;
                if (lastKnownTime > 0 && Math.abs(newTime - lastKnownTime) > 3) {
                    socket.emit('video_sync', { action: 'seek', current_time: newTime });
                }
                lastKnownTime = newTime;
                if (data.info.playerState === 2 && isVideoPlaying) {
                    isVideoPlaying = false;
                    socket.emit('video_sync', { action: 'pause', current_time: newTime });
                } else if (data.info.playerState === 1 && !isVideoPlaying) {
                    isVideoPlaying = true;
                    socket.emit('video_sync', { action: 'play', current_time: newTime });
                }
            }
        } catch (e) { }
    });

    socket.on('video_sync', function (data) {
        if (!currentVideoElement) return;
        syncInProgress = true;
        if (data.action === 'play') {
            currentVideoElement.contentWindow.postMessage(JSON.stringify({
                event: 'command', func: 'playVideo', args: []
            }), '*');
            isVideoPlaying = true;
        } else if (data.action === 'pause') {
            currentVideoElement.contentWindow.postMessage(JSON.stringify({
                event: 'command', func: 'pauseVideo', args: []
            }), '*');
            isVideoPlaying = false;
        } else if (data.action === 'seek' && data.current_time) {
            currentVideoElement.contentWindow.postMessage(JSON.stringify({
                event: 'command', func: 'seekTo', args: [data.current_time, true]
            }), '*');
        }
        setTimeout(() => { syncInProgress = false; }, 300);
    });

    // ---- Перетаскивание (drag) с ограничением по экрану ----
    let isDragging = false, dx = 0, dy = 0;
    videoHeader.addEventListener('mousedown', function (e) {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const r = videoWindow.getBoundingClientRect();
        dx = e.clientX - r.left;
        dy = e.clientY - r.top;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        let left = Math.max(10, Math.min(e.clientX - dx, window.innerWidth - videoWindow.offsetWidth - 10));
        let top = Math.max(10, Math.min(e.clientY - dy, window.innerHeight - videoWindow.offsetHeight - 10));
        videoWindow.style.left = left + 'px';
        videoWindow.style.top = top + 'px';
    });
    window.addEventListener('mouseup', function () {
        isDragging = false;
        document.body.style.userSelect = '';
    });

    // ---- ИЗМЕНЕНИЕ РАЗМЕРА (РЕСАЙЗ) – ПОЛНОСТЬЮ ПЕРЕПИСАНО ----
    const resizeHandles = videoWindow.querySelectorAll('.resize-handle');
    let isResizing = false;
    let resizeDir = '';
    let startX, startY, startW, startH, startL, startT;

    function startResize(e, dir) {
        isResizing = true;
        resizeDir = dir;
        startX = e.clientX;
        startY = e.clientY;
        startW = videoWindow.offsetWidth;
        startH = videoWindow.offsetHeight;
        const rect = videoWindow.getBoundingClientRect();
        startL = rect.left;
        startT = rect.top;
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
    }

    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', function (e) {
            const classList = this.className;
            let dir = '';
            if (classList.includes('top') && classList.includes('left')) dir = 'top-left';
            else if (classList.includes('top') && classList.includes('right')) dir = 'top-right';
            else if (classList.includes('bottom') && classList.includes('left')) dir = 'bottom-left';
            else if (classList.includes('bottom') && classList.includes('right')) dir = 'bottom-right';
            else if (classList.includes('top')) dir = 'top';
            else if (classList.includes('bottom')) dir = 'bottom';
            else if (classList.includes('left')) dir = 'left';
            else if (classList.includes('right')) dir = 'right';
            if (dir) startResize(e, dir);
        });
    });

    window.addEventListener('mousemove', function (e) {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newW = startW, newH = startH, newL = startL, newT = startT;

        const minW = 400, minH = 300;
        const maxW = window.innerWidth - 20, maxH = window.innerHeight - 20;

        switch (resizeDir) {
            case 'right':
                newW = Math.min(Math.max(startW + dx, minW), maxW - startL);
                break;
            case 'left':
                newW = Math.min(Math.max(startW - dx, minW), maxW - startL);
                newL = startL + (startW - newW);
                if (newL < 10) { newL = 10; newW = startL + startW - 10; }
                break;
            case 'bottom':
                newH = Math.min(Math.max(startH + dy, minH), maxH - startT);
                break;
            case 'top':
                newH = Math.min(Math.max(startH - dy, minH), maxH - startT);
                newT = startT + (startH - newH);
                if (newT < 10) { newT = 10; newH = startT + startH - 10; }
                break;
            case 'top-left':
                newW = Math.min(Math.max(startW - dx, minW), maxW - startL);
                newH = Math.min(Math.max(startH - dy, minH), maxH - startT);
                newL = startL + (startW - newW);
                newT = startT + (startH - newH);
                if (newL < 10) { newL = 10; newW = startL + startW - 10; }
                if (newT < 10) { newT = 10; newH = startT + startH - 10; }
                break;
            case 'top-right':
                newW = Math.min(Math.max(startW + dx, minW), maxW - startL);
                newH = Math.min(Math.max(startH - dy, minH), maxH - startT);
                newT = startT + (startH - newH);
                if (newT < 10) { newT = 10; newH = startT + startH - 10; }
                break;
            case 'bottom-left':
                newW = Math.min(Math.max(startW - dx, minW), maxW - startL);
                newH = Math.min(Math.max(startH + dy, minH), maxH - startT);
                newL = startL + (startW - newW);
                if (newL < 10) { newL = 10; newW = startL + startW - 10; }
                break;
            case 'bottom-right':
                newW = Math.min(Math.max(startW + dx, minW), maxW - startL);
                newH = Math.min(Math.max(startH + dy, minH), maxH - startT);
                break;
        }

        videoWindow.style.width = newW + 'px';
        videoWindow.style.height = newH + 'px';
        videoWindow.style.left = newL + 'px';
        videoWindow.style.top = newT + 'px';
    });

    window.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            resizeDir = '';
            document.body.style.userSelect = '';
        }
    });

    // ---- Завершение инициализации ----
    isVideoInitialized = true;
    console.log('🎬 Видео-комната инициализирована, окно скрыто (строго по кнопке)');
}