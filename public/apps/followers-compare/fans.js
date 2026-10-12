// fansApp.js – merged single module with full API
(function() {
  'use strict';

  // ─── fansList.js logic ──────────────────────────────────────────────

  async function readFileWithProgress(file, onProgress) {
    const total = file.size;
    const chunks = [];
    let loaded = 0;
    const stream = file.stream();
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      if (onProgress) onProgress(loaded, total, file.name);
    }

    const full = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      full.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return JSON.parse(new TextDecoder().decode(full));
  }

  function extractArray(data, path) {
    let current = data;
    for (const key of path) {
      if (current == null || typeof current !== 'object') return [];
      current = current[key];
    }
    return Array.isArray(current) ? current : [];
  }

  function cleanArray(arr) {
    return arr.filter(item => {
      if (item == null || typeof item !== 'object') return false;
      const userName = item.UserName;
      return !(userName === null || userName === undefined || userName === '' || userName === 'N/A');
    });
  }
  
  function deduplicate(arr) {
  const seen = new Map();
  return arr.filter(item => {
    if (!item || !item.UserName) return false;
    const key = item.UserName.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

  function buildStats(cleanedArr, rawLength, label) {
    return {
      label,
      rawLength,
      cleanedLength: cleanedArr.length,
      removed: rawLength - cleanedArr.length,
      firstObjectKeys:
        cleanedArr.length > 0 && typeof cleanedArr[0] === 'object' && cleanedArr[0] !== null
          ? Object.keys(cleanedArr[0])
          : null,
      sample: cleanedArr.slice(0, 2)
    };
  }

  async function processSingle(file, onProgress) {
    const data = await readFileWithProgress(file, onProgress);
    const path = ["Profile And Settings", "Follower", "FansList"];
    const raw = extractArray(data, path);
    const cleaned = cleanArray(raw);
    const arr = deduplicate(cleaned);
    return { arr, stats: buildStats(arr, raw.length, file.name) };
  }

  async function processBoth(fileOld, fileNew, onProgress) {
    const [resultOld, resultNew] = await Promise.all([
      processSingle(fileOld, onProgress),
      processSingle(fileNew, onProgress)
    ]);
    return {
      arrOld: resultOld.arr,
      arrNew: resultNew.arr,
      statsOld: resultOld.stats,
      statsNew: resultNew.stats
    };
  }

  // ─── fansCompare.js logic ──────────────────────────────────────────

  function processChunks(array, chunkSize, itemCallback, onComplete, context) {
    let index = 0;
    function doChunk() {
      const start = index;
      const end = Math.min(index + chunkSize, array.length);
      for (let i = start; i < end; i++) {
        itemCallback(array[i], i);
      }
      index = end;
      if (index < array.length) {
        if (context.onProgress) {
          context.onProgress({
            phase: context.phase,
            processed: index,
            total: array.length,
            percent: Math.round((index / array.length) * 100)
          });
        }
        setTimeout(doChunk, 0);
      } else {
        onComplete();
      }
    }
    doChunk();
  }

  function compareArrays(arrOld, arrNew, options = {}) {
    const { onProgress, chunkSize = 1000 } = options;

    return new Promise((resolve) => {
      const oldMap = new Map();

      processChunks(
        arrOld,
        chunkSize,
        (item) => {
          if (item && item.UserName) oldMap.set(item.UserName, item);
        },
        () => {
          if (onProgress) onProgress({ phase: 'indexed_old', percent: 100 });

          const newFollowers = [];
          const existing = [];

          processChunks(
            arrNew,
            chunkSize,
            (item) => {
              if (!item || !item.UserName) return;
              if (oldMap.has(item.UserName)) {
                const oldItem = oldMap.get(item.UserName);
                existing.push({
                  UserName: item.UserName,
                  OldDate: oldItem.Date,
                  NewDate: item.Date
                });
                oldMap.delete(item.UserName);
              } else {
                newFollowers.push(item);
              }
            },
            () => {
              const unfollowed = [];
              for (const [, oldItem] of oldMap) unfollowed.push(oldItem);

              const stable = [];
              const returning = [];
              for (const entry of existing) {
                if (entry.OldDate === entry.NewDate) {
                  stable.push(entry);
                } else {
                  returning.push(entry);
                }
              }

              const result = {
                unfollowed,
                newFollowers,
                existing,
                stable,
                returning,
                summary: {
                  totalOld: arrOld.length,
                  totalNew: arrNew.length,
                  unfollowedCount: unfollowed.length,
                  newCount: newFollowers.length,
                  existingCount: existing.length,
                  stableCount: stable.length,
                  returningCount: returning.length,
                  retentionRate: arrOld.length
                    ? ((existing.length / arrOld.length) * 100).toFixed(2) + '%'
                    : 'N/A'
                }
              };

              if (onProgress) onProgress({ phase: 'complete', percent: 100 });
              resolve(result);
            },
            { onProgress, phase: 'comparing' }
          );
        },
        { onProgress, phase: 'indexing_old' }
      );
    });
  }

  // ─── fansMain.js logic (public API) ──────────────────────────────

  async function extractFiles(fileOld, fileNew, onProgress) {
    if (fileOld && fileNew) {
      return await processBoth(fileOld, fileNew, onProgress);
    }
    if (fileOld) {
      const singleResult = await processSingle(fileOld, onProgress);
      return {
        arrOld: singleResult.arr,
        arrNew: [],
        statsOld: singleResult.stats,
        statsNew: null
      };
    }
    if (fileNew) {
      const singleResult = await processSingle(fileNew, onProgress);
      return {
        arrOld: [],
        arrNew: singleResult.arr,
        statsOld: null,
        statsNew: singleResult.stats
      };
    }
    throw new Error('At least one file required.');
  }

  // ─── EXPOSE SINGLE GLOBAL ──────────────────────────────────────────

  window.FansApp = {
    extractFiles,
    compareArrays: (arrOld, arrNew, onProgress) => {
      return compareArrays(arrOld, arrNew, { chunkSize: 500, onProgress });
    },
    // ─── Expose helpers for direct use ───
    processSingle,
    processBoth
  };

})();
