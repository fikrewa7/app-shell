var KeyEncryptor = (function () {
    'use strict';

    function _arrayBufferToBase64(buffer) {
        var bytes = new Uint8Array(buffer);
        var binary = '';
        for (var i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function _base64ToArrayBuffer(base64) {
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    async function _deriveKey(password, salt) {
        var enc = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 600000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encrypt(plaintext, password) {
        if (!plaintext || !password) {
            throw new Error('Plaintext and password are required.');
        }
        var salt = crypto.getRandomValues(new Uint8Array(16));
        var iv = crypto.getRandomValues(new Uint8Array(12));
        var key = await _deriveKey(password, salt);
        var encoded = new TextEncoder().encode(plaintext);
        var cipherBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encoded
        );
        return {
            iv: _arrayBufferToBase64(iv),
            salt: _arrayBufferToBase64(salt),
            ciphertext: _arrayBufferToBase64(cipherBuffer)
        };
    }

    async function decrypt(bundle, password) {
        if (!bundle || !password) {
            throw new Error('Bundle and password are required.');
        }
        var iv = new Uint8Array(_base64ToArrayBuffer(bundle.iv));
        var salt = new Uint8Array(_base64ToArrayBuffer(bundle.salt));
        var cipherBuffer = _base64ToArrayBuffer(bundle.ciphertext);
        var key = await _deriveKey(password, salt);
        var decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            cipherBuffer
        );
        return new TextDecoder().decode(decrypted);
    }

    return {
        encrypt: encrypt,
        decrypt: decrypt
    };
})();

var BlobUtils = (function () {
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
            const blobsInFolder = blobs.filter(function(blob) {
                return blob.pathname && blob.pathname.startsWith(prefix);
            });

            const total = blobsInFolder.length;

            const shuffled = blobsInFolder.slice();
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const randomImages = shuffled.slice(0, count);

            result[folder] = {
                total: total,
                images: randomImages
            };
        });

        return result;
    }

    function saveCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('Cache save failed:', e);
        }
    }

    function loadCache(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Cache load failed:', e);
            return null;
        }
    }

    function clearCache(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Cache clear failed:', e);
        }
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
                listeners[event] = listeners[event].filter(function(cb) {
                    return cb !== callback;
                });
            },
            emit: function(event, data) {
                if (!listeners[event]) return;
                listeners[event].forEach(function(cb) {
                    try {
                        cb(data);
                    } catch (e) {
                        console.error('[' + (prefix || 'Emitter') + '] Listener error for event "' + event + '":', e);
                    }
                });
            }
        };
    }

    function getAuthHeaders(apiSecretKey) {
        var headers = {};
        if (apiSecretKey) {
            headers['Authorization'] = 'Bearer ' + apiSecretKey;
        }
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

    function isFileNameDuplicate(fileName, list) {
        if (!fileName) return false;
        var lower = fileName.toLowerCase();
        return list.some(function (item) {
            return getFileNameFromPath(item.pathname).toLowerCase() === lower;
        });
    }

    function filterDuplicateFiles(newFiles, existingList) {
        if (!newFiles || !newFiles.length) return [];
        if (!existingList || !existingList.length) return newFiles.slice();

        var existingNames = {};
        for (var i = 0; i < existingList.length; i++) {
            var name = getFileNameFromPath(existingList[i].pathname).toLowerCase();
            if (name) existingNames[name] = true;
        }

        return newFiles.filter(function (file) {
            return !existingNames[file.name.toLowerCase()];
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
                if (e.target === modalOverlay) {
                    closeModal();
                    if (cb) cb();
                }
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
            document.getElementById('modal-cancel-btn').onclick = function() {
                closeModal();
                if (onCancel) onCancel();
            };
            document.getElementById('modal-confirm-btn').onclick = function() {
                closeModal();
                if (onConfirm) onConfirm();
            };
            modalOverlay.onclick = function(e) {
                if (e.target === modalOverlay) {
                    closeModal();
                    if (onCancel) onCancel();
                }
            };
        }

        return {
            closeModal: closeModal,
            showAlert: showAlert,
            showConfirm: showConfirm
        };
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
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    function formatToMonthYear(dateInput) {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[date.getMonth()] + ', ' + date.getFullYear();
    }

    function formatDuration(seconds) {
        if (!seconds) return '0:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) {
            return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    return {
        isSkippedPath: isSkippedPath,
        isVideoPath: isVideoPath,
        getTopLevelFolders: getTopLevelFolders,
        getRandomBlobsFromFolders: getRandomBlobsFromFolders,
        saveCache: saveCache,
        loadCache: loadCache,
        clearCache: clearCache,
        createEmitter: createEmitter,
        getAuthHeaders: getAuthHeaders,
        formatFileSize: formatFileSize,
        getFileNameFromPath: getFileNameFromPath,
        isFileNameDuplicate: isFileNameDuplicate,
        filterDuplicateFiles: filterDuplicateFiles,
        createModalHelpers: createModalHelpers,
        updateClock: updateClock,
        formatFullDate: formatFullDate,
        formatToMonthYear: formatToMonthYear,
        formatDuration: formatDuration
    };
})();

var FolderExplorer = (function() {
    'use strict';

    class FolderExplorer {
        constructor(rawData) {
            if (!rawData || !Array.isArray(rawData.blobs)) {
                throw new Error('Invalid data: expected { blobs: [...] }');
            }
            this.blobs = rawData.blobs;
            this.storeId = rawData.storeId || '';

            this.treeRoot = this._buildTree();

            this._currentPath = [];
            this._selectedFile = null;
            this._listeners = { change: [] };
        }

        static create(rawData) {
            return new FolderExplorer(rawData);
        }

        navigateToFolder(pathParts) {
            if (!Array.isArray(pathParts)) {
                pathParts = [];
            }
            let node = this.treeRoot;
            for (const part of pathParts) {
                if (!node.children[part]) {
                    this._emitChange();
                    return false;
                }
                node = node.children[part];
            }
            this._currentPath = pathParts.slice();
            this._selectedFile = null;
            this._emitChange();
            return true;
        }

        selectFile(blob) {
            if (!blob || !blob.pathname) {
                this._selectedFile = null;
                this._emitChange();
                return;
            }
            const pathParts = blob.pathname.split('/');
            pathParts.pop();
            this._currentPath = pathParts;
            this._selectedFile = blob;
            this._emitChange();
        }

        getCurrentPath() {
            return this._currentPath.slice();
        }

        getCurrentPathString() {
            return this._currentPath.join('/');
        }

        getSelectedFile() {
            return this._selectedFile;
        }

        getChildFolders(pathParts) {
            const node = this._getNode(pathParts || this._currentPath);
            if (!node) return [];
            return Object.keys(node.children).sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
            );
        }

        getFilesInCurrentFolder() {
            const node = this._getNode(this._currentPath);
            if (!node) return [];
            const files = this._getAllFilesRecursive(node);
            return files.sort((a, b) => {
                const nameA = a.pathname.split('/').pop();
                const nameB = b.pathname.split('/').pop();
                return nameA.localeCompare(nameB);
            });
        }

        getAllFiles() {
            return this.blobs.slice();
        }

        searchFiles(query) {
            if (!query || !query.trim()) return this.getFilesInCurrentFolder();
            const term = query.trim().toLowerCase();
            const allFiles = this.getFilesInCurrentFolder();
            return allFiles.filter(b => {
                const name = b.pathname.split('/').pop().toLowerCase();
                return name.includes(term);
            });
        }

        getTotalStats() {
            const totalSize = this.blobs.reduce((sum, b) => sum + b.size, 0);
            return {
                count: this.blobs.length,
                size: totalSize,
                sizeFormatted: BlobUtils.formatFileSize(totalSize)
            };
        }

        static formatSize(bytes) {
            return BlobUtils.formatFileSize(bytes);
        }

        static formatDate(iso) {
            return BlobUtils.formatFullDate(iso);
        }

        on(event, callback) {
            if (event === 'change' && typeof callback === 'function') {
                this._listeners.change.push(callback);
            }
        }

        off(event, callback) {
            if (event === 'change') {
                this._listeners.change = this._listeners.change.filter(cb => cb !== callback);
            }
        }

        _emitChange() {
            this._listeners.change.forEach(cb => {
                try { cb(); } catch (e) {}
            });
        }

        _buildTree() {
            const root = {
                name: '',
                isFolder: true,
                children: {},
                files: [],
                fullPath: ''
            };
            this.blobs.forEach(b => {
                const parts = b.pathname.split('/');
                let current = root;
                let acc = '';
                parts.forEach((part, idx) => {
                    acc += (acc ? '/' : '') + part;
                    if (idx === parts.length - 1) {
                        current.files.push({
                            name: part,
                            fullPath: b.pathname,
                            blob: b
                        });
                    } else {
                        if (!current.children[part]) {
                            current.children[part] = {
                                name: part,
                                isFolder: true,
                                children: {},
                                files: [],
                                fullPath: acc
                            };
                        }
                        current = current.children[part];
                    }
                });
            });
            return root;
        }

        _getNode(pathParts) {
            let node = this.treeRoot;
            if (!pathParts || pathParts.length === 0) return node;
            for (const part of pathParts) {
                if (!node.children[part]) return null;
                node = node.children[part];
            }
            return node;
        }

        _getAllFilesRecursive(node) {
            let results = node.files.map(f => f.blob);
            for (const key in node.children) {
                results = results.concat(this._getAllFilesRecursive(node.children[key]));
            }
            return results;
        }
    }

    return FolderExplorer;
})();

var ImageDB = (function () {
    'use strict';

    var emitter = BlobUtils.createEmitter('ImageDB');
    var _on = emitter.on;
    var _off = emitter.off;
    var _emit = emitter.emit;

    var _jfrKey = {
        "iv": "a4EroL5JUEgVloj1",
        "salt": "PtvozUTEvgxEqQUpQY3yyA==",
        "ciphertext": "ne2yiSgFCpDpDbjMmcW4wlNoFo2ogXbhH2sPHFup9SvlfRpay7PtKJnq1SJLdg2Pt9NHtDwf/+vncciJoKhzmxW53NuQA6X+BrTtXAhlMTI="
    };
    var _apiBase = 'https://blob-img-db.vercel.app/api';
    var _uploadCategory = 'screenshots';
    var _storeId = null;
    var _cacheKey = 'imageDB_cache_v1';

    var _apiSecretKey = (function() {
        try {
            if (typeof process !== 'undefined' && process.env && process.env.API_SECRET_KEY) {
                return process.env.API_SECRET_KEY;
            }
        } catch (e) {}
        return null;
    })();

    var _currentImages = [];
    var _selectedFiles = [];

    var _slideshowImages = [];
    var _slideshowIndex = 0;
    var _slideshowOpen = false;

    var _fetchPromise = null;

    function configure(options) {
        if (!options || typeof options !== 'object') return;
        if (typeof options.apiBase === 'string' && options.apiBase.length > 0) {
            _apiBase = options.apiBase.replace(/\/+$/, '');
        }
        if (typeof options.uploadCategory === 'string' && options.uploadCategory.length > 0) {
            _uploadCategory = options.uploadCategory;
        }
        if (typeof options.apiSecretKey === 'string') {
            _apiSecretKey = options.apiSecretKey;
        }
        _emit('configured', { apiBase: _apiBase, uploadCategory: _uploadCategory });
    }

    function fetchImages() {
        if (_fetchPromise) return _fetchPromise;

        const cached = BlobUtils.loadCache(_cacheKey);
        if (cached && cached.blobs && Array.isArray(cached.blobs)) {
            _currentImages = cached.blobs;
            if (cached.storeId) _storeId = cached.storeId;
            _emit('imagesLoaded', {
                images: _currentImages,
                count: _currentImages.length,
                storeId: _storeId,
                fromCache: true
            });
            return Promise.resolve(_currentImages);
        }

        _emit('imagesLoading');

        _fetchPromise = fetch(_apiBase + '/blobs?_=' + Date.now(), {
            headers: BlobUtils.getAuthHeaders(_apiSecretKey)
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                _currentImages = (data.blobs || []).filter(function(blob) {
                    return !BlobUtils.isSkippedPath(blob.pathname) && !BlobUtils.isVideoPath(blob.pathname);
                });
                if (data.storeId) _storeId = data.storeId;

                BlobUtils.saveCache(_cacheKey, {
                    blobs: _currentImages,
                    storeId: _storeId
                });

                _fetchPromise = null;
                _emit('imagesLoaded', {
                    images: _currentImages,
                    count: _currentImages.length,
                    storeId: _storeId,
                    fromCache: false
                });
                return _currentImages;
            })
            .catch(function (err) {
                _fetchPromise = null;
                _emit('imagesFetchError', { error: err, message: err.message });
                throw err;
            });

        return _fetchPromise;
    }

    function deleteImage(pathname) {
        if (!pathname) {
            return Promise.reject(new Error('Pathname is required'));
        }

        _emit('imageDeleting', { pathname: pathname });

        return fetch(_apiBase + '/blobs', {
            method: 'DELETE',
            headers: Object.assign({ 'Content-Type': 'application/json' }, BlobUtils.getAuthHeaders(_apiSecretKey)),
            body: JSON.stringify({ pathname: pathname }),
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Delete failed (HTTP ' + res.status + ')');
                return res.json().catch(function () {
                    return { success: true };
                });
            })
            .then(function (data) {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve(data);
                    }, 300);
                });
            })
            .then(function (data) {
                _emit('imageDeleted', { pathname: pathname, result: data });
                BlobUtils.clearCache(_cacheKey);
                return data;
            })
            .catch(function (err) {
                _emit('imageDeleteError', { pathname: pathname, error: err, message: err.message });
                throw err;
            });
    }

    function testConnection() {
        _emit('connectionTesting');

        return fetch(_apiBase + '/blobs?limit=1', {
            headers: BlobUtils.getAuthHeaders(_apiSecretKey)
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data.storeId) _storeId = data.storeId;
                var result = {
                    connected: true,
                    storeId: _storeId,
                    message: 'Connected successfully',
                };
                _emit('connectionTested', result);
                return result;
            })
            .catch(function (err) {
                var result = {
                    connected: false,
                    storeId: null,
                    message: err.message,
                };
                _emit('connectionTested', result);
                return result;
            });
    }

    function addFiles(files) {
        if (!files) {
            _emit('filesAdded', { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 });
            return { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 };
        }

        var fileArray = Array.from(files);

        var imageFiles = fileArray.filter(function (f) {
            return f.type && f.type.startsWith('image/');
        });
        var nonImageCount = fileArray.length - imageFiles.length;

        if (imageFiles.length === 0) {
            var result = { added: 0, skipped: nonImageCount, duplicates: [], totalProcessed: fileArray.length };
            _emit('filesAdded', result);
            _emit('noImageFiles', { nonImageCount: nonImageCount });
            return result;
        }

        var allExisting = _currentImages.map(function (img) {
            return { pathname: img.pathname };
        });
        var selectedAsImages = _selectedFiles.map(function (f) {
            return { pathname: f.name };
        });
        var combinedExisting = allExisting.concat(selectedAsImages);

        var uniqueFiles = BlobUtils.filterDuplicateFiles(imageFiles, combinedExisting);
        var skipped = imageFiles.length - uniqueFiles.length;

        if (uniqueFiles.length > 0) {
            _selectedFiles = _selectedFiles.concat(uniqueFiles);
        }

        var result = {
            added: uniqueFiles.length,
            skipped: skipped + nonImageCount,
            duplicates: imageFiles.slice(0).filter(function (f) {
                return uniqueFiles.indexOf(f) === -1;
            }).map(function (f) { return f.name; }),
            totalProcessed: fileArray.length,
            totalSelected: _selectedFiles.length,
        };

        _emit('filesAdded', result);
        _emit('selectionChanged', { selectedFiles: _selectedFiles, count: _selectedFiles.length });

        return result;
    }

    function clearSelectedFiles() {
        _selectedFiles = [];
        _emit('selectionChanged', { selectedFiles: [], count: 0 });
        _emit('selectionCleared');
    }

    function getSelectedFiles() {
        return _selectedFiles.slice();
    }

    function uploadFiles(files, onProgress, categories) {
        if (!files || !files.length) {
            return Promise.resolve({ success: 0, total: 0, failed: [] });
        }

        var total = files.length;
        var completed = 0;
        var failed = [];

        if (!categories || !Array.isArray(categories) || categories.length !== total) {
            categories = files.map(function() { return _uploadCategory; });
        }

        _emit('uploadStarted', { total: total, files: files.map(function(f) { return f.name; }) });

        function uploadSingleFile(file, index) {
            return new Promise(function(resolve) {
                var formData = new FormData();
                formData.append('image', file);
                
                var timestamp = file.lastModified || Date.now();
                formData.append('lastModified', timestamp);
                
                var queryUrl = _apiBase + '/uploads?category=' + encodeURIComponent(categories[index]) + '&lastModified=' + timestamp;
                var xhr = new XMLHttpRequest();
                xhr.open('POST', queryUrl, true);
                
                if (_apiSecretKey) {
                    xhr.setRequestHeader('Authorization', 'Bearer ' + _apiSecretKey);
                }
                
                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable) {
                        var currentPct = Math.round((e.loaded / e.total) * 100);
                        var overall = Math.round(((completed + currentPct / 100) / total) * 100);
                        
                        if (typeof onProgress === 'function') {
                            onProgress({
                                overallPercent: overall,
                                currentFileIndex: index,
                                totalFiles: total,
                                completed: completed,
                                failed: failed.length,
                                currentFileName: file.name,
                                currentFilePercent: currentPct,
                            });
                        }
                        _emit('uploadProgress', {
                            overallPercent: overall,
                            currentFileIndex: index,
                            totalFiles: total,
                            completed: completed,
                            failed: failed.length,
                            currentFileName: file.name,
                            currentFilePercent: currentPct,
                        });
                    }
                };
                
                xhr.onload = function() {
                    if (xhr.status === 200 || xhr.status === 201) {
                        resolve({ success: true });
                    } else {
                        resolve({ success: false, error: 'HTTP ' + xhr.status + ' ' + xhr.statusText });
                    }
                };
                
                xhr.onerror = function() {
                    resolve({ success: false, error: 'Network error' });
                };
                
                xhr.ontimeout = function() {
                    resolve({ success: false, error: 'Timeout' });
                };
                
                xhr.send(formData);
            });
        }

        function processNext(index) {
            if (index >= total) {
                var result = {
                    success: completed,
                    total: total,
                    failed: failed.slice(),
                };
                BlobUtils.clearCache(_cacheKey);
                _emit('uploadComplete', result);

                if (completed > 0) {
                    _selectedFiles = [];
                    _emit('selectionChanged', { selectedFiles: [], count: 0 });
                }

                return result;
            }

            var file = files[index];
            return uploadSingleFile(file, index).then(function(uploadResult) {
                if (uploadResult.success) {
                    completed++;
                } else {
                    failed.push({ name: file.name, error: uploadResult.error });
                }

                var overall = Math.round((completed / total) * 100);
                if (typeof onProgress === 'function') {
                    onProgress({
                        overallPercent: overall,
                        currentFileIndex: index,
                        totalFiles: total,
                        completed: completed,
                        failed: failed.length,
                        currentFileName: file.name,
                        currentFilePercent: 100,
                    });
                }
                _emit('uploadProgress', {
                    overallPercent: overall,
                    currentFileIndex: index,
                    totalFiles: total,
                    completed: completed,
                    failed: failed.length,
                    currentFileName: file.name,
                    currentFilePercent: 100,
                });

                return processNext(index + 1);
            });
        }

        return processNext(0).then(function(result) {
            return result;
        });
    }

    function uploadSelectedFiles(onProgress) {
        if (_selectedFiles.length === 0) {
            return Promise.resolve({ success: 0, total: 0, failed: [] });
        }
        return uploadFiles(_selectedFiles.slice(), onProgress);
    }

    function openSlideshow(index, imageUrls) {
        var urls = imageUrls;
        if (!urls || !urls.length) {
            urls = _currentImages.map(function (img) {
                return img.url;
            });
        }

        if (!urls.length) return null;

        _slideshowImages = urls;
        _slideshowIndex = Math.min(Math.max(0, index), urls.length - 1);
        _slideshowOpen = true;

        var state = getSlideshowState();
        _emit('slideshowOpened', state);
        return state;
    }

    function closeSlideshow() {
        _slideshowOpen = false;
        _emit('slideshowClosed', { wasOpen: true });
    }

    function nextSlide() {
        if (!_slideshowOpen || _slideshowImages.length <= 1) return null;
        _slideshowIndex = (_slideshowIndex + 1) % _slideshowImages.length;
        var state = getSlideshowState();
        _emit('slideshowChanged', state);
        return state;
    }

    function prevSlide() {
        if (!_slideshowOpen || _slideshowImages.length <= 1) return null;
        _slideshowIndex =
            (_slideshowIndex - 1 + _slideshowImages.length) % _slideshowImages.length;
        var state = getSlideshowState();
        _emit('slideshowChanged', state);
        return state;
    }

    function getSlideshowState() {
        return {
            isOpen: _slideshowOpen,
            images: _slideshowImages.slice(),
            currentIndex: _slideshowIndex,
            currentUrl: _slideshowImages[_slideshowIndex] || null,
            total: _slideshowImages.length,
        };
    }

    function getImages() {
        return _currentImages.slice();
    }

    function getApiBase() {
        return _apiBase;
    }

    function getJfrKey() {
        return _jfrKey;
    }

    function getStoreId() {
        return _storeId;
    }

    return {
        configure: configure,
        getApiBase: getApiBase,
        getStoreId: getStoreId,
        getJfrKey: getJfrKey,
        getUploadCategory: function() {
            return _uploadCategory;
        },
        on: _on,
        off: _off,
        fetchImages: fetchImages,
        deleteImage: deleteImage,
        testConnection: testConnection,
        getImages: getImages,
        addFiles: addFiles,
        clearSelectedFiles: clearSelectedFiles,
        getSelectedFiles: getSelectedFiles,
        filterDuplicateFiles: BlobUtils.filterDuplicateFiles,
        uploadFiles: uploadFiles,
        uploadSelectedFiles: uploadSelectedFiles,
        openSlideshow: openSlideshow,
        closeSlideshow: closeSlideshow,
        nextSlide: nextSlide,
        prevSlide: prevSlide,
        getSlideshowState: getSlideshowState,
        formatFileSize: BlobUtils.formatFileSize,
        getFileNameFromPath: BlobUtils.getFileNameFromPath,
        isFileNameDuplicate: function(fileName) {
            return BlobUtils.isFileNameDuplicate(fileName, _currentImages);
        }
    };
})();

var VideoDB = (function () {
    'use strict';

    var emitter = BlobUtils.createEmitter('VideoDB');
    var _on = emitter.on;
    var _off = emitter.off;
    var _emit = emitter.emit;

    var _jfrKey = {
        "iv": "a4EroL5JUEgVloj1",
        "salt": "PtvozUTEvgxEqQUpQY3yyA==",
        "ciphertext": "ne2yiSgFCpDpDbjMmcW4wlNoFo2ogXbhH2sPHFup9SvlfRpay7PtKJnq1SJLdg2Pt9NHtDwf/+vncciJoKhzmxW53NuQA6X+BrTtXAhlMTI="
    };
    var _apiBase = 'https://blob-img-db.vercel.app/api';
    var _uploadCategory = 'videos';
    var _storeId = null;
    var _cacheKey = 'videoDB_cache_v1';

    var _apiSecretKey = (function() {
        try {
            if (typeof process !== 'undefined' && process.env && process.env.API_SECRET_KEY) {
                return process.env.API_SECRET_KEY;
            }
        } catch (e) {}
        return null;
    })();

    var _currentVideos = [];
    var _selectedFiles = [];

    var _slideshowVideos = [];
    var _slideshowIndex = 0;
    var _slideshowOpen = false;

    var _fetchPromise = null;

    function configure(options) {
        if (!options || typeof options !== 'object') return;
        if (typeof options.apiBase === 'string' && options.apiBase.length > 0) {
            _apiBase = options.apiBase.replace(/\/+$/, '');
        }
        if (typeof options.uploadCategory === 'string' && options.uploadCategory.length > 0) {
            _uploadCategory = options.uploadCategory;
        }
        if (typeof options.apiSecretKey === 'string') {
            _apiSecretKey = options.apiSecretKey;
        }
        _emit('configured', { apiBase: _apiBase, uploadCategory: _uploadCategory });
    }

    function fetchVideos() {
        if (_fetchPromise) return _fetchPromise;

        const cached = BlobUtils.loadCache(_cacheKey);
        if (cached && cached.blobs && Array.isArray(cached.blobs)) {
            _currentVideos = cached.blobs;
            if (cached.storeId) _storeId = cached.storeId;
            _emit('videosLoaded', {
                videos: _currentVideos,
                count: _currentVideos.length,
                storeId: _storeId,
                fromCache: true
            });
            return Promise.resolve(_currentVideos);
        }

        _emit('videosLoading');

        _fetchPromise = fetch(_apiBase + '/blobs?_=' + Date.now(), {
            headers: BlobUtils.getAuthHeaders(_apiSecretKey)
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                _currentVideos = (data.blobs || []).filter(function(blob) {
                    return !BlobUtils.isSkippedPath(blob.pathname);
                });
                if (data.storeId) _storeId = data.storeId;

                BlobUtils.saveCache(_cacheKey, {
                    blobs: _currentVideos,
                    storeId: _storeId
                });

                _fetchPromise = null;
                _emit('videosLoaded', {
                    videos: _currentVideos,
                    count: _currentVideos.length,
                    storeId: _storeId,
                    fromCache: false
                });
                return _currentVideos;
            })
            .catch(function (err) {
                _fetchPromise = null;
                _emit('videosFetchError', { error: err, message: err.message });
                throw err;
            });

        return _fetchPromise;
    }

    function deleteVideo(pathname) {
        if (!pathname) {
            return Promise.reject(new Error('Pathname is required'));
        }

        _emit('videoDeleting', { pathname: pathname });

        return fetch(_apiBase + '/blobs', {
            method: 'DELETE',
            headers: Object.assign({ 'Content-Type': 'application/json' }, BlobUtils.getAuthHeaders(_apiSecretKey)),
            body: JSON.stringify({ pathname: pathname }),
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Delete failed (HTTP ' + res.status + ')');
                return res.json().catch(function () {
                    return { success: true };
                });
            })
            .then(function (data) {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve(data);
                    }, 300);
                });
            })
            .then(function (data) {
                _emit('videoDeleted', { pathname: pathname, result: data });
                BlobUtils.clearCache(_cacheKey);
                return data;
            })
            .catch(function (err) {
                _emit('videoDeleteError', { pathname: pathname, error: err, message: err.message });
                throw err;
            });
    }

    function testConnection() {
        _emit('connectionTesting');

        return fetch(_apiBase + '/blobs?limit=1', {
            headers: BlobUtils.getAuthHeaders(_apiSecretKey)
        })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data.storeId) _storeId = data.storeId;
                var result = {
                    connected: true,
                    storeId: _storeId,
                    message: 'Connected successfully',
                };
                _emit('connectionTested', result);
                return result;
            })
            .catch(function (err) {
                var result = {
                    connected: false,
                    storeId: null,
                    message: err.message,
                };
                _emit('connectionTested', result);
                return result;
            });
    }

    function addFiles(files) {
        if (!files) {
            _emit('filesAdded', { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 });
            return { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 };
        }

        var fileArray = Array.from(files);

        var videoFiles = fileArray.filter(function (f) {
            return f.type && f.type.startsWith('video/');
        });
        var nonVideoCount = fileArray.length - videoFiles.length;

        if (videoFiles.length === 0) {
            var result = { added: 0, skipped: nonVideoCount, duplicates: [], totalProcessed: fileArray.length };
            _emit('filesAdded', result);
            _emit('noVideoFiles', { nonVideoCount: nonVideoCount });
            return result;
        }

        var allExisting = _currentVideos.map(function (vid) {
            return { pathname: vid.pathname };
        });
        var selectedAsVideos = _selectedFiles.map(function (f) {
            return { pathname: f.name };
        });
        var combinedExisting = allExisting.concat(selectedAsVideos);

        var uniqueFiles = BlobUtils.filterDuplicateFiles(videoFiles, combinedExisting);
        var skipped = videoFiles.length - uniqueFiles.length;

        if (uniqueFiles.length > 0) {
            _selectedFiles = _selectedFiles.concat(uniqueFiles);
        }

        var result = {
            added: uniqueFiles.length,
            skipped: skipped + nonVideoCount,
            duplicates: videoFiles.slice(0).filter(function (f) {
                return uniqueFiles.indexOf(f) === -1;
            }).map(function (f) { return f.name; }),
            totalProcessed: fileArray.length,
            totalSelected: _selectedFiles.length,
        };

        _emit('filesAdded', result);
        _emit('selectionChanged', { selectedFiles: _selectedFiles, count: _selectedFiles.length });

        return result;
    }

    function clearSelectedFiles() {
        _selectedFiles = [];
        _emit('selectionChanged', { selectedFiles: [], count: 0 });
        _emit('selectionCleared');
    }

    function getSelectedFiles() {
        return _selectedFiles.slice();
    }

    function generateThumbnailFromFile(file, callback) {
        var video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.currentTime = 1;
        
        video.addEventListener('loadeddata', function() {
            var canvas = document.createElement('canvas');
            var aspectRatio = video.videoWidth / video.videoHeight;
            var width = 640;
            var height = 360;
            if (aspectRatio > 1.78) {
                width = 640;
                height = 360;
            } else {
                height = 360;
                width = 360 * aspectRatio;
            }
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(video, 0, 0, width, height);
            
            canvas.toBlob(function(blob) {
                var thumbnailFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                callback(thumbnailFile);
            }, 'image/jpeg', 0.85);
        });
        
        video.addEventListener('error', function() {
            var canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a2e36';
            ctx.fillRect(0, 0, 640, 360);
            ctx.fillStyle = '#ffffff';
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎬', 320, 180);
            
            canvas.toBlob(function(blob) {
                var thumbnailFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                callback(thumbnailFile);
            }, 'image/jpeg');
        });
        
        video.load();
    }

    function _uploadSingleFileToBlob(formData, category, onProgress) {
        return new Promise(function(resolve, reject) {
            var url = _apiBase + '/uploads?category=' + encodeURIComponent(category);
            
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            
            if (_apiSecretKey) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + _apiSecretKey);
            }
            
            if (typeof onProgress === 'function') {
                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable) {
                        var percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(percent);
                    }
                };
            }
            
            xhr.onload = function() {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(new Error('Invalid response'));
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status + ' ' + xhr.statusText));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('Timeout'));
            };
            
            xhr.send(formData);
        });
    }

    function uploadVideoWithThumbnail(file, onProgress) {
        return new Promise(function(resolve, reject) {
            generateThumbnailFromFile(file, function(thumbnailFile) {
                var baseCategory = _uploadCategory;
                
                var videoCategory = baseCategory;
                
                var thumbnailCategory = baseCategory + '/thumbnails';
                
                var videoFormData = new FormData();
                videoFormData.append('image', file);
                
                var thumbFormData = new FormData();
                thumbFormData.append('image', thumbnailFile);
                
                var videoUploaded = false;
                var thumbUploaded = false;
                var videoResult = null;
                var thumbResult = null;
                var errorOccurred = null;
                
                function checkComplete() {
                    if (videoUploaded && thumbUploaded) {
                        if (errorOccurred) {
                            reject(errorOccurred);
                        } else {
                            resolve({
                                video: videoResult,
                                thumbnail: thumbResult,
                                videoPath: videoCategory + '/' + file.name,
                                thumbnailPath: thumbnailCategory + '/' + file.name.replace(/\.[^.]+$/, '.jpg')
                            });
                        }
                    }
                }
                
                _uploadSingleFileToBlob(videoFormData, videoCategory, function(progress) {
                    if (typeof onProgress === 'function') {
                        onProgress({
                            phase: 'video',
                            percent: progress * 0.7,
                            fileName: file.name
                        });
                    }
                }).then(function(result) {
                    videoUploaded = true;
                    videoResult = result;
                    if (typeof onProgress === 'function') {
                        onProgress({
                            phase: 'video',
                            percent: 70,
                            fileName: file.name
                        });
                    }
                    checkComplete();
                }).catch(function(err) {
                    errorOccurred = err;
                    videoUploaded = true;
                    checkComplete();
                });
                
                _uploadSingleFileToBlob(thumbFormData, thumbnailCategory, function(progress) {
                    if (typeof onProgress === 'function') {
                        onProgress({
                            phase: 'thumbnail',
                            percent: 70 + (progress * 0.3),
                            fileName: file.name
                        });
                    }
                }).then(function(result) {
                    thumbUploaded = true;
                    thumbResult = result;
                    if (typeof onProgress === 'function') {
                        onProgress({
                            phase: 'thumbnail',
                            percent: 100,
                            fileName: file.name
                        });
                    }
                    checkComplete();
                }).catch(function(err) {
                    console.warn('Thumbnail upload failed:', err);
                    thumbUploaded = true;
                    thumbResult = { error: err.message };
                    checkComplete();
                });
            });
        });
    }

    function uploadFiles(files, onProgress, categories) {
        if (!files || !files.length) {
            return Promise.resolve({ success: 0, total: 0, failed: [] });
        }
        
        var total = files.length;
        var completed = 0;
        var failed = [];
        
        _emit('uploadStarted', { total: total, files: files.map(function(f) { return f.name; }) });
        
        function processNext(index) {
            if (index >= total) {
                var result = {
                    success: completed,
                    total: total,
                    failed: failed.slice(),
                };
                BlobUtils.clearCache(_cacheKey);
                _emit('uploadComplete', result);
                
                if (completed > 0) {
                    _selectedFiles = [];
                    _emit('selectionChanged', { selectedFiles: [], count: 0 });
                }
                
                return Promise.resolve(result);
            }
            
            var file = files[index];
            
            return uploadVideoWithThumbnail(file, function(progress) {
                var overallPercent = Math.round((completed / total) * 100) + (progress.percent / total);
                
                if (typeof onProgress === 'function') {
                    onProgress({
                        overallPercent: overallPercent,
                        currentFileIndex: index,
                        totalFiles: total,
                        completed: completed,
                        failed: failed.length,
                        currentFileName: file.name,
                        phase: progress.phase,
                        phaseLabel: progress.phase === 'video' ? 'Uploading video' : 'Uploading thumbnail',
                    });
                }
                _emit('uploadProgress', {
                    overallPercent: overallPercent,
                    currentFileIndex: index,
                    totalFiles: total,
                    completed: completed,
                    failed: failed.length,
                    currentFileName: file.name,
                    phase: progress.phase,
                    phaseLabel: progress.phase === 'video' ? 'Uploading video' : 'Uploading thumbnail',
                });
            }).then(function(result) {
                completed++;
                return processNext(index + 1);
            }).catch(function(err) {
                failed.push({ name: file.name, error: err.message || 'Unknown error' });
                return processNext(index + 1);
            });
        }
        
        return processNext(0);
    }

    function uploadSelectedFiles(onProgress) {
        if (_selectedFiles.length === 0) {
            return Promise.resolve({ success: 0, total: 0, failed: [] });
        }
        return uploadFiles(_selectedFiles.slice(), onProgress);
    }

    function openSlideshow(index, videoUrls) {
        var urls = videoUrls;
        if (!urls || !urls.length) {
            urls = _currentVideos.map(function(vid) {
                return vid.url;
            });
        }
        
        if (!urls.length) return null;
        
        _slideshowVideos = urls;
        _slideshowIndex = Math.min(Math.max(0, index), urls.length - 1);
        _slideshowOpen = true;
        
        var state = getSlideshowState();
        _emit('slideshowOpened', state);
        
        return state;
    }

    function closeSlideshow() {
        _slideshowOpen = false;
        _emit('slideshowClosed', { wasOpen: true });
    }

    function nextSlide() {
        if (!_slideshowOpen || _slideshowVideos.length <= 1) return null;
        _slideshowIndex = (_slideshowIndex + 1) % _slideshowVideos.length;
        var state = getSlideshowState();
        _emit('slideshowChanged', state);
        return state;
    }

    function prevSlide() {
        if (!_slideshowOpen || _slideshowVideos.length <= 1) return null;
        _slideshowIndex = (_slideshowIndex - 1 + _slideshowVideos.length) % _slideshowVideos.length;
        var state = getSlideshowState();
        _emit('slideshowChanged', state);
        return state;
    }

    function getSlideshowState() {
        return {
            isOpen: _slideshowOpen,
            videos: _slideshowVideos.slice(),
            currentIndex: _slideshowIndex,
            currentUrl: _slideshowVideos[_slideshowIndex] || null,
            total: _slideshowVideos.length,
        };
    }

    function getVideos() {
        return _currentVideos.slice();
    }

    function getApiBase() {
        return _apiBase;
    }

    function getJfrKey() {
        return _jfrKey;
    }

    function getStoreId() {
        return _storeId;
    }

    return {
        configure: configure,
        getApiBase: getApiBase,
        getStoreId: getStoreId,
        getJfrKey: getJfrKey,
        getUploadCategory: function() {
            return _uploadCategory;
        },
        on: _on,
        off: _off,
        fetchVideos: fetchVideos,
        deleteVideo: deleteVideo,
        testConnection: testConnection,
        getVideos: getVideos,
        addFiles: addFiles,
        clearSelectedFiles: clearSelectedFiles,
        getSelectedFiles: getSelectedFiles,
        filterDuplicateFiles: BlobUtils.filterDuplicateFiles,
        uploadFiles: uploadFiles,
        uploadSelectedFiles: uploadSelectedFiles,
        uploadVideoWithThumbnail: uploadVideoWithThumbnail,
        generateThumbnailFromFile: generateThumbnailFromFile,
        openSlideshow: openSlideshow,
        closeSlideshow: closeSlideshow,
        nextSlide: nextSlide,
        prevSlide: prevSlide,
        getSlideshowState: getSlideshowState,
        formatFileSize: BlobUtils.formatFileSize,
        getFileNameFromPath: BlobUtils.getFileNameFromPath,
        isFileNameDuplicate: function(fileName) {
            return BlobUtils.isFileNameDuplicate(fileName, _currentVideos);
        }
    };
})();

var ImageDBApp = (function () {
    'use strict';

    var storedKey, unlockModal, unlockPassword, unlockBtn, unlockError, unlockErrorMsg;
    var explorer, galleryGrid, summaryTotal, summaryLast, pageTitle, contentDesc;
    var fileInput, dropZone, previewGrid, uploadBtn, clearBtn, progressBar, progressText, uploadProgressDiv;
    var storeIdDisplay, apiEndpointDisplay, testResult;
    var clockDay, clockHours, clockMinutes, clockAmpm;
    var slideshowOverlay, slideshowImg, slideshowLoader, slideshowCounter;
    var modalOverlay, modalMessage, modalButtons;
    var dropdownRow, folderUpBtn;
    var categoryInput, saveCategoryBtn;
    var secretInput, setBtn;

    var modalHelpers;

    function showUnlockModal(show) {
        if (show) {
            unlockModal.classList.remove('hidden');
            unlockModal.classList.add('flex');
            setTimeout(() => {
                unlockPassword.focus();
            }, 100);
        } else {
            unlockModal.classList.add('hidden');
            unlockModal.classList.remove('flex');
        }
    }

    function attemptUnlock() {
        var password = unlockPassword.value.trim();
        if (!password) {
            unlockErrorMsg.textContent = 'Please enter a password.';
            unlockError.classList.remove('hidden');
            return;
        }

        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Unlocking…';
        unlockError.classList.add('hidden');

        var jfrKey = ImageDB.getJfrKey();
        KeyEncryptor.decrypt(jfrKey, password)
            .then(function(decrypted) {
                localStorage.setItem("img-blob-db-key", decrypted);
                window.location.reload();
            })
            .catch(function(err) {
                modalHelpers.showAlert('❌ Unlock failed: ' + err.message);
                unlockErrorMsg.textContent = 'Invalid password. Please try again.';
                unlockError.classList.remove('hidden');
                unlockPassword.value = '';
                unlockPassword.focus();
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = '<i class="fa-solid fa-key"></i> Unlock';
            });
    }

    function syncPathFromDropdowns() {
        if (!explorer) return;
        const selects = dropdownRow.querySelectorAll('select');
        const newPath = [];
        for (const select of selects) {
            const val = select.value;
            if (!val) break;
            newPath.push(val);
        }
        explorer.navigateToFolder(newPath);
        renderDropdowns();
        renderGalleryFromExplorer();
        updateFolderUpBtn();
    }

    function renderDropdowns() {
        if (!explorer) return;
        dropdownRow.innerHTML = '';
        const currentPath = explorer.getCurrentPath();

        for (let i = 0; i <= currentPath.length; i++) {
            const parentParts = currentPath.slice(0, i);
            const siblings = explorer.getChildFolders(parentParts);
            if (siblings.length === 0) break;
            const selectedValue = (i < currentPath.length) ? currentPath[i] : '';

            const wrapper = document.createElement('div');
            wrapper.className = 'flex items-center overflow-hidden h-full';
            const select = document.createElement('select');
            select.className = 'bg-[#1a2e36] border border-cyan-400/30 rounded-md p-0.5 px-1 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400/70 appearance-none cursor-pointer max-w-[56px] h-full max-h-full truncate';
            select.innerHTML = `<option value="">${i === 0 ? 'Select folder...' : 'Select...'}</option>`;
            siblings.forEach(folder => {
                const opt = document.createElement('option');
                opt.value = folder;
                opt.textContent = folder;
                if (folder === selectedValue) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', syncPathFromDropdowns);
            wrapper.appendChild(select);
            dropdownRow.appendChild(wrapper);
        }
    }

    function updateFolderUpBtn() {
        if (!explorer) return;
        const path = explorer.getCurrentPath();
        folderUpBtn.disabled = path.length === 0;
        folderUpBtn.onclick = () => {
            if (path.length === 0) return;
            const parent = path.slice(0, -1);
            explorer.navigateToFolder(parent);
            renderDropdowns();
            renderGalleryFromExplorer();
            updateFolderUpBtn();
        };
    }

    function isVideoFile(blob) {
        if (!blob) return false;
        if (blob.type && blob.type.startsWith('video/')) return true;
        const ext = blob.pathname ? blob.pathname.split('.').pop().toLowerCase() : '';
        const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp'];
        return videoExtensions.includes(ext);
    }
    
    function renderTopLevelFolderCard() {
        const allBlobs = explorer.getAllFiles();
        const folders = BlobUtils.getTopLevelFolders(allBlobs, 'uploads');
        
        if (folders.length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center text-white/40 text-[10px] mt-8">No folders available.</div>';
            return;
        }
        
        const folderCardsHTML = folders.map(folder => {
            const prefix = 'uploads/' + folder + '/';
            const total = allBlobs.filter(b => b.pathname.startsWith(prefix)).length;
            return `
            <div class="folder-card image-card relative bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-transform duration-150 hover:scale-[1.02] cursor-pointer w-full flex items-center justify-center" data-folder="${folder}">
                <div class="aspect-square relative flex items-center justify-center bg-white/5 w-[90%]">
                    <i class="fa-solid fa-folder-open text-5xl text-cyan-300"></i>
                            <i class="absolute top-0 right-0 fa-solid fa-folder-open text-cyan-300 text-[12px]"></i>
                </div>
                <div class="absolute bottom-0 left-0 w-full p-[2px] flex justify-end bg-gradient-to-t from-black/70 to-transparent rounded-b-lg flex-nowrap overflow-hidden max-w-full min-w-0 items-center">
                    <div class="text-[7px] text-cyan-300 text-right">${total} Images</div>
                </div>
                <span class="absolute top-[0px] left-[0px] p-[2px] text-[8px] text-white bg-gradient-to-t from-black/70 to-transparent rounded-b-lg truncate">${folder}</span>
            </div>`;
        }).join('');
        
        galleryGrid.innerHTML = folderCardsHTML;
        
        galleryGrid.querySelectorAll('.folder-card').forEach(card => {
            card.addEventListener('click', function() {
                const folder = this.dataset.folder;
                if (!folder) return;
                explorer.navigateToFolder(['uploads', folder]);
                renderDropdowns();
                renderGalleryFromExplorer();
                updateFolderUpBtn();
            });
        });
    }

    function renderFolder(folderName, folderData) {
        const photos = folderData.images.slice(0, 3);
        const posClasses = ['pos-1', 'pos-2', 'pos-3'];
        
        let photosHTML = photos.map((photo, index) => {
            const posClass = posClasses[index] || 'pos-1';
            return `
                <div class="pc-photo absolute w-full h-full p-[5%_5%_10%] rounded-[2%] overflow-hidden ${posClass}">
                    <div class="pc-img w-full h-full bg-cover bg-center bg-[#1a2e36] rounded-[1%]" style="background-image: url('${photo.url}');"></div>
                </div>
            `;
        }).join('');
        
        const displayName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
        
        return `
            <div class="folder relative w-[85%] aspect-square mx-auto rotate-[${(Math.random()*6-3).toFixed(2)}deg] transition-transform duration-300 hover:rotate-0 hover:-translate-y-1 hover:scale-[1.02] hover:z-30" data-folder="${folderName}">
                <button type="button" class="folder-btn absolute w-full h-full left-0 top-0 bg-transparent border-0 p-0 m-0 font-inherit text-inherit cursor-pointer overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] focus-visible:ring-offset-2">
                    <div class="folder-name absolute bottom-[5%] left-[5%] rotate-[-3deg] origin-bottom-left font-bold text-[1em] leading-none text-[#e5e7eb] tracking-normal whitespace-nowrap z-50 pointer-events-none bg-[#1a2e36]/90 rounded-md px-2 py-1 border border-cyan-400/20">
                        ${displayName}
                    </div>
                    ${photosHTML}
                    <div class="absolute left-[-8px] top-[-8px] z-50 font-bold text-lg text-cyan-300 flex items-center justify-center">
                        <i class="fa-solid fa-folder-open"></i>
                    </div>
                    <div class="absolute right-[-8px] top-[-8px] z-50 bg-[#2b2820] text-white font-bold tracking-wider py-0 px-[3px] rounded-full border-[1.5px] border-white count-badge pointer-events-none flex items-center justify-center">
                        <span class="text-[0.6em]">${folderData.total}</span>
                    </div>
                </button>
            </div>
        `;
    }

    function updateSummaryForFolderView(folderCount, totalImages) {
        const summaryContainer = document.getElementById('id-summary-container');
        if (!summaryContainer) return;
        
        summaryContainer.innerHTML = `
            <span><i class="fa-solid fa-folder-open text-cyan-300 mr-1"></i> Folder: <span id="summary-total-count" class="text-white font-semibold">${folderCount}</span></span>
            <span class="text-white/20">|</span>
            <span><i class="fa-regular fa-image text-cyan-300 mr-1"></i> Total Images: <span id="summary-last-upload" class="text-white font-semibold">${totalImages}</span></span>
        `;
        
        summaryTotal = document.getElementById('summary-total-count');
        summaryLast = document.getElementById('summary-last-upload');
    }

    function resetSummaryToNormal() {
        const summaryContainer = document.getElementById('id-summary-container');
        if (!summaryContainer) return;
        
        summaryContainer.innerHTML = `
            <span><i class="fa-solid fa-video text-cyan-300 mr-1"></i> Total: <span id="summary-total-count" class="text-white font-semibold">0</span></span>
            <span class="text-white/20">|</span>
            <span><i class="fa-regular fa-clock text-cyan-300 mr-1"></i> Last upload: <span id="summary-last-upload" class="text-white font-semibold">—</span></span>
        `;
        
        summaryTotal = document.getElementById('summary-total-count');
        summaryLast = document.getElementById('summary-last-upload');
    }

    function renderTopLevelFolderCards() {
        const allBlobs = explorer.getAllFiles();
        const foldersData = BlobUtils.getRandomBlobsFromFolders(allBlobs, 'uploads', 3);
        
        if (Object.keys(foldersData).length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center text-white/40 text-[10px] mt-8">No folders available.</div>';
            updateSummaryForFolderView(0, 0);
            return;
        }
        
        const folderCount = Object.keys(foldersData).length;
        const totalImages = Object.values(foldersData).reduce((sum, data) => sum + data.total, 0);
        
        updateSummaryForFolderView(folderCount, totalImages);
        
        let allFoldersHTML = '';
        for (const [name, data] of Object.entries(foldersData)) {
            allFoldersHTML += renderFolder(name, data);
        }
        galleryGrid.innerHTML = allFoldersHTML;
        
        galleryGrid.querySelectorAll('.folder').forEach(folderEl => {
            const folderName = folderEl.dataset.folder;
            if (!folderName) return;
            folderEl.addEventListener('click', function() {
                explorer.navigateToFolder(['uploads', folderName]);
                renderDropdowns();
                renderGalleryFromExplorer();
                updateFolderUpBtn();
            });
        });
    }

    function renderGalleryFromExplorer() {
        if (!explorer) return;
        if (explorer.getCurrentPathString() === 'uploads') {
            renderTopLevelFolderCards();
            return;
        }
        resetSummaryToNormal();
        const allFiles = explorer.getFilesInCurrentFolder();
        const files = allFiles.filter(file => !isVideoFile(file));
        summaryTotal.textContent = files.length;

        if (files.length > 0) {
            const last = files.reduce((a, b) => {
                const aDate = a.lastModified ?? a.uploadedAt;
                const bDate = b.lastModified ?? b.uploadedAt;
                return aDate > bDate ? a : b;
            });
            const displayDate = last.lastModified ?? last.uploadedAt;
            summaryLast.textContent = displayDate ? BlobUtils.formatFullDate(displayDate) : '—';
        } else {
            summaryLast.textContent = '—';
        }

        if (files.length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center text-white/40 text-[10px] mt-8">No images in this folder.</div>';
            return;
        }

        galleryGrid.innerHTML = files.map((img, idx) => {
            const sizeText = FolderExplorer.formatSize(img.size);
            const dateText = BlobUtils.formatToMonthYear(img.lastModified || img.uploadedAt);
            const fileName = img.pathname.split('/').pop();
            return `
            <div class="image-card relative bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-transform duration-150 hover:scale-[1.02] cursor-pointer w-full flex items-center justify-center" data-index="${idx}">
                <div class="aspect-square relative flex items-center justify-center bg-white/10 animate-pulse w-[90%]">
                    <img src="${img.url}" alt="${fileName}" class="max-w-full h-full object-cover opacity-0 transition-opacity duration-500" loading="lazy"
                        onload="this.style.opacity='1'; this.parentElement.classList.remove('bg-white/10','animate-pulse');"
                        onerror="this.style.display='none'; this.parentElement.classList.remove('bg-white/10','animate-pulse'); this.parentElement.innerHTML+='<div class=&quot;absolute inset-0 flex items-center justify-center text-white/30&quot;><i class=&quot;fa-solid fa-image&quot;></i></div>';" />
                    <button class="delete-btn absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] transition-colors z-10" data-path="${img.pathname}" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <div class="absolute bottom-0 left-0 w-full p-[2px] flex justify-between bg-gradient-to-t from-black/70 to-transparent rounded-b-lg flex-nowrap overflow-hidden max-w-full min-w-0 items-center">
                    <div class="flex-1 truncate text-[7px] text-white/80" title="${img.pathname}">${fileName}</div>
                    <div class="text-[7px] text-cyan-300 text-right">${sizeText}</div>
                </div>
                <span class="absolute top-[0px] left-[0px] p-[2px] text-[7px] text-white bg-gradient-to-t from-black/70 to-transparent rounded-b-lg truncate">${dateText}</span>
            </div>`;
        }).join('');

        galleryGrid.querySelectorAll('.image-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.delete-btn')) return;
                const index = parseInt(this.dataset.index, 10);
                if (!isNaN(index)) {
                    const urls = files.map(f => f.url);
                    ImageDB.openSlideshow(index, urls);
                }
            });
        });

        galleryGrid.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const path = this.dataset.path;
                modalHelpers.showConfirm(`Delete "${path.split('/').pop()}"?`, async function() {
                    await ImageDB.deleteImage(path);
                    ImageDB.fetchImages();
                });
            });
        });
    }

    function initExplorer(images, storeId) {
        const validImages = images.filter(function(img) {
            return img && typeof img.pathname === 'string' && img.pathname.length > 0;
        });
        explorer = FolderExplorer.create({ blobs: validImages, storeId: storeId || '' });
        explorer.navigateToFolder(['uploads']);
        renderDropdowns();
        renderGalleryFromExplorer();
        updateFolderUpBtn();
    }

    function compressIfLarge(file) {
        if (file.size <= 4.5 * 1024 * 1024) return Promise.resolve(file);

        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 1920;
                let w = img.width, h = img.height;
                if (w > maxW) { h = (maxW / w) * h; w = maxW; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(blob => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: file.lastModified
                    }));
                }, 'image/jpeg', 0.85);
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }

    function clearSelectionUI() {
        ImageDB.clearSelectedFiles();
        renderPreviews([]);
        fileInput.value = '';
        uploadProgressDiv.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
    }

    function renderPreviews(files) {
        previewGrid.innerHTML = '';
        files.forEach((file, idx) => {
            const url = URL.createObjectURL(file);
            const div = document.createElement('div');
            div.className = 'relative aspect-square rounded overflow-hidden border border-white/20';
            div.innerHTML = `
                <img src="${url}" class="w-full h-full object-cover" />
                <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-[6px] text-white truncate px-1">${file.name}</div>
                <span class="absolute top-0 right-0 bg-red-500/80 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full cursor-pointer remove-file" data-index="${idx}">×</span>`;
            previewGrid.appendChild(div);
        });
        previewGrid.querySelectorAll('.remove-file').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.index, 10);
                const filesArr = ImageDB.getSelectedFiles();
                filesArr.splice(idx, 1);
                ImageDB.clearSelectedFiles();
                if (filesArr.length) ImageDB.addFiles(filesArr);
                else renderPreviews([]);
            });
        });
        uploadBtn.disabled = files.length === 0;
    }

    function loadSlideshowImage(url, index, total) {
        slideshowImg.classList.remove('loaded');
        slideshowLoader.style.display = 'block';
        slideshowImg.style.opacity = '0';
        slideshowCounter.textContent = (index + 1) + ' / ' + total;
        const img = new Image();
        img.onload = function() {
            slideshowImg.src = url;
            slideshowLoader.style.display = 'none';
            slideshowImg.style.opacity = '1';
        };
        img.onerror = function() {
            slideshowLoader.style.display = 'none';
            slideshowImg.style.opacity = '1';
            slideshowImg.alt = 'Failed to load';
        };
        img.src = url;
        if (img.complete) {
            slideshowImg.src = url;
            slideshowLoader.style.display = 'none';
            slideshowImg.style.opacity = '1';
        }
    }

    function setActiveTab(tabBtn) {
        const common = 'flex-1 text-center py-0.5 text-[9px] transition-colors';
        const active = 'text-white border-b-[1.5px] border-cyan-400 font-medium';
        const inactive = 'text-white/60 border-b-[1.5px] border-transparent hover:text-white hover:border-cyan-400/50';
        document.querySelectorAll('#tab-bar .tab-btn').forEach(btn => {
            const icon = btn.querySelector('i');
            if (btn === tabBtn) {
                btn.className = `tab-btn ${common} ${active}`;
                if (icon) icon.classList.add('text-cyan-300');
            } else {
                btn.className = `tab-btn ${common} ${inactive}`;
                if (icon) icon.classList.remove('text-cyan-300');
            }
        });
        document.querySelectorAll('#tab-container > div > [id^="tab-pane-"]').forEach(p => p.classList.add('hidden'));
        const paneId = 'tab-pane-' + tabBtn.id.replace('tab-', '');
        const pane = document.getElementById(paneId);
        if (pane) pane.classList.remove('hidden');
        if (tabBtn.dataset.title) contentDesc.textContent = tabBtn.dataset.title;
    }

    function setActiveNav(navBtn) {
        document.querySelectorAll('#app-sidebar .nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn === navBtn);
        });
    }

    function initImageApp() {
        storedKey = localStorage.getItem("img-blob-db-key");
        unlockModal = document.getElementById('unlock-modal');
        unlockPassword = document.getElementById('unlock-password');
        unlockBtn = document.getElementById('unlock-btn');
        unlockError = document.getElementById('unlock-error');
        unlockErrorMsg = document.getElementById('unlock-error-msg');

        galleryGrid = document.getElementById('gallery-grid');
        summaryTotal = document.getElementById('summary-total-count');
        summaryLast = document.getElementById('summary-last-upload');
        pageTitle = document.getElementById('page-title');
        contentDesc = document.getElementById('content-desc');

        fileInput = document.getElementById('file-input');
        dropZone = document.getElementById('drop-zone');
        previewGrid = document.getElementById('file-preview-grid');
        uploadBtn = document.getElementById('upload-btn');
        clearBtn = document.getElementById('clear-btn');
        progressBar = document.getElementById('progress-bar');
        progressText = document.getElementById('progress-text');
        uploadProgressDiv = document.getElementById('upload-progress');

        storeIdDisplay = document.getElementById('store-id-display');
        apiEndpointDisplay = document.getElementById('api-endpoint-display');
        testResult = document.getElementById('test-result');

        clockDay = document.getElementById('clock-day');
        clockHours = document.getElementById('clock-hours');
        clockMinutes = document.getElementById('clock-minutes');
        clockAmpm = document.getElementById('clock-ampm');

        slideshowOverlay = document.getElementById('slideshow-overlay');
        slideshowImg = document.getElementById('slideshow-image');
        slideshowLoader = document.querySelector('.slideshow-loader');
        slideshowCounter = document.getElementById('slideshow-counter');
        modalOverlay = document.getElementById('custom-modal-overlay');
        modalMessage = document.getElementById('modal-message');
        modalButtons = document.getElementById('modal-buttons');

        dropdownRow = document.getElementById('dropdown-row');
        folderUpBtn = document.getElementById('folder-up-btn');

        categoryInput = document.getElementById('upload-category-input');
        saveCategoryBtn = document.getElementById('save-category-btn');

        secretInput = document.getElementById('api-secretkey-input');
        setBtn = document.getElementById('set-secretkey-btn');

        modalHelpers = BlobUtils.createModalHelpers(modalOverlay, modalMessage, modalButtons);

        if (!storedKey) {
            showUnlockModal(true);
            unlockBtn.addEventListener('click', attemptUnlock);
            unlockPassword.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    attemptUnlock();
                }
            });
            return;
        }

        ImageDB.configure({ apiSecretKey: storedKey });

        if (secretInput && storedKey) {
            secretInput.value = storedKey;
        }

        if (setBtn) {
            setBtn.addEventListener('click', function() {
                var newKey = secretInput.value.trim();
                if (!newKey) {
                    modalHelpers.showAlert('Please enter a valid secret key.');
                    return;
                }
                localStorage.setItem('img-blob-db-key', newKey);
                ImageDB.configure({ apiSecretKey: newKey });
                modalHelpers.showAlert('Secret key saved successfully!');
            });
        }

        BlobUtils.updateClock(clockDay, clockHours, clockMinutes, clockAmpm);
        setInterval(function() { BlobUtils.updateClock(clockDay, clockHours, clockMinutes, clockAmpm); }, 1000);

        ImageDB.on('imagesLoaded', function(data) {
            var validImages = (data.images || []).filter(function(img) {
                return img && typeof img.pathname === 'string' && img.pathname.length > 0;
            });
            initExplorer(validImages, data.storeId);
            
            storeIdDisplay.textContent = data.storeId || '—';
            apiEndpointDisplay.textContent = ImageDB.getApiBase();
        });

        ImageDB.on('imagesFetchError', function(data) {
            galleryGrid.innerHTML = `<div class="col-span-full text-center text-red-400 text-[10px] mt-8"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ${data.message}</div>`;
        });

        ImageDB.on('imagesLoading', function() {
            galleryGrid.innerHTML = `<div class="col-span-full text-center text-white/50 text-[10px] mt-8"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading…</div>`;
        });

        ImageDB.on('uploadStarted', function() {
            uploadProgressDiv.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            uploadBtn.disabled = true;
            clearBtn.disabled = true;
        });
        ImageDB.on('uploadProgress', function(p) {
            progressBar.style.width = p.overallPercent + '%';
            progressText.textContent = p.overallPercent + '%';
        });
        ImageDB.on('uploadComplete', function(result) {
            uploadProgressDiv.classList.add('hidden');
            uploadBtn.disabled = false;
            clearBtn.disabled = false;
            if (result.failed.length === 0) {
                modalHelpers.showAlert(`✅ Successfully uploaded ${result.success} image(s)!`);
            } else {
                const msg = `Uploaded ${result.success} of ${result.total}. Errors:\n${result.failed.map(f => f.name + ': ' + f.error).join('\n')}`;
                modalHelpers.showAlert(msg);
            }
            clearSelectionUI();
            ImageDB.fetchImages();
        });

        ImageDB.on('slideshowOpened', function(state) {
            if (!state) return;
            slideshowOverlay.classList.remove('hidden', 'opacity-0');
            slideshowOverlay.classList.add('flex', 'opacity-100');
            document.body.style.overflow = 'hidden';
            loadSlideshowImage(state.currentUrl, state.currentIndex, state.total);
        });
        ImageDB.on('slideshowClosed', function() {
            slideshowOverlay.classList.add('hidden', 'opacity-0');
            slideshowOverlay.classList.remove('flex', 'opacity-100');
            document.body.style.overflow = '';
        });
        ImageDB.on('slideshowChanged', function(state) {
            if (!state) return;
            loadSlideshowImage(state.currentUrl, state.currentIndex, state.total);
        });

        fileInput.addEventListener('change', function() {
            if (this.files.length) ImageDB.addFiles(this.files);
            this.value = '';
        });
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('border-cyan-400', 'bg-cyan-400/10');
        });
        dropZone.addEventListener('dragleave', function() {
            dropZone.classList.remove('border-cyan-400', 'bg-cyan-400/10');
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('border-cyan-400', 'bg-cyan-400/10');
            if (e.dataTransfer.files.length) ImageDB.addFiles(e.dataTransfer.files);
        });
        dropZone.addEventListener('click', function(e) {
            fileInput.click();
        });

        uploadBtn.addEventListener('click', async function() {
            const files = ImageDB.getSelectedFiles();
            if (!files.length) return;

            const processedFiles = await Promise.all(
                files.map(file => compressIfLarge(file))
            );

            const baseCategory = ImageDB.getUploadCategory ? ImageDB.getUploadCategory() : 'screenshots';
            const categories = processedFiles.map(file => {
                const d = new Date(file.lastModified);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${baseCategory}/${year}/${month}/${day}`;
            });

            ImageDB.uploadFiles(processedFiles, null, categories);
        });

        clearBtn.addEventListener('click', function() {
            clearSelectionUI();
        });
        ImageDB.on('selectionChanged', function(data) {
            renderPreviews(data.selectedFiles);
        });
        ImageDB.on('selectionCleared', function() { renderPreviews([]); });

        categoryInput.value = ImageDB.getUploadCategory ? ImageDB.getUploadCategory() : 'screenshots';
        ImageDB.on('configured', function(config) {
            if (config.uploadCategory) categoryInput.value = config.uploadCategory;
        });
        saveCategoryBtn.addEventListener('click', function() {
            const newCategory = categoryInput.value.trim();
            if (!newCategory) return modalHelpers.showAlert('Category name cannot be empty.');
            ImageDB.configure({ uploadCategory: newCategory });
            modalHelpers.showAlert(`Upload category updated to "${newCategory}".`);
        });

        document.getElementById('test-connection-btn').addEventListener('click', function() {
            testResult.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Testing…';
            ImageDB.testConnection().then(function(result) {
                if (result.connected) {
                    storeIdDisplay.textContent = result.storeId || '—';
                    apiEndpointDisplay.textContent = ImageDB.getApiBase();
                    testResult.innerHTML = '<i class="fa-solid fa-check-circle text-green-400 mr-1"></i> Connected';
                    testResult.className = 'text-[9px] text-green-400 self-center';
                } else {
                    testResult.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-400 mr-1"></i> ' + result.message;
                    testResult.className = 'text-[9px] text-red-400 self-center';
                }
            });
        });

        document.querySelectorAll('#tab-bar .tab-btn').forEach(btn => {
            btn.addEventListener('click', function() { setActiveTab(this); });
        });
        document.querySelectorAll('#app-sidebar .nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                setActiveNav(this);
                const tabId = this.id.replace('nav-', 'tab-');
                const tabBtn = document.getElementById(tabId);
                if (tabBtn) setActiveTab(tabBtn);
            });
        });

        document.getElementById('refresh-btn').addEventListener('click', function() {
            BlobUtils.clearCache('imageDB_cache_v1');
            ImageDB.fetchImages();
        });

        document.querySelector('.close-btn').addEventListener('click', function() { ImageDB.closeSlideshow(); });
        document.getElementById('slideshow-prev').addEventListener('click', function() { ImageDB.prevSlide(); });
        document.getElementById('slideshow-next').addEventListener('click', function() { ImageDB.nextSlide(); });

        document.addEventListener('keydown', function(e) {
            if (!ImageDB.getSlideshowState().isOpen) return;
            if (e.key === 'Escape') ImageDB.closeSlideshow();
            if (e.key === 'ArrowLeft') ImageDB.prevSlide();
            if (e.key === 'ArrowRight') ImageDB.nextSlide();
        });
        slideshowOverlay.addEventListener('click', function(e) { if (e.target === slideshowOverlay) ImageDB.closeSlideshow(); });
        let touchStartX = 0;
        slideshowOverlay.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].screenX; });
        slideshowOverlay.addEventListener('touchend', function(e) {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) ImageDB.nextSlide();
                else ImageDB.prevSlide();
            }
        });

        apiEndpointDisplay.textContent = ImageDB.getApiBase();
        ImageDB.fetchImages();
    }

    return {
        init: initImageApp,
        showAlert: function(msg, cb) { modalHelpers.showAlert(msg, cb); },
        showConfirm: function(msg, onConfirm, onCancel) { modalHelpers.showConfirm(msg, onConfirm, onCancel); }
    };
})();

var VideoDBApp = (function () {
    'use strict';

    var storedKey, unlockModal, unlockPassword, unlockBtn, unlockError, unlockErrorMsg;
    var allBlobs, currentVideos;
    var galleryGrid, summaryTotal, summaryLast, pageTitle, contentDesc;
    var fileInput, dropZone, previewGrid, uploadBtn, clearBtn, progressBar, progressText, uploadProgressDiv;
    var storeIdDisplay, apiEndpointDisplay, testResult;
    var clockDay, clockHours, clockMinutes, clockAmpm;
    var slideshowOverlay, slideshowVideo, slideshowLoader, slideshowCounter;
    var modalOverlay, modalMessage, modalButtons;
    var categoryInput, saveCategoryBtn;
    var secretInput, setBtn;

    var modalHelpers;

    function showUnlockModal(show) {
        if (show) {
            unlockModal.classList.remove('hidden');
            unlockModal.classList.add('flex');
            setTimeout(() => {
                unlockPassword.focus();
            }, 100);
        } else {
            unlockModal.classList.add('hidden');
            unlockModal.classList.remove('flex');
        }
    }

    function attemptUnlock() {
        var password = unlockPassword.value.trim();
        if (!password) {
            unlockErrorMsg.textContent = 'Please enter a password.';
            unlockError.classList.remove('hidden');
            return;
        }

        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Unlocking…';
        unlockError.classList.add('hidden');

        var jfrKey = VideoDB.getJfrKey();
        KeyEncryptor.decrypt(jfrKey, password)
            .then(function(decrypted) {
                localStorage.setItem("vid-blob-db-key", decrypted);
                window.location.reload();
            })
            .catch(function(err) {
                modalHelpers.showAlert('❌ Unlock failed: ' + err.message);
                unlockErrorMsg.textContent = 'Invalid password. Please try again.';
                unlockError.classList.remove('hidden');
                unlockPassword.value = '';
                unlockPassword.focus();
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = '<i class="fa-solid fa-key"></i> Unlock';
            });
    }

    function renderGallery() {
        const files = currentVideos;
        summaryTotal.textContent = files.length;

        if (files.length > 0) {
            const last = files.reduce((a, b) => {
                const aDate = a.lastModified ?? a.uploadedAt;
                const bDate = b.lastModified ?? b.uploadedAt;
                return aDate > bDate ? a : b;
            });
            const displayDate = last.lastModified ?? last.uploadedAt;
            summaryLast.textContent = displayDate ? BlobUtils.formatFullDate(displayDate) : '—';
        } else {
            summaryLast.textContent = '—';
        }

        if (files.length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center text-white/40 text-[10px] mt-8">No videos in this folder.</div>';
            return;
        }

        galleryGrid.innerHTML = files.map((vid, idx) => {
            const sizeText = BlobUtils.formatFileSize(vid.size);
            const dateText = BlobUtils.formatToMonthYear(vid.lastModified || vid.uploadedAt);
            const fileName = vid.pathname ? vid.pathname.split('/').pop() : 'unknown';
            const baseName = fileName.replace(/\.[^.]+$/, '');
            const thumbPath = 'uploads/videos/thumbnails/' + baseName + '.jpg';
            const thumbBlob = allBlobs.find(b => b.pathname === thumbPath);
            const thumbnailUrl = thumbBlob ? thumbBlob.url : null;

            return `
            <div class="video-card relative bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-transform duration-150 hover:scale-[1.02] cursor-pointer w-full flex items-center justify-center" data-index="${idx}">
                <div class="aspect-square relative flex items-center justify-center bg-black/50 w-[90%]">
                    <video src="${vid.url}" 
                           class="max-w-full h-full object-cover opacity-0 transition-opacity duration-500" 
                           muted 
                           preload="metadata"
                           poster="${thumbnailUrl || ''}"
                           onloadedmetadata="this.style.opacity='1'; this.parentElement.classList.remove('bg-black/50');"
                           onerror="this.style.display='none'; this.parentElement.classList.remove('bg-black/50');">
                    </video>
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div class="w-6 h-6 rounded-full bg-black/60 hover:bg-black/40 flex items-center justify-center transition-colors">
                            <i class="fa-solid fa-play text-white text-sm ml-0.5"></i>
                        </div>
                    </div>
                    <button class="delete-btn absolute top-[1px] right-[1px] bg-black/50 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[8px] transition-colors z-10" data-path="${vid.pathname}" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    ${vid.duration ? `<span class="absolute bottom-12 right-1 bg-black/70 text-white text-[8px] px-1.5 py-0.5 rounded">${BlobUtils.formatDuration(vid.duration)}</span>` : ''}
                </div>
                <div class="absolute bottom-0 left-0 w-full p-[2px] flex justify-between bg-gradient-to-t from-black/70 to-transparent rounded-b-lg flex-nowrap overflow-hidden max-w-full min-w-0 items-center">
                    <div class="flex-1 truncate text-[7px] text-white/80" title="${vid.pathname || ''}">${fileName}</div>
                    <div class="text-[7px] text-cyan-300 text-right">${sizeText}</div>
                </div>
                <span class="absolute top-[0px] left-[0px] p-[2px] text-[7px] text-white bg-gradient-to-t from-black/70 to-transparent rounded-b-lg truncate">${dateText}</span>
            </div>`;
        }).join('');

        galleryGrid.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.delete-btn')) return;
                const index = parseInt(this.dataset.index, 10);
                if (!isNaN(index)) {
                    const urls = files.map(f => f.url);
                    VideoDB.openSlideshow(index, urls);
                }
            });
        });

        galleryGrid.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const path = this.dataset.path;
                modalHelpers.showConfirm(`Delete "${path ? path.split('/').pop() : 'video'}"?`, async function() {
                    if (path) {
                        const fileName = path.split('/').pop();
                        const baseName = fileName.replace(/\.[^.]+$/, '');
                        const thumbnailPath = 'uploads/videos/thumbnails/' + baseName + '.jpg';
                        try {
                            await VideoDB.deleteVideo(thumbnailPath);
                        } catch (e) {}
                        await VideoDB.deleteVideo(path);
                        VideoDB.fetchVideos();
                    }
                });
            });
        });
    }

    function clearSelectionUI() {
        VideoDB.clearSelectedFiles();
        renderPreviews([]);
        fileInput.value = '';
        uploadProgressDiv.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
    }

    function renderPreviews(files) {
        previewGrid.innerHTML = '';
        files.forEach((file, idx) => {
            const url = URL.createObjectURL(file);
            const div = document.createElement('div');
            div.className = 'relative aspect-square rounded overflow-hidden border border-white/20 transition-all duration-300';
            div.dataset.index = idx;
            div.dataset.uploaded = 'false';

            const container = document.createElement('div');
            container.className = 'w-full h-full relative';
            container.style.background = '#1a2e36';

            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.preload = 'metadata';
            video.className = 'w-full h-full object-cover';
            video.style.opacity = '0';
            container.appendChild(video);

            const canvas = document.createElement('canvas');
            canvas.className = 'w-full h-full object-cover';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            container.appendChild(canvas);

            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
            overlay.innerHTML = `<div class="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"><i class="fa-solid fa-play text-white/80 text-xs"></i></div>`;
            container.appendChild(overlay);

            div.appendChild(container);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'absolute bottom-0 left-0 right-0 bg-black/60 text-[6px] text-white truncate px-1';
            nameDiv.textContent = file.name;
            div.appendChild(nameDiv);

            const statusBtn = document.createElement('span');
            statusBtn.className = 'absolute top-0 right-0 bg-red-500/80 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full cursor-pointer remove-file transition-all duration-300 hover:scale-110';
            statusBtn.textContent = '×';
            statusBtn.dataset.index = idx;
            statusBtn.title = 'Remove from queue';
            div.appendChild(statusBtn);

            previewGrid.appendChild(div);

            const vid = video;
            const canv = canvas;

            vid.addEventListener('loadedmetadata', function() {
                const seekTime = Math.min(1, this.duration * 0.1);
                this.currentTime = seekTime;
            });

            vid.addEventListener('seeked', function() {
                try {
                    const vw = this.videoWidth || 320;
                    const vh = this.videoHeight || 180;
                    canv.width = vw;
                    canv.height = vh;
                    const ctx = canv.getContext('2d');
                    ctx.drawImage(this, 0, 0, vw, vh);
                    canv.style.display = 'none';
                    this.style.opacity = '1';
                } catch (e) {
                    canv.style.display = 'none';
                    this.style.opacity = '1';
                }
            });

            vid.addEventListener('error', function() {
                canv.style.display = 'none';
                this.style.opacity = '1';
            });

            if (vid.readyState >= 2) {
                vid.dispatchEvent(new Event('loadedmetadata'));
            }
        });

        previewGrid.querySelectorAll('.remove-file').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.index, 10);
                const filesArr = VideoDB.getSelectedFiles();
                filesArr.splice(idx, 1);
                VideoDB.clearSelectedFiles();
                if (filesArr.length) {
                    VideoDB.addFiles(filesArr);
                } else {
                    renderPreviews([]);
                }
            });
        });

        uploadBtn.disabled = files.length === 0;
    }

    function loadSlideshowVideo(url, index, total) {
        slideshowVideo.pause();
        slideshowVideo.currentTime = 0;
        slideshowVideo.removeAttribute('poster');
        slideshowVideo.style.opacity = '0';
        slideshowVideo.classList.remove('loaded');

        if (slideshowLoader) slideshowLoader.style.display = 'block';
        if (slideshowCounter) slideshowCounter.textContent = (index + 1) + ' / ' + total;

        const playPauseBtn = document.getElementById('slideshow-play-pause');
        if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }

        const thumbnailUrl = url.replace('/videos/', '/videos/thumbnails/').replace(/\.[^.]+$/, '.jpg');
        slideshowVideo.poster = thumbnailUrl;

        slideshowVideo.src = url;
        slideshowVideo.load();

        slideshowVideo.onloadedmetadata = function() {
            if (slideshowLoader) slideshowLoader.style.display = 'none';
            slideshowVideo.style.opacity = '1';
        };

        slideshowVideo.oncanplay = function() {
            if (slideshowLoader) slideshowLoader.style.display = 'none';
            slideshowVideo.style.opacity = '1';
        };

        slideshowVideo.onerror = function(e) {
            console.error('Video error:', e);
            if (slideshowLoader) slideshowLoader.style.display = 'none';
            slideshowVideo.style.opacity = '1';
        };

        if (slideshowVideo.readyState >= 2) {
            if (slideshowLoader) slideshowLoader.style.display = 'none';
            slideshowVideo.style.opacity = '1';
        }
    }

    function setActiveTab(tabBtn) {
        const common = 'flex-1 text-center py-0.5 text-[9px] transition-colors';
        const active = 'text-white border-b-[1.5px] border-cyan-400 font-medium';
        const inactive = 'text-white/60 border-b-[1.5px] border-transparent hover:text-white hover:border-cyan-400/50';
        document.querySelectorAll('#tab-bar .tab-btn').forEach(btn => {
            const icon = btn.querySelector('i');
            if (btn === tabBtn) {
                btn.className = `tab-btn ${common} ${active}`;
                if (icon) icon.classList.add('text-cyan-300');
            } else {
                btn.className = `tab-btn ${common} ${inactive}`;
                if (icon) icon.classList.remove('text-cyan-300');
            }
        });
        document.querySelectorAll('#tab-container > div > [id^="tab-pane-"]').forEach(p => p.classList.add('hidden'));
        const paneId = 'tab-pane-' + tabBtn.id.replace('tab-', '');
        const pane = document.getElementById(paneId);
        if (pane) pane.classList.remove('hidden');
        if (tabBtn.dataset.title) contentDesc.textContent = tabBtn.dataset.title;
    }

    function setActiveNav(navBtn) {
        const base = 'flex items-center justify-center gap-1.5 p-1.5 rounded transition-colors';
        const activeNav = 'text-white bg-[#057c94] font-medium shadow-sm';
        const inactiveNav = 'border border-cyan-800/10 shadow-sm text-[#0d7088] hover:bg-[#057c94] hover:text-white hover:border-transparent';
        document.querySelectorAll('#app-sidebar .nav-btn').forEach(btn => {
            if (btn === navBtn) btn.className = `nav-btn ${base} ${activeNav}`;
            else btn.className = `nav-btn ${base} ${inactiveNav}`;
        });
        if (navBtn.dataset.title) pageTitle.textContent = navBtn.dataset.title;
    }

    function initVideoApp() {
        storedKey = localStorage.getItem("vid-blob-db-key");
        unlockModal = document.getElementById('unlock-modal');
        unlockPassword = document.getElementById('unlock-password');
        unlockBtn = document.getElementById('unlock-btn');
        unlockError = document.getElementById('unlock-error');
        unlockErrorMsg = document.getElementById('unlock-error-msg');

        galleryGrid = document.getElementById('gallery-grid');
        summaryTotal = document.getElementById('summary-total-count');
        summaryLast = document.getElementById('summary-last-upload');
        pageTitle = document.getElementById('page-title');
        contentDesc = document.getElementById('content-desc');

        fileInput = document.getElementById('file-input');
        dropZone = document.getElementById('drop-zone');
        previewGrid = document.getElementById('file-preview-grid');
        uploadBtn = document.getElementById('upload-btn');
        clearBtn = document.getElementById('clear-btn');
        progressBar = document.getElementById('progress-bar');
        progressText = document.getElementById('progress-text');
        uploadProgressDiv = document.getElementById('upload-progress');

        storeIdDisplay = document.getElementById('store-id-display');
        apiEndpointDisplay = document.getElementById('api-endpoint-display');
        testResult = document.getElementById('test-result');

        clockDay = document.getElementById('clock-day');
        clockHours = document.getElementById('clock-hours');
        clockMinutes = document.getElementById('clock-minutes');
        clockAmpm = document.getElementById('clock-ampm');

        slideshowOverlay = document.getElementById('slideshow-overlay');
        slideshowVideo = document.getElementById('slideshow-video');
        slideshowLoader = document.querySelector('.slideshow-loader');
        slideshowCounter = document.getElementById('slideshow-counter');
        modalOverlay = document.getElementById('custom-modal-overlay');
        modalMessage = document.getElementById('modal-message');
        modalButtons = document.getElementById('modal-buttons');

        categoryInput = document.getElementById('upload-category-input');
        saveCategoryBtn = document.getElementById('save-category-btn');

        secretInput = document.getElementById('api-secretkey-input');
        setBtn = document.getElementById('set-secretkey-btn');

        modalHelpers = BlobUtils.createModalHelpers(modalOverlay, modalMessage, modalButtons);

        if (!storedKey) {
            showUnlockModal(true);
            unlockBtn.addEventListener('click', attemptUnlock);
            unlockPassword.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    attemptUnlock();
                }
            });
            return;
        }

        VideoDB.configure({ apiSecretKey: storedKey });

        if (secretInput && storedKey) {
            secretInput.value = storedKey;
        }

        if (setBtn) {
            setBtn.addEventListener('click', function() {
                var newKey = secretInput.value.trim();
                if (!newKey) {
                    modalHelpers.showAlert('Please enter a valid secret key.');
                    return;
                }
                localStorage.setItem('vid-blob-db-key', newKey);
                VideoDB.configure({ apiSecretKey: newKey });
                modalHelpers.showAlert('Secret key saved successfully!');
            });
        }

        BlobUtils.updateClock(clockDay, clockHours, clockMinutes, clockAmpm);
        setInterval(function() { BlobUtils.updateClock(clockDay, clockHours, clockMinutes, clockAmpm); }, 1000);

        VideoDB.on('videosLoaded', function(data) {
            allBlobs = data.videos || data.blobs || [];
            currentVideos = allBlobs.filter(function(blob) {
                const path = blob.pathname || '';
                return path.startsWith('uploads/videos/') && !path.includes('/thumbnails/');
            });
            storeIdDisplay.textContent = data.storeId || '—';
            apiEndpointDisplay.textContent = VideoDB.getApiBase();
            renderGallery();
        });

        VideoDB.on('videosFetchError', function(data) {
            console.error('Video fetch error:', data);
            galleryGrid.innerHTML = `<div class="col-span-full text-center text-red-400 text-[10px] mt-8"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ${data.message || 'Failed to load videos'}</div>`;
        });

        VideoDB.on('videosLoading', function() {
            galleryGrid.innerHTML = `<div class="col-span-full text-center text-white/50 text-[10px] mt-8"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading…</div>`;
        });

        VideoDB.on('uploadStarted', function() {
            uploadProgressDiv.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            uploadBtn.disabled = true;
            clearBtn.disabled = true;
        });
        VideoDB.on('uploadProgress', function(p) {
            progressBar.style.width = p.overallPercent + '%';
            progressText.textContent = p.overallPercent + '%';
        });
        VideoDB.on('uploadComplete', function(result) {
            uploadProgressDiv.classList.add('hidden');
            uploadBtn.disabled = false;
            clearBtn.disabled = false;
            if (result.failed.length === 0) {
                modalHelpers.showAlert(`✅ Successfully uploaded ${result.success} video(s) with thumbnails!`);
            } else {
                const msg = `Uploaded ${result.success} of ${result.total}. Errors:\n${result.failed.map(f => f.name + ': ' + f.error).join('\n')}`;
                modalHelpers.showAlert(msg);
            }
            clearSelectionUI();
            VideoDB.fetchVideos();
        });

        VideoDB.on('slideshowOpened', function(state) {
            if (!state) return;
            slideshowOverlay.classList.remove('hidden', 'opacity-0');
            slideshowOverlay.classList.add('flex', 'opacity-100');
            document.body.style.overflow = 'hidden';
            loadSlideshowVideo(state.currentUrl, state.currentIndex, state.total);
        });
        VideoDB.on('slideshowClosed', function() {
            slideshowOverlay.classList.add('hidden', 'opacity-0');
            slideshowOverlay.classList.remove('flex', 'opacity-100');
            document.body.style.overflow = '';
        });
        VideoDB.on('slideshowChanged', function(state) {
            if (!state) return;
            loadSlideshowVideo(state.currentUrl, state.currentIndex, state.total);
        });

        fileInput.addEventListener('change', function() {
            if (this.files.length) VideoDB.addFiles(this.files);
            this.value = '';
        });
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('border-cyan-400', 'bg-cyan-400/10');
        });
        dropZone.addEventListener('dragleave', function() {
            dropZone.classList.remove('border-cyan-400', 'bg-cyan-400/10');
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('border-cyan-400', 'bg-cyan-400/10');
            if (e.dataTransfer.files.length) VideoDB.addFiles(e.dataTransfer.files);
        });
        dropZone.addEventListener('click', function(e) {
            fileInput.click();
        });

        uploadBtn.addEventListener('click', async function() {
            const files = VideoDB.getSelectedFiles();
            if (!files.length) return;

            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

            const baseCategory = VideoDB.getUploadCategory ? VideoDB.getUploadCategory() : 'videos';
            const categories = files.map(file => {
                const d = new Date(file.lastModified);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${baseCategory}/${year}/${month}/${day}`;
            });

            try {
                await VideoDB.uploadFiles(files, null, categories);
            } catch (error) {
                console.error('Upload error:', error);
                modalHelpers.showAlert('❌ Upload failed: ' + error.message);
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload All';
            }
        });

        clearBtn.addEventListener('click', function() {
            clearSelectionUI();
        });
        VideoDB.on('selectionChanged', function(data) {
            renderPreviews(data.selectedFiles);
        });
        VideoDB.on('selectionCleared', function() { renderPreviews([]); });

        categoryInput.value = VideoDB.getUploadCategory ? VideoDB.getUploadCategory() : 'videos';
        VideoDB.on('configured', function(config) {
            if (config.uploadCategory) categoryInput.value = config.uploadCategory;
        });
        saveCategoryBtn.addEventListener('click', function() {
            const newCategory = categoryInput.value.trim();
            if (!newCategory) return modalHelpers.showAlert('Category name cannot be empty.');
            VideoDB.configure({ uploadCategory: newCategory });
            modalHelpers.showAlert(`Upload category updated to "${newCategory}".`);
        });

        document.getElementById('test-connection-btn').addEventListener('click', function() {
            testResult.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Testing…';
            VideoDB.testConnection().then(function(result) {
                if (result.connected) {
                    storeIdDisplay.textContent = result.storeId || '—';
                    apiEndpointDisplay.textContent = VideoDB.getApiBase();
                    testResult.innerHTML = '<i class="fa-solid fa-check-circle text-green-400 mr-1"></i> Connected';
                    testResult.className = 'text-[9px] text-green-400 self-center';
                } else {
                    testResult.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-400 mr-1"></i> ' + result.message;
                    testResult.className = 'text-[9px] text-red-400 self-center';
                }
            });
        });

        document.querySelectorAll('#tab-bar .tab-btn').forEach(btn => {
            btn.addEventListener('click', function() { setActiveTab(this); });
        });
        document.querySelectorAll('#app-sidebar .nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                setActiveNav(this);
                const tabId = this.id.replace('nav-', 'tab-');
                const tabBtn = document.getElementById(tabId);
                if (tabBtn) setActiveTab(tabBtn);
            });
        });

        document.getElementById('refresh-btn').addEventListener('click', function() {
            BlobUtils.clearCache('videoDB_cache_v1');
            galleryGrid.innerHTML = `<div class="col-span-full text-center text-white/50 text-[10px] mt-8"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading videos…</div>`;
            VideoDB.fetchVideos().catch(function(err) {
                console.error('Refresh failed:', err);
            });
        });

        document.querySelector('.close-btn').addEventListener('click', function() { VideoDB.closeSlideshow(); });
        document.getElementById('slideshow-prev').addEventListener('click', function() { VideoDB.prevSlide(); });
        document.getElementById('slideshow-next').addEventListener('click', function() { VideoDB.nextSlide(); });

        const playPauseBtn = document.getElementById('slideshow-play-pause');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', function() {
                const video = document.getElementById('slideshow-video');
                if (!video) return;
                if (video.paused) {
                    video.play().then(() => {
                        this.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    }).catch(function(err) {});
                } else {
                    video.pause();
                    this.innerHTML = '<i class="fa-solid fa-play"></i>';
                }
            });
        }

        document.addEventListener('keydown', function(e) {
            if (!VideoDB.getSlideshowState().isOpen) return;
            const video = document.getElementById('slideshow-video');
            const playPauseBtn = document.getElementById('slideshow-play-pause');
            if (e.key === 'Escape') {
                VideoDB.closeSlideshow();
                return;
            }
            if (e.key === 'ArrowLeft') {
                VideoDB.prevSlide();
                return;
            }
            if (e.key === 'ArrowRight') {
                VideoDB.nextSlide();
                return;
            }
            if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                if (!video) return;
                if (video.paused) {
                    video.play().then(() => {
                        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    }).catch(function(err) {});
                } else {
                    video.pause();
                    if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                }
            }
        });

        slideshowOverlay.addEventListener('click', function(e) {
            if (e.target === slideshowOverlay) VideoDB.closeSlideshow();
        });
        let touchStartX = 0;
        slideshowOverlay.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].screenX; });
        slideshowOverlay.addEventListener('touchend', function(e) {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) VideoDB.nextSlide();
                else VideoDB.prevSlide();
            }
        });

        apiEndpointDisplay.textContent = VideoDB.getApiBase();
        VideoDB.fetchVideos().catch(function(err) {
            console.error('Failed to fetch videos:', err);
            galleryGrid.innerHTML = `<div class="col-span-full text-center text-red-400 text-[10px] mt-8"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Failed to load videos: ${err.message || 'Unknown error'}</div>`;
        });
    }

    return {
        init: initVideoApp,
        showAlert: function(msg, cb) { modalHelpers.showAlert(msg, cb); },
        showConfirm: function(msg, onConfirm, onCancel) { modalHelpers.showConfirm(msg, onConfirm, onCancel); }
    };
})();

var ImageBlob = {
    ImageDB: ImageDB,
    FolderExplorer: FolderExplorer,
    ImageDBApp: ImageDBApp
};

var VideoBlob = {
    VideoDB: VideoDB,
    VideoDBApp: VideoDBApp
};

window.KeyEncryptor = KeyEncryptor;
window.BlobUtils = BlobUtils;
window.FolderExplorer = FolderExplorer;
window.ImageBlob = ImageBlob;
window.VideoBlob = VideoBlob;