(function () {
  function hexToBytes(hex) {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function decryptKey(encryptedHex, passcode) {
    if (!passcode || typeof passcode !== 'string') {
      throw new Error('Passcode is required');
    }

    const combined = hexToBytes(encryptedHex);
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passcode),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 600_000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const plainBytes = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
    );

    return bytesToHex(plainBytes);
  }

  const ENCRYPTED_KEY_HEX =
    '1c766d4af8a1f6d5b83ac9d2c126974d1167311277943869dd6280e1e89b305a9ceffe21b9da80b210d125387306709d27ecf0cbd671ed77b42514498a0bdd80eab60b25bafe7a2a314ae73b';

  const API_KEY_STORAGE_KEY =
    (typeof Config !== 'undefined' && Config.get('API_KEY_STORAGE_KEY')) || 'myKey';

  function createModal() {
    const overlay = document.createElement('div');
    overlay.id = 'passcodeModal';
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-container">
        <div class="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
          <span class="flex items-center gap-2 text-sm font-semibold">
            <i class="fas fa-lock text-indigo-400"></i> API Key Required
          </span>
          <button id="closePasscodeModalBtn" class="text-slate-400 hover:text-white">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <p class="text-xs text-slate-400 mb-3">
          Enter passcode to decrypt and store your API key.
        </p>
        <input
          type="password"
          id="passcodeInput"
          class="config-input mb-3"
          placeholder="Passcode"
          autocomplete="off"
        />
        <div id="passcodeError" class="text-xs text-red-400 mb-2 hidden"></div>
        <button
          id="submitPasscodeBtn"
          class="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-2 rounded-md text-xs font-medium"
        >
          <i class="fas fa-key mr-1"></i> Unlock
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function showError(message) {
    const errorEl = document.getElementById('passcodeError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  function openModal() {
    const modal = document.getElementById('passcodeModal') || createModal();
    modal.classList.add('active');
    const input = document.getElementById('passcodeInput');
    if (input) input.focus();
  }

  function closeModal() {
    const modal = document.getElementById('passcodeModal');
    if (modal) {
      modal.classList.remove('active');
      const errorEl = document.getElementById('passcodeError');
      if (errorEl) errorEl.classList.add('hidden');
      const input = document.getElementById('passcodeInput');
      if (input) input.value = '';
    }
  }

  async function handleUnlock() {
    const passcode = document.getElementById('passcodeInput').value.trim();
    if (!passcode) {
      showError('Please enter a passcode');
      return;
    }

    const submitBtn = document.getElementById('submitPasscodeBtn');
    submitBtn.disabled = true;
    showError('');

    try {
      const decryptedKey = await decryptKey(ENCRYPTED_KEY_HEX, passcode);
      localStorage.setItem(API_KEY_STORAGE_KEY, decryptedKey);
      console.log('API key successfully stored');
      closeModal();
    } catch (err) {
      console.error('Decryption failed:', err);
      showError('Invalid passcode or corrupted data');
    } finally {
      submitBtn.disabled = false;
    }
  }

  function init() {
    createModal();

    document.addEventListener('click', (e) => {
      if (e.target.id === 'closePasscodeModalBtn') closeModal();
      if (e.target.id === 'submitPasscodeBtn') handleUnlock();
    });

    window.addEventListener('DOMContentLoaded', () => {
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (!storedKey) {
        openModal();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
