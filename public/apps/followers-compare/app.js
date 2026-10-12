(function(FansApp) {
  'use strict';

  const { D, toast, setStatus, showDialog, closeDialog } = FansApp.DOM;
  const { handleFile, extractSingleFile, extractBoth, runComparison, state } = FansApp.Core;
  const { renderResults, updateStatsTab, updateUI, switchTab } = FansApp.Render;

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
      try {
        document.execCommand('copy');
        toast(msg, 'success', 1500);
      } catch (e) {
        toast('Copy failed', 'error', 8000);
      }
      ta.remove();
    });
  }

  function downloadJson(data, filename) {
    if (!data || !data.length) {
      toast('Nothing to download', 'warning');
      return;
    }
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
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

  function viewData(key) {
    const arr = key === 'old' ? state.extracted.arrOld : state.extracted.arrNew;
    const stats = key === 'old' ? state.extracted.statsOld : state.extracted.statsNew;
    if (!arr?.length) return toast(`No ${key} data extracted`, 'warning');
    let html = `<div class="text-sm font-medium mb-2">${key.toUpperCase()} (${arr.length} items)</div>`;
    if (stats) html += `<div class="text-xs text-white/60 mb-2">Raw: ${stats.rawLength} · Cleaned: ${stats.cleanedLength} · Removed: ${stats.removed}</div>`;
    const sample = arr.slice(0, 50);
    html += `<div class="text-xs text-white/80 break-all" style="line-height:1.6;">${sample.map(i=>i.UserName||i).filter(Boolean).join('<br>')}</div>`;
    if (arr.length > 50) html += `<div class="text-xs text-white/40 mt-1">… and ${arr.length-50} more</div>`;
    html += `<div class="flex gap-2 mt-3"><button class="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm text-white/80 hover:bg-white/20 transition" onclick="window._copyData('${key}')"><i class="fa-regular fa-copy"></i><span>Copy all</span></button></div>`;
    showDialog(html);
    window._copyData = (k) => {
      const a = k === 'old' ? state.extracted.arrOld : state.extracted.arrNew;
      copyText(a.map(i => i.UserName || i).filter(Boolean).join('\n'), `Copied ${k} usernames`);
    };
  }

  function init() {
    // Drop zones
    setupDrop(D.dropOld, D.fileOld, D.oldFileStatus, 'old');
    setupDrop(D.dropNew, D.fileNew, D.newFileStatus, 'new');

    // Extract single buttons
    D.extractOldBtn.addEventListener('click', () => {
      extractSingleFile(state.files.old, 'old').then(() => {
        D.progressBar.style.width = '100%';
        D.progressText.innerHTML = '<i class="fa-regular fa-check text-green-400"></i> done';
        setStatus('ready');
      }).catch(() => {});
    });
    D.extractNewBtn.addEventListener('click', () => {
      extractSingleFile(state.files.new, 'new').then(() => {
        D.progressBar.style.width = '100%';
        D.progressText.innerHTML = '<i class="fa-regular fa-check text-green-400"></i> done';
        setStatus('ready');
      }).catch(() => {});
    });

    // Extract both / compare
    D.extractBothBtn.addEventListener('click', extractBoth);
    D.compareBtn.addEventListener('click', runComparison);

    // View buttons
    D.viewOldBtn.addEventListener('click', () => viewData('old'));
    D.viewNewBtn.addEventListener('click', () => viewData('new'));

    // Clear all
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
      toast('Cleared', 'info', 1000);
      setStatus('ready');
    });

    // Copy section buttons
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

    // Download section buttons
    document.addEventListener('click', e => {
      const btn = e.target.closest('.download-section-btn');
      if (btn) {
        const targetId = btn.dataset.target;
        let data = null;
        let filename = 'data.json';
        if (targetId === 'unfollowed-list') {
          data = state.comparison?.unfollowed;
          filename = 'unfollowed.json';
        } else if (targetId === 'new-list') {
          data = state.comparison?.newFollowers;
          filename = 'new_followers.json';
        } else if (targetId === 'returning-list') {
          data = state.comparison?.returning;
          filename = 'returning.json';
        } else if (targetId === 'existing-list') {
          data = state.comparison?.existing;
          filename = 'existing.json';
        }
        if (data) downloadJson(data, filename);
      }
    });

    // Copy extract summary
    D.copyExtractBtn.addEventListener('click', () => {
      const t = `Old: ${state.extracted.arrOld.length} (raw ${state.extracted.statsOld?.rawLength||'?'}), New: ${state.extracted.arrNew.length} (raw ${state.extracted.statsNew?.rawLength||'?'}), Removed: ${(state.extracted.statsOld?.removed||0)+(state.extracted.statsNew?.removed||0)}`;
      copyText(t, 'Copied extraction stats');
    });

    // Copy stats
    D.copyStatsBtn.addEventListener('click', () => {
      const o = state.extracted.statsOld,
            n = state.extracted.statsNew;
      const lines = [];
      if (o) lines.push(`Old: ${o.cleanedLength}/${o.rawLength} (removed ${o.removed})`);
      if (n) lines.push(`New: ${n.cleanedLength}/${n.rawLength} (removed ${n.removed})`);
      if (state.comparison) {
        const s = state.comparison.summary;
        lines.push(`Unfollowed: ${s.unfollowedCount}, New: ${s.newCount}, Existing: ${s.existingCount}, Retention: ${s.retentionRate}`);
      }
      copyText(lines.join('\n'), 'Copied stats');
    });

    // Dialog close
    D.dialogCloseBtn.addEventListener('click', closeDialog);
    D.dialogOverlay.addEventListener('click', e => {
      if (e.target === D.dialogOverlay) closeDialog();
    });

    // Tab switching
    D.tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    // Clock
    const updateClock = () => {
      D.footerTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    updateClock();
    setInterval(updateClock, 30000);

    // Initial state
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
