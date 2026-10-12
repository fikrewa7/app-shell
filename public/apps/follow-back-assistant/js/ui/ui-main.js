// ui-main.js - Main initialisation and cross-module wiring
window.FollowBackApp = window.FollowBackApp || {};
window.FollowBackApp.UI = window.FollowBackApp.UI || {};
window.FollowBackApp.UI.Main = (function() {
  const DOM = window.FollowBackApp.DOM;
  const Core = window.FollowBackApp.UI.Core;
  const Helpers = window.FollowBackApp.Helpers;
  const Render = window.FollowBackApp.Render;
  const Extraction = window.FollowBackApp.Extraction;
  const Config = window.FollowBackApp.Config;
  
  function renderExtractedToTable() {
    const list = Extraction.getExtractedList();
    if (!list || list.length === 0) {
      Core.showDialog('No extracted data. Please run extraction first.');
      return;
    }
    const tableData = list.map(item => Helpers.normalizeExtractedToTableFormat(item));
    Render.renderTable(tableData);
    Core.switchTab('tabSample');
  }
  
  if (DOM.renderTableBtn) {
    DOM.renderTableBtn.addEventListener('click', renderExtractedToTable);
  }
  
  // Initial demo: show sample table
  const demoData = Config.get('DEMO_TABLE_DATA') || window.FollowBackApp.Config.DEFAULT.DEMO_TABLE_DATA;
  Render.renderTable(demoData);
  
  // Ensure active button matches visible pane (sync initial state)
  const activeTabBtn = document.querySelector('[data-tab].active');
  if (activeTabBtn) {
    const tabId = activeTabBtn.getAttribute('data-tab');
    Core.switchTab(tabId);
  }
  
  console.log('UI initialised (follow-back detection moved to worker)');
})();