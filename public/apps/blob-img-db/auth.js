var AuthModule = (function() {
  'use strict';

  // ============ EMBEDDED KEY ENCRYPTOR ============
  const KeyEncryptor = (function () {
    'use strict';

    // Convert ArrayBuffer to Base64 string
    function _arrayBufferToBase64(buffer) {
      var bytes = new Uint8Array(buffer);
      var binary = '';
      for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    // Convert Base64 string to ArrayBuffer
    function _base64ToArrayBuffer(base64) {
      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    // Derive AES-GCM key from password and salt using PBKDF2
    async function _deriveKey(password, salt) {
      var enc = new TextEncoder();
      var keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 600000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    // Encrypt plaintext with password
    async function encrypt(plaintext, password) {
      if (!plaintext || !password) {
        throw new Error('Plaintext and password are required.');
      }
      var salt = crypto.getRandomValues(new Uint8Array(16));
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var key = await _deriveKey(password, salt);
      var encoded = new TextEncoder().encode(plaintext);
      var cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoded
      );
      return {
        iv: _arrayBufferToBase64(iv),
        salt: _arrayBufferToBase64(salt),
        ciphertext: _arrayBufferToBase64(cipherBuffer)
      };
    }

    // Decrypt bundle with password
    async function decrypt(bundle, password) {
      if (!bundle || !password) {
        throw new Error('Bundle and password are required.');
      }
      var iv = new Uint8Array(_base64ToArrayBuffer(bundle.iv));
      var salt = new Uint8Array(_base64ToArrayBuffer(bundle.salt));
      var cipherBuffer = _base64ToArrayBuffer(bundle.ciphertext);
      var key = await _deriveKey(password, salt);
      var decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        cipherBuffer
      );
      return new TextDecoder().decode(decrypted);
    }

    return {
      encrypt: encrypt,
      decrypt: decrypt
    };
  })();

  // ============ AUTH MODULE ============
  const CONFIG = {
    apiBase: 'https://blob-img-db.vercel.app/api',
    encryptedKeyEndpoint: '/encrypted-key-v2',
    blobdbEndpoint: '/blobdb',
    storageKey: 'blob-db-storage-key'
  };
  
  let cachedJfrKey = null;
  let jfrKeyPromise = null;
  
  // Fetch encrypted JFR key from backend
  function fetchEncryptedKey() {
    if (cachedJfrKey) {
      return Promise.resolve(cachedJfrKey);
    }
    
    if (jfrKeyPromise) {
      return jfrKeyPromise;
    }
    
    jfrKeyPromise = fetch(`${CONFIG.apiBase}${CONFIG.encryptedKeyEndpoint}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to fetch encrypted key`);
        }
        return res.json();
      })
      .then(data => {
        if (!data.jfrKey) {
          throw new Error('Invalid response: missing jfrKey');
        }
        cachedJfrKey = data.jfrKey;
        jfrKeyPromise = null;
        return cachedJfrKey;
      })
      .catch(err => {
        console.error('Error fetching encrypted key:', err);
        jfrKeyPromise = null;
        throw err;
      });
    
    return jfrKeyPromise;
  }
  
  // Clear cached JFR key
  function clearCache() {
    cachedJfrKey = null;
    jfrKeyPromise = null;
  }
  
  // Unlock API key using password
  async function unlockWithPassword(password) {
    try {
      const jfrKey = await fetchEncryptedKey();
      const decryptedKey = await KeyEncryptor.decrypt(jfrKey, password);
      return decryptedKey;
    } catch (err) {
      throw new Error(`Unlock failed: ${err.message}`);
    }
  }
  
  // Check if API key exists in localStorage
  function hasStoredKey(storageKey) {
    return !!localStorage.getItem(storageKey);
  }
  
  // Get API key from localStorage
  function getStoredKey(storageKey) {
    return localStorage.getItem(storageKey);
  }
  
  // Store API key in localStorage
  function storeKey(storageKey, apiKey) {
    localStorage.setItem(storageKey, apiKey);
  }
  
  // Remove API key from localStorage
  function removeKey(storageKey) {
    localStorage.removeItem(storageKey);
  }

  // Encrypt plaintext with password (general purpose)
  async function encrypt(plaintext, password) {
    try {
      return await KeyEncryptor.encrypt(plaintext, password);
    } catch (err) {
      throw new Error(`Encryption failed: ${err.message}`);
    }
  }

  // Decrypt bundle with password (general purpose)
  async function decrypt(bundle, password) {
    try {
      return await KeyEncryptor.decrypt(bundle, password);
    } catch (err) {
      throw new Error(`Decryption failed: ${err.message}`);
    }
  }
  
  return {
    fetchEncryptedKey,
    unlockWithPassword,
    hasStoredKey,
    getStoredKey,
    storeKey,
    removeKey,
    clearCache,
    encrypt,
    decrypt,
    config: CONFIG
  };
})();
window.AuthModule = AuthModule;
