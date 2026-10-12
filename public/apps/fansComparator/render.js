(function(FansApp) {
  'use strict';

  const { D, toast } = FansApp.DOM;
  const { state } = FansApp.Core;

  function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    return Number(n).toLocaleString();
  }

  const fullData = {
    unfollowed: [],
    newFollowers: [],
    returning: [],
    existing: []
  };

  function renderResults(result) {
    if (!result) {
      D.resultEmptyMsg.classList.remove('hidden');
      D.resultSections.classList.add('hidden');
      D.resultSingleMsg.classList.add('hidden');
      return;
    }
    D.resultEmptyMsg.classList.add('hidden');
    D.resultSingleMsg.classList.add('hidden');
    D.resultSections.classList.remove('hidden');

    fullData.unfollowed = result.unfollowed || [];
    fullData.newFollowers = result.newFollowers || [];
    fullData.returning = result.returning || [];
    fullData.existing = result.existing || [];

    const s = result.summary;
    D.rUnfollowed.textContent = formatNumber(s.unfollowedCount);
    D.rNew.textContent = formatNumber(s.newCount);
    D.rReturning.textContent = formatNumber(s.returningCount);
    D.rExisting.textContent = formatNumber(s.existingCount);
    D.rRetention.textContent = s.retentionRate || '—';
    D.rUnfollowedBadge.textContent = formatNumber(s.unfollowedCount);
    D.rNewBadge.textContent = formatNumber(s.newCount);
    D.rReturningBadge.textContent = formatNumber(s.returningCount);
    D.rExistingBadge.textContent = formatNumber(s.existingCount);

    updateListContent('unfollowed-list', fullData.unfollowed, Infinity);
    updateListContent('new-list', fullData.newFollowers, Infinity);
    updateListContent('returning-list', fullData.returning, Infinity);
    updateListContent('existing-list', fullData.existing, 20);

    updateUI();
  }

  function updateListContent(targetId, arr, max) {
    const pre = document.getElementById(targetId);
    if (!pre) return;
    pre.textContent = renderList(arr, max);
  }

  function renderList(arr, max = 20) {
    if (!arr?.length) return '—';
    const items = arr.slice(0, max).map(item => JSON.stringify(item, null, 2));
    let text = items.join('\n\n');
    if (arr.length > max) text += '\n\n… and ' + formatNumber(arr.length - max) + ' more';
    return text;
  }

  function applyFilter(inputEl) {
    const targetId = inputEl.dataset.target;
    let dataArray;
    switch (targetId) {
      case 'unfollowed-list': dataArray = fullData.unfollowed; break;
      case 'new-list': dataArray = fullData.newFollowers; break;
      case 'returning-list': dataArray = fullData.returning; break;
      case 'existing-list': dataArray = fullData.existing; break;
      default: return;
    }
    const filterText = inputEl.value.trim().toLowerCase();
    if (!filterText) {
      updateListContent(targetId, dataArray, targetId === 'existing-list' ? 20 : Infinity);
      return;
    }
    const filtered = dataArray.filter(item => {
      return item && item.UserName && item.UserName.toLowerCase().includes(filterText);
    });
    updateListContent(targetId, filtered, Infinity);
  }

  function updateStatsTab() {
    const o = state.extracted.statsOld,
          n = state.extracted.statsNew;
    D.stOldRaw.textContent = o ? formatNumber(o.rawLength) : '—';
    D.stOldClean.textContent = o ? formatNumber(o.cleanedLength) : '—';
    D.stOldRemoved.textContent = o ? formatNumber(o.removed) : '—';
    if (n) {
      D.stNewRaw.textContent = formatNumber(n.rawLength);
      D.stNewClean.textContent = formatNumber(n.cleanedLength);
      D.stNewRemoved.textContent = formatNumber(n.removed);
      D.stNewAbsent.classList.add('hidden');
    } else {
      D.stNewRaw.textContent = '—';
      D.stNewClean.textContent = '—';
      D.stNewRemoved.textContent = '—';
      D.stNewAbsent.classList.remove('hidden');
    }
    const totalRemoved = (o?.removed || 0) + (n?.removed || 0);
    D.stRemovedTotal.textContent = totalRemoved ? formatNumber(totalRemoved) : '—';

    let sample = '';
    if (o?.sample?.length) sample += 'Old sample: ' + o.sample.map(i => i.UserName).filter(Boolean).join(', ');
    if (n?.sample?.length) {
      if (sample) sample += ' | ';
      sample += 'New sample: ' + n.sample.map(i => i.UserName).filter(Boolean).join(', ');
    }
    D.statsSample.textContent = sample || 'No sample data';
  }

  function updateUI() {
    const hasOld = !!state.files.old;
    const hasNew = !!state.files.new;
    const hasOldData = state.extracted.arrOld.length > 0;
    const hasNewData = state.extracted.arrNew.length > 0;
    const hasBothData = hasOldData && hasNewData;

    D.extractOldBtn.disabled = !hasOld;
    D.extractNewBtn.disabled = !hasNew;
    D.extractBothBtn.disabled = !(hasOld && hasNew);
    D.compareBtn.disabled = !hasBothData;
    D.viewOldBtn.disabled = !hasOldData;
    D.viewNewBtn.disabled = !hasNewData;

    if (hasOldData || hasNewData) {
      D.extOldCount.textContent = formatNumber(state.extracted.arrOld.length);
      D.extNewCount.textContent = formatNumber(state.extracted.arrNew.length);
      D.extRemovedOld.textContent = formatNumber(state.extracted.statsOld?.removed || 0);
      D.extRemovedNew.textContent = formatNumber(state.extracted.statsNew?.removed || 0);
      //D.quickStartMsg.classList.add('hidden');
    } else {
      //D.quickStartMsg.classList.remove('hidden');
    }

    if (hasOldData && hasNewData) {
      D.resultSingleMsg.classList.add('hidden');
      D.resultEmptyMsg.classList.add('hidden');
    } else if (hasOldData || hasNewData) {
      D.resultSingleMsg.classList.remove('hidden');
      D.resultEmptyMsg.classList.add('hidden');
    } else {
      D.resultSingleMsg.classList.add('hidden');
      D.resultEmptyMsg.classList.remove('hidden');
    }

    D.footerMemory.textContent = (hasOldData || hasNewData) ?
      `O:${formatNumber(state.extracted.arrOld.length)} N:${formatNumber(state.extracted.arrNew.length)}` +
      (state.comparison ? ` | Δ:${formatNumber(state.comparison.summary.unfollowedCount)} ➕${formatNumber(state.comparison.summary.newCount)}` : '') :
      '—';
  }

  function switchTab(tabId) {
    D.tabBtns.forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('border-current', isActive);
      btn.classList.toggle('font-semibold', isActive);
      btn.classList.toggle('border-transparent', !isActive);
      btn.classList.toggle('font-normal', !isActive);
      btn.classList.toggle('text-gray-900', isActive);
      btn.classList.toggle('dark:text-gray-100', isActive);
      btn.classList.toggle('text-gray-500', !isActive);
      btn.classList.toggle('dark:text-gray-400', !isActive);
    });
    Object.entries(D.panes).forEach(([key, pane]) => {
      pane.classList.toggle('hidden', 'tab-' + key !== tabId);
    });
  }

  FansApp.Render = { renderResults, updateStatsTab, updateUI, switchTab, applyFilter };
})(window.FansApp || {});
