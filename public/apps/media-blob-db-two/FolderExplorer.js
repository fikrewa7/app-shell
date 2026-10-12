import { BlobUtils } from './BlobUtils.js';

export const FolderExplorer = (function() {
    'use strict';

    class FolderExplorer {
        constructor(rawData) {
            if (!rawData || !Array.isArray(rawData.blobs)) {
                throw new Error('Invalid data: expected { blobs: [...] }');
            }
            this.blobs = rawData.blobs;
            this.storeId = rawData.storeId || '';
            this.treeRoot = this._buildTree();
            this._currentPath = [];
            this._selectedFile = null;
            this._listeners = { change: [] };
        }

        static create(rawData) { return new FolderExplorer(rawData); }

        navigateToFolder(pathParts) {
            if (!Array.isArray(pathParts)) pathParts = [];
            let node = this.treeRoot;
            for (const part of pathParts) {
                if (!node.children[part]) { this._emitChange(); return false; }
                node = node.children[part];
            }
            this._currentPath = pathParts.slice();
            this._selectedFile = null;
            this._emitChange();
            return true;
        }

        selectFile(blob) {
            if (!blob || !blob.pathname) {
                this._selectedFile = null;
                this._emitChange();
                return;
            }
            const pathParts = blob.pathname.split('/');
            pathParts.pop();
            this._currentPath = pathParts;
            this._selectedFile = blob;
            this._emitChange();
        }

        getCurrentPath() { return this._currentPath.slice(); }
        getCurrentPathString() { return this._currentPath.join('/'); }
        getSelectedFile() { return this._selectedFile; }

        getChildFolders(pathParts) {
            const node = this._getNode(pathParts || this._currentPath);
            if (!node) return [];
            return Object.keys(node.children).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }

        getFilesInCurrentFolder() {
            const node = this._getNode(this._currentPath);
            if (!node) return [];
            return this._getAllFilesRecursive(node).sort((a, b) => {
                const nameA = a.pathname.split('/').pop();
                const nameB = b.pathname.split('/').pop();
                return nameA.localeCompare(nameB);
            });
        }

        getAllFiles() { return this.blobs.slice(); }

        searchFiles(query) {
            if (!query || !query.trim()) return this.getFilesInCurrentFolder();
            const term = query.trim().toLowerCase();
            return this.getFilesInCurrentFolder().filter(b => b.pathname.split('/').pop().toLowerCase().includes(term));
        }

        getTotalStats() {
            const totalSize = this.blobs.reduce((sum, b) => sum + b.size, 0);
            return { count: this.blobs.length, size: totalSize, sizeFormatted: BlobUtils.formatFileSize(totalSize) };
        }

        static formatSize(bytes) { return BlobUtils.formatFileSize(bytes); }
        static formatDate(iso) { return BlobUtils.formatFullDate(iso); }

        on(event, callback) {
            if (event === 'change' && typeof callback === 'function') this._listeners.change.push(callback);
        }

        off(event, callback) {
            if (event === 'change') this._listeners.change = this._listeners.change.filter(cb => cb !== callback);
        }

        _emitChange() {
            this._listeners.change.forEach(cb => { try { cb(); } catch (e) {} });
        }

        _buildTree() {
            const root = { name: '', isFolder: true, children: {}, files: [], fullPath: '' };
            this.blobs.forEach(b => {
                const parts = b.pathname.split('/');
                let current = root;
                let acc = '';
                parts.forEach((part, idx) => {
                    acc += (acc ? '/' : '') + part;
                    if (idx === parts.length - 1) {
                        current.files.push({ name: part, fullPath: b.pathname, blob: b });
                    } else {
                        if (!current.children[part]) {
                            current.children[part] = { name: part, isFolder: true, children: {}, files: [], fullPath: acc };
                        }
                        current = current.children[part];
                    }
                });
            });
            return root;
        }

        _getNode(pathParts) {
            let node = this.treeRoot;
            if (!pathParts || pathParts.length === 0) return node;
            for (const part of pathParts) {
                if (!node.children[part]) return null;
                node = node.children[part];
            }
            return node;
        }

        _getAllFilesRecursive(node) {
            let results = node.files.map(f => f.blob);
            for (const key in node.children) {
                results = results.concat(this._getAllFilesRecursive(node.children[key]));
            }
            return results;
        }
    }

    return FolderExplorer;
})();