(function(FansApp) {
  'use strict';

  const { D, toast, setStatus } = FansApp.DOM;

  const state = {
    files: { old: null, new: null },
    extracted: { arrOld: [], arrNew: [], statsOld: null, statsNew: null },
    comparison: null
  };

  function handleFile(f, key, statusSpan, zone) {
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
  }

  function updateProgress(loaded, total, name) {
    const pct = total ? Math.round((loaded / total) * 100) : 0;
    D.progressBar.style.width = Math.min(pct, 100) + '%';
    D.progressText.innerHTML = (name || '') + ' ' + pct + '%';
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
      D.progressText.innerHTML = '<i class="fa-regular fa-check text-green-400"></i> done';
      toast(`Both files extracted: Old ${result.arrOld.length}, New ${result.arrNew.length}`, 'success');
      FansApp.Render.updateStatsTab();
      FansApp.Render.updateUI();
      setStatus('ready');
    } catch (e) {
      toast('Extraction error: ' + e.message, 'error', 10000);
      D.progressText.innerHTML = '<i class="fa-regular fa-xmark text-red-400"></i> error';
      setStatus('error');
      console.error(e);
    } finally {
      D.extractBothBtn.disabled = false;
      D.extractBothBtn.innerHTML = '<i class="fa-regular fa-wand-magic-sparkles text-[10px]"></i><span>Both</span>';
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

    try {
      setStatus('working');
      D.compareBtn.disabled = true;
      D.compareBtn.innerHTML = '<i class="fa-regular fa-spinner fa-spin text-[10px]"></i><span>Comparing...</span>';

      const totalItems = oldA.length + newA.length;
      const oldWeight = totalItems > 0 ? oldA.length / totalItems : 0.5;

      const onProgress = (p) => {
        if (p.phase === 'indexing_old') {
          const progress = p.percent * oldWeight;
          D.progressBar.style.width = Math.min(progress, oldWeight * 100) + '%';
          D.progressText.innerHTML = 'Indexing... ' + (p.percent || 0) + '%';
        } else if (p.phase === 'comparing') {
          const base = oldWeight * 100;
          const progress = base + (p.percent * (1 - oldWeight));
          D.progressBar.style.width = Math.min(progress, 100) + '%';
          D.progressText.innerHTML = 'Comparing... ' + (p.percent || 0) + '%';
        } else if (p.phase === 'complete') {
          D.progressBar.style.width = '100%';
          D.progressText.innerHTML = '<i class="fa-regular fa-check text-green-400"></i> complete';
        }
      };

      const result = await FansApp.compareArrays(oldA, newA, onProgress);
      state.comparison = result;
      FansApp.Render.renderResults(result);
      toast(`Done: ${result.summary.unfollowedCount} unfollowed, ${result.summary.newCount} new`, 'success');
      FansApp.Render.switchTab('tab-results');
      setStatus('ready');
    } catch (e) {
      toast('Comparison error: ' + e.message, 'error', 10000);
      setStatus('error');
      console.error(e);
    } finally {
      D.compareBtn.disabled = false;
      D.compareBtn.innerHTML = '<i class="fa-regular fa-arrow-right-arrow-left text-[10px]"></i><span>Compare</span>';
    }
  }

  FansApp.Core = { state, handleFile, updateProgress, extractSingleFile, extractBoth, runComparison };

})(window.FansApp || {});
