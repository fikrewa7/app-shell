(function(FansApp) {
  'use strict';

  const { D, toast, setStatus, showDialog, closeDialog } = FansApp.DOM;
  const { handleFile, extractSingleFile, extractBoth, runComparison, state, restoreSession, clearSessionStorage } = FansApp.Core;
  const { renderResults, updateStatsTab, updateUI, switchTab, applyFilter } = FansApp.Render;

  function setupDrop(zone, input, statusSpan, key) {
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f && (f.type === 'application/json' || f.name.endsWith('.json'))) {
        handleFile(f, key, statusSpan, zone);
      } else if (f) {
        toast('Please select a JSON file', 'warning');
      }
    });
    input.addEventListener('change', () => {
      if (input.files.length) handleFile(input.files[0], key, statusSpan, zone);
    });
  }

  function copyText(text, msg = 'Copied!') {
    if (!text) return toast('Nothing to copy', 'warning');
    navigator.clipboard.writeText(text).then(() => toast(msg, 'success', 1500)).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(msg, 'success', 1500); } catch (e) { toast('Copy failed', 'error', 8000); }
      ta.remove();
    });
  }

  function downloadData(data, filename, format = 'json') {
    if (!data || !data.length) {
      toast('Nothing to download', 'warning');
      return;
    }
    let content, mime;
    if (format === 'csv') {
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(obj => Object.values(obj).map(v => `"${v ?? ''}"`).join(','));
      content = [headers, ...rows].join('\n');
      mime = 'text/csv';
      filename = filename.replace('.json', '.csv');
    } else if (format === 'text') {
      content = data.map(i => i.UserName || i).filter(Boolean).join('\n');
      mime = 'text/plain';
      filename = filename.replace('.json', '.txt');
    } else {
      content = JSON.stringify(data, null, 2);
      mime = 'application/json';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Downloaded ${filename}`, 'success', 1500);
  }

  // Refactored: now builds and shows the dropdown immediately (no click listener)
  function showDownloadDropdown(btn, data, filenameBase) {
    // Remove any existing dropdown
    const existing = document.querySelector('.download-dropdown');
    if (existing) existing.remove();

    const dropdown = document.createElement('div');
    dropdown.className = [
      'download-dropdown',
      'absolute bottom-full mb-1 right-0',
      'border rounded-lg p-1',
      'flex flex-col z-50 shadow-xl',
      'bg-white dark:bg-gray-800',
      'border-gray-200 dark:border-gray-700',
      'text-gray-700 dark:text-gray-200'
    ].join(' ');

    dropdown.innerHTML = `
      <button class="format-option text-[0.5rem] hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition">JSON</button>
      <button class="format-option text-[0.5rem] hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition">CSV</button>
      <button class="format-option text-[0.5rem] hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition">Text (usernames)</button>
    `;

    // Position dropdown relative to the button's parent
    btn.parentNode.style.position = 'relative';
    btn.parentNode.appendChild(dropdown);

    dropdown.querySelectorAll('.format-option').forEach(opt => {
      opt.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const format = opt.textContent.includes('JSON') ? 'json' : opt.textContent.includes('CSV') ? 'csv' : 'text';
        downloadData(data, filenameBase, format);
        dropdown.remove();
      });
    });

    // Close dropdown on outside click
    const closeDropdown = (ev) => {
      if (!dropdown.contains(ev.target)) dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 0);
  }

  function viewData(key) {
    const arr = key === 'old' ? state.extracted.arrOld : state.extracted.arrNew;
    const stats = key === 'old' ? state.extracted.statsOld : state.extracted.statsNew;
    if (!arr?.length) return toast(`No ${key} data extracted`, 'warning');

    let html = `
      <div class="text-gray-900 dark:text-gray-100">
        <div class="text-sm font-medium mb-2">
          ${key.toUpperCase()} (${arr.length} items)
        </div>`;

    if (stats) {
      html += `
        <div class="text-xs mb-2 text-gray-600 dark:text-gray-400">
          Raw: ${stats.rawLength} · Cleaned: ${stats.cleanedLength} · Removed: ${stats.removed}
        </div>`;
    }

    const sample = arr.slice(0, 50);
    html += `
      <div class="text-xs break-all text-gray-700 dark:text-gray-300" style="line-height:1.6;">
        ${sample.map(i => i.UserName || i).filter(Boolean).join('<br>')}
      </div>`;

    if (arr.length > 50) {
      html += `
        <div class="text-xs mt-1 text-gray-500 dark:text-gray-400">
          … and ${arr.length - 50} more
        </div>`;
    }

    html += `
      <div class="flex gap-2 mt-3">
        <button
          class="border rounded-lg px-3 py-1 text-sm transition bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
          onclick="window._copyData('${key}')"
        >
          <i class="fa-regular fa-copy"></i><span>Copy all</span>
        </button>
      </div>
    </div>`;

    showDialog(html);

    window._copyData = (k) => {
      const a = k === 'old' ? state.extracted.arrOld : state.extracted.arrNew;
      copyText(a.map(i => i.UserName || i).filter(Boolean).join('\n'), `Copied ${k} usernames`);
    };
  }

  function init() {
    const htmlEl = document.documentElement;
    D.themeToggle.addEventListener('click', () => {
      htmlEl.classList.toggle('dark');
      const isDark = htmlEl.classList.contains('dark');
      D.themeToggle.innerHTML = isDark
        ? '<i class="fa-regular fa-moon"></i>'
        : '<i class="fa-regular fa-sun"></i>';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    if (localStorage.getItem('theme') === 'light') {
      htmlEl.classList.remove('dark');
      D.themeToggle.innerHTML = '<i class="fa-regular fa-moon"></i>';
    }

    if (restoreSession()) {
      if (confirm('Restore previous session? (Extracted data and comparison results will be loaded.)')) {
        updateUI();
        updateStatsTab();
        if (state.comparison) renderResults(state.comparison);
        toast('Session restored', 'info', 2000);
      } else {
        clearSessionStorage();
      }
    }

    D.downloadSampleBtn.addEventListener('click', () => {
      const sampleData = {
        "Profile And Settings": {
          "Follower": {
            "FansList": [
              { "UserName": "fan1", "Date": "2025-01-01" },
              { "UserName": "fan2", "Date": "2025-02-01" }
            ]
          }
        }
      };
      downloadData([sampleData], 'sample.json', 'json');
    });

    setupDrop(D.dropOld, D.fileOld, D.oldFileStatus, 'old');
    setupDrop(D.dropNew, D.fileNew, D.newFileStatus, 'new');

    D.extractOldBtn.addEventListener('click', () => {
      extractSingleFile(state.files.old, 'old').then(() => {
        D.progressBar.style.width = '100%';
        D.progressText.innerHTML = '<i class="fa-regular fa-check"></i> done';
        setStatus('ready');
      }).catch(() => {});
    });
    D.extractNewBtn.addEventListener('click', () => {
      extractSingleFile(state.files.new, 'new').then(() => {
        D.progressBar.style.width = '100%';
        D.progressText.innerHTML = '<i class="fa-regular fa-check"></i> done';
        setStatus('ready');
      }).catch(() => {});
    });

    D.extractBothBtn.addEventListener('click', extractBoth);
    D.compareBtn.addEventListener('click', runComparison);

    D.viewOldBtn.addEventListener('click', () => viewData('old'));
    D.viewNewBtn.addEventListener('click', () => viewData('new'));

    D.clearAllBtn.addEventListener('click', () => {
      if (!confirm('Clear all data?')) return;
      state.files.old = null;
      state.files.new = null;
      state.extracted.arrOld = [];
      state.extracted.arrNew = [];
      state.extracted.statsOld = null;
      state.extracted.statsNew = null;
      state.comparison = null;
      D.oldFileStatus.innerHTML = 'none';
      D.newFileStatus.innerHTML = 'none';
      document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('has-file'));
      D.fileOld.value = '';
      D.fileNew.value = '';
      D.progressBar.style.width = '0%';
      D.progressText.innerHTML = 'ready';
      D.viewOldBtn.disabled = true;
      D.viewNewBtn.disabled = true;
      D.compareBtn.disabled = true;
      D.resultEmptyMsg.classList.remove('hidden');
      D.resultSections.classList.add('hidden');
      D.resultSingleMsg.classList.add('hidden');
      D.rUnfollowed.textContent = '0';
      D.rNew.textContent = '0';
      D.rReturning.textContent = '0';
      D.returningList.textContent = '—';
      D.returningList.dataset.full = '';
      D.rExisting.textContent = '0';
      D.rRetention.textContent = '—';
      D.rUnfollowedBadge.textContent = '0';
      D.rNewBadge.textContent = '0';
      D.rReturningBadge.textContent = '0';
      D.rExistingBadge.textContent = '0';
      D.unfollowedList.textContent = '—';
      D.newList.textContent = '—';
      D.existingList.textContent = '—';
      D.unfollowedList.dataset.full = '';
      D.newList.dataset.full = '';
      D.existingList.dataset.full = '';
      updateStatsTab();
      updateUI();
      clearSessionStorage();
      toast('Cleared', 'info', 1000);
      setStatus('ready');
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('.copy-section-btn');
      if (btn) {
        const targetId = btn.dataset.target;
        let json = '';
        if (targetId === 'unfollowed-list') {
          json = (state.comparison?.unfollowed || []).map(i => JSON.stringify(i)).join('\n');
        } else if (targetId === 'new-list') {
          json = (state.comparison?.newFollowers || []).map(i => JSON.stringify(i)).join('\n');
        } else if (targetId === 'existing-list') {
          json = (state.comparison?.existing || []).map(i => JSON.stringify(i)).join('\n');
        } else if (targetId === 'returning-list') {
          json = (state.comparison?.returning || []).map(i => JSON.stringify(i)).join('\n');
        }
        if (json) copyText(json, 'Copied JSON');
      }
    });

    // Download dropdowns – on‑click checks for data, then shows the dropdown
    document.querySelectorAll('.download-section-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const targetId = this.dataset.target;
        let dataArray, filename;
        if (targetId === 'unfollowed-list') {
          dataArray = state.comparison?.unfollowed;
          filename = 'unfollowed.json';
        } else if (targetId === 'new-list') {
          dataArray = state.comparison?.newFollowers;
          filename = 'new_followers.json';
        } else if (targetId === 'returning-list') {
          dataArray = state.comparison?.returning;
          filename = 'returning.json';
        } else if (targetId === 'existing-list') {
          dataArray = state.comparison?.existing;
          filename = 'existing.json';
        }
        if (!dataArray || !dataArray.length) {
          toast('No data available for this section', 'warning');
          return;
        }
        // Show the dropdown with the data
        showDownloadDropdown(this, dataArray, filename);
      });
    });

    D.filterInputs.forEach(input => {
      input.addEventListener('input', () => applyFilter(input));
    });

    D.copyExtractBtn.addEventListener('click', () => {
      const t = `Old: ${state.extracted.arrOld.length} (raw ${state.extracted.statsOld?.rawLength||'?'}), New: ${state.extracted.arrNew.length} (raw ${state.extracted.statsNew?.rawLength||'?'}), Removed: ${(state.extracted.statsOld?.removed||0)+(state.extracted.statsNew?.removed||0)}`;
      copyText(t, 'Copied extraction stats');
    });

    D.copyStatsBtn.addEventListener('click', () => {
      const o = state.extracted.statsOld, n = state.extracted.statsNew;
      const lines = [];
      if (o) lines.push(`Old: ${o.cleanedLength}/${o.rawLength} (removed ${o.removed})`);
      if (n) lines.push(`New: ${n.cleanedLength}/${n.rawLength} (removed ${n.removed})`);
      if (state.comparison) {
        const s = state.comparison.summary;
        lines.push(`Unfollowed: ${s.unfollowedCount}, New: ${s.newCount}, Existing: ${s.existingCount}, Retention: ${s.retentionRate}`);
      }
      copyText(lines.join('\n'), 'Copied stats');
    });

    D.dialogCloseBtn.addEventListener('click', closeDialog);
    D.dialogOverlay.addEventListener('click', e => {
      if (e.target === D.dialogOverlay) closeDialog();
    });

    D.tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    const updateClock = () => {
      D.footerTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    updateClock();
    setInterval(updateClock, 30000);

    switchTab('tab-files');
    updateUI();
    setStatus('ready');
  }

  window._moduleLoadError = function(name) {
    toast(`Failed to load ${name} — check network or console`, 'error', 10000);
  };
  window._toast = toast;
  window._copyText = copyText;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window.FansApp || {});
