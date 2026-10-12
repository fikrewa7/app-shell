(function() {
  "use strict";
  
  const EventBus = window.EventBus;
  
  let state = {
    data: null,
    rawText: "",
    isValid: true,
    error: null,
    darkMode: true,
    selectedPath: null,
    searchQuery: "",
    searchResults: [],
    searchMode: "simple",
    undoStack: [],
    redoStack: [],
    activeView: "split",
    settings: { autoFormat: true, indent: 2 },
    isEditingText: false,
    validation: {
  valid: true,
  error: null,
  errorLine: -1
}
  };
  const subscribers = [];
  
  function getState() { return Object.freeze({ ...state }); }
  
  function updateState(partial) {
    const prev = state;
    state = { ...state, ...partial };
    if (partial.settings) state.settings = { ...prev.settings, ...partial.settings };
    subscribers.forEach(fn => fn(state, prev));
    EventBus.emit("stateChanged", state);
  }
  
  function subscribe(listener) {
    subscribers.push(listener);
    return () => {
      const i = subscribers.indexOf(listener);
      if (i > -1) subscribers.splice(i, 1);
    };
  }
  
  function pushUndo() {
    const s = getState();
    updateState({
      undoStack: [...s.undoStack, { data: JSON.parse(JSON.stringify(s.data)), rawText: s.rawText }].slice(-50),
      redoStack: []
    });
  }
  
  function undo() {
    const s = getState();
    if (s.undoStack.length === 0) return;
    const prev = s.undoStack[s.undoStack.length - 1];
    updateState({
      data: prev.data,
      rawText: prev.rawText,
      isValid: true,
      error: null,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, { data: JSON.parse(JSON.stringify(s.data)), rawText: s.rawText }]
    });
  }
  
  function redo() {
    const s = getState();
    if (s.redoStack.length === 0) return;
    const next = s.redoStack[s.redoStack.length - 1];
    updateState({
      data: next.data,
      rawText: next.rawText,
      isValid: true,
      error: null,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, { data: JSON.parse(JSON.stringify(s.data)), rawText: s.rawText }]
    });
  }
  
  window.StateManager = { getState, updateState, subscribe, pushUndo, undo, redo };
})();