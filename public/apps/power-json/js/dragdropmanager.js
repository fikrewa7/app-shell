(function() {
  "use strict";
  
  const EventBus = window.EventBus;
  const overlay = document.getElementById("drop-overlay");
  let dragCounter = 0;
  
  window.addEventListener("dragenter", e => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer.types.includes("Files")) overlay.classList.remove("hidden");
  });
  window.addEventListener("dragleave", e => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) overlay.classList.add("hidden");
  });
  window.addEventListener("dragover", e => e.preventDefault());
  window.addEventListener("drop", e => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add("hidden");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = ev => EventBus.emit("file:loaded", ev.target.result);
        reader.readAsText(file);
      }
    }
  });
  
  window.DragDropManager = {};
})();