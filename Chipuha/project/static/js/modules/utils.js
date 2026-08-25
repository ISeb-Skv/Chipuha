// ============================================================
// Утилиты общего назначения
// ============================================================

export function getCurrentUser() {
    const el = document.getElementById('currentUserDisplay');
    return el ? el.textContent.trim() : '';
}

export function getCurrentTime() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

export function generateId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// === Работа с localStorage ===
export function loadHiddenMessages() {
    try {
        return JSON.parse(localStorage.getItem('hidden_messages') || '[]');
    } catch {
        return [];
    }
}

export function saveHiddenMessages(hiddenMessages) {
    localStorage.setItem('hidden_messages', JSON.stringify(hiddenMessages));
}

export function loadVolumes() {
    try {
        return JSON.parse(localStorage.getItem('volumes') || '{}');
    } catch {
        return {};
    }
}

export function saveVolumes(volumes) {
    localStorage.setItem('volumes', JSON.stringify(volumes));
}

export function loadGlobalVolume() {
    const val = localStorage.getItem('globalVolume');
    return val ? parseFloat(val) : 1.0;
}

export function saveGlobalVolume(val) {
    localStorage.setItem('globalVolume', val.toString());
}

export function loadMicMuted() {
    return localStorage.getItem('micMuted') === 'true' || false;
}

export function saveMicMuted(val) {
    localStorage.setItem('micMuted', val ? 'true' : 'false');
}

export function loadHeadphonesMuted() {
    return localStorage.getItem('headphonesMuted') === 'true' || false;
}

export function saveHeadphonesMuted(val) {
    localStorage.setItem('headphonesMuted', val ? 'true' : 'false');
}

// === Кеширование сообщений ===
const CACHE_KEY = 'cached_messages';
const CACHE_TIME_KEY = 'cache_timestamp';
const CACHE_MAX_AGE = 3600000; // 1 час

export function loadCachedMessages() {
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (!stored) return [];
        const msgs = JSON.parse(stored);
        const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
        if (cacheTime && (Date.now() - parseInt(cacheTime) > CACHE_MAX_AGE)) {
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(CACHE_TIME_KEY);
            return [];
        }
        return msgs;
    } catch {
        return [];
    }
}

export function saveCachedMessages(messages) {
    if (messages.length > 50) messages = messages.slice(-50);
    localStorage.setItem(CACHE_KEY, JSON.stringify(messages));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
}