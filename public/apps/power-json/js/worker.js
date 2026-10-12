// worker.js
self.addEventListener('message', (e) => {
  const { type, payload } = e.data;
  if (type === 'parse') {
    const result = parseJSON(payload.text);
    const nodeCount = result.data ? countNodes(result.data) : 0;
    self.postMessage({
      type: 'parse-result',
      id: payload.id,
      data: result.data,
      error: result.error,
      nodeCount
    });
  }
});

// ---------- Parsing logic (copied from DataManager) ----------
function parseJSON(text) {
  if (!text || !text.trim()) return { data: null, error: 'Empty input' };
  try {
    return { data: JSON.parse(text), error: null };
  } catch (e) {
    let cleaned = text
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/'/g, '"')
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
    try {
      return { data: JSON.parse(cleaned), error: null };
    } catch (e2) {
      return { data: null, error: e.message };
    }
  }
}

function countNodes(data) {
  if (data === null || typeof data !== 'object') return 1;
  let count = 1;
  for (const key in data) count += countNodes(data[key]);
  return count;
}