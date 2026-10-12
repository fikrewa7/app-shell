(function() {
  "use strict";

  const EventBus = window.EventBus;
  const StateManager = window.StateManager;

  function evaluateJSONPath(data, path) {
    if (!path.startsWith("$")) return [];
    const parts = path.replace(/^\$\.?/, "").split(/\.|\[(\d+)\]|\['([^']+)'\]/).filter(Boolean);
    let results = [];
    function walk(current, partIdx, currentPath) {
      if (partIdx >= parts.length) { results.push({ path: currentPath, value: current }); return; }
      const part = parts[partIdx];
      if (part === "*") {
        if (Array.isArray(current)) current.forEach((item, i) => walk(item, partIdx + 1, `${currentPath}[${i}]`));
        else if (typeof current === "object" && current !== null) Object.keys(current).forEach(k => walk(current[k], partIdx + 1, `${currentPath}.${k}`));
      } else if (/^\d+$/.test(part) && Array.isArray(current)) { const idx = parseInt(part); if (idx < current.length) walk(current[idx], partIdx + 1, `${currentPath}[${idx}]`); }
      else if (typeof current === "object" && current !== null && part in current) { walk(current[part], partIdx + 1, currentPath === "$" ? `$.${part}` : `${currentPath}.${part}`); }
    }
    walk(data, 0, "$");
    return results;
  }

  function simpleSearch(data, query) {
    const results = [], q = query.toLowerCase();
    function walk(obj, path) {
      if (typeof obj === "string" && obj.toLowerCase().includes(q)) results.push({ path, value: obj });
      else if (typeof obj === "number" && String(obj).includes(q)) results.push({ path, value: obj });
      else if (typeof obj === "boolean" && String(obj).includes(q)) results.push({ path, value: obj });
      else if (obj !== null && typeof obj === "object") {
        if (Array.isArray(obj)) obj.forEach((item, i) => walk(item, `${path}[${i}]`));
        else { Object.keys(obj).forEach(k => { if (k.toLowerCase().includes(q)) results.push({ path: `${path}.${k}`, value: k }); walk(obj[k], `${path}.${k}`); }); }
      }
    }
    walk(data, "$");
    return results;
  }

  EventBus.on("search:execute", ({ query, mode }) => {
    const state = StateManager.getState();
    if (!query || !state.data) { StateManager.updateState({ searchQuery: "", searchResults: [] }); return; }
    let results = mode === "jsonpath" ? evaluateJSONPath(state.data, query) : simpleSearch(state.data, query);
    StateManager.updateState({ searchQuery: query, searchResults: results, searchMode: mode });
  });

  window.SearchEngine = { evaluateJSONPath, simpleSearch };
})();