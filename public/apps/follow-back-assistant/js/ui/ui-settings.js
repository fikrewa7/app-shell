// ui-settings.js - Settings panel logic
window.FollowBackApp = window.FollowBackApp || {};
window.FollowBackApp.UI = window.FollowBackApp.UI || {};
window.FollowBackApp.UI.Settings = (function() {
  const DOM = window.FollowBackApp.DOM;
  const Core = window.FollowBackApp.UI.Core;
  const Config = window.FollowBackApp.Config;
  
  function loadConfigToForm() {
    if (DOM.cfg_jsonPath) DOM.cfg_jsonPath.value = Config.get('JSON_PATH_TO_FANS').join(', ');
    if (DOM.cfg_followingPath) DOM.cfg_followingPath.value = Config.get('FOLLOWING_PATH').join(', ');
    if (DOM.cfg_startIndex) DOM.cfg_startIndex.value = Config.get('EXTRACT_START_INDEX');
    if (DOM.cfg_maxExtract) DOM.cfg_maxExtract.value = Config.get('MAX_FOLLOWERS_TO_EXTRACT');
    if (DOM.cfg_apiBase) DOM.cfg_apiBase.value = Config.get('API_BASE_URL');
    if (DOM.cfg_userPath) DOM.cfg_userPath.value = Config.get('API_USER_PATH');
    if (DOM.cfg_apiKeyStorageKey) DOM.cfg_apiKeyStorageKey.value = Config.get('API_KEY_STORAGE_KEY');
    if (DOM.cfg_apiKeyHeader) DOM.cfg_apiKeyHeader.value = Config.get('API_KEY_HEADER_NAME');
    if (DOM.cfg_authHeader) DOM.cfg_authHeader.value = Config.get('AUTH_HEADER_NAME');
    if (DOM.cfg_concurrency) DOM.cfg_concurrency.value = Config.get('FETCH_CONCURRENCY');
    if (DOM.cfg_defaultAvatar) DOM.cfg_defaultAvatar.value = Config.get('DEFAULT_AVATAR_URL');
    if (DOM.cfg_millionThreshold) DOM.cfg_millionThreshold.value = Config.get('MILLION_THRESHOLD');
    if (DOM.cfg_thousandThreshold) DOM.cfg_thousandThreshold.value = Config.get('THOUSAND_THRESHOLD');
    if (DOM.cfg_dateLocale) DOM.cfg_dateLocale.value = Config.get('DATE_LOCALE');
    if (DOM.cfg_dateFormat) DOM.cfg_dateFormat.value = JSON.stringify(Config.get('DATE_FORMAT_OPTIONS'));
    if (DOM.cfg_minFollowers) DOM.cfg_minFollowers.value = Config.get('MIN_FOLLOWERS_TO_FILTER');
    if (DOM.cfg_ownUsername) DOM.cfg_ownUsername.value = Config.get('OWN_USERNAME');
  }
  
  function saveConfigFromForm() {
    try {
      const newConfig = {
        JSON_PATH_TO_FANS: DOM.cfg_jsonPath ? DOM.cfg_jsonPath.value.split(',').map(s => s.trim()) : [],
        FOLLOWING_PATH: DOM.cfg_followingPath ? DOM.cfg_followingPath.value.split(',').map(s => s.trim()) : [],
        EXTRACT_START_INDEX: DOM.cfg_startIndex ? parseInt(DOM.cfg_startIndex.value, 10) : 0,
        MAX_FOLLOWERS_TO_EXTRACT: DOM.cfg_maxExtract ? parseInt(DOM.cfg_maxExtract.value, 10) : 300,
        API_BASE_URL: DOM.cfg_apiBase ? DOM.cfg_apiBase.value : '',
        API_USER_PATH: DOM.cfg_userPath ? DOM.cfg_userPath.value : '/api/followback',
        API_KEY_STORAGE_KEY: DOM.cfg_apiKeyStorageKey ? DOM.cfg_apiKeyStorageKey.value : '',
        API_KEY_HEADER_NAME: DOM.cfg_apiKeyHeader ? DOM.cfg_apiKeyHeader.value : '',
        AUTH_HEADER_NAME: DOM.cfg_authHeader ? DOM.cfg_authHeader.value : '',
        FETCH_CONCURRENCY: DOM.cfg_concurrency ? parseInt(DOM.cfg_concurrency.value, 10) : 5,
        DEFAULT_AVATAR_URL: DOM.cfg_defaultAvatar ? DOM.cfg_defaultAvatar.value : '',
        MILLION_THRESHOLD: DOM.cfg_millionThreshold ? parseFloat(DOM.cfg_millionThreshold.value) : 1e6,
        THOUSAND_THRESHOLD: DOM.cfg_thousandThreshold ? parseFloat(DOM.cfg_thousandThreshold.value) : 1e3,
        DATE_LOCALE: DOM.cfg_dateLocale ? DOM.cfg_dateLocale.value : 'en-US',
        DATE_FORMAT_OPTIONS: DOM.cfg_dateFormat ? JSON.parse(DOM.cfg_dateFormat.value) : { year: 'numeric', month: 'short' },
        MIN_FOLLOWERS_TO_FILTER: DOM.cfg_minFollowers ? parseInt(DOM.cfg_minFollowers.value, 10) : 10000,
        OWN_USERNAME: DOM.cfg_ownUsername ? DOM.cfg_ownUsername.value.trim() : ''
      };
      Config.update(newConfig);
      Core.showDialog('Settings saved. They will be used for future extractions and fetches.');
    } catch (e) {
      Core.showDialog('Invalid JSON for date format: ' + e.message);
    }
  }
  
  function resetConfig() {
    Config.reset();
    loadConfigToForm();
    Core.showDialog('Settings reset to defaults.');
  }
  
  if (DOM.saveConfigBtn) DOM.saveConfigBtn.addEventListener('click', saveConfigFromForm);
  if (DOM.resetConfigBtn) DOM.resetConfigBtn.addEventListener('click', resetConfig);
  
  loadConfigToForm();
  
  return { loadConfigToForm, saveConfigFromForm, resetConfig };
})();