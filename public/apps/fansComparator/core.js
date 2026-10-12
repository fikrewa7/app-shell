(function(FansApp) {
  'use strict';

  const { D, toast, setStatus } = FansApp.DOM;
  const state = {
    files: { old: null, new: null },
    extracted: { arrOld: [], arrNew: [], statsOld: null, statsNew: null },
    comparison: null
  };

  function handleFile(f, key, statusSpan, zone) {
    if (f.size > 500 * 1024 * 1024) {
      toast('File is too large (max 500 MB). Please use a smaller export.', 'error', 8000);
      return;
    }
    state.files[key] = f;
    const sizeStr = (f.size / 1024).toFixed(1) + ' KB';
    statusSpan.innerHTML = `<i class="fa-regular fa-file text-[10px]"></i> ${f.name} (${sizeStr})`;
    zone.classList.add('has-file');
    if (key === 'old') {
      state.extracted.arrOld = [];
      state.extracted.statsOld = null;
    } else {
      state.extracted.arrNew = [];
      state.extracted.statsNew = null;
    }
    state.comparison = null;
    FansApp.Render.updateUI();
    toast(`Loaded ${f.name}`, 'info', 2000);
    setStatus('ready');
    FansApp.Render.updateStatsTab();
    persistSession();
  }

  function updateProgress(p) {
    if (p && typeof p === 'object' && p.phase) {
      if (p.phase === 'reading') {
        const pct = p.percent || 0;
        D.progressBar.style.width = pct + '%';
        D.progressText.innerHTML = `Reading ${p.name || ''} ... ${pct}%`;
      } else if (p.phase === 'processing') {
        D.progressText.innerHTML = p.text || 'Processing...';
      }
    } else if (typeof p === 'number') {
      const loaded = arguments[0], total = arguments[1], name = arguments[2];
      const pct = total ? Math.round((loaded / total) * 100) : 0;
      D.progressBar.style.width = Math.min(pct, 100) + '%';
      D.progressText.innerHTML = (name || '') + ' ' + pct + '%';
    }
  }

  async function extractSingleFile(file, side) {
    D.progressBar.style.transition = 'none';
    D.progressBar.style.width = '0%';
    D.progressText.innerHTML = 'starting extraction...';
    requestAnimationFrame(() => { D.progressBar.style.transition = ''; });

    if (!file) return toast('No file uploaded for this side', 'warning');
    if (!FansApp) {
      toast('ExtractArrays module is not available – check the browser console for errors.', 'error', 10000);
      return;
    }
    try {
      const result = await FansApp.processSingle(file, updateProgress);
      if (side === 'old') {
        state.extracted.arrOld = result.arr;
        state.extracted.statsOld = result.stats;
      } else {
        state.extracted.arrNew = result.arr;
        state.extracted.statsNew = result.stats;
      }
      state.comparison = null;
      toast(`${side} file extracted: ${result.arr.length} users`, 'success');
      FansApp.Render.updateStatsTab();
      FansApp.Render.updateUI();
      persistSession();
      return result;
    } catch (e) {
      toast(`Error extracting ${side}: ${e.message}`, 'error', 10000);
      throw e;
    }
  }

  async function extractBoth() {
    D.progressBar.style.transition = 'none';
    D.progressBar.style.width = '0%';
    D.progressText.innerHTML = 'starting extraction...';
    requestAnimationFrame(() => { D.progressBar.style.transition = ''; });

    if (!state.files.old || !state.files.new) return toast('Both files must be uploaded', 'warning');
    if (!FansApp) {
      toast('ComparisonApp module is not available – check the browser console for errors.', 'error', 10000);
      return;
    }
    try {
      setStatus('working');
      D.extractBothBtn.disabled = true;
      D.extractBothBtn.innerHTML = '<i class="fa-regular fa-spinner fa-spin text-[10px]"></i><span>Extracting...</span>';
      const result = await FansApp.extractFiles(state.files.old, state.files.new, updateProgress);
      state.extracted.arrOld = result.arrOld || [];
      state.extracted.arrNew = result.arrNew || [];
      state.extracted.statsOld = result.statsOld || null;
      state.extracted.statsNew = result.statsNew || null;
      state.comparison = null;
      D.progressBar.style.width = '100%';
      D.progressText.innerHTML = '<i class="fa-regular fa-check"></i> done';
      toast(`Both files extracted: Old ${result.arrOld.length}, New ${result.arrNew.length}`, 'success');
      FansApp.Render.updateStatsTab();
      FansApp.Render.updateUI();
      setStatus('ready');
      persistSession();
    } catch (e) {
      toast('Extraction error: ' + e.message, 'error', 10000);
      D.progressText.innerHTML = '<i class="fa-regular fa-xmark"></i> error';
      setStatus('error');
      console.error(e);
    } finally {
      D.extractBothBtn.disabled = false;
      D.extractBothBtn.innerHTML = '<i class="fa-regular fa-wand-magic-sparkles text-[10px]"></i><span>Extract Both</span>';
    }
  }

  async function runComparison() {
    const oldA = state.extracted.arrOld,
          newA = state.extracted.arrNew;
    if (!oldA.length || !newA.length) return toast('Need both Old and New data. Extract both files.', 'warning');
    if (!FansApp) {
      toast('ComparisonApp module is not available – check the browser console for errors.', 'error', 10000);
      return;
    }

    D.progressBar.style.transition = 'none';
    D.progressBar.style.width = '0%';
    D.progressText.innerHTML = 'starting comparison...';
    requestAnimationFrame(() => { D.progressBar.style.transition = ''; });

    const USE_WORKER = window.Worker && (oldA.length > 5000 || newA.length > 5000);

    const onProgress = (p) => {
      if (p.phase === 'indexing_old' || p.phase === 'comparing') {
        D.progressBar.style.width = Math.min(p.percent || 0, 100) + '%';
        D.progressText.innerHTML = p.phase === 'indexing_old' ? `Indexing... ${p.percent}%` : `Comparing... ${p.percent}%`;
      } else if (p.phase === 'complete') {
        D.progressBar.style.width = '100%';
        D.progressText.innerHTML = '<i class="fa-regular fa-check"></i> complete';
      }
    };

    try {
      setStatus('working');
      D.compareBtn.disabled = true;
      D.compareBtn.innerHTML = '<i class="fa-regular fa-spinner fa-spin text-[10px]"></i><span>Comparing...</span>';

      let result;
      if (USE_WORKER) {
        result = await runComparisonInWorker(oldA, newA, onProgress);
      } else {
        result = await FansApp.compareArrays(oldA, newA, onProgress);
      }

      state.comparison = result;
      FansApp.Render.renderResults(result);
      toast(`Done: ${result.summary.unfollowedCount} unfollowed, ${result.summary.newCount} new`, 'success');
      FansApp.Render.switchTab('tab-results');
      setStatus('ready');
      persistSession();
    } catch (e) {
      toast('Comparison error: ' + e.message, 'error', 10000);
      setStatus('error');
      console.error(e);
    } finally {
      D.compareBtn.disabled = false;
      D.compareBtn.innerHTML = '<i class="fa-regular fa-arrow-right-arrow-left text-[10px]"></i><span>Compare</span>';
    }
  }

  function runComparisonInWorker(arrOld, arrNew, onProgress) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./worker.js');
      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'progress') {
          onProgress(data.payload);
        } else if (data.type === 'result') {
          worker.terminate();
          resolve(data.payload);
        } else if (data.type === 'error') {
          worker.terminate();
          reject(new Error(data.payload));
        }
      };
      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };
      worker.postMessage({ arrOld, arrNew });
    });
  }

  function persistSession() {
    const sess = {
      files: { oldName: state.files.old?.name, newName: state.files.new?.name },
      extracted: {
        arrOld: state.extracted.arrOld.slice(0, 100),
        arrNew: state.extracted.arrNew.slice(0, 100),
        statsOld: state.extracted.statsOld,
        statsNew: state.extracted.statsNew
      },
      comparison: state.comparison
    };
    try {
      localStorage.setItem('fansAppState', JSON.stringify(sess));
    } catch (e) { /* ignore */ }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem('fansAppState');
      if (!raw) return false;
      const sess = JSON.parse(raw);
      if (sess.extracted?.arrOld?.length || sess.extracted?.arrNew?.length || sess.comparison) {
        state.extracted.arrOld = sess.extracted.arrOld || [];
        state.extracted.arrNew = sess.extracted.arrNew || [];
        state.extracted.statsOld = sess.extracted.statsOld || null;
        state.extracted.statsNew = sess.extracted.statsNew || null;
        state.comparison = sess.comparison || null;
        state.files = { old: null, new: null };
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function clearSessionStorage() {
    localStorage.removeItem('fansAppState');
  }

  FansApp.Core = { state, handleFile, updateProgress, extractSingleFile, extractBoth, runComparison, persistSession, restoreSession, clearSessionStorage };
})(window.FansApp || {});
