(function() {
  "use strict";
  
  const worker = new Worker('worker.js');
  const callbacks = {};
  let idCounter = 0;
  
  worker.addEventListener('message', (e) => {
    const { type, id, data, error, nodeCount } = e.data;
    if (type === 'parse-result' && callbacks[id]) {
      callbacks[id]({ data, error, nodeCount });
      delete callbacks[id];
    }
  });
  
  function parse(text) {
    return new Promise((resolve, reject) => {
      const id = ++idCounter;
      callbacks[id] = (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({ data: result.data, nodeCount: result.nodeCount });
        }
      };
      worker.postMessage({ type: 'parse', payload: { text, id } });
    });
  }
  
  function terminate() {
    worker.terminate();
  }
  
  window.WorkerManager = { parse, terminate };
})();