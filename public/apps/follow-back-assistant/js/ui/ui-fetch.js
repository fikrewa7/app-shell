// ui-fetch.js - Fetch profiles UI logic
window.FollowBackApp = window.FollowBackApp || {};
window.FollowBackApp.UI = window.FollowBackApp.UI || {};
window.FollowBackApp.UI.Fetch = (function() {
  const DOM = window.FollowBackApp.DOM;
  const Core = window.FollowBackApp.UI.Core;
  const Helpers = window.FollowBackApp.Helpers;
  const Render = window.FollowBackApp.Render;
  const Extraction = window.FollowBackApp.Extraction;
  const Fetcher = window.FollowBackApp.Fetcher;
  const Config = window.FollowBackApp.Config;
  
  async function fetchAndUpdateAll() {
    const list = Extraction.getExtractedList();
    if (!list || list.length === 0) {
      Core.showDialog('No extracted data. Please run extraction first.');
      return;
    }
    if (DOM.fetchProfilesBtn) {
      DOM.fetchProfilesBtn.disabled = true;
      DOM.fetchProfilesBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (DOM.extractedJsonPre) {
      DOM.extractedJsonPre.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Fetching profiles...';
    }
    
    try {
      const usernames = list.map(item => item.UserName).filter(u => u);
      const fetchedResults = await Fetcher.fetchBatchProfiles(usernames);
      
      const enrichedList = list.map((item, idx) => {
        const fetched = fetchedResults[idx];
        if (fetched && !fetched.error) {
          return {
            ...item,
            followerCount: fetched.followers,
            followingCount: fetched.following,
            heartCount: fetched.likes,
            avatarUrl: fetched.avatarUrl,
            displayName: fetched.displayName,
            verified: fetched.verified || false
          };
        }
        return item;
      });
      
      // Preserve the following list (unchanged) and update followers
      const followingList = Extraction.getFollowingList();
      Extraction.setExtractedData(enrichedList, followingList || []);
      
      const tableData = enrichedList.map(item => ({
        avatar: item.avatarUrl || Config.get('DEFAULT_AVATAR_URL'),
        displayName: item.displayName || '',
        handle: `@${item.UserName}`,
        followers: item.followerCount || '',
        following: item.followingCount || '',
        likes: item.heartCount || '',
        date: Helpers.formatDate(item.Date),
        followBack: item.followBack || false,
        verified: item.verified || false
      }));
      
      tableData.sort((a, b) => (Helpers.parseFormattedNumber(b.followers) - Helpers.parseFormattedNumber(a.followers)));
      const minFollowers = Config.get('MIN_FOLLOWERS_TO_FILTER');
      const filtered = tableData.filter(item => Helpers.parseFormattedNumber(item.followers) >= minFollowers);
      
      Render.renderTable(filtered);
      //const jsonForPre = filtered.map(({ avatar, followBack, verified, ...rest }) => rest);
      const jsonForPre = filtered.map(({ avatar, ...rest }) => rest);
      if (DOM.extractedJsonPre) DOM.extractedJsonPre.innerText = JSON.stringify(jsonForPre, null, 2);
      
      const successCount = fetchedResults.filter(r => r && !r.error).length;
      Core.showDialog(`Fetched ${successCount} profiles. Table updated (filter ≥ ${minFollowers.toLocaleString()} followers).`);
      Core.switchTab('tabSample');
    } catch (err) {
      console.error(err);
      if (DOM.extractedJsonPre) DOM.extractedJsonPre.innerText = `Error: ${err.message}`;
      Core.showDialog(`Fetch failed: ${err.message}`);
    } finally {
      if (DOM.fetchProfilesBtn) {
        DOM.fetchProfilesBtn.disabled = false;
        DOM.fetchProfilesBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  }
  
  if (DOM.fetchProfilesBtn) {
    DOM.fetchProfilesBtn.addEventListener('click', fetchAndUpdateAll);
  }
  
  return { fetchAndUpdateAll };
})();