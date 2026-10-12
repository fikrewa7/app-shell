(function(FansApp) {
  'use strict';

  const { D, toast } = FansApp.DOM;
  const { state } = FansApp.Core;

  function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    return Number(n).toLocaleString();
  }

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

    const renderList = (arr, max = 20) => {
      if (!arr?.length) return '—';
      const items = arr.slice(0, max).map(item => JSON.stringify(item, null, 2));
      let text = items.join('\n\n');
      if (arr.length > max) text += '\n\n… and ' + formatNumber(arr.length - max) + ' more';
      return text;
    };

    D.unfollowedList.textContent = renderList(result.unfollowed, Infinity);
    D.newList.textContent = renderList(result.newFollowers, Infinity);
    D.returningList.textContent = renderList(result.returning, Infinity);
    D.existingList.textContent = renderList(result.existing, 20);

    updateUI();
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
      btn.classList.toggle('text-white/80', isActive);
      btn.classList.toggle('border-blue-400', isActive);
      btn.classList.toggle('text-white/30', !isActive);
      btn.classList.toggle('border-transparent', !isActive);
    });
    Object.entries(D.panes).forEach(([key, pane]) => {
      pane.classList.toggle('hidden', 'tab-' + key !== tabId);
    });
  }

  FansApp.Render = { renderResults, updateStatsTab, updateUI, switchTab };

})(window.FansApp || {});
