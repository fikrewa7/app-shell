// texteditor.js
(function() {
  "use strict";

  const EventBus = window.EventBus;
  const StateManager = window.StateManager;

  const textarea = document.getElementById("raw-textarea");
  const overlay = document.getElementById("syntax-overlay");
  let isEditing = false, debounceTimer = null;

  // ---- Helper: escape HTML ----
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---- Tokenizer-based highlighter (accepts errorLine) ----
  function highlight(text, errorLine = -1) {
    if (!text) return "";
    let html = "";
    let i = 0;
    const len = text.length;

    function append(token, className) {
      if (token.length === 0) return;
      const escaped = escapeHtml(token);
      if (className) {
        html += `<span class="${className}">${escaped}</span>`;
      } else {
        html += escaped;
      }
    }

    while (i < len) {
      const ch = text[i];

      // --- Whitespace (no class) ---
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        let ws = '';
        while (i < len && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) {
          ws += text[i];
          i++;
        }
        append(ws, null);
        continue;
      }

      // --- Single-line comment ---
      if (ch === '/' && i + 1 < len && text[i + 1] === '/') {
        let comment = '';
        while (i < len && text[i] !== '\n') {
          comment += text[i];
          i++;
        }
        append(comment, 'text-gray-400');
        continue;
      }

      // --- Multi-line comment ---
      if (ch === '/' && i + 1 < len && text[i + 1] === '*') {
        let comment = '';
        while (i < len && !(text[i] === '*' && i + 1 < len && text[i + 1] === '/')) {
          comment += text[i];
          i++;
        }
        if (i + 1 < len) {
          comment += text[i] + text[i + 1];
          i += 2;
        }
        append(comment, 'text-gray-400');
        continue;
      }

      // --- Double-quoted string ---
      if (ch === '"') {
        let str = '"';
        i++;
        while (i < len) {
          if (text[i] === '"' && text[i - 1] !== '\\') {
            str += '"';
            i++;
            break;
          }
          str += text[i];
          i++;
        }
        // Detect if it's a key (followed by colon after whitespace)
        let j = i;
        while (j < len && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n' || text[j] === '\r')) j++;
        const isKey = (j < len && text[j] === ':');
        const className = isKey ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400';
        append(str, className);
        continue;
      }

      // --- Numbers (including negative, decimal, exponent) ---
      if (/[0-9-]/.test(ch) && !(ch === '-' && i + 1 < len && !/[0-9]/.test(text[i + 1]))) {
        let num = '';
        if (ch === '-') { num += '-'; i++; }
        while (i < len && /[0-9]/.test(text[i])) { num += text[i]; i++; }
        if (i < len && text[i] === '.') { num += '.'; i++; while (i < len && /[0-9]/.test(text[i])) { num += text[i]; i++; } }
        if (i < len && (text[i] === 'e' || text[i] === 'E')) { num += text[i]; i++; if (i < len && (text[i] === '+' || text[i] === '-')) { num += text[i]; i++; } while (i < len && /[0-9]/.test(text[i])) { num += text[i]; i++; } }
        append(num, 'text-blue-600 dark:text-blue-400');
        continue;
      }

      // --- Booleans and null ---
      if (text.substr(i, 4) === 'true') {
        append('true', 'text-purple-600 dark:text-purple-400');
        i += 4;
        continue;
      }
      if (text.substr(i, 5) === 'false') {
        append('false', 'text-purple-600 dark:text-purple-400');
        i += 5;
        continue;
      }
      if (text.substr(i, 4) === 'null') {
        append('null', 'text-purple-600 dark:text-purple-400');
        i += 4;
        continue;
      }

      // --- Brackets ---
      if ('{}[]'.includes(ch)) {
        append(ch, 'text-gray-500 dark:text-gray-500');
        i++;
        continue;
      }

      // --- Any other character (commas, colons, etc.) ---
      let other = '';
      while (i < len && !/[{}[\]"\/\-0-9tfn]/.test(text[i]) && !(text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) {
        other += text[i];
        i++;
      }
      append(other, null);
    }

    // --- Apply error line highlighting if errorLine is provided ---
    if (errorLine > 0) {
      const lines = html.split('\n');
      if (errorLine <= lines.length) {
        lines[errorLine - 1] = '<span class="syntax-error-line block">' + lines[errorLine - 1] + '</span>';
      }
      html = lines.join('\n');
    }

    return html;
  }

  // ---- Update overlay (now accepts errorLine) ----
  function updateOverlay(text, errorLine = -1) {
    if (!overlay) return;
    overlay.innerHTML = highlight(text, errorLine);
  }

  // ---- Sync scroll between textarea and overlay ----
  function syncScroll() {
    if (overlay && textarea) {
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    }
  }

  // ---- Textarea input event (with debounce) ----
  textarea.addEventListener("input", () => {
    isEditing = true;
    const state = StateManager.getRawState ? StateManager.getRawState() : StateManager.getState();
    const errLine = state.validation?.errorLine || -1;
    updateOverlay(textarea.value, errLine);
    syncScroll();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      isEditing = false;
      EventBus.emit("text:changed", textarea.value);
    }, 300);
  });

  textarea.addEventListener("scroll", syncScroll);

  textarea.addEventListener("blur", () => {
    isEditing = false;
    EventBus.emit("text:changed", textarea.value);
  });

  // ---- React to state changes (external) ----
  EventBus.on("stateChanged", (state) => {
    // Only update if the user isn't actively editing
    if (!isEditing && textarea.value !== state.rawText) {
      textarea.value = state.rawText || "";
      updateOverlay(state.rawText, state.validation?.errorLine || -1);
      syncScroll();
    } else if (state.rawText === textarea.value) {
      // Refresh overlay if errorLine changed (e.g., after new parse)
      updateOverlay(state.rawText, state.validation?.errorLine || -1);
    }
  });

  // ---- Public API ----
  window.TextEditor = {
    updateOverlay,
    getValue: () => textarea.value,
    setValue: (text, errorLine = -1) => {
      textarea.value = text;
      updateOverlay(text, errorLine);
      syncScroll();
    },
    syncScroll
  };

  // ---- Log ----
  // console.log('[texteditor] Tokenizer-based highlighter with error-line support loaded.');
})();