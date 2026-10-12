(function() {
      
  // ─── Check for stored key ──────────────────────────────
  var storedKey = localStorage.getItem("img-blob-db-key");
  var unlockModal = document.getElementById('unlock-modal');
  var unlockPassword = document.getElementById('unlock-password');
  var unlockBtn = document.getElementById('unlock-btn');
  var unlockError = document.getElementById('unlock-error');
  var unlockErrorMsg = document.getElementById('unlock-error-msg');

  // ─── Helper: show/hide unlock modal ──────────────────
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

  // ─── Unlock logic ──────────────────────────────────────
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
        showAlert('❌ Unlock failed: ' + err.message);
        unlockErrorMsg.textContent = 'Invalid password. Please try again.';
        unlockError.classList.remove('hidden');
        unlockPassword.value = '';
        unlockPassword.focus();
        unlockBtn.disabled = false;
        unlockBtn.innerHTML = '<i class="fa-solid fa-key"></i> Unlock';
      });
  }

  // ─── If no stored key, show unlock modal and STOP ────
  if (!storedKey) {
    showUnlockModal(true);

    unlockBtn.addEventListener('click', attemptUnlock);
    unlockPassword.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptUnlock();
      }
    });

    // Do NOT proceed with the rest of the app
    return;
  }

  // ─── Stored key exists → configure and start app ──────
  ImageDB.configure({ apiSecretKey: storedKey });

  // -----------------------------------------------------------
  // Global state
  // -----------------------------------------------------------
  let explorer = null;            // FolderExplorer instance

  // -----------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------
  const galleryGrid = document.getElementById('gallery-grid');
  const summaryTotal = document.getElementById('summary-total-count');
  const summaryLast = document.getElementById('summary-last-upload');
  const pageTitle = document.getElementById('page-title');
  const contentDesc = document.getElementById('content-desc');

  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const previewGrid = document.getElementById('file-preview-grid');
  const uploadBtn = document.getElementById('upload-btn');
  const clearBtn = document.getElementById('clear-btn');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const uploadProgressDiv = document.getElementById('upload-progress');

  const storeIdDisplay = document.getElementById('store-id-display');
  const apiEndpointDisplay = document.getElementById('api-endpoint-display');
  const testResult = document.getElementById('test-result');

  const clockDay = document.getElementById('clock-day');
  const clockHours = document.getElementById('clock-hours');
  const clockMinutes = document.getElementById('clock-minutes');
  const clockAmpm = document.getElementById('clock-ampm');

  const slideshowOverlay = document.getElementById('slideshow-overlay');
  const slideshowImg = document.getElementById('slideshow-image');
  const slideshowLoader = document.querySelector('.slideshow-loader');
  const slideshowCounter = document.getElementById('slideshow-counter');
  const modalOverlay = document.getElementById('custom-modal-overlay');
  const modalMessage = document.getElementById('modal-message');
  const modalButtons = document.getElementById('modal-buttons');

  const dropdownRow = document.getElementById('dropdown-row');
  const folderUpBtn = document.getElementById('folder-up-btn');

  const categoryInput = document.getElementById('upload-category-input');
  const saveCategoryBtn = document.getElementById('save-category-btn');

  // ========== Secret Key Input / Button ==========
  var secretInput = document.getElementById('api-secretkey-input');
  var setBtn = document.getElementById('set-secretkey-btn');
  
  if (secretInput && storedKey) {
    secretInput.value = storedKey;
  }
  
  if (setBtn) {
    setBtn.addEventListener('click', function() {
      var newKey = secretInput.value.trim();
      if (!newKey) {
        showAlert('Please enter a valid secret key.');
        return;
      }
      localStorage.setItem('img-blob-db-key', newKey);
      ImageDB.configure({ apiSecretKey: newKey });
      showAlert('Secret key saved successfully!');
    });
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
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${month}, ${year}`;
  }

  // -----------------------------------------------------------
  // Modal helpers
  // -----------------------------------------------------------
  function closeModal() {
    modalOverlay.classList.add('hidden', 'opacity-0');
    modalOverlay.classList.remove('flex', 'opacity-100');
    modalButtons.innerHTML = '';
    const box = modalOverlay.querySelector('.modal-box');
    if (box) { box.classList.remove('scale-100', 'translate-y-0'); box.classList.add('scale-95', 'translate-y-2'); }
  }

  function showAlert(msg, cb) {
    modalMessage.textContent = msg;
    modalOverlay.querySelector('.text-4xl i').className = 'fa-solid fa-circle-info';
    modalButtons.innerHTML = `<button class="bg-[#057c94] hover:bg-[#046a80] text-white px-4 py-1 rounded-full text-[10px] font-semibold shadow-md transition-all min-w-[60px]" id="modal-ok-btn">OK</button>`;
    modalOverlay.classList.remove('hidden', 'opacity-0');
    modalOverlay.classList.add('flex', 'opacity-100');
    const box = modalOverlay.querySelector('.modal-box');
    if (box) { box.classList.remove('scale-95', 'translate-y-2'); box.classList.add('scale-100', 'translate-y-0'); }
    document.getElementById('modal-ok-btn').onclick = function() { closeModal(); if (cb) cb(); };
    modalOverlay.onclick = function(e) { if (e.target === modalOverlay) { closeModal(); if (cb) cb(); } };
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
    if (box) { box.classList.remove('scale-95', 'translate-y-2'); box.classList.add('scale-100', 'translate-y-0'); }
    document.getElementById('modal-cancel-btn').onclick = function() { closeModal(); if (onCancel) onCancel(); };
    document.getElementById('modal-confirm-btn').onclick = function() { closeModal(); if (onConfirm) onConfirm(); };
    modalOverlay.onclick = function(e) { if (e.target === modalOverlay) { closeModal(); if (onCancel) onCancel(); } };
  }

  // -----------------------------------------------------------
  // Clock
  // -----------------------------------------------------------
  function updateClock() {
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
  updateClock();
  setInterval(updateClock, 1000);

  // -----------------------------------------------------------
  // Dynamic dependent dropdowns
  // -----------------------------------------------------------
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
      wrapper.className = 'flex items-center gap-1 overflow-hidden w-full';
      const select = document.createElement('select');
      select.className = 'bg-[#1a2e36] border border-cyan-400/30 rounded-md py-0.5 px-1 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400/70 appearance-none cursor-pointer w-full max-w-full';
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

  // -----------------------------------------------------------
  // Gallery rendering (from explorer)
  // -----------------------------------------------------------
  function renderGalleryFromExplorer() {
    if (!explorer) return;
    const files = explorer.getFilesInCurrentFolder();
    summaryTotal.textContent = files.length;
    
    if (files.length > 0) {
      const last = files.reduce((a, b) => {
        const aDate = a.lastModified ?? a.uploadedAt;
        const bDate = b.lastModified ?? b.uploadedAt;
        return aDate > bDate ? a : b;
      });
      const displayDate = last.lastModified ?? last.uploadedAt;
      summaryLast.textContent = displayDate ? formatFullDate(displayDate) : '—';
    } else {
      summaryLast.textContent = '—';
    }

    if (files.length === 0) {
      galleryGrid.innerHTML = '<div class="col-span-full text-center text-white/40 text-[10px] mt-8">No images in this folder.</div>';
      return;
    }

    galleryGrid.innerHTML = files.map((img, idx) => {
      const sizeText = FolderExplorer.formatSize(img.size);
      const dateText = formatToMonthYear(img.lastModified || img.uploadedAt);
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
            <div class="flex-1 [text-shadow:1px_1px_2px_rgba(0,0,0,0.5)] p-[0px] truncate text-[7px] text-white/80" title="${img.pathname}">${fileName}</div>
            <div class="p-[0px] text-[7px] text-cyan-300 text-right">${sizeText}</div>
          </div>
          <span class="absolute top-[0px] left-[0px] p-[2px] text-[7px] text-white bg-gradient-to-t from-black/70 to-transparent rounded-b-lg truncate [text-shadow:1px_1px_2px_rgba(0,0,0,0.5)]">${dateText}</span>
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
        showConfirm(`Delete "${path.split('/').pop()}"?`, async function() {
          await ImageDB.deleteImage(path);
          ImageDB.fetchImages();
        });
      });
    });
  }

  // -----------------------------------------------------------
  // Re-create explorer when images are loaded
  // -----------------------------------------------------------
  function initExplorer(images, storeId) {
    explorer = FolderExplorer.create({ blobs: images, storeId: storeId || '' });
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

  // -----------------------------------------------------------
  // ImageDB event bindings
  // -----------------------------------------------------------
  ImageDB.on('imagesLoaded', function(data) {
    initExplorer(data.images, data.storeId);
    storeIdDisplay.textContent = data.storeId || '—';
    apiEndpointDisplay.textContent = ImageDB.getApiBase();
  });

  ImageDB.on('imagesFetchError', function(data) {
    galleryGrid.innerHTML = `<div class="col-span-full text-center text-red-400 text-[10px] mt-8"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ${data.message}</div>`;
  });

  ImageDB.on('imagesLoading', function() {
    galleryGrid.innerHTML = `<div class="col-span-full text-center text-white/50 text-[10px] mt-8"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Loading…</div>`;
  });

  // Upload events
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
      showAlert(`✅ Successfully uploaded ${result.success} image(s)!`);
    } else {
      const msg = `Uploaded ${result.success} of ${result.total}. Errors:\n${result.failed.map(f => f.name + ': ' + f.error).join('\n')}`;
      showAlert(msg);
    }
    clearSelectionUI();
    ImageDB.fetchImages();
  });

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

  // Slideshow listeners
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

  // -----------------------------------------------------------
  // Upload logic
  // -----------------------------------------------------------
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

  // -----------------------------------------------------------
  // Settings
  // -----------------------------------------------------------
  categoryInput.value = ImageDB.getUploadCategory ? ImageDB.getUploadCategory() : 'screenshots';
  ImageDB.on('configured', function(config) {
    if (config.uploadCategory) categoryInput.value = config.uploadCategory;
  });
  saveCategoryBtn.addEventListener('click', function() {
    const newCategory = categoryInput.value.trim();
    if (!newCategory) return showAlert('Category name cannot be empty.');
    ImageDB.configure({ uploadCategory: newCategory });
    showAlert(`Upload category updated to "${newCategory}".`);
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

  // -----------------------------------------------------------
  // Tab / nav switching
  // -----------------------------------------------------------
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

  document.getElementById('refresh-btn').addEventListener('click', function() { ImageDB.fetchImages(); });

  // -----------------------------------------------------------
  // Slideshow controls
  // -----------------------------------------------------------
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

  dropZone.addEventListener('click', function(e) {
    fileInput.click();
  });

  // -----------------------------------------------------------
  // Initial load (only runs if storedKey existed)
  // -----------------------------------------------------------
  apiEndpointDisplay.textContent = ImageDB.getApiBase();
  ImageDB.fetchImages();

})();
