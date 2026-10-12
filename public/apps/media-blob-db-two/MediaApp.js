import { BlobUtils } from './BlobUtils.js';
import { FolderExplorer } from './FolderExplorer.js';
import { KeyEncryptor } from './KeyEncryptor.js';

export function createMediaApp(mediaDB, type) {
    'use strict';

    const isVideo = type === 'video';
    let explorer = null;
    let _videoShowFlat = false;

    let galleryGrid, summaryTotal, summaryLast, contentDesc;
    let fileInput, dropZone, previewGrid, uploadBtn, clearBtn, progressBar, progressText, uploadProgressDiv;
    let storeIdDisplay, apiEndpointDisplay, testResult;
    let clockDay, clockHours, clockMinutes, clockAmpm;
    let slideshowOverlay, slideshowImg, slideshowVideo, slideshowLoader, slideshowCounter;
    let modalOverlay, modalMessage, modalButtons;
    let dropdownRow, folderUpBtn;
    let categoryInput, saveCategoryBtn;
    let secretInput, setBtn;
    let modalHelpers;

    function getStorageKey() {
        return type === 'video' ? 'vid-blob-db-key' : 'img-blob-db-key';
    }

    function showUnlockModal(show) {
        const unlockModal = document.getElementById('unlock-modal');
        const unlockPassword = document.getElementById('unlock-password');
        if (show) {
            unlockModal.classList.remove('hidden');
            unlockModal.classList.add('flex');
            setTimeout(() => unlockPassword.focus(), 100);
        } else {
            unlockModal.classList.add('hidden');
            unlockModal.classList.remove('flex');
        }
    }

    function attemptUnlock() {
        const unlockPassword = document.getElementById('unlock-password');
        const unlockBtn = document.getElementById('unlock-btn');
        const unlockError = document.getElementById('unlock-error');
        const unlockErrorMsg = document.getElementById('unlock-error-msg');
        const password = unlockPassword.value.trim();
        if (!password) {
            unlockErrorMsg.textContent = 'Please enter a password.';
            unlockError.classList.remove('hidden');
            return;
        }
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Unlocking…';
        unlockError.classList.add('hidden');
        KeyEncryptor.decrypt(mediaDB.getJfrKey(), password)
            .then(decrypted => {
                localStorage.setItem(getStorageKey(), decrypted);
                window.location.reload();
            })
            .catch(err => {
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
            select.className = 'bg-[#1a2e36] border border-cyan-400/30 rounded-md p-0.5 px-1 text-xs text-cyan-100 focus:outline-none focus:border-cyan-400/70 appearance-none cursor-pointer max-w-[56px] h-full truncate';
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
            explorer.navigateToFolder(path.slice(0, -1));
            renderDropdowns();
            renderGalleryFromExplorer();
            updateFolderUpBtn();
        };
    }

    function isVideoFile(blob) {
        if (!blob) return false;
        if (blob.type && blob.type.startsWith('video/')) return true;
        const ext = blob.pathname ? blob.pathname.split('.').pop().toLowerCase() : '';
        return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp'].includes(ext);
    }

    function renderTopLevelFolderCards() {
        const allBlobs = explorer ? explorer.getAllFiles() : mediaDB.getItems();
        const foldersData = BlobUtils.getRandomBlobsFromFolders(allBlobs, 'uploads', 3);
        if (Object.keys(foldersData).length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center text-white/40 text-[10px] mt-8"><span>No folders available.</span></div>';
            updateSummaryForFolderView(0, 0);
            return;
        }
        updateSummaryForFolderView(Object.keys(foldersData).length, Object.values(foldersData).reduce((sum, d) => sum + d.total, 0));

        galleryGrid.innerHTML = Object.entries(foldersData).map(([name, data]) => {
            const photosHTML = (data.images || []).slice(0, 3).map((photo, idx) => `
                <div class="pc-photo absolute w-full h-full p-[5%_5%_10%] rounded-[2%] overflow-hidden pos-${idx + 1}">
                    <div class="pc-img w-full h-full bg-cover bg-center bg-[#1a2e36] rounded-[1%]" style="background-image: url('${photo.url}');"></div>
                </div>`).join('');
            return `
                <div class="folder relative w-[85%] aspect-square mx-auto transition-transform duration-300 hover:scale-[1.02] cursor-pointer" data-folder="${name}">
                    <div class="folder-btn absolute w-full h-full left-0 top-0 bg-transparent">
                        <div class="folder-name absolute bottom-[5%] left-[5%] font-bold text-[1em] text-[#e5e7eb] z-50 bg-[#1a2e36]/90 rounded-md px-2 py-1 border border-cyan-400/20">${name}</div>
                        ${photosHTML}
                        <div class="absolute left-[-8px] top-[-8px] z-50 text-cyan-300"><i class="fa-solid fa-folder-open"></i></div>
                        <div class="absolute right-[-8px] top-[-8px] z-50 bg-[#2b2820] text-white py-0 px-[3px] rounded-full border border-white"><span class="text-[0.6em]">${data.total}</span></div>
                    </div>
                </div>`;
        }).join('');

        galleryGrid.querySelectorAll('.folder').forEach(el => {
            el.addEventListener('click', () => {
                explorer.navigateToFolder(['uploads', el.dataset.folder]);
                renderDropdowns();
                renderGalleryFromExplorer();
                updateFolderUpBtn();
            });
        });
    }

    function updateSummaryForFolderView(folderCount, totalImages) {
        const container = document.getElementById('id-summary-container');
        if (!container) return;
        container.innerHTML = `
            <span><i class="fa-solid fa-folder-open text-cyan-300 mr-1"></i> Folder: <span id="summary-total-count" class="text-white font-semibold">${folderCount}</span></span>
            <span class="text-white/20">|</span>
            <span><i class="fa-regular fa-image text-cyan-300 mr-1"></i> Total: <span id="summary-last-upload" class="text-white font-semibold">${totalImages}</span></span>
        `;
        summaryTotal = document.getElementById('summary-total-count');
        summaryLast = document.getElementById('summary-last-upload');
    }

    function resetSummaryToNormal() {
        const container = document.getElementById('id-summary-container');
        if (!container) return;
        container.innerHTML = `
            <span><i class="fa-solid fa-video text-cyan-300 mr-1"></i> Total: <span id="summary-total-count" class="text-white font-semibold">0</span></span>
            <span class="text-white/20">|</span>
            <span><i class="fa-regular fa-clock text-cyan-300 mr-1"></i> Last upload: <span id="summary-last-upload" class="text-white font-semibold">—</span></span>
        `;
        summaryTotal = document.getElementById('summary-total-count');
        summaryLast = document.getElementById('summary-last-upload');
    }

    function renderGalleryFromExplorer() {
        if (!explorer) return;
        if (explorer.getCurrentPathString() === 'uploads') {
            renderTopLevelFolderCards();
            return;
        }
        resetSummaryToNormal();
        const files = explorer.getFilesInCurrentFolder().filter(f => !isVideoFile(f));
        summaryTotal.textContent = files.length;
        summaryLast.textContent = files.length > 0 ? BlobUtils.formatFullDate(files.reduce((a, b) => (a.lastModified ?? a.uploadedAt) > (b.lastModified ?? b.uploadedAt) ? a : b).lastModified) : '—';

        if (files.length === 0) {
            galleryGrid.innerHTML = '<div class="col-span-full text-center text-white/40 text-[10px] mt-8"><span>No images in this folder.</span></div>';
            return;
        }

        galleryGrid.innerHTML = files.map((img, idx) => `
            <div class="image-card relative bg-white/15 border border-white/10 rounded-lg overflow-hidden w-full cursor-pointer" style="height:0; padding-bottom:133.33%;" data-index="${idx}">
                <img src="${img.url}" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <button class="delete-btn absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] z-10" data-path="${img.pathname}"><i class="fa-solid fa-trash-can"></i></button>
                <div class="absolute bottom-0 left-0 w-full p-[2px] flex justify-between bg-gradient-to-t from-black/70 to-transparent z-10">
                    <div class="truncate text-[7px] text-white/80">${img.pathname.split('/').pop()}</div>
                    <div class="text-[7px] text-cyan-300">${FolderExplorer.formatSize(img.size)}</div>
                </div>
            </div>`).join('');

        galleryGrid.querySelectorAll('.image-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.delete-btn')) return;
                mediaDB.openSlideshow(parseInt(card.dataset.index, 10), files.map(f => f.url));
            });
        });
        galleryGrid.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                modalHelpers.showConfirm(`Delete "${btn.dataset.path.split('/').pop()}"?`, async () => {
                    await mediaDB.deleteItem(btn.dataset.path);
                    mediaDB.fetchData();
                });
            });
        });
    }

    function renderPreviews(files) {
        previewGrid.innerHTML = '';
        files.forEach((file, idx) => {
            const url = URL.createObjectURL(file);
            const div = document.createElement('div');
            div.className = 'relative w-[calc(33.333%-0.35rem)] aspect-square rounded overflow-hidden border border-white/20 ready';
            div.dataset.index = idx;
            div.id = `grid-item-${idx}`;
            div.dataset.uploaded = 'false';

            const mediaEl = isVideo ? document.createElement('video') : document.createElement('img');
            mediaEl.src = url;
            mediaEl.className = 'w-full h-full object-cover';
            div.appendChild(mediaEl);

            const progressOverlay = document.createElement('div');
            progressOverlay.className = 'prg-overlay absolute inset-x-0 bottom-0 bg-black/40 pointer-events-none transition-all duration-150';
            progressOverlay.id = `prg-overlay-${idx}`;
            div.appendChild(progressOverlay);
            
            const nameDiv = document.createElement('div');
                nameDiv.className = 'absolute bottom-0 left-0 right-0 bg-black/60 text-[6px] text-white truncate px-1';
                nameDiv.textContent = file.name;
                div.appendChild(nameDiv);



            const removeBtn = document.createElement('span');
            removeBtn.className = 'absolute top-1 right-1 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full cursor-pointer remove-file z-10';
            removeBtn.dataset.index = idx;
            const iconX = document.createElement('i');
iconX.className = 'fa-solid fa-xmark';
removeBtn.appendChild(iconX);
const iconC = document.createElement('i');
iconC.className = 'fa-solid fa-check';
removeBtn.appendChild(iconC);

const iconE = document.createElement('i');
iconE.className = 'fa-solid fa-triangle-exclamation';
removeBtn.appendChild(iconE);

            div.appendChild(removeBtn);

            previewGrid.appendChild(div);
        });

        previewGrid.querySelectorAll('.remove-file').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                const idx = parseInt(el.dataset.index, 10);
                const filesArr = mediaDB.getSelectedFiles();
                filesArr.splice(idx, 1);
                mediaDB.clearSelectedFiles();
                if (filesArr.length) mediaDB.addFiles(filesArr);
                else renderPreviews([]);
            });
        });

        uploadBtn.disabled = files.length === 0;
        dropZone.classList.add("hidden");
    }

    function clearSelectionUI() {
        mediaDB.clearSelectedFiles();
        renderPreviews([]);
        fileInput.value = '';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        dropZone.classList.remove("hidden");
    }

    function init() {
        galleryGrid = document.getElementById('gallery-grid');
        summaryTotal = document.getElementById('summary-total-count');
        summaryLast = document.getElementById('summary-last-upload');
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
        slideshowVideo = document.getElementById('slideshow-video');
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

        // Safe initialization of modalHelpers
        modalHelpers = BlobUtils.createModalHelpers(modalOverlay, modalMessage, modalButtons);

        const storedKey = localStorage.getItem(getStorageKey());
        const unlockModal = document.getElementById('unlock-modal');
        const unlockPassword = document.getElementById('unlock-password');
        const unlockBtn = document.getElementById('unlock-btn');

        if (!storedKey) {
            showUnlockModal(true);
            unlockBtn.addEventListener('click', attemptUnlock);
            unlockPassword.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); attemptUnlock(); } });
            return;
        }

        mediaDB.configure({ apiSecretKey: storedKey });
        if (secretInput && storedKey) secretInput.value = storedKey;

        BlobUtils.updateClock(clockDay, clockHours, clockMinutes, clockAmpm);
        setInterval(() => BlobUtils.updateClock(clockDay, clockHours, clockMinutes, clockAmpm), 1000);

        // --- Tab and Navigation Switching Logic ---
        const tabPanes = {
            'gallery': document.getElementById('tab-pane-gallery'),
            'upload': document.getElementById('tab-pane-upload'),
            'settings': document.getElementById('tab-pane-settings'),
            'help': document.getElementById('tab-pane-help'),
            'docs': document.getElementById('tab-pane-docs')
        };

        function switchTab(targetName) {
            Object.values(tabPanes).forEach(pane => {
                if (pane) pane.classList.add('hidden');
            });
            if (tabPanes[targetName]) {
                tabPanes[targetName].classList.remove('hidden');
            }

            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('text-white', 'border-cyan-400', 'font-medium');
                btn.classList.add('text-white/60', 'border-transparent');
            });
            const activeTabBtn = document.getElementById(`tab-${targetName}`);
            if (activeTabBtn) {
                activeTabBtn.classList.remove('text-white/60', 'border-transparent');
                activeTabBtn.classList.add('text-white', 'border-cyan-400', 'font-medium');
            }

            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            const activeNavBtn = document.getElementById(`nav-${targetName}`);
            if (activeNavBtn) activeNavBtn.classList.add('active');

            const pageTitle = document.getElementById('page-title');
            if (pageTitle) {
                if (targetName === 'gallery') pageTitle.textContent = isVideo ? 'Videos Blob DB' : 'Images Blob DB';
                else if (targetName === 'upload') pageTitle.textContent = 'Upload Files';
                else if (targetName === 'settings') pageTitle.textContent = 'Settings';
                else if (targetName === 'help') pageTitle.textContent = 'Help & Support';
                else if (targetName === 'docs') pageTitle.textContent = 'Documentation';
            }
        }

        ['gallery', 'upload', 'settings', 'help', 'docs'].forEach(name => {
            const btn = document.getElementById(`tab-${name}`);
            if (btn) btn.addEventListener('click', () => switchTab(name));
        });

        ['gallery', 'upload', 'settings'].forEach(name => {
            const btn = document.getElementById(`nav-${name}`);
            if (btn) btn.addEventListener('click', () => switchTab(name));
        });

        // --- Settings Action Bindings ---
        if (setBtn && secretInput) {
            setBtn.addEventListener('click', () => {
                const newKey = secretInput.value.trim();
                if (!newKey) {
                    modalHelpers.showAlert('Please enter a valid secret key.');
                    return;
                }
                localStorage.setItem(getStorageKey(), newKey);
                mediaDB.configure({ apiSecretKey: newKey });
                modalHelpers.showAlert('✅ Secret key updated successfully!');
            });
        }

        if (saveCategoryBtn && categoryInput) {
            categoryInput.value = mediaDB.getUploadCategory();
            saveCategoryBtn.addEventListener('click', () => {
                const newCat = categoryInput.value.trim();
                if (!newCat) {
                    modalHelpers.showAlert('Please enter a valid category.');
                    return;
                }
                mediaDB.configure({ uploadCategory: newCat });
                modalHelpers.showAlert(`✅ Upload category updated to "${newCat}"!`);
            });
        }

        const testConnectionBtn = document.getElementById('test-connection-btn');
        if (testConnectionBtn && testResult) {
            testConnectionBtn.addEventListener('click', async () => {
                testResult.textContent = 'Testing connection...';
                testResult.className = 'text-[9px] text-cyan-300 self-center';
                try {
                    const res = await mediaDB.testConnection();
                    if (res.connected) {
                        testResult.textContent = `Connected! Store ID: ${res.storeId || 'N/A'}`;
                        testResult.className = 'text-[9px] text-green-400 self-center';
                    } else {
                        testResult.textContent = `Connection failed: ${res.message}`;
                        testResult.className = 'text-[9px] text-red-400 self-center';
                    }
                } catch (e) {
                    testResult.textContent = `Error: ${e.message}`;
                    testResult.className = 'text-[9px] text-red-400 self-center';
                }
            });
        }

        // --- Slideshow Event Bindings ---
        mediaDB.on('slideshowOpened', state => {
            if (!slideshowOverlay) return;
            slideshowOverlay.classList.remove('hidden');
            slideshowOverlay.classList.add('flex');
            setTimeout(() => slideshowOverlay.classList.add('opacity-100'), 10);
            updateSlideshowView(state);
        });

        mediaDB.on('slideshowChanged', state => {
            updateSlideshowView(state);
        });

        function updateSlideshowView(state) {
            if (!state || !state.currentUrl) return;
            if (slideshowCounter) slideshowCounter.textContent = `${state.currentIndex + 1} / ${state.total}`;
            
            if (isVideo) {
                if (slideshowVideo) {
                    slideshowVideo.src = state.currentUrl;
                    slideshowVideo.style.opacity = '1';
                    slideshowVideo.load();
                }
            } else {
                if (slideshowImg) {
                    slideshowImg.src = state.currentUrl;
                    slideshowImg.style.opacity = '1';
                }
            }
        }

        const closeSlideshowBtn = slideshowOverlay ? slideshowOverlay.querySelector('.close-btn') : null;
        if (closeSlideshowBtn) {
            closeSlideshowBtn.addEventListener('click', () => {
                mediaDB.closeSlideshow();
                if (slideshowOverlay) {
                    slideshowOverlay.classList.remove('opacity-100');
                    setTimeout(() => {
                        slideshowOverlay.classList.remove('flex');
                        slideshowOverlay.classList.add('hidden');
                        if (slideshowVideo) slideshowVideo.pause();
                    }, 300);
                }
            });
        }

        const nextSlideBtn = document.getElementById('slideshow-next');
        const prevSlideBtn = document.getElementById('slideshow-prev');
        if (nextSlideBtn) nextSlideBtn.addEventListener('click', () => mediaDB.nextSlide());
        if (prevSlideBtn) prevSlideBtn.addEventListener('click', () => mediaDB.prevSlide());

        // --- Database Event Listeners ---
        mediaDB.on(`${type}sLoaded`, data => {
            storeIdDisplay.textContent = data.storeId || '—';
            apiEndpointDisplay.textContent = mediaDB.getApiBase();
            if (!isVideo) {
                explorer = FolderExplorer.create({ blobs: data[type + 's'] || [], storeId: data.storeId || '' });
                explorer.navigateToFolder(['uploads']);
                renderDropdowns();
                renderGalleryFromExplorer();
                updateFolderUpBtn();
            } else {
                _videoShowFlat = false;
                renderGalleryFromExplorer();
            }
        });

        mediaDB.on('uploadStarted', () => {
            uploadProgressDiv.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            uploadBtn.disabled = true;
            clearBtn.disabled = true;
        });

        mediaDB.on('uploadProgress', p => {
            const pct = Number(p.overallPercent || 0).toFixed(0);
            progressBar.style.width = pct + '%';
            progressText.textContent = pct + '%';
            
            const overlay = document.getElementById(`prg-overlay-${p.currentFileIndex}`);
            if (overlay) overlay.style.height = `${100 - p.filePercent}%`;
        });

        mediaDB.on('singleFileComplete', data => {
            const overlay = document.getElementById(`prg-overlay-${data.index}`);
            if (overlay) overlay.style.height = '0%';
            const item = document.getElementById(`grid-item-${data.index}`);
            if (item) {
                item.setAttribute('data-uploaded', 'true');
                item.className = item.className.replace('ready', 'completed');
                item.classList.add('border-green-500/50');
            }
        });

        mediaDB.on('singleFileFailed', data => {
            const overlay = document.getElementById(`prg-overlay-${data.index}`);
            if (overlay) overlay.style.height = '0%';
            const item = document.getElementById(`grid-item-${data.index}`);
            if (item) {
                item.className = item.className.replace('ready', 'failed');
                item.classList.add('border-red-500');
            }
        });

        mediaDB.on('uploadComplete', result => {
            uploadBtn.disabled = false;
            clearBtn.disabled = false;
            if (result.failed.length === 0) {
                modalHelpers.showAlert(`✅ Successfully uploaded ${result.success} ${type}(s)!`);
            } else {
                modalHelpers.showAlert(`Uploaded ${result.success} of ${result.total}. Errors:\n${result.failed.map(f => f.name + ': ' + f.error).join('\n')}`);
            }
            // setTimeout(() => clearSelectionUI(), 1500);
            mediaDB.fetchData();
        });

        fileInput.addEventListener('change', function() { if (this.files.length) mediaDB.addFiles(this.files); this.value = ''; });
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('border-cyan-400', 'bg-cyan-400/10'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-cyan-400', 'bg-cyan-400/10'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('border-cyan-400', 'bg-cyan-400/10'); if (e.dataTransfer.files.length) mediaDB.addFiles(e.dataTransfer.files); });
        dropZone.addEventListener('click', () => fileInput.click());

        uploadBtn.addEventListener('click', async () => {
            const files = mediaDB.getSelectedFiles();
            if (!files.length) return;
            const baseCategory = mediaDB.getUploadCategory();
            const categories = files.map(file => {
                const d = new Date(file.lastModified);
                return `${baseCategory}/${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
            });
            await mediaDB.uploadFiles(files, null, categories);
        });

        clearBtn.addEventListener('click', clearSelectionUI);
        mediaDB.on('selectionChanged', data => renderPreviews(data.selectedFiles));
        mediaDB.on('selectionCleared', () => renderPreviews([]));

        apiEndpointDisplay.textContent = mediaDB.getApiBase();
        mediaDB.fetchData();
    }

    return { 
        init, 
        showAlert: (msg, cb) => modalHelpers.showAlert(msg, cb), 
        showConfirm: (msg, onConfirm, onCancel) => modalHelpers.showConfirm(msg, onConfirm, onCancel) 
    };
}