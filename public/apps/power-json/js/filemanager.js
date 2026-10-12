(function() {
  "use strict";

  const EventBus = window.EventBus;
  const fileInput = document.getElementById("file-input");

  fileInput.addEventListener("change", e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { EventBus.emit("file:loaded", ev.target.result); };
    reader.readAsText(file);
    fileInput.value = "";
  });

  function download(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  window.FileManager = { download, triggerImport: () => fileInput.click() };
})();