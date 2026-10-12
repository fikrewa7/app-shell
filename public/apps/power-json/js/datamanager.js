(function() {
  "use strict";
  
  function tolerantParseOld(text) {
    if (!text || !text.trim()) return { data: null, error: "Empty input" };
    try { return { data: JSON.parse(text), error: null }; }
    catch (e) {
      let cleaned = text
        .replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,(\s*[}\]])/g, "$1").replace(/'/g, '"')
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
      try { return { data: JSON.parse(cleaned), error: null }; }
      catch (e2) { return { data: null, error: e.message }; }
    }
  }
  
  function tolerantParse(text) {
  if (!text || !text.trim()) {
    return { data: null, error: 'Empty input', errorLine: -1 };
  }
  
  // First attempt: strict JSON
  try {
    const data = JSON.parse(text);
    return { data, error: null, errorLine: -1 };
  } catch (e) {
    // Second attempt: clean the text (JSON5-like)
    let cleaned = text;
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, function(match) {
      const inner = match.slice(1, -1).replace(/"/g, '\\"');
      return '"' + inner + '"';
    });
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    cleaned = cleaned.replace(/,\s*$/g, '');
    
    try {
      const data = JSON.parse(cleaned);
      return { data, error: null, errorLine: -1, wasCleaned: true };
    } catch (e2) {
      // --- ADD THIS BLOCK ---
      const msg = e2.message || 'Parse error';
      const lineMatch = msg.match(/position\s+(\d+)/i) || msg.match(/line\s+(\d+)/i);
      let errorLine = -1;
      if (lineMatch) {
        const pos = parseInt(lineMatch[1]);
        errorLine = text.substring(0, pos).split('\n').length;
      }
      return { data: null, error: msg, errorLine };
    }
  }
}
 
  function stringify(data, space) {
    if (data === undefined) return "";
    try { return JSON.stringify(data, null, space); } catch (e) { return ""; }
  }
  
  function validate(text) { return tolerantParse(text); }
  
  function getSize(text) {
    const bytes = new Blob([text]).size;
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  
  function countNodes(data) {
    if (data === null || typeof data !== "object") return 1;
    let count = 1;
    for (const key in data) count += countNodes(data[key]);
    return count;
  }
  
  window.DataManager = { parse: tolerantParse, stringify, validate, getSize, countNodes };
})();