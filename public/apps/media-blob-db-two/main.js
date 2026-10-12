import { createMediaDB } from './MediaDB.js';
import { createMediaApp } from './MediaApp.js';
import { BlobUtils } from './BlobUtils.js';
import { FolderExplorer } from './FolderExplorer.js';
import { KeyEncryptor } from './KeyEncryptor.js';
import { VideoThumbnail } from './VideoThumbnail.js';

const ImageDB = createMediaDB('image');
const VideoDB = createMediaDB('video');
const ImageDBApp = createMediaApp(ImageDB, 'image');
const VideoDBApp = createMediaApp(VideoDB, 'video');

// Expose switch function globally so inline HTML elements (if any) can access it
window.switchBlobApp = function(type) {
    localStorage.setItem('blob-app-type', type);
    window.location.reload();
};

function updateSwitchButton() {
    var appType = localStorage.getItem('blob-app-type') || 'image';
    var btn = document.getElementById('switchApp');
    var icon = document.getElementById('switchAppIcon');
    var label = document.getElementById('switchAppLabel');
    var title = document.getElementById('page-title');
    var currDb = document.getElementById('current-db-type');
    var currIcon = document.getElementById('current-db-icon');
    
    if (appType === 'video') {
        if (btn) btn.setAttribute('data-app', 'image');
        if (icon) icon.className = 'fa-solid fa-image text-[10px]';
        if (label) label.textContent = 'Images';
        if (title) title.textContent = 'Videos Blob DB';
        if (currDb) currDb.value = 'Videos';
        if (currIcon) currIcon.className = "fa-solid fa-video text-green-400 mr-1";
    } else {
        if (btn) btn.setAttribute('data-app', 'video');
        if (icon) icon.className = 'fa-solid fa-video text-[10px]';
        if (label) label.textContent = 'Video';
        if (title) title.textContent = 'Images Blob DB';
        if (currDb) currDb.value = 'Images';
        if (currIcon) currIcon.className = "fa-solid fa-image text-green-400 mr-1";
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var appType = localStorage.getItem('blob-app-type') || 'image';
    
    document.body.classList.remove('mode-image', 'mode-video');
    document.body.classList.add(appType === 'video' ? 'mode-video' : 'mode-image');
    
    var fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.setAttribute('accept', appType === 'video' ? 'video/*' : 'image/*');
    }
    
    updateSwitchButton();
    
    if (appType === 'video') {
        VideoDBApp.init();
    } else {
        ImageDBApp.init();
    }
    
    var switchBtn = document.getElementById('switchApp');
    if (switchBtn) {
        switchBtn.addEventListener('click', function() {
            var target = this.getAttribute('data-app');
            if (target) {
                window.switchBlobApp(target);
            }
        });
    }
    
    var exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', function() {
            var exitEvent = new CustomEvent('blobdb-exit', {
                detail: { timestamp: Date.now() }
            });
            document.dispatchEvent(exitEvent);
        });
    }
    
    document.addEventListener('blobdb-exit', function(e) {
        if (ImageDBApp && ImageDBApp.showConfirm) {
            ImageDBApp.showConfirm('Are you sure you want to exit?', function() {});
        } else if (VideoDBApp && VideoDBApp.showConfirm) {
            VideoDBApp.showConfirm('Are you sure you want to exit?', function() {});
        }
    });
});