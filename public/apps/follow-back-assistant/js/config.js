// config.js - Central configuration with localStorage persistence
window.FollowBackApp = window.FollowBackApp || {};
(function(configModule) {
  // Default configuration
  const DEFAULT_CONFIG = {
    // Extraction paths
    JSON_PATH_TO_FANS: ["Profile And Settings", "Follower", "FansList"],
    FOLLOWING_PATH: ["Profile And Settings", "Following", "Following"],
    EXTRACT_START_INDEX: 0,
    MAX_FOLLOWERS_TO_EXTRACT: 300,
    
    // API settings
    API_BASE_URL: 'https://tik-proxy.vercel.app',
    API_USER_PATH: '/api/followback',
    API_KEY_STORAGE_KEY: 'myKey',
    API_KEY_HEADER_NAME: 'X-API-Key',
    AUTH_HEADER_NAME: 'Authorization',
    FETCH_CONCURRENCY: 5,
    
    // UI defaults & filtering
    DEFAULT_AVATAR_URL: 'https://via.placeholder.com/32?text=?',
    MILLION_THRESHOLD: 1e6,
    THOUSAND_THRESHOLD: 1e3,
    DATE_LOCALE: 'en-US',
    DATE_FORMAT_OPTIONS: { year: 'numeric', month: 'short' },
    MIN_FOLLOWERS_TO_FILTER: 10000,
    OWN_USERNAME: '',
    USE_BATCH_ENDPOINT_THRESHOLD: 20,
    
    // Demo table data (static, not editable in UI)
    DEMO_TABLE_DATA: [
      { avatar: "https://randomuser.me/api/portraits/women/68.jpg", displayName: "Emma Watson", handle: "@emmawatson", followers: "245.3K", following: "1.2K", likes: "45.6K", date: "Sep 2026", followBack: false },
      { avatar: "https://randomuser.me/api/portraits/men/32.jpg", displayName: "Chris Evans", handle: "@chrisevans", followers: "1.2M", following: "3.4K", likes: "230.1K", date: "Mar 2024", followBack: true },
      { avatar: "https://randomuser.me/api/portraits/women/45.jpg", displayName: "Zendaya", handle: "@zendaya", followers: "2.1M", following: "2.1K", likes: "512.3K", date: "Dec 2025", followBack: false },
      { avatar: "https://randomuser.me/api/portraits/men/22.jpg", displayName: "Keanu Reeves", handle: "@keanu", followers: "892.5K", following: "892", likes: "98.4K", date: "Jan 2024", followBack: true },
      { avatar: "https://randomuser.me/api/portraits/women/89.jpg", displayName: "Scarlett Johansson", handle: "@scarlett", followers: "3.4M", following: "4.1K", likes: "890.2K", date: "Aug 2026", followBack: false }
    ]
  };
  
  // Load from localStorage or use default
  let currentConfig = { ...DEFAULT_CONFIG };
  const stored = localStorage.getItem('FollowBackApp_Config');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      currentConfig = { ...DEFAULT_CONFIG, ...parsed };
      if (typeof currentConfig.DATE_FORMAT_OPTIONS === 'string') {
        try { currentConfig.DATE_FORMAT_OPTIONS = JSON.parse(currentConfig.DATE_FORMAT_OPTIONS); } catch (e) { currentConfig.DATE_FORMAT_OPTIONS = DEFAULT_CONFIG.DATE_FORMAT_OPTIONS; }
      }
    } catch (e) { console.warn("Failed to load config", e); }
  }
  
  function persistConfig() {
    localStorage.setItem('FollowBackApp_Config', JSON.stringify(currentConfig));
  }
  
  // Public API
  configModule.get = (key) => currentConfig[key];
  configModule.getAll = () => ({ ...currentConfig });
  configModule.set = (key, value) => {
    currentConfig[key] = value;
    persistConfig();
  };
  configModule.update = (newConfig) => {
    currentConfig = { ...currentConfig, ...newConfig };
    persistConfig();
  };
  configModule.reset = () => {
    currentConfig = { ...DEFAULT_CONFIG };
    persistConfig();
  };
  configModule.DEFAULT = DEFAULT_CONFIG;
})(window.FollowBackApp.Config = window.FollowBackApp.Config || {});