window.FollowBackApp = window.FollowBackApp || {};
(function(helpers) {
  const Config = window.FollowBackApp.Config;
  
  helpers.formatNumber = function(num) {
    if (num === undefined || num === null) return '';
    const n = Number(num);
    if (isNaN(n)) return num;
    const million = Config.get('MILLION_THRESHOLD');
    const thousand = Config.get('THOUSAND_THRESHOLD');
    if (n >= million) return (n / million).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= thousand) return (n / thousand).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };
  
  helpers.formatDate = function(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const locale = Config.get('DATE_LOCALE');
    const options = Config.get('DATE_FORMAT_OPTIONS');
    return d.toLocaleDateString(locale, options);
  };
  
  // No more followingSet parameter – uses followBack flag from extracted item
  helpers.normalizeExtractedToTableFormat = function(extractedItem) {
    return {
      avatar: Config.get('DEFAULT_AVATAR_URL'),
      displayName: extractedItem.displayName || extractedItem.UserName || '',
      handle: `@${extractedItem.UserName || ''}`,
      followers: extractedItem.followerCount || '',
      following: extractedItem.followingCount || '',
      likes: extractedItem.heartCount || '',
      date: extractedItem.Date ? helpers.formatDate(extractedItem.Date) : '',
      followBack: extractedItem.followBack || false,
      verified: extractedItem.verified || false
    };
  };
  
  helpers.parseFormattedNumber = function(value) {
    if (typeof value === 'number') return value;
    if (!value || value === '') return 0;
    const str = String(value).toUpperCase();
    let multiplier = 1;
    const million = Config.get('MILLION_THRESHOLD');
    const thousand = Config.get('THOUSAND_THRESHOLD');
    if (str.endsWith('M')) multiplier = million;
    else if (str.endsWith('K')) multiplier = thousand;
    const num = parseFloat(str.replace(/[KM]$/i, ''));
    return isNaN(num) ? 0 : num * multiplier;
  };
  
  helpers.parseDateToTimestamp = function(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };
})(window.FollowBackApp.Helpers = window.FollowBackApp.Helpers || {});