export const BlobUtils = (function () {
    'use strict';

    function isSkippedPath(pathname) {
        if (!pathname || typeof pathname !== 'string') return false;
        const parts = pathname.split('/');
        parts.pop();
        return parts.some(part => part === 'json' || part === 'json-data');
    }

    function isVideoPath(pathname) {
        if (!pathname || typeof pathname !== 'string') return false;
        return /^uploads\/(videos|video)\//.test(pathname);
    }

    function getTopLevelFolders(blobs, basePath) {
        basePath = (basePath || 'uploads').replace(/^\/+|\/+$/g, '');
        const folderSet = {};
        const excluded = new Set(['json', 'json-data', 'videos', 'video']);

        blobs.forEach(function(blob) {
            if (!blob.pathname) return;
            const parts = blob.pathname.split('/');
            const baseIndex = parts.indexOf(basePath);
            if (baseIndex === -1) return;

            const nextPart = parts[baseIndex + 1];
            if (nextPart && parts.length > baseIndex + 2 && !excluded.has(nextPart.toLowerCase())) {
                folderSet[nextPart] = true;
            }
        });

        return Object.keys(folderSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }

    function getRandomBlobsFromFolders(blobs, basePath, count) {
        basePath = (basePath || 'uploads').replace(/^\/+|\/+$/g, '');
        count = count || 3;

        const folders = getTopLevelFolders(blobs, basePath);
        const result = {};

        folders.forEach(function(folder) {
            const prefix = basePath + '/' + folder + '/';
            const blobsInFolder = blobs.filter(blob => blob.pathname && blob.pathname.startsWith(prefix));
            const shuffled = blobsInFolder.slice();
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            result[folder] = {
                total: blobsInFolder.length,
                images: shuffled.slice(0, count)
            };
        });

        return result;
    }

    function saveCache(key, data) {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn('Cache save failed:', e); }
    }

    function loadCache(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('Cache load failed:', e);
            return null;
        }
    }

    function clearCache(key) {
        try { localStorage.removeItem(key); } catch (e) { console.warn('Cache clear failed:', e); }
    }

    function createEmitter(prefix) {
        var listeners = {};
        return {
            on: function(event, callback) {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(callback);
            },
            off: function(event, callback) {
                if (!listeners[event]) return;
                listeners[event] = listeners[event].filter(cb => cb !== callback);
            },
            emit: function(event, data) {
                if (!listeners[event]) return;
                listeners[event].forEach(cb => {
                    try { cb(data); } catch (e) { console.error('[' + (prefix || 'Emitter') + '] Listener error for event "' + event + '":', e); }
                });
            }
        };
    }

    function getAuthHeaders(apiSecretKey) {
        var headers = {};
        if (apiSecretKey) headers['Authorization'] = 'Bearer ' + apiSecretKey;
        return headers;
    }

    function formatFileSize(bytes) {
        if (!bytes || typeof bytes !== 'number' || bytes < 0) return '';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1024).toFixed(1) + ' KB';
    }

    function getFileNameFromPath(path) {
        if (!path || typeof path !== 'string') return '';
        return path.replace(/^.*\//, '');
    }

    function filterDuplicateFiles(newFiles, existingList) {
        if (!newFiles || !newFiles.length) return [];
        if (!existingList || !existingList.length) return newFiles.slice();

        var existingNames = {};
        for (var i = 0; i < existingList.length; i++) {
            var name = getFileNameFromPath(existingList[i].pathname).toLowerCase();
            if (name) existingNames[name] = true;
        }

        return newFiles.filter(file => !existingNames[file.name.toLowerCase()]);
    }

    function isFileNameDuplicate(fileName, existingList) {
        if (!fileName || !existingList || !existingList.length) return false;
        var targetName = getFileNameFromPath(fileName).toLowerCase();
        return existingList.some(function(item) {
            var existingName = getFileNameFromPath(item.pathname || '').toLowerCase();
            return existingName === targetName;
        });
    }

    function createModalHelpers(modalOverlay, modalMessage, modalButtons) {
        function closeModal() {
            modalOverlay.classList.add('hidden', 'opacity-0');
            modalOverlay.classList.remove('flex', 'opacity-100');
            modalButtons.innerHTML = '';
            const box = modalOverlay.querySelector('.modal-box');
            if (box) {
                box.classList.remove('scale-100', 'translate-y-0');
                box.classList.add('scale-95', 'translate-y-2');
            }
        }

        function showAlert(msg, cb) {
            modalMessage.textContent = msg;
            modalOverlay.querySelector('.text-4xl i').className = 'fa-solid fa-circle-info';
            modalButtons.innerHTML = `<button class="bg-[#057c94] hover:bg-[#046a80] text-white px-4 py-1 rounded-full text-[10px] font-semibold shadow-md transition-all min-w-[60px]" id="modal-ok-btn">OK</button>`;
            modalOverlay.classList.remove('hidden', 'opacity-0');
            modalOverlay.classList.add('flex', 'opacity-100');
            const box = modalOverlay.querySelector('.modal-box');
            if (box) {
                box.classList.remove('scale-95', 'translate-y-2');
                box.classList.add('scale-100', 'translate-y-0');
            }
            document.getElementById('modal-ok-btn').onclick = function() {
                closeModal();
                if (cb) cb();
            };
            modalOverlay.onclick = function(e) {
                if (e.target === modalOverlay) { closeModal(); if (cb) cb(); }
            };
        }

        function showConfirm(msg, onConfirm, onCancel) {
            modalMessage.textContent = msg;
            modalOverlay.querySelector('.text-4xl i').className = 'fa-solid fa-triangle-exclamation';
            modalButtons.innerHTML = `
                <button class="bg-white/10 hover:bg-white/20 text-gray-300 px-4 py-1 rounded-full text-[10px] font-semibold border border-white/15 transition-all min-w-[60px]" id="modal-cancel-btn">Cancel</button>
                <button class="bg-red-700 hover:bg-red-800 text-white px-4 py-1 rounded-full text-[10px] font-semibold shadow-md transition-all min-w-[60px]" id="modal-confirm-btn">Confirm</button>
            `;
            modalOverlay.classList.remove('hidden', 'opacity-0');
            modalOverlay.classList.add('flex', 'opacity-100');
            const box = modalOverlay.querySelector('.modal-box');
            if (box) {
                box.classList.remove('scale-95', 'translate-y-2');
                box.classList.add('scale-100', 'translate-y-0');
            }
            document.getElementById('modal-cancel-btn').onclick = function() { closeModal(); if (onCancel) onCancel(); };
            document.getElementById('modal-confirm-btn').onclick = function() { closeModal(); if (onConfirm) onConfirm(); };
            modalOverlay.onclick = function(e) { if (e.target === modalOverlay) { closeModal(); if (onCancel) onCancel(); } };
        }

        return { closeModal, showAlert, showConfirm };
    }

    function updateClock(clockDay, clockHours, clockMinutes, clockAmpm) {
        const now = new Date();
        const day = now.toLocaleDateString('en-US', { weekday: 'short' });
        let h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        clockDay.textContent = day + ',';
        clockHours.textContent = String(h).padStart(2, '0');
        clockMinutes.textContent = m;
        clockAmpm.textContent = ampm;
    }

    function formatFullDate(dateInput) {
        if (!dateInput) return '';
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    return {
        isSkippedPath, isVideoPath, getTopLevelFolders, getRandomBlobsFromFolders,
        saveCache, loadCache, clearCache, createEmitter, getAuthHeaders,
        formatFileSize, getFileNameFromPath, filterDuplicateFiles, isFileNameDuplicate,
        createModalHelpers, updateClock, formatFullDate
    };
})();