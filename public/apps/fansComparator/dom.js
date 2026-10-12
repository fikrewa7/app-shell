(function(FansApp) {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const D = {
    tabBtns: $$('.tab-btn'),
    panes: { files: $('#tab-files'), results: $('#tab-results'), stats: $('#tab-stats') },
    fileOld: $('#file-old'), fileNew: $('#file-new'),
    dropOld: $('#drop-old'), dropNew: $('#drop-new'),
    oldFileName: $('#old-file-name'), newFileName: $('#new-file-name'),
    oldFileStatus: $('#old-file-status'), newFileStatus: $('#new-file-status'),
    extractOldBtn: $('#extract-old-btn'), extractNewBtn: $('#extract-new-btn'),
    extractBothBtn: $('#extract-both-btn'), compareBtn: $('#compare-btn'),
    viewOldBtn: $('#view-old-btn'), viewNewBtn: $('#view-new-btn'),
    clearAllBtn: $('#clear-all-btn'),
    copyExtractBtn: $('#copy-extract-btn'), copyStatsBtn: $('#copy-stats-btn'),
    progressBar: $('#extract-progress-bar'), progressText: $('#extract-progress-text'),
    extractSummary: $('#extract-summary'),
    extOldCount: $('#ext-old-count'), extNewCount: $('#ext-new-count'),
    extRemovedOld: $('#ext-removed-old'), extRemovedNew: $('#ext-removed-new'),
    rUnfollowed: $('#r-unfollowed'), rNew: $('#r-new'), rReturning: $('#r-returning'), rExisting: $('#r-existing'), rRetention: $('#r-retention'),
    rUnfollowedBadge: $('#r-unfollowed-badge'), rNewBadge: $('#r-new-badge'), rReturningBadge: $('#r-returning-badge'), rExistingBadge: $('#r-existing-badge'),
    unfollowedList: $('#unfollowed-list'), newList: $('#new-list'), returningList: $('#returning-list'), existingList: $('#existing-list'),
    resultEmptyMsg: $('#result-empty-msg'), resultSingleMsg: $('#result-single-msg'),
    resultSections: $('#result-sections'),
    stOldRaw: $('#st-old-raw'), stOldClean: $('#st-old-clean'), stOldRemoved: $('#st-old-removed'),
    stNewRaw: $('#st-new-raw'), stNewClean: $('#st-new-clean'), stNewRemoved: $('#st-new-removed'),
    stNewAbsent: $('#st-new-absent'), stRemovedTotal: $('#st-removed-total'), statsSample: $('#stats-sample'),
    footerMemory: $('#footer-memory'), footerStatus: $('#footer-status'), footerTime: $('#footer-time'),
    dialogOverlay: $('#dialog-overlay'), dialogContent: $('#dialog-content'), dialogCloseBtn: $('#dialog-close-btn'),
    toastContainer: $('#toast-container'), statusText: $('#status-text'), statusDot: $('#status-dot'),
    themeToggle: $('#theme-toggle'),
    quickStartMsg: $('#quick-start-msg'), downloadSampleBtn: $('#download-sample-btn'),
    filterInputs: $$('.filter-input')
  };

  function toast(msg, type = 'info', dur) {
    if (dur === undefined) {
      if (type === 'error') dur = 8000;
      else if (type === 'warning') dur = 6000;
      else dur = 2800;
    }
    const icons = {
      success: 'fa-regular fa-circle-check',
      error: 'fa-regular fa-circle-xmark',
      warning: 'fa-regular fa-triangle-exclamation',
      info: 'fa-regular fa-circle-info'
    };
    const el = document.createElement('div');
    const colorClasses = {
      success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
      error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
      warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
      info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
    };
    el.className = [
      'toast',
      'rounded-xl',
      'px-3 py-1.5',
      'text-xs',
      'shadow-2xl',
      'flex items-center gap-2',
      'pointer-events-auto',
      'max-w-full w-full sm:max-w-sm',
      'cursor-pointer',
      'border',
      colorClasses[type] || colorClasses.info
    ].join(' ');
    el.innerHTML = `<i class="${icons[type] || icons.info} text-sm"></i><span>${msg}</span>`;
    el.addEventListener('click', () => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    });
    D.toastContainer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) {
        el.classList.add('removing');
        setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
      }
    }, dur);
  }

  function showDialog(html) {
    D.dialogContent.innerHTML = html;
    D.dialogOverlay.classList.remove('hidden');
    D.dialogOverlay.classList.add('flex');
  }
  function closeDialog() {
    D.dialogOverlay.classList.add('hidden');
    D.dialogOverlay.classList.remove('flex');
  }

  function setStatus(t) {
    D.statusText.textContent = t;
    D.footerStatus.innerHTML = `<i class="fa-regular fa-circle text-[6px] ${
      t === 'working' ? 'fa-spin text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
    }"></i> ${t}`;
    D.statusDot.className = 'fa-regular fa-circle text-[8px] ' + (
      t === 'working' ? 'fa-spin text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
    );
  }

  FansApp.DOM = { $, $$, D, toast, showDialog, closeDialog, setStatus };
})(window.FansApp || {});
