var ImageDB = (function () {
  'use strict';

  // ============================================================
  // PRIVATE STATE
  // ============================================================
  var _jfrKey = {
  "iv": "a4EroL5JUEgVloj1",
  "salt": "PtvozUTEvgxEqQUpQY3yyA==",
  "ciphertext": "ne2yiSgFCpDpDbjMmcW4wlNoFo2ogXbhH2sPHFup9SvlfRpay7PtKJnq1SJLdg2Pt9NHtDwf/+vncciJoKhzmxW53NuQA6X+BrTtXAhlMTI="
};
  var _apiBase = 'https://blob-img-db.vercel.app/api';
  var _uploadCategory = 'screenshots';
  var _storeId = null;

  // API Secret Key – try to read from environment if available
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

  // ============================================================
  // PRIVATE EVENT SYSTEM
  // ============================================================
  var _listeners = {};

  function _on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
  }

  function _off(event, callback) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(function (cb) {
      return cb !== callback;
    });
  }

  function _emit(event, data) {
    if (!_listeners[event]) return;
    _listeners[event].forEach(function (cb) {
      try {
        cb(data);
      } catch (e) {
        console.error('[ImageDB] Listener error for event "' + event + '":', e);
      }
    });
  }

  // ============================================================
  // HELPER: Build common headers
  // ============================================================
  function _getAuthHeaders() {
    var headers = {};
    if (_apiSecretKey) {
      headers['Authorization'] = 'Bearer ' + _apiSecretKey;
    }
    return headers;
  }

  // ============================================================
  // CONFIGURATION
  // ============================================================
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

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  function formatFileSize(bytes) {
    if (!bytes || typeof bytes !== 'number' || bytes < 0) return '';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  function getFileNameFromPath(path) {
    if (!path || typeof path !== 'string') return '';
    return path.replace(/^.*\//, '');
  }

  function isFileNameDuplicate(fileName) {
    if (!fileName) return false;
    var lower = fileName.toLowerCase();
    return _currentImages.some(function (img) {
      return getFileNameFromPath(img.pathname).toLowerCase() === lower;
    });
  }

  function filterDuplicateFiles(newFiles, existingImages) {
    if (!newFiles || !newFiles.length) return [];
    if (!existingImages || !existingImages.length) return newFiles.slice();

    var existingNames = {};
    for (var i = 0; i < existingImages.length; i++) {
      var name = getFileNameFromPath(existingImages[i].pathname).toLowerCase();
      if (name) existingNames[name] = true;
    }

    return newFiles.filter(function (file) {
      return !existingNames[file.name.toLowerCase()];
    });
  }

  // ============================================================
  // IMAGE API OPERATIONS
  // ============================================================
  function fetchImages() {
    if (_fetchPromise) return _fetchPromise;

    _emit('imagesLoading');

    _fetchPromise = fetch(_apiBase + '/blobs?_=' + Date.now(), {
      headers: _getAuthHeaders()
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        _currentImages = data.blobs || [];
        if (data.storeId) _storeId = data.storeId;
        _fetchPromise = null;
        _emit('imagesLoaded', {
          images: _currentImages,
          count: _currentImages.length,
          storeId: _storeId,
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
      headers: Object.assign({ 'Content-Type': 'application/json' }, _getAuthHeaders()),
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
      headers: _getAuthHeaders()
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

  // ============================================================
  // FILE SELECTION & FILTERING
  // ============================================================
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

    var uniqueFiles = filterDuplicateFiles(imageFiles, combinedExisting);
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

  // --- Kept the addFilesss variant for reference (unchanged) ---
  function addFilesss(files) { /* ... original code unchanged ... */
    if (!files) {
      _emit('filesAdded', { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 });
      return { added: 0, skipped: 0, duplicates: [], totalProcessed: 0 };
    }
    
    var fileArray = Array.from(files);
    var imageFiles = fileArray.filter(function(f) {
      return f.type && f.type.startsWith('image/');
    });
    var nonImageCount = fileArray.length - imageFiles.length;
    
    if (imageFiles.length === 0) {
      var result = { added: 0, skipped: nonImageCount, duplicates: [], totalProcessed: fileArray.length };
      _emit('filesAdded', result);
      _emit('noImageFiles', { nonImageCount: nonImageCount });
      return result;
    }
    
    function getTargetPath(file) {
      var d = new Date(file.lastModified);
      var year = d.getFullYear();
      var month = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return _uploadCategory + '/' + year + '/' + month + '/' + day + '/' + file.name;
    }
    
    var existingPaths = {};
    for (var i = 0; i < _currentImages.length; i++) {
      existingPaths[_currentImages[i].pathname] = true;
    }
    
    var selectedNames = {};
    for (var j = 0; j < _selectedFiles.length; j++) {
      selectedNames[_selectedFiles[j].name.toLowerCase()] = true;
    }
    
    var uniqueFiles = [];
    var duplicates = [];
    
    for (var k = 0; k < imageFiles.length; k++) {
      var file = imageFiles[k];
      var targetPath = getTargetPath(file);
      var nameLower = file.name.toLowerCase();
      
      if (selectedNames[nameLower]) {
        duplicates.push(file.name);
        continue;
      }
      
      if (existingPaths[targetPath]) {
        duplicates.push(file.name);
        continue;
      }
      
      uniqueFiles.push(file);
      selectedNames[nameLower] = true;
    }
    
    var skipped = imageFiles.length - uniqueFiles.length;
    
    if (uniqueFiles.length > 0) {
      _selectedFiles = _selectedFiles.concat(uniqueFiles);
    }
    
    var result = {
      added: uniqueFiles.length,
      skipped: skipped + nonImageCount,
      duplicates: duplicates,
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

  // ============================================================
  // UPLOAD OPERATIONS
  // ============================================================
  // Updated to include Authorization header in XHR
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

    function uploadSingleFilesss(file, index) {
      return new Promise(function(resolve) {
        var formData = new FormData();
        formData.append('image', file);
        formData.append('lastModified', String(file.lastModified || Date.now()));

        var xhr = new XMLHttpRequest();
        xhr.open('POST', _apiBase + '/uploads?category=' + encodeURIComponent(categories[index]), true);

        // Set Authorization header if key exists
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
    
    function uploadSingleFile(file, index) {
  return new Promise(function(resolve) {
    var formData = new FormData();
    formData.append('image', file);
    
    var timestamp = file.lastModified || Date.now();
    formData.append('lastModified', timestamp);
    
    var queryUrl = _apiBase + '/uploads?category=' + encodeURIComponent(categories[index]) + '&lastModified=' + timestamp;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', queryUrl, true);
    
    // Set Authorization header if key exists
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

  // uploadFilesssss remains as the old version (kept for completeness but not exported)
  function uploadFilesssss(files, onProgress) {
    if (!files || !files.length) {
      return Promise.resolve({ success: 0, total: 0, failed: [] });
    }

    var total = files.length;
    var completed = 0;
    var failed = [];
    var category = _uploadCategory;

    _emit('uploadStarted', { total: total, files: files.map(function (f) { return f.name; }) });

    function uploadSingleFile(file, index) {
      return new Promise(function (resolve) {
        var formData = new FormData();
        formData.append('image', file);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', _apiBase + '/uploads?category=' + encodeURIComponent(category), true);

        // Add auth header if key present
        if (_apiSecretKey) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + _apiSecretKey);
        }

        xhr.upload.onprogress = function (e) {
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

        xhr.onload = function () {
          if (xhr.status === 200 || xhr.status === 201) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: 'HTTP ' + xhr.status + ' ' + xhr.statusText });
          }
        };

        xhr.onerror = function () {
          resolve({ success: false, error: 'Network error' });
        };

        xhr.ontimeout = function () {
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
        _emit('uploadComplete', result);

        if (completed > 0) {
          _selectedFiles = [];
          _emit('selectionChanged', { selectedFiles: [], count: 0 });
        }

        return result;
      }

      var file = files[index];
      return uploadSingleFile(file, index).then(function (uploadResult) {
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

    return processNext(0).then(function (result) {
      return result;
    });
  }

  function uploadSelectedFiles(onProgress) {
    if (_selectedFiles.length === 0) {
      return Promise.resolve({ success: 0, total: 0, failed: [] });
    }
    return uploadFiles(_selectedFiles.slice(), onProgress);
  }

  // ============================================================
  // SLIDESHOW MANAGEMENT
  // ============================================================
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

  // ============================================================
  // GETTERS
  // ============================================================
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

  // ============================================================
  // PUBLIC API
  // ============================================================
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
    filterDuplicateFiles: filterDuplicateFiles,
    uploadFiles: uploadFiles,
    uploadSelectedFiles: uploadSelectedFiles,
    openSlideshow: openSlideshow,
    closeSlideshow: closeSlideshow,
    nextSlide: nextSlide,
    prevSlide: prevSlide,
    getSlideshowState: getSlideshowState,
    formatFileSize: formatFileSize,
    getFileNameFromPath: getFileNameFromPath,
    isFileNameDuplicate: isFileNameDuplicate,
  };
})();

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
