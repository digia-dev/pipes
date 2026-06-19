export default function (Alpine) {
  Alpine.data('files', () => ({
    newMenuOpen: false,
    loading: false,

    get token() {
      return Alpine.store('pipes').token;
    },
    get page() {
      return Alpine.store('pipes').activeFilesPage || 'home';
    },
    set page(val) {
      Alpine.store('pipes').activeFilesPage = val;
    },
    get view() {
      return Alpine.store('pipes').view || 'grid';
    },
    set view(val) {
      Alpine.store('pipes').view = val;
    },
    get isAdmin() {
      return Alpine.store('pipes').isAdmin;
    },
    get sortBy() {
      return Alpine.store('pipes').sortBy || 'name';
    },
    get sortDir() {
      return Alpine.store('pipes').sortDir || 'asc';
    },
    get activityLabels() {
      return { upload: 'uploaded', delete: 'deleted', rename: 'renamed', move: 'moved', share: 'shared', version: 'updated', create: 'created' };
    },
    get selectedFileIds() {
      return Alpine.store('pipes').selectedFileIds || [];
    },
    get searchQuery() {
      return Alpine.store('pipes').searchQuery || '';
    },
    get activeFolderId() {
      return Alpine.store('pipes').activeFolderId;
    },
    get folderHistory() {
      return Alpine.store('pipes').folderHistory || [];
    },

    get folders() {
      const f = Alpine.store('pipes').folders;
      return Array.isArray(f) ? f : [];
    },
    get filesItems() {
      const f = Alpine.store('pipes').filesItems;
      return Array.isArray(f) ? f : [];
    },
    get folderTree() {
      const f = Alpine.store('pipes').folderTree;
      return Array.isArray(f) ? f : [];
    },

    get filteredFolders() {
      let f = this.folders;
      const q = this.searchQuery.toLowerCase().trim();
      if (q) f = f.filter(x => (x.name || '').toLowerCase().includes(q));
      const dir = this.sortDir === 'asc' ? 1 : -1;
      return [...f].sort((a, b) => dir * (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));
    },

    get filteredFiles() {
      let f = this.filesItems;
      const q = this.searchQuery.toLowerCase().trim();
      if (q) f = f.filter(x => (x.original_name || x.name || x.title || '').toLowerCase().includes(q));
      const sort = this.sortBy;
      const dir = this.sortDir === 'asc' ? 1 : -1;
      return [...f].sort((a, b) => {
        let va, vb;
        if (sort === 'name') { va = (a.original_name || a.name || a.title || '').toLowerCase(); vb = (b.original_name || b.name || b.title || '').toLowerCase(); return dir * va.localeCompare(vb); }
        if (sort === 'size') { va = a.size || 0; vb = b.size || 0; return dir * (va - vb); }
        if (sort === 'created_at') { va = a.created_at || ''; vb = b.created_at || ''; return dir * va.localeCompare(vb); }
        if (sort === 'owner') { va = (a.owner_name || '').toLowerCase(); vb = (b.owner_name || '').toLowerCase(); return dir * va.localeCompare(vb); }
        return 0;
      });
    },

    get expandedFolders() {
      const f = Alpine.store('pipes').expandedFolders;
      return Array.isArray(f) ? f : [];
    },
    get flatFolderTree() {
      const result = [];
      const walk = (nodes, depth) => {
        if (!Array.isArray(nodes)) return;
        for (const n of nodes) {
          if (!n || !n.id) continue;
          result.push({ ...n, depth });
          if (Array.isArray(n.children) && n.children.length && this.expandedFolders.includes(n.id)) {
            walk(n.children, depth + 1);
          }
        }
      };
      walk(this.folderTree, 0);
      return result;
    },

    get activity() {
      const a = Alpine.store('pipes').activity;
      return Array.isArray(a) ? a : [];
    },

    get filteredFiles() {
      let f = Alpine.store('pipes').filesItems || [];
      const q = this.searchQuery.toLowerCase().trim();
      if (q) f = f.filter(x => (x.original_name || x.name || x.title || '').toLowerCase().includes(q));
      const sort = this.sortBy;
      const dir = this.sortDir === 'asc' ? 1 : -1;
      return [...f].sort((a, b) => {
        let va, vb;
        if (sort === 'name') { va = (a.original_name || a.name || a.title || '').toLowerCase(); vb = (b.original_name || b.name || b.title || '').toLowerCase(); return dir * va.localeCompare(vb); }
        if (sort === 'size') { va = a.size || 0; vb = b.size || 0; return dir * (va - vb); }
        if (sort === 'created_at') { va = a.created_at || ''; vb = b.created_at || ''; return dir * va.localeCompare(vb); }
        if (sort === 'owner') { va = (a.owner_name || '').toLowerCase(); vb = (b.owner_name || '').toLowerCase(); return dir * va.localeCompare(vb); }
        return 0;
      });
    },

    formatSize(size) {
      if (!size) return '';
      if (size < 1024) return size + ' B';
      if (size < 1048576) return (size / 1024).toFixed(1) + ' KB';
      return (size / 1048576).toFixed(1) + ' MB';
    },

    async switchPage(p) {
      this.page = p;
      this.loading = true;
      if (window.loadFilesPage) await loadFilesPage(p);
      this.loading = false;
    },

    toggleFolderTree(id) {
      const ex = Alpine.store('pipes').expandedFolders || [];
      const idx = ex.indexOf(id);
      if (idx > -1) ex.splice(idx, 1); else ex.push(id);
      Alpine.store('pipes').expandedFolders = [...ex];
    },

    goBack() {
      const hist = Alpine.store('pipes').folderHistory || [];
      if (hist.length) {
        const prev = hist.pop();
        Alpine.store('pipes').folderHistory = [...hist];
        if (window.loadFilesFolder) loadFilesFolder(prev, false);
      }
    },

    async openFolder(id) {
      this.loading = true;
      if (window.loadFilesFolder) await loadFilesFolder(id);
      this.loading = false;
    },

    async openFile(id) {
      if (this.page === 'archive') {
        if (window.selectTask) selectTask(id);
      } else {
        if (window.previewFilesItem) previewFilesItem(id);
      }
    },

    async toggleStar(id) {
      const res = await this.$api('/files/items/' + id + '/star', { method: 'POST' });
      if (this.page === 'starred') {
        if (window.loadFilesPage) loadFilesPage('starred');
      } else {
        const items = Alpine.store('pipes').filesItems;
        const f = items.find(x => x.id === id);
        if (f) f.is_starred = res.is_starred ? 1 : 0;
        Alpine.store('pipes').filesItems = [...items];
      }
    },

    async toggleSelect(type, id) {
      const key = (type === 'folder' ? 'f' : 'fi') + id;
      let sel = [...this.selectedFileIds];
      const idx = sel.indexOf(key);
      if (idx > -1) sel.splice(idx, 1); else sel.push(key);
      Alpine.store('pipes').selectedFileIds = sel;
      if (!sel.length) Alpine.store('pipes').selectMode = false;
      else Alpine.store('pipes').selectMode = true;
    },

    setSort(field) {
      const s = Alpine.store('pipes');
      if (s.sortBy === field) s.sortDir = s.sortDir === 'asc' ? 'desc' : 'asc';
      else { s.sortBy = field; s.sortDir = 'asc'; }
      Alpine.store('pipes', { ...s });
    },

    inlineRename(type, id, nameEl) {
      const current = (type === 'folder' ? Alpine.store('pipes').folders : Alpine.store('pipes').filesItems).find(x => x.id === id)?.name || '';
      const input = document.createElement('input');
      input.className = 'fs-inline-input';
      input.value = current;
      input.style.width = Math.max(current.length * 8, 60) + 'px';
      if (nameEl) {
        nameEl.textContent = '';
        nameEl.appendChild(input);
        input.focus();
        input.select();
      }
      const done = () => {
        const val = input.value.trim();
        if (val && val !== current) {
          const endpoint = type === 'folder' ? '/files/folders/' + id : '/files/items/' + id;
          this.$api(endpoint, { method: 'PUT', body: JSON.stringify({ name: val }) });
        }
        if (nameEl) nameEl.textContent = val || current;
      };
      input.addEventListener('blur', done);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
        if (ev.key === 'Escape') { if (nameEl) nameEl.textContent = current; }
      });
    },

    async confirmDelete(type, id) {
      if (!confirm('Delete this ' + type + '?')) return;
      if (type === 'folder') {
        await this.$api('/files/folders/' + id, { method: 'DELETE' });
      }
      if (window.loadFilesFolder) loadFilesFolder(Alpine.store('pipes').activeFolderId);
    },

    get allSelected() {
      const ids = this.selectedFileIds;
      if (!ids.length) return false;
      const total = (Alpine.store('pipes').folders || []).length + (Alpine.store('pipes').filesItems || []).length;
      return ids.length >= total;
    },
    toggleSelectAll() {
      const store = Alpine.store('pipes');
      const all = [
        ...(store.folders || []).map(f => 'f' + f.id),
        ...(store.filesItems || []).map(f => 'fi' + f.id),
      ];
      if (this.allSelected) store.selectedFileIds = [];
      else store.selectedFileIds = all;
    },
    async pasteItems() {
      const clip = Alpine.store('pipes').clipboard;
      if (!clip?.items?.length) return;
      const folderId = Alpine.store('pipes').activeFolderId;
      const fileIds = clip.items.filter(i => i.type === 'file').map(i => i.id);
      const folderIds = clip.items.filter(i => i.type === 'folder').map(i => i.id);
      try {
        for (const fid of folderIds) {
          await this.$api('/files/folders/' + fid, { method: 'PUT', body: JSON.stringify({ parent_id: folderId }) });
        }
        if (fileIds.length) {
          await this.$api('/files/bulk', { method: 'POST', body: JSON.stringify({ action: 'move', file_ids: fileIds, folder_id: folderId }) });
        }
      } catch (e) { alert('Failed to paste items'); }
      Alpine.store('pipes').clipboard = { items: [], mode: null };
      if (window.loadFilesPage) loadFilesPage();
    },

    switchView(v) {
      this.view = v;
      if (window.switchFilesView) switchFilesView(v);
    },

    toggleNewMenu() {
      this.newMenuOpen = !this.newMenuOpen;
    },

    newAction(action) {
      this.newMenuOpen = false;
      if (action === 'upload-file') document.getElementById('fs-file-input')?.click();
      else if (action === 'create-folder') {
        const el = Alpine.raw(document.getElementById('create-folder-modal'));
        if (el) { Alpine.store('modals').openModal('create-folder-modal'); el.__x.$data.name = ''; }
      }
    },

    uploadOverlay: false,
    uploadProgress: [],
    _dragCount: 0,
    contextMenu: { visible: false, x: 0, y: 0, items: [], target: { type: null, id: null } },

    openContextMenu(type, id, e) {
      const isAdmin = Alpine.store('pipes').isAdmin;
      const isArchive = this.page === 'archive';
      let items;
      if (type === 'folder') {
        items = [{ action:'open', label:'Open', icon:'folder-open' }];
        if (isAdmin) items.push({ action:'rename', label:'Rename', icon:'pencil' });
        items.push({ action:'cut', label:'Cut', icon:'scissors' });
        if (isAdmin) items.push({ action:'delete', label:'Delete', icon:'trash-2', danger:true });
      } else if (isArchive) {
        items = [
          { action:'open', label:'Open Task', icon:'eye' },
          { action:'restore', label:'Restore', icon:'rotate-ccw' },
          { action:'moveArchive', label:'Move to Folder', icon:'folder' },
          { action:'delete', label:'Delete', icon:'trash-2', danger:true },
        ];
      } else {
        items = [{ action:'open', label:'Open', icon:'eye' }];
        if (isAdmin) items.push({ action:'rename', label:'Rename', icon:'pencil' });
        items.push({ action:'copy', label:'Copy', icon:'copy' });
        items.push({ action:'cut', label:'Cut', icon:'scissors' });
        if (isAdmin) items.push({ action:'delete', label:'Delete', icon:'trash-2', danger:true });
      }
      this.contextMenu = {
        visible: true,
        x: Math.min(e.clientX, window.innerWidth - 200),
        y: Math.min(e.clientY, window.innerHeight - 300),
        items,
        target: { type, id },
      };
    },
    async contextAction(action) {
      const cm = this.contextMenu;
      const target = cm.target;
      cm.visible = false;
      const type = target.type;
      const id = target.id;

      if (action === 'open') {
        if (type === 'folder') this.openFolder(id);
        else if (this.page === 'archive') { if (window.selectTask) selectTask(id); }
        else { if (window.previewFilesItem) previewFilesItem(id); }
      } else if (action === 'rename') {
        if (window.openRenameModal) openRenameModal(type, id);
      } else if (action === 'copy') {
        if (type === 'folder') return;
        await this.$api('/files/items/' + id + '/duplicate', { method: 'POST', body: JSON.stringify({ folder_id: Alpine.store('pipes').activeFolderId }) });
        if (window.loadFilesPage) loadFilesPage(this.page);
      } else if (action === 'cut') {
        const key = (type === 'folder' ? 'f' : 'fi') + id;
        Alpine.store('pipes').clipboard = { items: [{ key, type, id }], mode: 'cut' };
      } else if (action === 'restore') {
        await this.$api('/lines/tasks/' + id + '/restore', { method: 'PUT' });
        if (window.loadFilesPage) loadFilesPage('archive');
      } else if (action === 'moveArchive') {
        const folders = await this.$api('/files/archive-folders');
        if (window.moveArchiveItem) moveArchiveItem(id, folders);
      } else if (action === 'delete') {
        if (this.page === 'archive') {
          const ok = await Alpine.store('modals').confirm('Delete permanently?', 'This archived task will be deleted forever.', 'Delete');
          if (!ok) return;
          await this.$api('/lines/archive/bulk', { method: 'POST', body: JSON.stringify({ action: 'delete', task_ids: [id] }) });
          if (window.loadFilesPage) loadFilesPage('archive');
        } else if (type === 'folder') {
          this.confirmDelete('folder', id);
        } else {
          this.confirmDelete('file', id);
        }
      }
    },

    handleDragEnter() {
      this._dragCount++;
      this.uploadOverlay = true;
    },
    handleDragLeave() {
      this._dragCount--;
      if (this._dragCount <= 0) { this._dragCount = 0; this.uploadOverlay = false; }
    },
    handleDrop(e) {
      this.uploadOverlay = false;
      this._dragCount = 0;
      const fl = e.dataTransfer?.files;
      if (fl?.length) this.startUpload(fl);
    },
    async startUpload(fileList) {
      const files = Array.from(fileList);
      this.uploadProgress = files.map(f => ({ name: f.name, progress: 0 }));
      let completed = 0;
      for (let i = 0; i < files.length; i++) {
        this.uploadProgress[i].progress = 30;
        const form = new FormData();
        form.append('file', files[i]);
        const folderId = Alpine.store('pipes').activeFolderId;
        if (folderId) form.append('folder_id', folderId);
        try {
          const res = await fetch('/api/files/upload', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + this.token },
            body: form,
          });
          if (res.ok) {
            this.uploadProgress[i].progress = 100;
            completed++;
          } else {
            this.uploadProgress[i].progress = -1;
          }
        } catch {
          this.uploadProgress[i].progress = -1;
        }
      }
      if (completed > 0) {
        if (window.loadFilesPage) loadFilesPage();
      }
      setTimeout(() => { this.uploadProgress = []; }, 2000);
    },

    init() {
      this.$watch('searchQuery', () => {
        if (window.renderFilesContent && !document.getElementById('files-area')?.hasAttribute('x-data')) {
          renderFilesContent();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.contextMenu.visible = false;
      });
    },
  }))
}
