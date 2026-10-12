// ui-analytics.js - Analytics dashboard
window.FollowBackApp = window.FollowBackApp || {};
window.FollowBackApp.UI = window.FollowBackApp.UI || {};
window.FollowBackApp.UI.Analytics = (function() {
  const DOM = window.FollowBackApp.DOM;
  const Core = window.FollowBackApp.UI.Core;
  const Extraction = window.FollowBackApp.Extraction;
  const Config = window.FollowBackApp.Config;
  const Helpers = window.FollowBackApp.Helpers;
  
  let chartDist = null;
  let chartMutual = null;
  
  function formatNumberShort(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  }
  
  function renderCards(stats) {
    const container = DOM.analyticsCards;
    if (!container) return;
    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-slate-800/50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-indigo-300">${stats.totalFollowers}</div>
          <div class="text-xs text-slate-400">Total Followers</div>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-emerald-300">${stats.mutual}</div>
          <div class="text-xs text-slate-400">Mutual Followers</div>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-amber-300">${stats.nonMutual}</div>
          <div class="text-xs text-slate-400">Not Following Back</div>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-cyan-300">${stats.youFollowNonFollowers}</div>
          <div class="text-xs text-slate-400">You Follow (No Return)</div>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-purple-300">${formatNumberShort(stats.avgFollowers)}</div>
          <div class="text-xs text-slate-400">Avg Follower Count</div>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-pink-300">${stats.verifiedCount}</div>
          <div class="text-xs text-slate-400">Verified Accounts</div>
        </div>
      </div>
    `;
  }
  
  function renderCharts(data) {
    // Follower count distribution (binned)
    const bins = [0, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
    const counts = new Array(bins.length - 1).fill(0);
    data.forEach(f => {
      const val = Helpers.parseFormattedNumber(f.followers);
      for (let i = 0; i < bins.length - 1; i++) {
        if (val >= bins[i] && val < bins[i + 1]) {
          counts[i]++;
          break;
        }
        if (val >= bins[bins.length - 1]) counts[counts.length - 1]++;
      }
    });
    const labels = bins.slice(0, -1).map((b, i) => `${b.toLocaleString()}-${bins[i+1].toLocaleString()}`);
    
    if (chartDist) chartDist.destroy();
    const ctxDist = document.getElementById('chartDist')?.getContext('2d');
    if (ctxDist) {
      chartDist = new Chart(ctxDist, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Followers', data: counts, backgroundColor: '#6366f1' }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#cbd5e1' } } } }
      });
    }
    
    // Mutual vs non-mutual pie
    const mutual = data.filter(f => f.followBack).length;
    const nonMutual = data.length - mutual;
    if (chartMutual) chartMutual.destroy();
    const ctxMutual = document.getElementById('chartMutual')?.getContext('2d');
    if (ctxMutual) {
      chartMutual = new Chart(ctxMutual, {
        type: 'pie',
        data: { labels: ['Mutual', 'Not Mutual'], datasets: [{ data: [mutual, nonMutual], backgroundColor: ['#10b981', '#f59e0b'] }] },
        options: { responsive: true, plugins: { legend: { labels: { color: '#cbd5e1' } } } }
      });
    }
  }
  
  function renderBestCandidates(followers) {
    const tbody = DOM.bestCandidatesBody;
    if (!tbody) return;
    // Filter: not mutual, follower count >= MIN_FOLLOWERS_TO_FILTER, and has live stats (followerCount > 0)
    const minFollowers = Config.get('MIN_FOLLOWERS_TO_FILTER');
    const candidates = followers.filter(f =>
      !f.followBack && f.followerCount && Helpers.parseFormattedNumber(f.followerCount) >= minFollowers
    ).sort((a, b) => Helpers.parseFormattedNumber(b.followerCount) - Helpers.parseFormattedNumber(a.followerCount));
    
    tbody.innerHTML = '';
    if (candidates.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-400">No candidates found</td></tr>';
      return;
    }
    candidates.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-2 py-1"><img src="${f.avatarUrl || Config.get('DEFAULT_AVATAR_URL')}" class="w-6 h-6 rounded-full"></td>
        <td class="px-2 py-1">${f.displayName || f.UserName}</td>
        <td class="px-2 py-1">${Helpers.formatNumber(f.followerCount)}</td>
        <td class="px-2 py-1"><input type="checkbox" class="table-checkbox candidate-follow" data-username="${f.UserName}"></td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  function renderSuspicious(followers) {
    const tbody = DOM.suspiciousBody;
    if (!tbody) return;
    // Suspicious: high following (>5000) but low followers (<100)
    const suspicious = followers.filter(f =>
      f.followingCount && f.followerCount &&
      Helpers.parseFormattedNumber(f.followingCount) > 5000 &&
      Helpers.parseFormattedNumber(f.followerCount) < 100
    ).sort((a, b) => Helpers.parseFormattedNumber(b.followingCount) - Helpers.parseFormattedNumber(a.followingCount));
    
    tbody.innerHTML = '';
    if (suspicious.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-400">No suspicious accounts detected</td></tr>';
      return;
    }
    suspicious.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-2 py-1"><img src="${f.avatarUrl || Config.get('DEFAULT_AVATAR_URL')}" class="w-6 h-6 rounded-full"></td>
        <td class="px-2 py-1">${f.displayName || f.UserName}</td>
        <td class="px-2 py-1">${Helpers.formatNumber(f.followerCount)}</td>
        <td class="px-2 py-1">${Helpers.formatNumber(f.followingCount)}</td>
        <td class="px-2 py-1"><input type="checkbox" class="table-checkbox suspicious-unfollow" data-username="${f.UserName}"></td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  function computeStats(followers, followingList) {
    const totalFollowers = followers.length;
    const mutual = followers.filter(f => f.followBack).length;
    const nonMutual = totalFollowers - mutual;
    
    // People you follow who don't follow back
    const ownUsername = Config.get('OWN_USERNAME');
    let youFollowNonFollowers = 0;
    if (ownUsername) {
      const followingSet = new Set(followingList);
      // For analytics, we need to know which of your following are NOT in followers
      // But followers list may not include all (only extracted). To be accurate, we need full following vs full followers.
      // As we only have extracted followers, we approximate using the intersection? Better to use the full following list
      // and the full followers list? We only have extracted followers. We'll compute based on the extracted followers only.
      // That's a limitation. For now, compute as followers who are not following back? Actually we want: people you follow (from followingList) who are not in the extracted followers.
      // Since followingList is the full list, we can filter those not present in extracted followers.
      const followerUsernames = new Set(followers.map(f => f.UserName));
      youFollowNonFollowers = followingList.filter(u => !followerUsernames.has(u)).length;
    } else {
      youFollowNonFollowers = 'N/A (set username)';
    }
    
    const followerCounts = followers.map(f => Helpers.parseFormattedNumber(f.followerCount)).filter(v => v > 0);
    const avgFollowers = followerCounts.length ? followerCounts.reduce((a, b) => a + b, 0) / followerCounts.length : 0;
    const verifiedCount = followers.filter(f => f.verified).length;
    
    return { totalFollowers, mutual, nonMutual, youFollowNonFollowers, avgFollowers, verifiedCount };
  }
  
  async function refreshAnalytics() {
    const followers = Extraction.getExtractedList();
    const followingList = Extraction.getFollowingList();
    if (!followers || followers.length === 0) {
      Core.showDialog('No extracted data. Please run extraction and fetch profiles first.');
      return;
    }
    // Wait a bit for stats to be enriched? Assume fetch already done.
    const stats = computeStats(followers, followingList || []);
    renderCards(stats);
    renderCharts(followers);
    renderBestCandidates(followers);
    renderSuspicious(followers);
  }
  
  // Listen for tab switch to refresh when analytics tab is opened
  function init() {
    const tabBtn = document.querySelector('[data-tab="tabAnalytics"]');
    if (tabBtn) {
      tabBtn.addEventListener('click', () => {
        setTimeout(refreshAnalytics, 100); // allow DOM to show
      });
    }
  }
  init();
  
  return { refreshAnalytics };
})();