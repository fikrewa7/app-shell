// ui-core.js - Shared UI utilities
window.FollowBackApp = window.FollowBackApp || {};
window.FollowBackApp.UI = window.FollowBackApp.UI || {};
window.FollowBackApp.UI.Core = (function() {
  const DOM = window.FollowBackApp.DOM;

  // Dialog
  function showDialog(msg) {
    if (DOM.dialogMsg) DOM.dialogMsg.innerHTML = msg;
    if (DOM.dialogOverlay) DOM.dialogOverlay.classList.add('active');
  }
  function closeDialog() {
    if (DOM.dialogOverlay) DOM.dialogOverlay.classList.remove('active');
  }
  if (DOM.closeDialogBtn) DOM.closeDialogBtn.onclick = closeDialog;
  if (DOM.dialogOkBtn) DOM.dialogOkBtn.onclick = closeDialog;
  if (DOM.dialogOverlay) {
    DOM.dialogOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.dialogOverlay) closeDialog();
    });
  }

  // Progress bar
  function updateProgress(percent, msg) {
    if (DOM.progressFill) DOM.progressFill.style.width = Math.min(100, percent) + '%';
    if (DOM.progressMsg) DOM.progressMsg.innerText = msg || '';
  }

  // Buttons state
  function updateButtonsState(hasData) {
    const enabled = !!hasData;
    if (DOM.renderTableBtn) DOM.renderTableBtn.disabled = !enabled;
    if (DOM.fetchProfilesBtn) DOM.fetchProfilesBtn.disabled = !enabled;
    
    DOM.extractBtn.disabled = !enabled;
    DOM.extractBtn.classList.add("hidden");
    DOM.fetchProfilesBtn.classList.remove("hidden");
  }

  // Tab switching (3 tabs)
  const panes = {
    tabJson: DOM.tabJson,
    tabSample: DOM.tabSample,
    tabConfig: DOM.tabConfig,
    tabAnalytics: DOM.tabAnalytics
  };
  const tabBtns = document.querySelectorAll('[data-tab]');
  function switchTab(tabId) {
    Object.keys(panes).forEach(id => {
      if (panes[id]) panes[id].classList.add('hidden');
    });
    if (panes[tabId]) panes[tabId].classList.remove('hidden');
    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });
  
    // Config Tab switching (3 tabs)
  const cpanes = {
    tabConfigJson: DOM.tabConfigJson,
    tabConfigExtract: DOM.tabConfigExtract,
    tabConfigApi: DOM.tabConfigApi,
    tabConfigUi: DOM.tabConfigUi
  };
  const tabCBtns = document.querySelectorAll('[data-ctab]');
  function switchCTab(tabId) {
    Object.keys(cpanes).forEach(id => {
      if (cpanes[id]) cpanes[id].classList.add('hidden');
    });
    if (cpanes[tabId]) cpanes[tabId].classList.remove('hidden');
    tabCBtns.forEach(btn => {
      if (btn.getAttribute('data-ctab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  tabCBtns.forEach(btn => {
    btn.addEventListener('click', () => switchCTab(btn.getAttribute('data-ctab')));
  });

  // Public API (getFollowingSet removed)
  return {
    showDialog,
    updateProgress,
    updateButtonsState,
    switchTab,
    switchCTab
  };
})();