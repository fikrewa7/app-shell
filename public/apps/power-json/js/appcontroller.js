// appcontroller.js
(function() {
  "use strict";

  const EventBus = window.EventBus;
  const StateManager = window.StateManager;
  const DataManager = window.DataManager;
  const TreeRenderer = window.TreeRenderer;
  const FileManager = window.FileManager;
  const ClipboardManager = window.ClipboardManager;
  // WorkerManager is optional – we'll use a fallback
  const WorkerManager = window.WorkerManager;

window.clearJSON = function() {
  StateManager.updateState({
    data: null,
    rawText: "",
    isValid: true,
    error: null,
    selectedPath: null,
    undoStack: [],
    redoStack: []
  });
};

window.resetJSON = function() {
  const defaultData = {
    "company": {
      "name": "PowerJSON Inc.",
      "founded": 2024,
      "active": true,
      "departments": [
        {
          "name": "Engineering",
          "head": {
            "name": "Alice Chen",
            "title": "VP of Engineering",
            "contact": {
              "email": "alice@powerjson.io",
              "phone": null,
              "slack": "@alice"
            }
          },
          "teams": [
            {
              "name": "Frontend",
              "lead": "Bob Smith",
              "members": [
                { "name": "Carol White", "role": "Senior", "skills": ["React", "TypeScript", "CSS"] },
                { "name": "Dave Brown", "role": "Junior", "skills": ["JavaScript", "HTML"] }
              ]
            },
            {
              "name": "Backend",
              "lead": "Eve Davis",
              "members": [
                { "name": "Frank Wilson", "role": "Lead", "skills": ["Node.js", "Python", "MongoDB"] },
                { "name": "Grace Lee", "role": "Senior", "skills": ["Java", "Spring", "SQL"] }
              ]
            }
          ]
        },
        {
          "name": "Product",
          "head": {
            "name": "Henry Ford",
            "title": "VP of Product",
            "contact": {
              "email": "henry@powerjson.io",
              "phone": "+1-555-1234",
              "slack": "@henry"
            }
          },
          "teams": [
            {
              "name": "Design",
              "lead": "Ivy Green",
              "members": [
                { "name": "Jack Black", "role": "UX", "skills": ["Figma", "User Testing"] },
                { "name": "Karen White", "role": "UI", "skills": ["Sketch", "Illustrator"] }
              ]
            },
            {
              "name": "Analytics",
              "lead": "Leo King",
              "members": [
                { "name": "Mia Turner", "role": "Data Scientist", "skills": ["Python", "R", "Tableau"] }
              ]
            }
          ]
        }
      ],
      "metadata": {
        "created": "2025-01-01T00:00:00Z",
        "lastUpdated": "2025-02-15T12:30:00Z",
        "tags": ["tech", "json", "editor"],
        "ratings": { "overall": 4.8, "usability": 4.9, "features": 4.7 }
      }
    }
  };

  StateManager.pushUndo();
  const formatted = DataManager.stringify(defaultData, StateManager.getState().settings.indent);
  StateManager.updateState({
    data: defaultData,
    rawText: formatted,
    isValid: true,
    error: null,
    selectedPath: null
  });
};
  // ---------- Helper: parse JSON with optional worker ----------
  async function parseJSON(text) {
    // If worker is available, use it
    if (WorkerManager) {
      try {
        const result = await WorkerManager.parse(text);
        return { data: result.data, nodeCount: result.nodeCount, error: null };
      } catch (err) {
        // Worker failed – fallback to synchronous
        console.warn('Worker parse failed, falling back to synchronous:', err);
        const syncResult = DataManager.parse(text);
        if (syncResult.error) {
          return { data: null, error: syncResult.error };
        }
        return {
          data: syncResult.data,
          nodeCount: DataManager.countNodes(syncResult.data),
          error: null
        };
      }
    } else {
      // No worker – synchronous parse
      const result = DataManager.parse(text);
      if (result.error) {
        return { data: null, error: result.error };
      }
      return {
        data: result.data,
        nodeCount: DataManager.countNodes(result.data),
        error: null
      };
    }
  }

  // ---------- Theme ----------
  function setTheme(dark) {
    const html = document.documentElement;
    if (dark) html.classList.add("dark"); else html.classList.remove("dark");
    document.getElementById("theme-icon").className = dark ? "fas fa-moon text-gray-600 dark:text-gray-400" : "fas fa-sun text-yellow-500";
    StateManager.updateState({ darkMode: dark });
    localStorage.setItem("powerjson-dark", dark ? "1" : "0");
  }
  const savedDark = localStorage.getItem("powerjson-dark");
  if (savedDark !== null) setTheme(savedDark === "1"); else setTheme(true);

document.getElementById('select-type-cast').addEventListener('change', function() {
  const type = this.value;
  if (!type) return;
  const path = TreeRenderer.getSelectedPath?.() || StateManager.getState().selectedPath;
  if (!path) return;
  // Cast the node at 'path' to 'type'
  const state = StateManager.getState();
  const { value } = TreeRenderer.getValueAtPath(state.data, path);
  let newValue;
  switch (type) {
    case 'string': newValue = String(value); break;
    case 'number': newValue = Number(value) || 0; break;
    case 'boolean': newValue = Boolean(value); break;
    case 'null': newValue = null; break;
    case 'object': newValue = {}; break;
    case 'array': newValue = []; break;
  }
  const newData = TreeRenderer.setValueAtPath(state.data, path, newValue);
  StateManager.pushUndo();
  StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
  this.value = ''; // reset select
});

document.getElementById('btn-clear').addEventListener('click', () => {
  //if (confirm('Clear all JSON data? This cannot be undone.')) {
clearJSON();
  //}
});

document.getElementById('btn-reset').addEventListener('click', () => {
  resetJSON();
});


  document.getElementById("btn-theme-toggle").addEventListener("click", () => setTheme(!StateManager.getState().darkMode));
  document.getElementById("btn-settings-theme").addEventListener("click", () => setTheme(!StateManager.getState().darkMode));

  // ---------- Settings Drawer ----------
  const settingsDrawer = document.getElementById("settings-drawer");
  document.getElementById("btn-settings").addEventListener("click", () => settingsDrawer.classList.remove("hidden"));
  document.getElementById("btn-close-settings").addEventListener("click", () => settingsDrawer.classList.add("hidden"));
  settingsDrawer.addEventListener("click", e => { if (e.target === settingsDrawer) settingsDrawer.classList.add("hidden"); });

  // ---------- Tools Drawer ----------
  const toolsDrawer = document.getElementById("tools-drawer");
  document.getElementById("btn-tools").addEventListener("click", () => toolsDrawer.classList.remove("hidden"));
  document.getElementById("btn-close-tools").addEventListener("click", () => toolsDrawer.classList.add("hidden"));
  toolsDrawer.addEventListener("click", e => { if (e.target === toolsDrawer) toolsDrawer.classList.add("hidden"); });

  // ---------- Help Modal ----------
  const helpModal = document.getElementById("help-modal");
  document.getElementById("btn-help").addEventListener("click", () => helpModal.classList.remove("hidden"));
  document.getElementById("btn-close-help").addEventListener("click", () => helpModal.classList.add("hidden"));
  helpModal.addEventListener("click", e => { if (e.target === helpModal) helpModal.classList.add("hidden"); });

  // ---------- URL Import ----------
  const urlModal = document.getElementById("url-import-modal");
  document.getElementById("btn-import-url").addEventListener("click", () => urlModal.classList.remove("hidden"));
  document.getElementById("btn-url-cancel").addEventListener("click", () => urlModal.classList.add("hidden"));
  document.getElementById("btn-url-confirm").addEventListener("click", async () => {
    const url = document.getElementById("url-input").value;
    if (!url) return;
    try {
      StateManager.updateState({ isLoading: true });
      const res = await fetch(url);
      const text = await res.text();
      const { data, error } = await parseJSON(text);
      if (error) throw new Error(error);
      const state = StateManager.getState();
      const formatted = state.settings.autoFormat ? DataManager.stringify(data, state.settings.indent) : text;
      StateManager.updateState({
        data,
        rawText: formatted,
        isValid: true,
        error: null,
        selectedPath: null,
        isLoading: false
      });
      urlModal.classList.add("hidden");
    } catch (err) {
      StateManager.updateState({ isLoading: false });
      alert("Failed to load: " + err.message);
    }
  });
  urlModal.addEventListener("click", e => { if (e.target === urlModal) urlModal.classList.add("hidden"); });

  // ---------- File Import ----------
  document.getElementById("btn-import-file").addEventListener("click", () => FileManager.triggerImport());

  // ---------- Clipboard ----------
  document.getElementById("btn-paste").addEventListener("click", () => ClipboardManager.read());
  document.getElementById("btn-copy").addEventListener("click", () => {
    const state = StateManager.getState();
    ClipboardManager.write(state.rawText || "");
  });

  // ---------- Download ----------
  document.getElementById("btn-download").addEventListener("click", () => {
    const state = StateManager.getState();
    FileManager.download("data.json", state.rawText || "{}");
  });

  // ---------- Formatting ----------
  document.getElementById("btn-beautify").addEventListener("click", () => {
    const state = StateManager.getState();
    if (!state.data) return;
    StateManager.pushUndo();
    const text = DataManager.stringify(state.data, state.settings.indent);
    StateManager.updateState({ rawText: text });
  });
  document.getElementById("btn-compact").addEventListener("click", () => {
    const state = StateManager.getState();
    if (!state.data) return;
    StateManager.pushUndo();
    const text = DataManager.stringify(state.data, 0);
    StateManager.updateState({ rawText: text });
  });

  // ---------- Undo/Redo ----------
  document.getElementById("btn-undo").addEventListener("click", () => StateManager.undo());
  document.getElementById("btn-redo").addEventListener("click", () => StateManager.redo());

  // ---------- Search ----------
  const searchPanel = document.getElementById("search-panel");
  document.getElementById("btn-search").addEventListener("click", () => searchPanel.classList.toggle("hidden"));
  document.getElementById("btn-search-clear").addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    StateManager.updateState({ searchQuery: "", searchResults: [] });
  });
  document.getElementById("search-input").addEventListener("input", e => {
    const query = e.target.value;
    const mode = document.getElementById("search-jsonpath").checked ? "jsonpath" : "simple";
    EventBus.emit("search:execute", { query, mode });
  });
  document.getElementById("search-jsonpath").addEventListener("change", e => {
    const query = document.getElementById("search-input").value;
    EventBus.emit("search:execute", { query, mode: e.target.checked ? "jsonpath" : "simple" });
  });

  // ---------- Node Operations (Toolbar) ----------
  document.getElementById("btn-wrap-object").addEventListener("click", () => {
    const state = StateManager.getState();
    if (!state.selectedPath || !state.data) return;
    const newData = TreeRenderer.wrapAtPath(state.data, state.selectedPath, "object");
    StateManager.pushUndo();
    StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
  });
  document.getElementById("btn-wrap-array").addEventListener("click", () => {
    const state = StateManager.getState();
    if (!state.selectedPath || !state.data) return;
    const newData = TreeRenderer.wrapAtPath(state.data, state.selectedPath, "array");
    StateManager.pushUndo();
    StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
  });
  document.getElementById("btn-delete-node").addEventListener("click", () => {
    const state = StateManager.getState();
    if (!state.selectedPath || !state.data || state.selectedPath === "$") return;
    const newData = TreeRenderer.deleteAtPath(state.data, state.selectedPath);
    StateManager.pushUndo();
    StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent), selectedPath: null });
  });

  // ---------- Mobile View Toggles ----------
  const textPane = document.getElementById("text-pane");
  const treePane = document.getElementById("tree-pane");
  const btnViewText = document.getElementById("btn-view-text");
  const btnViewTree = document.getElementById("btn-view-tree");

  function showTextView() {
    textPane.classList.remove("hidden");
    treePane.classList.add("hidden");
    btnViewText.classList.add("bg-blue-100", "dark:bg-blue-900", "text-blue-700", "dark:text-blue-300");
    btnViewText.classList.remove("hover:bg-gray-200", "dark:hover:bg-gray-800");
    btnViewTree.classList.remove("bg-blue-100", "dark:bg-blue-900", "text-blue-700", "dark:text-blue-300");
    btnViewTree.classList.add("hover:bg-gray-200", "dark:hover:bg-gray-800");
  }
  function showTreeView() {
    textPane.classList.add("hidden");
    treePane.classList.remove("hidden");
    treePane.classList.add("flex");
    btnViewTree.classList.add("bg-blue-100", "dark:bg-blue-900", "text-blue-700", "dark:text-blue-300");
    btnViewTree.classList.remove("hover:bg-gray-200", "dark:hover:bg-gray-800");
    btnViewText.classList.remove("bg-blue-100", "dark:bg-blue-900", "text-blue-700", "dark:text-blue-300");
    btnViewText.classList.add("hover:bg-gray-200", "dark:hover:bg-gray-800");
  }
  btnViewText.addEventListener("click", showTextView);
  btnViewTree.addEventListener("click", showTreeView);

  // ---------- Node Editor Panel ----------
  const nodeEditorPanel = document.getElementById("node-editor-panel");
  const nodeEditorTextarea = document.getElementById("node-editor-textarea");
  document.getElementById("btn-close-node-editor").addEventListener("click", () => {
    nodeEditorPanel.classList.add("hidden");
    StateManager.updateState({ selectedPath: null });
  });
  nodeEditorTextarea.addEventListener("blur", () => {
    const state = StateManager.getState();
    if (!state.selectedPath || !state.data) return;
    let val = nodeEditorTextarea.value;
    const { value: currentValue } = TreeRenderer.getValueAtPath(state.data, state.selectedPath);
    const currentType = typeof currentValue;
    if (currentType === "number") val = Number(val);
    else if (currentType === "boolean") val = val === "true";
    else if (currentValue === null) val = val === "null" ? null : val;
    const newData = TreeRenderer.setValueAtPath(state.data, state.selectedPath, val);
    StateManager.pushUndo();
    StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
  });

  // ---------- Type Cast Menu ----------
  const typeCastMenu = document.getElementById("type-cast-menu");
  typeCastMenu.addEventListener("click", e => {
    const btn = e.target.closest("button[data-type]");
    if (!btn) return;
    const type = btn.dataset.type;
    const path = typeCastMenu.dataset.path;
    if (!path) return;
    const state = StateManager.getState();
    let newValue;
    const { value } = TreeRenderer.getValueAtPath(state.data, path);
    switch (type) {
      case "string": newValue = String(value); break;
      case "number": newValue = Number(value) || 0; break;
      case "boolean": newValue = Boolean(value); break;
      case "null": newValue = null; break;
      case "object": newValue = {}; break;
      case "array": newValue = []; break;
      default: newValue = value;
    }
    const newData = TreeRenderer.setValueAtPath(state.data, path, newValue);
    StateManager.pushUndo();
    StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
    typeCastMenu.classList.add("hidden");
  });
  document.addEventListener("click", e => {
    if (!typeCastMenu.contains(e.target) && !e.target.closest(".action-type")) {
      typeCastMenu.classList.add("hidden");
    }
  });

  // ---------- Settings Controls ----------
  document.getElementById("setting-autoformat").addEventListener("change", e => {
    StateManager.updateState({ settings: { autoFormat: e.target.checked } });
  });
  document.getElementById("setting-indent").addEventListener("change", e => {
    const val = e.target.value;
    StateManager.updateState({ settings: { indent: val === "\\t" ? "\t" : parseInt(val) } });
  });

  // ---------- Keyboard Shortcuts ----------
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) return;
      else return;
    }
    if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      helpModal.classList.remove("hidden");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      StateManager.undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      StateManager.redo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      searchPanel.classList.toggle("hidden");
      if (!searchPanel.classList.contains("hidden")) {
        document.getElementById("search-input").focus();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      document.getElementById("btn-beautify").click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      document.getElementById("btn-download").click();
    }
  });

  // ---------- State Change Listener (UI updates) ----------
  EventBus.on("stateChanged", state => {
    const statusIcon = document.getElementById("status-icon");
    const statusText = document.getElementById("status-text");
    const statusSize = document.getElementById("status-size");
    const statusNodes = document.getElementById("status-nodes");

    if (state.isLoading) {
      statusIcon.innerHTML = '<i class="fas fa-spinner fa-spin text-blue-500"></i>';
      statusText.textContent = "Loading…";
      statusText.className = "text-blue-600 dark:text-blue-400";
    } else if (state.isValid) {
      statusIcon.innerHTML = '<i class="fas fa-check-circle text-green-500"></i>';
      statusText.textContent = "Valid JSON";
      statusText.className = "text-gray-600 dark:text-gray-400";
    } else {
      statusIcon.innerHTML = '<i class="fas fa-times-circle text-red-500"></i>';
      statusText.textContent = state.error || "Invalid JSON";
      statusText.className = "text-red-600 dark:text-red-400";
    }
    statusSize.textContent = DataManager.getSize(state.rawText || "");
    statusNodes.textContent = state.data ? DataManager.countNodes(state.data) + " nodes" : "0 nodes";

    if (state.selectedPath && state.data) {
      const { value } = TreeRenderer.getValueAtPath(state.data, state.selectedPath);
      if (value !== undefined && value !== null && typeof value !== "object") {
        nodeEditorPanel.classList.remove("hidden");
        nodeEditorTextarea.value = String(value);
      } else if (value !== undefined && value !== null) {
        nodeEditorPanel.classList.remove("hidden");
        nodeEditorTextarea.value = DataManager.stringify(value, 2);
      } else {
        //nodeEditorPanel.classList.add("hidden");
      }
    } else {
      //nodeEditorPanel.classList.add("hidden");
    }

    const searchStatus = document.getElementById("search-status");
    if (state.searchQuery) {
      searchStatus.textContent = `${state.searchResults.length} matches`;
    } else {
      searchStatus.textContent = "";
    }
  });

  // ---------- Text Editor Input (synchronous) ----------
  EventBus.on("text:changed", text => {
    const currentState = StateManager.getState();
    if (currentState.isLoading) return;
    const result = DataManager.parse(text);
    if (result.error) {
      StateManager.updateState({ rawText: text, isValid: false, error: result.error });
    } else {
      StateManager.pushUndo();
      StateManager.updateState({ data: result.data, rawText: text, isValid: true, error: null });
    }
  });

  // ---------- File Loaded (drag/drop, file picker) ----------
  EventBus.on("file:loaded", async (text) => {
    try {
      StateManager.updateState({ isLoading: true });
      const { data, error } = await parseJSON(text);
      if (error) throw new Error(error);
      const state = StateManager.getState();
      const formatted = state.settings.autoFormat ? DataManager.stringify(data, state.settings.indent) : text;
      StateManager.updateState({
        data: data,
        rawText: formatted,
        isValid: true,
        error: null,
        selectedPath: null,
        isLoading: false
      });
    } catch (err) {
      StateManager.updateState({
        rawText: text,
        isValid: false,
        error: err.message,
        isLoading: false
      });
    }
  });

  // ---------- Clipboard Imported ----------
  EventBus.on("clipboard:imported", async (text) => {
    try {
      StateManager.updateState({ isLoading: true });
      const { data, error } = await parseJSON(text);
      if (error) throw new Error(error);
      const state = StateManager.getState();
      const formatted = state.settings.autoFormat ? DataManager.stringify(data, state.settings.indent) : text;
      StateManager.updateState({
        data: data,
        rawText: formatted,
        isValid: true,
        error: null,
        selectedPath: null,
        isLoading: false
      });
    } catch (err) {
      StateManager.updateState({
        rawText: text,
        isValid: false,
        error: err.message,
        isLoading: false
      });
    }
  });

  // ---------- Plugin: Transform Script ----------
  EventBus.on("plugin:jsonUpdated", data => {
    StateManager.pushUndo();
    const state = StateManager.getState();
    StateManager.updateState({
      data: data,
      rawText: DataManager.stringify(data, state.settings.indent),
      isValid: true,
      error: null
    });
  });

  // ---------- Initialise with Default Data ----------
  const defaultData = {
    "name": "Power JSON Editor",
    "version": 1.0,
    "features": ["Tree View", "Text Editor", "Search", "Dark Mode", "Plugins"],
    "settings": {
      "theme": "dark",
      "autoFormat": true,
      "indent": 2
    },
    "sample": {
      "string": "Hello, World! This is a long sample string to demonstrate truncation in the tree view when values exceed a certain length.",
      "number": 42,
      "float": 3.14159,
      "boolean": true,
      "nullValue": null,
      "nested": {
        "array": [1, 2, 3, 4, 5],
        "object": { "a": 1, "b": 2 }
      }
    },
    "users": [
      { "id": 1, "name": "Alice", "active": true },
      { "id": 2, "name": "Bob", "active": false },
      { "id": 3, "name": "Charlie", "active": true }
    ],
    "metadata": {
      "created": "2024-01-01T00:00:00Z",
      "tags": ["json", "editor", "tool"],
      "count": 3
    }
  };

  const initialText = DataManager.stringify(defaultData, 2);
  StateManager.updateState({
    //data: defaultData,
    data: null,
    //rawText: initialText,
    rawText: "",
    isValid: true,
    error: null,
    isLoading: false
  });

  window.AppController = {};
})();