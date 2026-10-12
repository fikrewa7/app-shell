// treerenderer.js
(function() {
  "use strict";

  //console.log('[treerenderer] Starting...');

  // --- Dependency checks ---
  if (typeof window.StateManager === 'undefined') {
    console.error('[treerenderer] StateManager is not defined. Check script loading order.');
    return;
  }
  if (typeof window.EventBus === 'undefined') {
    console.error('[treerenderer] EventBus is not defined. Check script loading order.');
    return;
  }
  if (typeof window.DataManager === 'undefined') {
    console.error('[treerenderer] DataManager is not defined. Check script loading order.');
    return;
  }

  const StateManager = window.StateManager;
  const EventBus = window.EventBus;
  const DataManager = window.DataManager;

  // --- Find the container ---
  const container = document.getElementById("tree-view");
  if (!container) {
    console.error('[treerenderer] Could not find element with id "tree-view".');
    return;
  }
  //console.log('[treerenderer] Container found:', container);

  let expandedPaths = new Set(["$"]);

  function getTypeIcon(value) {
    if (value === null) return ['fa-circle', 'text-gray-400'];
    const t = typeof value;
    if (t === "boolean") return [value ? 'fa-toggle-on text-blue-500' : 'fa-toggle-off text-gray-400'];
    if (t === "number") return ['fa-hashtag', 'text-blue-600 dark:text-blue-400'];
    if (t === "string") return ['fa-quote-left', 'text-green-600 dark:text-green-400'];
    if (Array.isArray(value)) return ['fa-list', 'text-yellow-600 dark:text-yellow-400'];
    return ['fa-folder', 'text-orange-500'];
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderValue(value, path) {
    if (value === null) return `<span class="text-gray-500 italic cursor-pointer node-value" data-path="${path}" data-type="null">null</span>`;
    const t = typeof value;
    if (t === "boolean") return `<span class="text-purple-600 dark:text-purple-400 font-semibold cursor-pointer node-value" data-path="${path}" data-type="boolean">${value}</span>`;
    if (t === "number") return `<span class="text-blue-600 dark:text-blue-400 cursor-pointer node-value" data-path="${path}" data-type="number">${value}</span>`;
    if (t === "string") {
      const display = value.length > 100 ? escapeHtml(value.slice(0, 100)) + "..." : escapeHtml(value);
      return `<span class="text-green-600 dark:text-green-400 cursor-pointer node-value" data-path="${path}" data-type="string">"${display}"</span>`;
    }
    return "";
  }

  function renderNode(data, path, key) {
    const isRoot = path === "$";
    const isObj = data !== null && typeof data === "object";
    const isExpanded = expandedPaths.has(path);
    const [iconClass, iconColor] = getTypeIcon(data);
    const state = StateManager.getState();
    const isSelected = state.selectedPath === path;
    const searchMatches = state.searchResults.some(r => r.path === path);

    let html = `<div class="tree-node select-none" data-path="${path}">`;
    html += `<div class="flex items-start gap-1 py-0.5 px-1 rounded ${isSelected ? 'node-selected' : ''} ${searchMatches ? 'search-match' : ''} hover:bg-gray-100 dark:hover:bg-gray-800 group">`;
    html += `<span class="drag-handle cursor-move opacity-0 group-hover:opacity-100 px-1" data-path="${path}"><i class="fas fa-arrows-alt text-gray-400 text-[10px]"></i></span>`;
    if (isObj && !isRoot) {
      html += `<span class="cursor-pointer px-1 expand-btn" data-path="${path}"><i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-gray-500 text-[10px]"></i></span>`;
    } else if (!isRoot) {
      html += `<span class="w-5"></span>`;
    } else {
      html += `<span class="cursor-pointer px-1 expand-btn" data-path="${path}"><i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} text-gray-500 text-[10px]"></i></span>`;
    }
    html += `<i class="fas ${iconClass} ${iconColor || ''} mt-1 text-[10px] w-3 text-center"></i>`;
    if (!isRoot) {
      html += `<span class="node-key text-red-600 dark:text-red-400 font-semibold cursor-pointer" data-path="${path}">${escapeHtml(String(key))}</span>`;
      html += `<span class="text-gray-400 mx-0.5">:</span>`;
    }
    if (isObj) {
      const count = Array.isArray(data) ? data.length : Object.keys(data).length;
      html += `<span class="text-gray-500 text-[10px]">{${count}}</span>`;
    } else {
      html += renderValue(data, path);
    }
    html += `<span class="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">`;
    html += `<button class="action-add px-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" data-path="${path}"><i class="fas fa-plus text-[10px] text-gray-500"></i></button>`;
    html += `<button class="action-delete px-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" data-path="${path}"><i class="fas fa-trash text-[10px] text-red-500"></i></button>`;
    html += `<button class="action-duplicate px-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" data-path="${path}"><i class="fas fa-clone text-[10px] text-gray-500"></i></button>`;
    html += `<button class="action-type px-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700" data-path="${path}"><i class="fas fa-exchange-alt text-[10px] text-gray-500"></i></button>`;
    html += `</span></div>`;
    if (isObj && isExpanded) {
      html += `<div class="tree-children pl-3">`;
      if (Array.isArray(data)) {
        data.forEach((item, idx) => {
          html += renderNode(item, `${path}[${idx}]`, idx);
        });
      } else {
        Object.keys(data).forEach(k => {
          html += renderNode(data[k], `${path}.${k}`, k);
        });
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }

  function render() {
    const state = StateManager.getState();
    //console.log('[treerenderer] Rendering tree, state.data:', state.data);
    if (!state.data) {
      container.innerHTML = `<div class="p-4 text-gray-500 text-center">No JSON loaded</div>`;
      return;
    }
    const html = renderNode(state.data, "$", "root");
    //console.log('[treerenderer] Generated HTML length:', html.length);
    container.innerHTML = html;
  }

  // ---- Public API methods ----
  function getValueAtPath(data, path) {
    if (path === "$") return { parent: null, key: null, value: data };
    const parts = path.replace(/^\$\.?/, "").split(/\.|\[(\d+)\]/).filter(Boolean);
    let current = data, parent = null, key = null;
    for (let i = 0; i < parts.length; i++) {
      parent = current;
      key = /^\d+$/.test(parts[i]) ? parseInt(parts[i]) : parts[i];
      current = current[key];
    }
    return { parent, key, value: current };
  }

  function setValueAtPath(data, path, newValue) {
    if (path === "$") return newValue;
    const parts = path.replace(/^\$\.?/, "").split(/\.|\[(\d+)\]/).filter(Boolean);
    const clone = JSON.parse(JSON.stringify(data));
    let current = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = /^\d+$/.test(parts[i]) ? parseInt(parts[i]) : parts[i];
      current = current[k];
    }
    const lastKey = /^\d+$/.test(parts[parts.length - 1]) ? parseInt(parts[parts.length - 1]) : parts[parts.length - 1];
    current[lastKey] = newValue;
    return clone;
  }

  function deleteAtPath(data, path) {
    if (path === "$") return null;
    const parts = path.replace(/^\$\.?/, "").split(/\.|\[(\d+)\]/).filter(Boolean);
    const clone = JSON.parse(JSON.stringify(data));
    let current = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = /^\d+$/.test(parts[i]) ? parseInt(parts[i]) : parts[i];
      current = current[k];
    }
    const lastKey = /^\d+$/.test(parts[parts.length - 1]) ? parseInt(parts[parts.length - 1]) : parts[parts.length - 1];
    if (Array.isArray(current)) {
      current.splice(lastKey, 1);
    } else {
      delete current[lastKey];
    }
    return clone;
  }

  function duplicateAtPath(data, path) {
    const { parent, key, value } = getValueAtPath(data, path);
    if (!parent) return data;
    const clone = JSON.parse(JSON.stringify(data));
    const { parent: p2, key: k2 } = getValueAtPath(clone, path);
    if (Array.isArray(p2)) {
      p2.splice(parseInt(k2) + 1, 0, JSON.parse(JSON.stringify(value)));
    } else {
      let newKey = String(k2) + "_copy";
      let i = 1;
      while (newKey in p2) {
        newKey = String(k2) + "_copy" + i;
        i++;
      }
      p2[newKey] = JSON.parse(JSON.stringify(value));
    }
    return clone;
  }

  function wrapAtPath(data, path, type) {
    const { value } = getValueAtPath(data, path);
    const wrapped = type === "object" ? { "wrapped": value } : [value];
    return setValueAtPath(data, path, wrapped);
  }

  function addChildAtPath(data, path) {
    const clone = JSON.parse(JSON.stringify(data));
    const { value: target } = getValueAtPath(clone, path);
    if (Array.isArray(target)) {
      target.push("new item");
    } else if (typeof target === "object" && target !== null) {
      let newKey = "newKey";
      let i = 1;
      while (newKey in target) {
        newKey = "newKey" + i;
        i++;
      }
      target[newKey] = "value";
    }
    return clone;
  }

  // ---- Event Delegation ----
  container.addEventListener("click", e => {
    const expandBtn = e.target.closest(".expand-btn");
    if (expandBtn) {
      const path = expandBtn.dataset.path;
      if (expandedPaths.has(path)) expandedPaths.delete(path);
      else expandedPaths.add(path);
      render();
      return;
    }

    const nodeValue = e.target.closest(".node-value");
    if (nodeValue) {
      const path = nodeValue.dataset.path;
      const type = nodeValue.dataset.type;
      StateManager.updateState({ selectedPath: path });
      EventBus.emit("node:selected", { path, type });

      if (type === "boolean") {
        const state = StateManager.getState();
        const { value } = getValueAtPath(state.data, path);
        const newData = setValueAtPath(state.data, path, !value);
        StateManager.pushUndo();
        StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
      } else if (type !== "object" && type !== "array") {
        const currentText = nodeValue.textContent;
        const input = document.createElement("input");
        input.type = "text";
        input.value = type === "string" ? currentText.slice(1, -1) : currentText;
        input.className = "bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 text-xs font-mono";
        nodeValue.replaceWith(input);
        input.focus();
        input.select();

        function finish() {
          let val = input.value;
          if (type === "number") val = Number(val);
          else if (type === "string") val = String(val);
          else if (type === "null") val = null;
          const state = StateManager.getState();
          const newData = setValueAtPath(state.data, path, val);
          StateManager.pushUndo();
          StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
        }
        input.addEventListener("blur", finish, { once: true });
        input.addEventListener("keydown", ev => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            input.blur();
          }
        });
      }
      return;
    }

    const nodeKey = e.target.closest(".node-key");
    if (nodeKey) {
      const path = nodeKey.dataset.path;
      StateManager.updateState({ selectedPath: path });
      EventBus.emit("node:selected", { path, type: "key" });
      return;
    }

    const actionDelete = e.target.closest(".action-delete");
    if (actionDelete) {
      const path = actionDelete.dataset.path;
      const state = StateManager.getState();
      const newData = deleteAtPath(state.data, path);
      StateManager.pushUndo();
      StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent), selectedPath: null });
      return;
    }

    const actionDuplicate = e.target.closest(".action-duplicate");
    if (actionDuplicate) {
      const path = actionDuplicate.dataset.path;
      const state = StateManager.getState();
      const newData = duplicateAtPath(state.data, path);
      StateManager.pushUndo();
      StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
      return;
    }

    const actionAdd = e.target.closest(".action-add");
    if (actionAdd) {
      const path = actionAdd.dataset.path;
      const state = StateManager.getState();
      const newData = addChildAtPath(state.data, path);
      StateManager.pushUndo();
      StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
      expandedPaths.add(path);
      return;
    }

    
    
    const actionType = e.target.closest(".action-type");
if (actionType) {
  const path = actionType.dataset.path;
  const rect = actionType.getBoundingClientRect();
  const menu = document.getElementById("type-cast-menu");
  
  // Set initial position (below the button, aligned left)
  menu.style.left = rect.left + "px";
  menu.style.top = (rect.bottom + 4) + "px";
  menu.classList.remove("hidden");
  menu.dataset.path = path;
  
  // --- Adjust horizontal position (prevent right overflow) ---
  const menuWidth = menu.offsetWidth;
  const maxLeft = window.innerWidth - menuWidth;
  if (rect.left > maxLeft) {
    menu.style.left = Math.max(0, maxLeft) + "px";
  }
  
  // --- Adjust vertical position (prevent bottom overflow) ---
  const menuHeight = menu.offsetHeight;
  const maxTop = window.innerHeight - menuHeight;
  if (rect.bottom + 4 > maxTop) {
    // Place above the button instead of below
    menu.style.top = Math.max(0, rect.top - menuHeight - 4) + "px";
  }
  
  return;
}

    const treeNode = e.target.closest(".tree-node");
    if (treeNode) {
      StateManager.updateState({ selectedPath: treeNode.dataset.path });
    }
  });

  // ---- Drag and Drop ----
  let dragPath = null;
  container.addEventListener("dragstart", e => {
    const handle = e.target.closest(".drag-handle");
    if (handle) {
      dragPath = handle.dataset.path;
      e.dataTransfer.effectAllowed = "move";
      e.target.closest(".tree-node").classList.add("dragging");
    }
  });
  container.addEventListener("dragend", e => {
    document.querySelectorAll(".dragging").forEach(el => el.classList.remove("dragging"));
    document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
    dragPath = null;
  });
  container.addEventListener("dragover", e => {
    e.preventDefault();
    const node = e.target.closest(".tree-node");
    if (node && node.dataset.path !== dragPath) {
      const row = node.querySelector(":scope > div");
      if (row) row.classList.add("drag-over");
    }
  });
  container.addEventListener("dragleave", e => {
    const node = e.target.closest(".tree-node");
    if (node) {
      const row = node.querySelector(":scope > div");
      if (row) row.classList.remove("drag-over");
    }
  });
  container.addEventListener("drop", e => {
    e.preventDefault();
    const node = e.target.closest(".tree-node");
    if (node && dragPath && node.dataset.path !== dragPath) {
      const targetPath = node.dataset.path;
      const state = StateManager.getState();
      const { value: dragValue } = getValueAtPath(state.data, dragPath);
      let newData = deleteAtPath(state.data, dragPath);
      const { value: targetValue } = getValueAtPath(newData, targetPath);
      if (Array.isArray(targetValue)) {
        targetValue.push(JSON.parse(JSON.stringify(dragValue)));
      } else if (typeof targetValue === "object" && targetValue !== null) {
        let newKey = "moved";
        let i = 1;
        while (newKey in targetValue) {
          newKey = "moved" + i;
          i++;
        }
        targetValue[newKey] = JSON.parse(JSON.stringify(dragValue));
      }
      StateManager.pushUndo();
      StateManager.updateState({ data: newData, rawText: DataManager.stringify(newData, state.settings.indent) });
      EventBus.emit("node:moved", { from: dragPath, to: targetPath });
    }
  });

  // ---- Subscribe to events ----
  EventBus.on("stateChanged", () => render());
  EventBus.on("node:updated", () => render());

  // ---- Expose Public API ----
  window.TreeRenderer = {
    render,
    getValueAtPath,
    setValueAtPath,
    deleteAtPath,
    duplicateAtPath,
    wrapAtPath,
    addChildAtPath
  };

  // ---- Initial render ----
  render();

  //console.log('[treerenderer] Initialised successfully.');
})();