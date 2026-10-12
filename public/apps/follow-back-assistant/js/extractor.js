(function(extraction) {
  let activeWorker = null;
  let extractedFollowers = null;
  let extractedFollowing = null; // new: store following usernames array
  
  extraction.getExtractedList = () => extractedFollowers;
  extraction.getFollowingList = () => extractedFollowing; // new
  extraction.setExtractedData = (followers, following) => {
    extractedFollowers = followers;
    extractedFollowing = following;
  };
  
  extraction.performExtraction = async function(source, sourceType, callbacks) {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    const { onProgress, onComplete, onError } = callbacks;
    onProgress(2, 'starting worker...');
    
    const Config = window.FollowBackApp.Config;
    const followersPath = Config.get('JSON_PATH_TO_FANS');
    const followingPath = Config.get('FOLLOWING_PATH');
    const startIdx = Config.get('EXTRACT_START_INDEX');
    const maxExtract = Config.get('MAX_FOLLOWERS_TO_EXTRACT');
    
    const workerScript = `
      self.onmessage = async function(e) {
        const { source, sourceType, followersPath, followingPath, startIdx, maxExtract } = e.data;
        const sendProgress = (percent, msg) => self.postMessage({ type: 'progress', percent, message: msg });
        try {
          let jsonData;
          sendProgress(5, 'loading data...');
          if(sourceType === 'file') {
            const text = await source.text();
            sendProgress(25, 'parsing JSON');
            jsonData = JSON.parse(text);
          } else {
            const resp = await fetch(source);
            if(!resp.ok) throw new Error('HTTP '+resp.status);
            const text = await resp.text();
            sendProgress(25, 'parsing remote JSON');
            jsonData = JSON.parse(text);
          }

          // Extract followers
          sendProgress(40, 'navigating to FansList...');
          const fansArray = followersPath.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, jsonData);
          if(!Array.isArray(fansArray)) throw new Error('FansList not found or not an array');
          
          sendProgress(55, \`filtering \${fansArray.length} followers...\`);
          const validFollowers = [];
          for(let i=0; i<fansArray.length; i++) {
            const item = fansArray[i];
            if(item && typeof item.UserName === 'string' && item.Date != null) validFollowers.push({ UserName: item.UserName, Date: item.Date });
            if(i % 15000 === 0 && i>0) sendProgress(55 + Math.floor((i/fansArray.length)*10), \`filtered \${i}/\${fansArray.length} followers\`);
          }
          sendProgress(70, 'sorting followers by date (latest first)');
          validFollowers.sort((a,b) => new Date(b.Date) - new Date(a.Date));
          sendProgress(80, \`taking latest \${maxExtract} followers from index \${startIdx}\`);
          const extractedFollowers = validFollowers.slice(startIdx, startIdx + maxExtract);

          // Extract following list (full list for analytics)
          sendProgress(85, 'extracting following list for analytics...');
          const followingArray = followingPath.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, jsonData);
          let followingList = [];
          if(Array.isArray(followingArray)) {
            for(const item of followingArray) {
              const username = typeof item === 'string' ? item : (item.UserName || item.uniqueId);
              if(username) followingList.push(username);
            }
          } else {
            console.warn('Following list not found or not an array');
          }
          
          // Compute followBack flag (mutual)
          const followingSet = new Set(followingList);
          for(const follower of extractedFollowers) {
            follower.followBack = followingSet.has(follower.UserName);
          }

          sendProgress(100, 'extraction done');
          self.postMessage({ 
            type: 'result', 
            followers: extractedFollowers,
            following: followingList
          });
        } catch(err) {
          self.postMessage({ type: 'error', errorMsg: err.message });
        }
      };
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    activeWorker = worker;
    
    worker.onmessage = (ev) => {
      const data = ev.data;
      if (data.type === 'progress') onProgress(data.percent, data.message);
      else if (data.type === 'result') {
        extraction.setExtractedData(data.followers, data.following);
        onComplete(data.followers);
        URL.revokeObjectURL(workerUrl);
        activeWorker = null;
      } else if (data.type === 'error') {
        onError(data.errorMsg);
        URL.revokeObjectURL(workerUrl);
        activeWorker = null;
      }
    };
    worker.onerror = (err) => {
      onError('Worker error: ' + err.message);
      URL.revokeObjectURL(workerUrl);
      activeWorker = null;
    };
    worker.postMessage({ source, sourceType, followersPath, followingPath, startIdx, maxExtract });
  };
})(window.FollowBackApp.Extraction = window.FollowBackApp.Extraction || {});