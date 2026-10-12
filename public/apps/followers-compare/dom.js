(function(FansApp) {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const D = {
    tabBtns: $$('.tab-btn'),
    panes: {
      files: $('#tab-files'),
      results: $('#tab-results'),
      stats: $('#tab-stats')
    },
    fileOld: $('#file-old'),
    fileNew: $('#file-new'),
    dropOld: $('#drop-old'),
    dropNew: $('#drop-new'),
    oldFileName: $('#old-file-name'),
    newFileName: $('#new-file-name'),
    oldFileStatus: $('#old-file-status'),
    newFileStatus: $('#new-file-status'),
    extractOldBtn: $('#extract-old-btn'),
    extractNewBtn: $('#extract-new-btn'),
    extractBothBtn: $('#extract-both-btn'),
    compareBtn: $('#compare-btn'),
    viewOldBtn: $('#view-old-btn'),
    viewNewBtn: $('#view-new-btn'),
    clearAllBtn: $('#clear-all-btn'),
    copyExtractBtn: $('#copy-extract-btn'),
    copyStatsBtn: $('#copy-stats-btn'),
    progressBar: $('#extract-progress-bar'),
    progressText: $('#extract-progress-text'),
    extractSummary: $('#extract-summary'),
    extOldCount: $('#ext-old-count'),
    extNewCount: $('#ext-new-count'),
    extRemovedOld: $('#ext-removed-old'),
    extRemovedNew: $('#ext-removed-new'),
    rUnfollowed: $('#r-unfollowed'),
    rNew: $('#r-new'),
    rReturning: $('#r-returning'),
    rExisting: $('#r-existing'),
    rRetention: $('#r-retention'),
    rUnfollowedBadge: $('#r-unfollowed-badge'),
    rNewBadge: $('#r-new-badge'),
    rReturningBadge: $('#r-returning-badge'),
    rExistingBadge: $('#r-existing-badge'),
    unfollowedList: $('#unfollowed-list'),
    newList: $('#new-list'),
    returningList: $('#returning-list'),
    existingList: $('#existing-list'),
    resultEmptyMsg: $('#result-empty-msg'),
    resultSingleMsg: $('#result-single-msg'),
    resultSections: $('#result-sections'),
    stOldRaw: $('#st-old-raw'),
    stOldClean: $('#st-old-clean'),
    stOldRemoved: $('#st-old-removed'),
    stNewRaw: $('#st-new-raw'),
    stNewClean: $('#st-new-clean'),
    stNewRemoved: $('#st-new-removed'),
    stNewAbsent: $('#st-new-absent'),
    stRemovedTotal: $('#st-removed-total'),
    statsSample: $('#stats-sample'),
    footerMemory: $('#footer-memory'),
    footerStatus: $('#footer-status'),
    footerTime: $('#footer-time'),
    dialogOverlay: $('#dialog-overlay'),
    dialogContent: $('#dialog-content'),
    dialogCloseBtn: $('#dialog-close-btn'),
    toastContainer: $('#toast-container'),
    statusText: $('#status-text'),
    statusDot: $('#status-dot')
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
    el.className = `toast bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white/90 shadow-2xl flex items-center gap-2 pointer-events-auto max-w-full w-full sm:max-w-sm cursor-pointer ${
      type === 'success' ? 'border-l-2 border-l-green-400' :
      type === 'error' ? 'border-l-2 border-l-red-400' :
      type === 'warning' ? 'border-l-2 border-l-yellow-400' :
      'border-l-2 border-l-blue-400'
    }`;
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
      t === 'ready' ? 'text-green-400' :
      t === 'working' ? 'text-yellow-400 fa-spin' :
      t === 'error' ? 'text-red-400' : 'text-white/30'
    }"></i> ${t}`;
    D.statusDot.className = 'fa-regular fa-circle text-[8px] ' + (
      t === 'ready' ? 'text-green-400' :
      t === 'working' ? 'text-yellow-400 fa-spin' :
      t === 'error' ? 'text-red-400' : 'text-white/30'
    );
  }

  // Expose under FansApp.DOM
  FansApp.DOM = { $, $$, D, toast, showDialog, closeDialog, setStatus };

})(window.FansApp || {});
