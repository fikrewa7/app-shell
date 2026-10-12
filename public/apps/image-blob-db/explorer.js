/**
 * FolderExplorer Module (IIFE)
 * Standalone logic for navigating a virtual file system built from flat blob data.
 * No UI or DOM dependencies – works in any JavaScript environment.
 *
 * Usage:
 *   const explorer = FolderExplorer.create({
 *       blobs: [ { url, downloadUrl, pathname, size, uploadedAt } ],
 *       storeId: "store_123"
 *   });
 *
 *   explorer.navigateToFolder(["uploads", "screenshots"]);
 *   const files = explorer.getFilesInCurrentFolder();
 *   explorer.on("change", () => { ... });
 */
(function (global) {
  'use strict';

  class FolderExplorer {
    /**
     * @param {Object} rawData - { blobs: Array, storeId: String }
     */
    constructor(rawData) {
      if (!rawData || !Array.isArray(rawData.blobs)) {
        throw new Error('Invalid data: expected { blobs: [...] }');
      }
      this.blobs = rawData.blobs;
      this.storeId = rawData.storeId || '';

      // Build tree once
      this.treeRoot = this._buildTree();

      // State
      this._currentPath = [];          // array of folder names from root
      this._selectedFile = null;      // the original blob object
      this._listeners = { change: [] };
    }

    // ── Public API ──────────────────────────

    /**
     * Factory method
     */
    static create(rawData) {
      return new FolderExplorer(rawData);
    }

    /**
     * Navigate to a specific folder by an array of folder names (relative to root).
     * @param {string[]} pathParts - e.g. ['uploads', 'screenshots', '2026']
     */
    navigateToFolder(pathParts) {
      if (!Array.isArray(pathParts)) {
        pathParts = [];
      }
      // Validate that the path exists
      let node = this.treeRoot;
      for (const part of pathParts) {
        if (!node.children[part]) {
          // Path doesn't exist; stay at current folder
          this._emitChange();
          return false;
        }
        node = node.children[part];
      }
      this._currentPath = pathParts.slice();
      this._selectedFile = null;
      this._emitChange();
      return true;
    }

    /**
     * Select a file. This automatically sets the current folder to the file's parent directory.
     * @param {Object} blob - one of the original blob objects
     */
    selectFile(blob) {
      if (!blob || !blob.pathname) {
        this._selectedFile = null;
        this._emitChange();
        return;
      }
      const pathParts = blob.pathname.split('/');
      pathParts.pop(); // remove file name
      this._currentPath = pathParts;
      this._selectedFile = blob;
      this._emitChange();
    }

    /**
     * Get current folder path as an array of folder names.
     * @returns {string[]}
     */
    getCurrentPath() {
      return this._currentPath.slice();
    }

    /**
     * Get current folder path as a string (e.g. "uploads/screenshots/2026").
     * @returns {string}
     */
    getCurrentPathString() {
      return this._currentPath.join('/');
    }

    /**
     * Get the currently selected file blob, or null.
     * @returns {Object|null}
     */
    getSelectedFile() {
      return this._selectedFile;
    }

    /**
     * Get all child folder names of a given path (or the current folder if no path provided).
     * @param {string[]} [pathParts] - relative to root. If omitted, current folder is used.
     * @returns {string[]} sorted folder names
     */
    getChildFolders(pathParts) {
      const node = this._getNode(pathParts || this._currentPath);
      if (!node) return [];
      return Object.keys(node.children).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
    }

    /**
     * Recursively get all files (blobs) inside the current folder.
     * Sorted by file name alphabetically.
     * @returns {Object[]} array of blob objects
     */
    getFilesInCurrentFolder() {
      const node = this._getNode(this._currentPath);
      if (!node) return [];
      const files = this._getAllFilesRecursive(node);
      return files.sort((a, b) => {
        const nameA = a.pathname.split('/').pop();
        const nameB = b.pathname.split('/').pop();
        return nameA.localeCompare(nameB);
      });
    }

    /**
     * Get all files in the entire store.
     * @returns {Object[]} all blobs
     */
    getAllFiles() {
      return this.blobs.slice();
    }

    /**
     * Search files in the current folder whose name matches the query (case-insensitive).
     * @param {string} query
     * @returns {Object[]} matching blobs
     */
    searchFiles(query) {
      if (!query || !query.trim()) return this.getFilesInCurrentFolder();
      const term = query.trim().toLowerCase();
      const allFiles = this.getFilesInCurrentFolder();
      return allFiles.filter(b => {
        const name = b.pathname.split('/').pop().toLowerCase();
        return name.includes(term);
      });
    }

    /**
     * Get total statistics of the blob store.
     * @returns {{ count: number, size: number, sizeFormatted: string }}
     */
    getTotalStats() {
      const totalSize = this.blobs.reduce((sum, b) => sum + b.size, 0);
      return {
        count: this.blobs.length,
        size: totalSize,
        sizeFormatted: FolderExplorer.formatSize(totalSize)
      };
    }

    /**
     * Static utility: format bytes to human-readable string.
     * @param {number} bytes
     * @returns {string}
     */
    static formatSizes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(2) + ' MB';
    }
    
   static formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  
  const KB = 1024;
  const MB = KB * 1024;
  
  // Less than 1 MB
  if (bytes < MB) {
    const kb = bytes / KB;
    // When KB value is 1000 or more, show as MB (now with .toFixed(2))
    if (kb >= 1000) {
      const mb = bytes / MB; // e.g., 1007.5 KB → 0.98 MB
      return mb.toFixed(2) + ' MB'; // returns "0.98 MB"
    }
    // Normal KB display with 2 decimals
    return kb.toFixed(2) + ' KB';
  }
  
  // 1 MB and above – now 2 decimals
  const mb = bytes / MB;
  return mb.toFixed(2) + ' MB'; // e.g., 15 MB → "15.00 MB"
}

    /**
     * Static utility: format ISO date string to readable format.
     * @param {string} iso
     * @returns {string}
     */
    static formatDate(iso) {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    /**
     * Register an event listener.
     * @param {string} event - 'change' (triggered on navigation/selection)
     * @param {function} callback
     */
    on(event, callback) {
      if (event === 'change' && typeof callback === 'function') {
        this._listeners.change.push(callback);
      }
    }

    /**
     * Remove an event listener.
     */
    off(event, callback) {
      if (event === 'change') {
        this._listeners.change = this._listeners.change.filter(cb => cb !== callback);
      }
    }

    // ── Internal Methods ────────────────────

    _emitChange() {
      this._listeners.change.forEach(cb => {
        try { cb(); } catch (e) { /* ignore */ }
      });
    }

    /**
     * Build a nested tree from flat blob paths.
     */
    _buildTree() {
      const root = {
        name: '',
        isFolder: true,
        children: {},
        files: [],
        fullPath: ''
      };
      this.blobs.forEach(b => {
        const parts = b.pathname.split('/');
        let current = root;
        let acc = '';
        parts.forEach((part, idx) => {
          acc += (acc ? '/' : '') + part;
          if (idx === parts.length - 1) {
            // it's a file
            current.files.push({
              name: part,
              fullPath: b.pathname,
              blob: b
            });
          } else {
            if (!current.children[part]) {
              current.children[part] = {
                name: part,
                isFolder: true,
                children: {},
                files: [],
                fullPath: acc
              };
            }
            current = current.children[part];
          }
        });
      });
      return root;
    }

    /**
     * Get tree node by path array. Returns root if empty or null if invalid.
     */
    _getNode(pathParts) {
      let node = this.treeRoot;
      if (!pathParts || pathParts.length === 0) return node;
      for (const part of pathParts) {
        if (!node.children[part]) return null;
        node = node.children[part];
      }
      return node;
    }

    /**
     * Recursively collect all blob objects from a tree node.
     */
    _getAllFilesRecursive(node) {
      let results = node.files.map(f => f.blob);
      for (const key in node.children) {
        results = results.concat(this._getAllFilesRecursive(node.children[key]));
      }
      return results;
    }
  }

  // Expose to global
  global.FolderExplorer = FolderExplorer;

})(typeof window !== 'undefined' ? window : global);
