// ui-extract.js - Extraction UI logic
window.FollowBackApp = window.FollowBackApp || {};
window.FollowBackApp.UI = window.FollowBackApp.UI || {};
window.FollowBackApp.UI.Extract = (function() {
  const DOM = window.FollowBackApp.DOM;
  const Core = window.FollowBackApp.UI.Core;
  const Extraction = window.FollowBackApp.Extraction;
  
  function displayExtractedJson(list) {
    if (!DOM.extractedJsonPre) return;
    if (!list || list.length === 0) {
      DOM.extractedJsonPre.innerText = 'No followers extracted.';
      Core.updateButtonsState(false);
      return;
    }
    DOM.extractedJsonPre.innerText = JSON.stringify(list, null, 2);
    Core.updateProgress(100, `Extracted ${list.length} followers`);
    Core.updateButtonsState(true);
  }
  
  async function performExtraction() {
    if (!DOM.fileInput || !DOM.fileInput.files.length) {
      Core.showDialog('Please select a JSON file.');
      return;
    }
    const source = DOM.fileInput.files[0];
    const sourceType = 'file';
    if (DOM.extractedJsonPre) {
      DOM.extractedJsonPre.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Processing...';
    }
    Core.updateButtonsState(false);
    Core.updateProgress(2, 'starting worker...');
    
    await Extraction.performExtraction(source, sourceType, {
      onProgress: Core.updateProgress,
      onComplete: (list) => { displayExtractedJson(list); },
      onError: (errMsg) => {
        Core.showDialog('Extraction failed: ' + errMsg);
        Core.updateProgress(0, 'error');
        if (DOM.extractedJsonPre) DOM.extractedJsonPre.innerText = 'Error: ' + errMsg;
        Core.updateButtonsState(false);
      }
    });
  }
  
  // Event binding
  if (DOM.customFileBtn && DOM.fileInput) {
    DOM.customFileBtn.addEventListener('click', () => DOM.fileInput.click());
  }
  if (DOM.fileInput && DOM.fileLabelSpan) {
    DOM.fileInput.addEventListener('change', () => {
      if (DOM.fileInput.files.length) {
        const name = DOM.fileInput.files[0].name;
        DOM.fileLabelSpan.innerText = name.slice(0, 25) + (name.length > 25 ? '...' : '');
        if (DOM.autoExtract && DOM.autoExtract.checked) performExtraction();
      } else {
        DOM.fileLabelSpan.innerText = 'upload json';
      }
    });
  }
  if (DOM.extractBtn) {
    DOM.extractBtn.addEventListener('click', performExtraction);
  }
  
  return { performExtraction };
})();