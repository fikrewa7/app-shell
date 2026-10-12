import { BlobUtils } from './BlobUtils.js';
import { VideoThumbnail } from './VideoThumbnail.js';

export function createMediaDB(type) {
    'use strict';

    const isVideo = type === 'video';
    const label = isVideo ? 'Video' : 'Image';
    const cacheKey = `${type}DB_cache_v1`;

    const emitter = BlobUtils.createEmitter(`${label}DB`);
    const _on = emitter.on;
    const _off = emitter.off;
    const _emit = emitter.emit;

    const _jfrKey = {
        "iv": "a4EroL5JUEgVloj1",
        "salt": "PtvozUTEvgxEqQUpQY3yyA==",
        "ciphertext": "ne2yiSgFCpDpDbjMmcW4wlNoFo2ogXbhH2sPHFup9SvlfRpay7PtKJnq1SJLdg2Pt9NHtDwf/+vncciJoKhzmxW53NuQA6X+BrTtXAhlMTI="
    };

    let _apiBase = 'https://media-blob-db-two.vercel.app/api';
    let _uploadCategory = isVideo ? 'videos' : 'screenshots';
    let _storeId = null;
    let _uploadThreshold = 4 * 1024 * 1024;
    let _apiSecretKey = null;

    let _items = [];
    let _selectedFiles = [];
    let _slideshowItems = [];
    let _slideshowIndex = 0;
    let _slideshowOpen = false;
    let _fetchPromise = null;

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
        if (typeof options.uploadThreshold === 'number') {
            _uploadThreshold = options.uploadThreshold;
        }
        _emit('configured', { apiBase: _apiBase, uploadCategory: _uploadCategory });
    }

    function _filterBlobs(blobs) {
        return blobs.filter(blob => {
            if (BlobUtils.isSkippedPath(blob.pathname)) return false;
            if (!isVideo && BlobUtils.isVideoPath(blob.pathname)) return false;
            return true;
        });
    }

    function fetchData() {
        if (_fetchPromise) return _fetchPromise;

        const cached = BlobUtils.loadCache(cacheKey);
        if (cached && cached.blobs && Array.isArray(cached.blobs)) {
            _items = cached.blobs;
            if (cached.storeId) _storeId = cached.storeId;
            _emit(`${type}sLoaded`, { [type + 's']: _items, count: _items.length, storeId: _storeId, fromCache: true });
            return Promise.resolve(_items);
        }

        _emit(`${type}sLoading`);

        _fetchPromise = fetch(_apiBase + '/server?_=' + Date.now(), {
            headers: BlobUtils.getAuthHeaders(_apiSecretKey)
        })
            .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
            .then(data => {
                _items = _filterBlobs(data.blobs || []);
                if (data.storeId) _storeId = data.storeId;
                BlobUtils.saveCache(cacheKey, { blobs: _items, storeId: _storeId });
                _fetchPromise = null;
                _emit(`${type}sLoaded`, { [type + 's']: _items, count: _items.length, storeId: _storeId, fromCache: false });
                return _items;
            })
            .catch(err => {
                _fetchPromise = null;
                _emit(`${type}sFetchError`, { error: err, message: err.message });
                throw err;
            });

        return _fetchPromise;
    }

    function deleteItem(pathname) {
        if (!pathname) return Promise.reject(new Error('Pathname is required'));
        _emit(`${type}Deleting`, { pathname });

        return fetch(_apiBase + '/server', {
            method: 'DELETE',
            headers: Object.assign({ 'Content-Type': 'application/json' }, BlobUtils.getAuthHeaders(_apiSecretKey)),
            body: JSON.stringify({ pathname }),
        })
            .then(res => { if (!res.ok) throw new Error('Delete failed (HTTP ' + res.status + ')'); return res.json().catch(() => ({ success: true })); })
            .then(data => new Promise(resolve => setTimeout(() => resolve(data), 300)))
            .then(data => {
                _emit(`${type}Deleted`, { pathname, result: data });
                BlobUtils.clearCache(cacheKey);
                return data;
            })
            .catch(err => {
                _emit(`${type}DeleteError`, { pathname, error: err, message: err.message });
                throw err;
            });
    }

    function testConnection() {
        _emit('connectionTesting');
        return fetch(_apiBase + '/server?limit=1', { headers: BlobUtils.getAuthHeaders(_apiSecretKey) })
            .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
            .then(data => {
                if (data.storeId) _storeId = data.storeId;
                const result = { connected: true, storeId: _storeId, message: 'Connected successfully' };
                _emit('connectionTested', result);
                return result;
            })
            .catch(err => {
                const result = { connected: false, storeId: null, message: err.message };
                _emit('connectionTested', result);
                return result;
            });
    }

    function addFiles(files) {
        if (!files) {
            _emit('filesAdded', { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 });
            return { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 };
        }

        const fileArray = Array.from(files);
        const mediaFiles = fileArray.filter(f => f.type && f.type.startsWith(isVideo ? 'video/' : 'image/'));
        const nonMediaCount = fileArray.length - mediaFiles.length;

        if (mediaFiles.length === 0) {
            const result = { added: 0, skipped: nonMediaCount, duplicates: [], totalProcessed: fileArray.length };
            _emit('filesAdded', result);
            _emit(`no${label}Files`, { nonMediaCount });
            return result;
        }

        const allExisting = _items.map(item => ({ pathname: item.pathname }));
        const selectedAsMedia = _selectedFiles.map(f => ({ pathname: f.name }));
        const combinedExisting = allExisting.concat(selectedAsMedia);
        const uniqueFiles = BlobUtils.filterDuplicateFiles(mediaFiles, combinedExisting);
        const skipped = mediaFiles.length - uniqueFiles.length;

        if (uniqueFiles.length > 0) _selectedFiles = _selectedFiles.concat(uniqueFiles);

        const result = {
            added: uniqueFiles.length,
            skipped: skipped + nonMediaCount,
            duplicates: mediaFiles.filter(f => uniqueFiles.indexOf(f) === -1).map(f => f.name),
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

    function getSelectedFiles() { return _selectedFiles.slice(); }

    function _uploadSingleFile(formData, category, onProgress) {
        return new Promise((resolve, reject) => {
            const timestamp = formData.get('lastModified') || Date.now();
            formData.set('lastModified', timestamp);
            const queryUrl = `${_apiBase}/server?category=${encodeURIComponent(category)}&lastModified=${timestamp}`;
            const xhr = new XMLHttpRequest();
            xhr.open('POST', queryUrl, true);
            if (_apiSecretKey) xhr.setRequestHeader('Authorization', 'Bearer ' + _apiSecretKey);
            xhr.upload.onprogress = e => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };
            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new Error('Invalid response')); }
                } else {
                    reject(new Error('HTTP ' + xhr.status + ' ' + xhr.statusText));
                }
            };
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.ontimeout = () => reject(new Error('Timeout'));
            xhr.send(formData);
        });
    }

    function _requestPresign(file, category) {
        const url = _apiBase + '/server?action=presign&date=' + Date.now();
        const fd = new FormData();
        fd.append('filename', file.name);
        fd.append('category', category);
        fd.append('lastModified', file.lastModified || Date.now());

        return fetch(url, {
            method: 'POST',
            headers: BlobUtils.getAuthHeaders(_apiSecretKey),
            body: fd,
        })
            .then(res => {
                if (!res.ok) {
                    return res.json().catch(() => ({})).then(errData => { throw new Error(errData.error || ('Presign failed (HTTP ' + res.status + ')')); });
                }
                return res.json();
            })
            .then(data => {
                if (!data || !data.presignedUrl) throw new Error('Server did not return presignedUrl');
                return data.presignedUrl;
            });
    }

    function _putToPresignedUrl(file, presignedUrl, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', presignedUrl, true);
            xhr.upload.onprogress = e => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };
            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new Error('Invalid response from blob storage')); }
                } else {
                    reject(new Error('HTTP ' + xhr.status + ' ' + xhr.statusText));
                }
            };
            xhr.onerror = () => reject(new Error('Network error during direct upload'));
            xhr.ontimeout = () => reject(new Error('Upload timeout'));
            xhr.send(file);
        });
    }

    function _uploadFileSmart(file, onProgress, category) {
        if (file.size <= _uploadThreshold) {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('lastModified', file.lastModified || Date.now());
            return _uploadSingleFile(formData, category, onProgress);
        }
        return _requestPresign(file, category).then(presignedUrl => _putToPresignedUrl(file, presignedUrl, onProgress));
    }

    function _generateThumbnail(file, callback) {
        var baseName = file.name.replace(/\.[^.]+$/, '');
        var thumbName = baseName + '.jpg';

        function emitFromBlob(blob) {
            var thumbFile = new File([blob], thumbName, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
            callback(thumbFile);
        }

        function emitPlaceholder() {
            var canvas = document.createElement('canvas');
            canvas.width = 640; canvas.height = 360;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a2e36'; ctx.fillRect(0, 0, 640, 360);
            ctx.fillStyle = '#ffffff'; ctx.font = '40px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🎬', 320, 180);
            canvas.toBlob(emitFromBlob, 'image/jpeg', 0.85);
        }

        VideoThumbnail.generate({ file: file, name: file.name, lastModified: file.lastModified })
            .then(result => emitFromBlob(result.file))
            .catch(err => {
                console.warn('VideoThumbnail.generate failed, using placeholder:', err);
                emitPlaceholder();
            });
    }

    function _uploadImage(file, onProgress) {
        return _uploadFileSmart(file, p => onProgress && onProgress({ phase: 'image', percent: p }), _uploadCategory);
    }

    function _uploadVideo(file, onProgress) {
        return new Promise((resolve, reject) => {
            _generateThumbnail(file, thumbnailFile => {
                const videoCategory = _uploadCategory;
                const thumbCategory = _uploadCategory + '/thumbnails';

                _uploadFileSmart(file, p => onProgress && onProgress({ phase: 'video', percent: p * 0.9, fileName: file.name }), videoCategory)
                    .then(videoResult => {
                        const thumbForm = new FormData();
                        thumbForm.append('image', thumbnailFile);
                        thumbForm.append('lastModified', file.lastModified || Date.now());

                        return _uploadSingleFile(thumbForm, thumbCategory, p => onProgress && onProgress({ phase: 'thumbnail', percent: 90 + p * 0.1, fileName: file.name }))
                            .then(thumbResult => ({ videoResult, thumbResult }))
                            .catch(err => {
                                console.warn('Thumbnail upload failed:', err);
                                return { videoResult, thumbResult: { error: err.message } };
                            });
                    })
                    .then(({ videoResult, thumbResult }) => {
                        resolve({
                            video: videoResult,
                            thumbnail: thumbResult,
                            videoPath: videoCategory + '/' + file.name,
                            thumbnailPath: thumbCategory + '/' + file.name.replace(/\.[^.]+$/, '.jpg')
                        });
                    })
                    .catch(reject);
            });
        });
    }

    function uploadFiles(files, onProgress, categories) {
        if (!files || !files.length) return Promise.resolve({ success: 0, total: 0, failed: [] });

        const total = files.length;
        let completed = 0;
        const failed = [];

        if (!categories || !Array.isArray(categories) || categories.length !== total) {
            categories = files.map(() => _uploadCategory);
        }

        _emit('uploadStarted', { total, files: files.map(f => f.name) });

        const processNext = index => {
            if (index >= total) {
                const result = { success: completed, total, failed: failed.slice() };
                BlobUtils.clearCache(cacheKey);
                _emit('uploadComplete', result);
                return Promise.resolve(result);
            }

            const file = files[index];
            const uploadFn = isVideo ? _uploadVideo : _uploadImage;
            return uploadFn(file, p => {
                const overall = Math.min(100, Math.round((completed / total) * 100 + (p.percent / total)));
                const progressData = {
                    overallPercent: overall,
                    filePercent: p.percent,
                    currentFileIndex: index,
                    totalFiles: total,
                    completed,
                    failed: failed.length,
                    currentFileName: file.name,
                    phase: p.phase,
                    phaseLabel: p.phase === 'video' ? 'Uploading video' : p.phase === 'thumbnail' ? 'Uploading thumbnail' : 'Uploading image'
                };
                if (typeof onProgress === 'function') onProgress(progressData);
                _emit('uploadProgress', progressData);
            })
            .then(() => {
                completed++;
                _emit('singleFileComplete', { index, fileName: file.name, success: true });
                return processNext(index + 1);
            })
            .catch(err => {
                failed.push({ index, name: file.name, error: err.message || 'Unknown error' });
                _emit('singleFileFailed', { index, error: err.message });
                return processNext(index + 1);
            });
        };

        return processNext(0);
    }

    function uploadSelectedFiles(onProgress) {
        if (_selectedFiles.length === 0) return Promise.resolve({ success: 0, total: 0, failed: [] });
        return uploadFiles(_selectedFiles.slice(), onProgress);
    }

    function openSlideshow(index, urls) {
        let items = urls;
        if (!items || !items.length) items = _items.map(item => item.url);
        if (!items.length) return null;

        _slideshowItems = items;
        _slideshowIndex = Math.min(Math.max(0, index), items.length - 1);
        _slideshowOpen = true;

        const state = getSlideshowState();
        _emit('slideshowOpened', state);
        return state;
    }

    function closeSlideshow() {
        _slideshowOpen = false;
        _emit('slideshowClosed', { wasOpen: true });
    }

    function nextSlide() {
        if (!_slideshowOpen || _slideshowItems.length <= 1) return null;
        _slideshowIndex = (_slideshowIndex + 1) % _slideshowItems.length;
        const state = getSlideshowState();
        _emit('slideshowChanged', state);
        return state;
    }

    function prevSlide() {
        if (!_slideshowOpen || _slideshowItems.length <= 1) return null;
        _slideshowIndex = (_slideshowIndex - 1 + _slideshowItems.length) % _slideshowItems.length;
        const state = getSlideshowState();
        _emit('slideshowChanged', state);
        return state;
    }

    function getSlideshowState() {
        return {
            isOpen: _slideshowOpen,
            items: _slideshowItems.slice(),
            currentIndex: _slideshowIndex,
            currentUrl: _slideshowItems[_slideshowIndex] || null,
            total: _slideshowItems.length,
            type
        };
    }

    return {
        type, configure,
        getApiBase: () => _apiBase,
        getStoreId: () => _storeId,
        getJfrKey: () => _jfrKey,
        getUploadCategory: () => _uploadCategory,
        on: _on, off: _off,
        fetchData, deleteItem, testConnection,
        getItems: () => _items.slice(),
        addFiles, clearSelectedFiles, getSelectedFiles,
        filterDuplicateFiles: BlobUtils.filterDuplicateFiles,
        isFileNameDuplicate: (fileName) => BlobUtils.isFileNameDuplicate(fileName, _items),
        uploadFiles, uploadSelectedFiles,
        openSlideshow, closeSlideshow, nextSlide, prevSlide, getSlideshowState,
        formatFileSize: BlobUtils.formatFileSize,
        getFileNameFromPath: BlobUtils.getFileNameFromPath
    };
}