// dom.js - Central DOM element registry
window.FollowBackApp = window.FollowBackApp || {};
window.FollowBackApp.DOM = (function() {
  // Helper to get element and warn if missing
  function get(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`DOM element with id "${id}" not found`);
    return el;
  }
  
  return {
    // File & extraction
    fileInput: get('jsonFileInput'),
    fileLabelSpan: get('fileNameDisplay'),
    extractBtn: get('extractBtn'),
    autoExtract: get('autoExtractCheck'),
    customFileBtn: get('customFileBtn'),
    
    // Progress
    progressFill: get('progressFill'),
    progressMsg: get('progressMsg'),
    
    // Buttons & pre
    renderTableBtn: get('renderTableBtn'),
    fetchProfilesBtn: get('fetchProfilesBtn'),
    extractedJsonPre: get('extractedJsonPre'),
    
    // Dialog
    dialogOverlay: get('customDialog'),
    dialogMsg: get('dialogMessage'),
    closeDialogBtn: get('closeDialogBtn'),
    dialogOkBtn: get('dialogOkBtn'),
    
    // Tab panes
    tabJson: get('tabJson'),
    tabSample: get('tabSample'),
    tabConfig: get('tabConfig'),
    tabAnalytics: get('tabAnalytics'),
    // Config  Tab panes
    tabConfigJson: get('tabConfigJson'),
      tabConfigExtract: get('tabConfigExtract'),
      tabConfigApi: get('tabConfigApi'),
      tabConfigUi: get('tabConfigUi'),
    
    // Settings inputs
    cfg_jsonPath: get('cfg_jsonPath'),
    cfg_followingPath: get('cfg_followingPath'),
    cfg_startIndex: get('cfg_startIndex'),
    cfg_maxExtract: get('cfg_maxExtract'),
    cfg_apiBase: get('cfg_apiBase'),
    cfg_userPath: get('cfg_userPath'),
    cfg_apiKeyStorageKey: get('cfg_apiKeyStorageKey'),
    cfg_apiKeyHeader: get('cfg_apiKeyHeader'),
    cfg_authHeader: get('cfg_authHeader'),
    cfg_concurrency: get('cfg_concurrency'),
    cfg_defaultAvatar: get('cfg_defaultAvatar'),
    cfg_millionThreshold: get('cfg_millionThreshold'),
    cfg_thousandThreshold: get('cfg_thousandThreshold'),
    cfg_dateLocale: get('cfg_dateLocale'),
    cfg_dateFormat: get('cfg_dateFormat'),
    cfg_minFollowers: get('cfg_minFollowers'),
    cfg_ownUsername: get('cfg_ownUsername'),
    
    // Settings buttons
    saveConfigBtn: get('saveConfigBtn'),
    resetConfigBtn: get('resetConfigBtn'),
    
    // Table body
    dynamicTableBody: get('dynamicTableBody'),
  
  // Analytics containers
  analyticsCards: get('analyticsCards'),
  chartDist: get('chartDist'),
  chartMutual: get('chartMutual'),
  bestCandidatesBody: get('bestCandidatesBody'),
  suspiciousBody: get('suspiciousBody')
  };
})();