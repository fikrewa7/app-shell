(function() {
  "use strict";

  const EventBus = window.EventBus;
  const StateManager = window.StateManager;
  const TreeRenderer = window.TreeRenderer;
  const DataManager = window.DataManager;

  const mockOutput = document.getElementById("mock-server-output");
  const scriptInput = document.getElementById("script-input");
  const scriptOutput = document.getElementById("script-output");

  function updateMockServer() {
    const state = StateManager.getState();
    if (!state.data) { mockOutput.textContent = "No data"; return; }
    const json = JSON.stringify(state.data);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    mockOutput.textContent = `data:application/json;base64,${base64}`;
  }

  EventBus.on("stateChanged", updateMockServer);

  document.getElementById("btn-run-script").addEventListener("click", () => {
    const state = StateManager.getState(); if (!state.data) return;
    const code = scriptInput.value;
    try { const fn = new Function("json", code + "; return transform(json);"); const result = fn(JSON.parse(JSON.stringify(state.data))); scriptOutput.innerHTML = `<span class="text-green-600 dark:text-green-400">Success</span>`; EventBus.emit("plugin:jsonUpdated", result); }
    catch (e) { scriptOutput.innerHTML = `<span class="text-red-600 dark:text-red-400">${e.message}</span>`; }
  });

  // Array Table Editor
  const tableModal = document.getElementById("array-table-modal");
  const tableContainer = document.getElementById("array-table-container");
  let tablePath = null, tableData = [];

  function openTableEditor(path, data) {
    if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || data[0] === null) { alert("Select an array of objects to use the table editor."); return; }
    tablePath = path; tableData = JSON.parse(JSON.stringify(data));
    const keys = [...new Set(tableData.flatMap(row => Object.keys(row)))];
    let html = `<table class="w-full text-xs border-collapse"><thead><tr class="bg-gray-100 dark:bg-gray-800">`;
    keys.forEach(k => { html += `<th class="border border-gray-200 dark:border-gray-700 p-1 text-left text-gray-700 dark:text-gray-300">${k}</th>`; });
    html += `<th class="border border-gray-200 dark:border-gray-700 p-1 w-8"></th></tr></thead><tbody>`;
    tableData.forEach((row, idx) => {
      html += `<tr data-idx="${idx}">`;
      keys.forEach(k => { const val = row[k] !== undefined ? String(row[k]) : ""; html += `<td class="border border-gray-200 dark:border-gray-700 p-0"><input type="text" data-key="${k}" value="${val.replace(/"/g, '&quot;')}" class="w-full p-1 bg-transparent border-none outline-none font-mono text-xs text-gray-800 dark:text-gray-200"></td>`; });
      html += `<td class="border border-gray-200 dark:border-gray-700 p-1 text-center"><button class="btn-del-row touch-target text-red-500"><i class="fas fa-times"></i></button></td></tr>`;
    });
    html += `</tbody></table>`;
    html += `<button id="btn-add-row" class="mt-2 px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-xs"><i class="fas fa-plus"></i> Add Row</button>`;
    tableContainer.innerHTML = html; tableModal.classList.remove("hidden");
  }

  tableContainer.addEventListener("click", e => {
    if (e.target.closest(".btn-del-row")) {
      const row = e.target.closest("tr"); const idx = parseInt(row.dataset.idx);
      tableData.splice(idx, 1); row.remove();
      tableContainer.querySelectorAll("tbody tr").forEach((r, i) => { r.dataset.idx = i; });
    }
    if (e.target.closest("#btn-add-row")) {
      const keys = [...tableContainer.querySelectorAll("thead th")].map(th => th.textContent).filter(k => k);
      const tbody = tableContainer.querySelector("tbody");
      const idx = tbody.querySelectorAll("tr").length;
      let html = `<tr data-idx="${idx}">`;
      keys.forEach(k => { html += `<td class="border border-gray-200 dark:border-gray-700 p-0"><input type="text" data-key="${k}" value="" class="w-full p-1 bg-transparent border-none outline-none font-mono text-xs text-gray-800 dark:text-gray-200"></td>`; });
      html += `<td class="border border-gray-200 dark:border-gray-700 p-1 text-center"><button class="btn-del-row touch-target text-red-500"><i class="fas fa-times"></i></button></td></tr>`;
      tbody.insertAdjacentHTML("beforeend", html);
    }
  });

  document.getElementById("btn-open-table").addEventListener("click", () => {
    const state = StateManager.getState();
    const path = state.selectedPath || "$";
    const { value } = TreeRenderer.getValueAtPath(state.data, path);
    openTableEditor(path, value);
  });

  document.getElementById("btn-close-table").addEventListener("click", () => tableModal.classList.add("hidden"));
  document.getElementById("btn-table-cancel").addEventListener("click", () => tableModal.classList.add("hidden"));
  document.getElementById("btn-table-save").addEventListener("click", () => {
    const rows = tableContainer.querySelectorAll("tbody tr");
    const keys = [...tableContainer.querySelectorAll("thead th")].map(th => th.textContent).filter(k => k);
    const newData = [];
    rows.forEach(row => {
      const obj = {};
      row.querySelectorAll("input[data-key]").forEach(input => {
        const key = input.dataset.key;
        let val = input.value.trim();
        if (!isNaN(val) && val !== "") val = Number(val);
        else if (val === "true") val = true;
        else if (val === "false") val = false;
        else if (val === "null") val = null;
        obj[key] = val;
      });
      newData.push(obj);
    });
    const state = StateManager.getState();
    const newJson = TreeRenderer.setValueAtPath(state.data, tablePath, newData);
    StateManager.pushUndo();
    StateManager.updateState({ data: newJson, rawText: DataManager.stringify(newJson, state.settings.indent) });
    tableModal.classList.add("hidden");
  });

  window.PluginLoader = {};
})();