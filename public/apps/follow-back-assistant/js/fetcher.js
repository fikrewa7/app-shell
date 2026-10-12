(function(fetcher) {
  const Config = window.FollowBackApp.Config;

function updateProgress(percent, msg) {
  if (window.FollowBackApp.UI && typeof window.FollowBackApp.UI.updateProgress === 'function') {
    window.FollowBackApp.UI.updateProgress(percent, msg);
  } else {
    const fill = document.getElementById('progressFill');
    const span = document.getElementById('progressMsg');
    if (fill) fill.style.width = percent + '%';
    if (span) span.innerText = msg || '';
  }
}

  async function fetchProfileFromAPI(username) {
    const apiKey = localStorage.getItem(Config.get('API_KEY_STORAGE_KEY'));
    if (!apiKey) throw new Error(`API key not found. Set localStorage.${Config.get('API_KEY_STORAGE_KEY')}`);
    const url = `${Config.get('API_BASE_URL')}${Config.get('API_USER_PATH')}/${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      headers: {
        [Config.get('API_KEY_HEADER_NAME')]: apiKey,
        [Config.get('AUTH_HEADER_NAME')]: apiKey
      }
    });
    if (response.status === 401) throw new Error('Invalid API key');
    if (!response.ok) {
      let errText = `HTTP ${response.status}`;
      try { const errJson = await response.json(); errText = errJson.error || errText; } catch(e) {}
      throw new Error(errText);
    }
    const json = await response.json();
    if (!json?.data?.userInfo?.user) throw new Error('Invalid API response');
    const user = json.data.userInfo.user;
    const stats = json.data.userInfo.statsV2 || {};
    return {
      uniqueId: user.uniqueId,
      nickname: user.nickname || user.uniqueId,
      avatarMedium: user.avatarMedium,
      followerCount: stats.followerCount || 0,
      followingCount: stats.followingCount || 0,
      heartCount: stats.heartCount || 0,
      verified: user.verified || false
    };
  }

  // New: batch fetch using multi‑username endpoint
  async function fetchBatchFromAPI(usernamesArray) {
    const apiKey = localStorage.getItem(Config.get('API_KEY_STORAGE_KEY'));
    if (!apiKey) throw new Error(`API key not found. Set localStorage.${Config.get('API_KEY_STORAGE_KEY')}`);
    const usernamesParam = usernamesArray.join(',');
    const url = `${Config.get('API_BASE_URL')}${Config.get('API_USER_PATH')}?usernames=${encodeURIComponent(usernamesParam)}`;
    const response = await fetch(url, {
      headers: {
        [Config.get('API_KEY_HEADER_NAME')]: apiKey,
        [Config.get('AUTH_HEADER_NAME')]: apiKey
      }
    });
    if (response.status === 401) throw new Error('Invalid API key');
    if (!response.ok) {
      let errText = `HTTP ${response.status}`;
      try { const errJson = await response.json(); errText = errJson.error || errText; } catch(e) {}
      throw new Error(errText);
    }
    const json = await response.json();
    // Expecting { results: [{ username, success, data, error? }] }
    if (!json.results) throw new Error('Invalid batch response format');
    return json.results;
  }

  fetcher.fetchProfileData = async function(userName) {
    const profile = await fetchProfileFromAPI(userName);
    return {
      userName: profile.uniqueId,
      displayName: profile.nickname,
      followers: profile.followerCount,
      following: profile.followingCount,
      likes: profile.heartCount,
      avatarUrl: profile.avatarMedium,
      verified: profile.verified
    };
  };

  fetcher.fetchBatchProfiles = async function(userNamesArray) {
    const threshold = Config.get('USE_BATCH_ENDPOINT_THRESHOLD');
    if (userNamesArray.length <= threshold) {
      // Use batch endpoint
      try {
        const batchResults = await fetchBatchFromAPI(userNamesArray);
        // Map batch results back to original order (they should be in same order)
        return batchResults.map(r => {
          if (r.success && r.data) {
            const user = r.data.userInfo.user;
            const stats = r.data.userInfo.statsV2 || {};
            return {
              userName: user.uniqueId,
              displayName: user.nickname || user.uniqueId,
              followers: stats.followerCount || 0,
              following: stats.followingCount || 0,
              likes: stats.heartCount || 0,
              avatarUrl: user.avatarMedium,
              verified: user.verified || false
            };
          } else {
            return { userName: r.username, error: r.error || 'Batch fetch failed' };
          }
        });
      } catch (err) {
        console.warn('Batch fetch failed, falling back to concurrent requests', err);
        // Fall through to concurrent method
      }
    }
    // Concurrent method (original)
    const total = userNamesArray.length;
    const results = new Array(total);
    let completed = 0;
    const updateBatchProgress = () => {
      const percent = Math.floor((completed / total) * 100);
      updateProgress(percent, `Fetched ${completed}/${total} profiles`);
    };
    const queue = [...userNamesArray.entries()];
    const concurrency = Config.get('FETCH_CONCURRENCY');
    const worker = async () => {
      while (queue.length) {
        const [idx, username] = queue.shift();
        try {
          results[idx] = await fetcher.fetchProfileData(username);
        } catch (err) {
          results[idx] = { userName: username, error: err.message };
        } finally {
          completed++;
          updateBatchProgress();
        }
      }
    };
    const workers = [];
    for (let i = 0; i < Math.min(concurrency, total); i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  };

  fetcher.hasApiKey = () => !!localStorage.getItem(Config.get('API_KEY_STORAGE_KEY'));
})(window.FollowBackApp.Fetcher = window.FollowBackApp.Fetcher || {});