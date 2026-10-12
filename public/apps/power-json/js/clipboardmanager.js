(function() {
  "use strict";

  const EventBus = window.EventBus;

  async function read() {
    try { const text = await navigator.clipboard.readText(); EventBus.emit("clipboard:imported", text); }
    catch (e) { alert("Clipboard access denied. Please paste manually."); }
  }

  async function write(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  window.ClipboardManager = { read, write };
})();