// Web Worker for comparison – uses the same logic as fans.js but adapted for worker messaging.
(function() {
  function compareArrays(arrOld, arrNew, options = {}) {
    const chunkSize = options.chunkSize || 500;
    return new Promise((resolve) => {
      const oldMap = new Map();

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
            self.postMessage({
              type: 'progress',
              payload: {
                phase: context.phase,
                processed: index,
                total: array.length,
                percent: Math.round((index / array.length) * 100)
              }
            });
            setTimeout(doChunk, 0);
          } else {
            onComplete();
          }
        }
        doChunk();
      }

      processChunks(
        arrOld,
        chunkSize,
        (item) => {
          if (item && item.UserName) oldMap.set(item.UserName, item);
        },
        () => {
          self.postMessage({ type: 'progress', payload: { phase: 'indexed_old', percent: 100 } });

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
                if (entry.OldDate === entry.NewDate) stable.push(entry);
                else returning.push(entry);
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
              self.postMessage({ type: 'result', payload: result });
            },
            { phase: 'comparing' }
          );
        },
        { phase: 'indexing_old' }
      );
    });
  }

  self.onmessage = function(e) {
    const { arrOld, arrNew } = e.data;
    compareArrays(arrOld, arrNew)
      .catch(err => self.postMessage({ type: 'error', payload: err.message }));
  };
})();