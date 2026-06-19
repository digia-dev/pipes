export default function (Alpine) {
  Alpine.data('comments', () => ({
    commentText: '',
    filePickerOpen: false,
    newTodoText: '',
    replyFormFor: null,
    replyText: '',
    editingCommentId: null,
    editText: '',
    pendingUpload: null,
    pendingUploadTaskId: null,
    uploadPreviewVisible: false,
    uploadFileName: '',
    commentFiles: {},
    taskFiles: [],
    mentionDD: { visible: false, x: 0, y: 0, w: 0, maxH: '150px', activeIdx: 0, items: [] },
    _mentionTarget: null,

    init() {
      this.$watch('comments', (comments) => {
        this.$nextTick(() => {
          if (Array.isArray(comments)) {
            comments.forEach(c => {
              this._loadCommentFilesLocally(c.id, c.task_id);
            });
          }
          const el = this.$el?.querySelector('.cp-messages');
          if (el) el.scrollTop = el.scrollHeight;
          if (window.lucide) lucide.createIcons();
        });
      });
      this.$watch('task', async (task) => {
        if (task?.id) {
          try {
            const files = await this.$api('/files?task_id=' + task.id + '&comment_id=-1');
            this.taskFiles = Array.isArray(files) ? files.slice(0, 8) : [];
          } catch { this.taskFiles = []; }
        } else {
          this.taskFiles = [];
        }
      });
    },

    get task() {
      return Alpine.store('pipes').selectedTask;
    },
    get comments() {
      return Alpine.store('pipes').comments;
    },
    get todos() {
      return Alpine.store('pipes').todos;
    },
    get users() {
      return Alpine.store('pipes').users;
    },
    get user() {
      return Alpine.store('pipes').user;
    },
    get isAdmin() {
      return Alpine.store('pipes').isAdmin;
    },
    get activeTab() {
      return Alpine.store('pipes').commentsTab || 'comments';
    },
    set activeTab(val) {
      Alpine.store('pipes').commentsTab = val;
    },

    filesForComment(commentId) {
      return this.commentFiles[commentId] || [];
    },

    fileImgSrc(fid) {
      return '/api/files/' + fid + '/download?token=' + Alpine.store('pipes').token;
    },

    async _loadCommentFilesLocally(commentId, taskId) {
      if (this.commentFiles[commentId]) return;
      try {
        const files = await this.$api('/files?task_id=' + taskId + '&comment_id=' + commentId);
        if (Array.isArray(files) && files.length) {
          this.commentFiles[commentId] = files;
        }
      } catch {}
    },

    get parentComments() {
      const all = this.comments || [];
      return all.filter(c => !c.parent_id).reverse();
    },

    repliesFor(parentId) {
      const all = this.comments || [];
      return all.filter(c => c.parent_id === parentId);
    },

    replyCount(parentId) {
      return (this.comments || []).filter(c => c.parent_id === parentId).length;
    },

    avatarColor(uid) {
      const colors = ['#0B2D52', '#FF8A00', '#1e40af', '#9333EA', '#0891B2', '#059669', '#DC2626', '#D97706'];
      return colors[(uid || 0) % colors.length];
    },

    userDisplay(uid) {
      if (!uid) return 'Unknown';
      const u = this.users.find(u => u.id === uid);
      return u ? u.display_name : 'Unknown';
    },

    userInitial(uid) {
      return (this.userDisplay(uid) || '?').charAt(0).toUpperCase();
    },

    formatDate(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr + 'Z').toLocaleString();
    },

    canEdit(uid) {
      return this.isAdmin || uid === this.user?.id;
    },

    esc(str) {
      if (!str) return '';
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    },

    renderText(str) {
      if (!str) return '';
      let h = this.esc(str);
      h = h.replace(/@(\w+)/g, '<span class="mention-user">@$1</span>');
      h = h.replace(/#(\w+)/g, '<span class="mention-todo" data-todo="$1">#$1</span>');
      return h;
    },

    closePanel() {
      if (window.closeCommentsPanel) closeCommentsPanel();
    },

    openDetail() {
      if (this.task && window.openCardDetail) openCardDetail(this.task.id);
    },

    switchTab(tab) {
      this.activeTab = tab;
      this.$nextTick(() => {
        if (window.lucide) lucide.createIcons();
      });
    },

    onInput(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 80) + 'px';
      this._checkMention(el);
    },

    onKeydown(e, taskId) {
      if (this.mentionDD.visible) {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.mentionDD.activeIdx = Math.min(this.mentionDD.activeIdx + 1, this.mentionDD.items.length - 1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); this.mentionDD.activeIdx = Math.max(0, this.mentionDD.activeIdx - 1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this._applyMention(e.target); return; }
        if (e.key === 'Escape') { this.closeMentionDD(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send(taskId);
      }
    },

    _checkMention(el) {
      if (!el) return;
      this._mentionTarget = el;
      const pos = el.selectionStart;
      const before = el.value.substring(0, pos);
      const at = before.lastIndexOf('@');
      const hash = before.lastIndexOf('#');
      const nl = before.lastIndexOf('\n');
      const sp = before.lastIndexOf(' ');
      let type = null, idx = -1;
      if (at > nl && at > sp) { type = 'user'; idx = at; }
      else if (hash > nl && hash > sp) { type = 'todo'; idx = hash; }
      if (!type) { this.closeMentionDD(); return; }
      const term = before.substring(idx + 1);
      if (term.includes(' ')) { this.closeMentionDD(); return; }
      this.mentionDD.activeIdx = 0;
      let items;
      if (type === 'user') {
        items = this.users.filter(u => (u.username||'').toLowerCase().includes(term)).map(u => ({ insert: '@' + u.username, label: u.display_name || u.username, sub: '@' + u.username, badge: (u.display_name||'U').charAt(0).toUpperCase(), bg: '#0B2D52' }));
      } else {
        items = this.todos.filter(t => (t.name||'').toLowerCase().includes(term)).map(t => ({ insert: '#' + t.name, label: t.name, sub: '#' + t.name, badge: t.name.charAt(0).toUpperCase(), bg: '#2563EB' }));
      }
      if (!items.length) { this.closeMentionDD(); return; }
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      this.mentionDD = {
        visible: true,
        x: r.left,
        y: spaceBelow < 160 ? Math.max(10, r.top - Math.min(160, r.top)) : r.bottom + 4,
        w: Math.min(r.width, 300),
        maxH: spaceBelow < 160 ? Math.min(150, r.top - 10) + 'px' : '150px',
        activeIdx: 0,
        items,
      };
    },

    closeMentionDD() {
      this.mentionDD.visible = false;
      this.mentionDD.items = [];
    },

    _applyMention(el) {
      if (!el) el = this._mentionTarget;
      if (!el) return;
      const item = this.mentionDD.items[this.mentionDD.activeIdx];
      if (!item) return;
      const pos = el.selectionStart;
      const before = el.value.substring(0, pos);
      const at = before.lastIndexOf('@');
      const hash = before.lastIndexOf('#');
      const start = Math.max(at, hash);
      if (start < 0) { this.closeMentionDD(); return; }
      const after = el.value.substring(pos);
      const insert = item.insert;
      el.value = before.substring(0, start) + insert + ' ' + after;
      el.selectionStart = el.selectionEnd = start + insert.length + 1;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 80) + 'px';
      if (el.classList.contains('cp-input')) this.commentText = el.value;
      else if (el.classList.contains('cp-reply-input')) this.replyText = el.value;
      this.closeMentionDD();
    },

    async send(taskId) {
      const text = this.commentText.trim();
      if (!text && !this.pendingUpload) return;

      if (!text && this.pendingUpload) {
        await this._uploadFile(taskId);
        return;
      }

      const comment = await this.$api('/lines/comments', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, user_id: this.user?.id, content: text }),
      });

      if (this.pendingUpload) {
        await this._uploadFileWithComment(taskId, comment.id);
      }

      this.commentText = '';
      await this._refreshComments(taskId);
      if (window.loadBoard) loadBoard();
    },

    async _uploadFile(taskId) {
      if (!this.pendingUpload) return;
      const form = new FormData();
      form.append('file', this.pendingUpload);
      form.append('task_id', taskId);
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + Alpine.store('pipes').token },
        body: form,
      });
      this._clearUpload();
      if (window.loadBoard) loadBoard();
    },

    async _uploadFileWithComment(taskId, commentId) {
      if (!this.pendingUpload) return;
      const form = new FormData();
      form.append('file', this.pendingUpload);
      form.append('task_id', taskId);
      form.append('comment_id', commentId);
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + Alpine.store('pipes').token },
        body: form,
      });
      this._clearUpload();
    },

    _clearUpload() {
      this.pendingUpload = null;
      this.pendingUploadTaskId = null;
      this.uploadPreviewVisible = false;
      this.uploadFileName = '';
      const fi = document.getElementById('cp-file-input');
      if (fi) fi.value = '';
      const ci = document.getElementById('cp-camera-input');
      if (ci) ci.value = '';
    },

    onFileSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.pendingUpload = file;
      this.pendingUploadTaskId = this.task?.id;
      this.uploadPreviewVisible = true;
      this.uploadFileName = file.name;
      this.filePickerOpen = false;
    },

    onCameraSelected(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.pendingUpload = file;
      this.pendingUploadTaskId = this.task?.id;
      this.uploadPreviewVisible = true;
      this.uploadFileName = file.name;
      this.filePickerOpen = false;
    },

    cancelUpload() {
      this._clearUpload();
    },

    toggleFilePicker() {
      this.filePickerOpen = !this.filePickerOpen;
    },

    async deleteTaskFile(fileId) {
      if (!(await Alpine.store('modals').confirm('Delete this file?', 'Delete'))) return;
      await fetch('/api/files/' + fileId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + Alpine.store('pipes').token },
      });
      this.taskFiles = this.taskFiles.filter(f => f.id !== fileId);
    },

    pickFromFiles() {
      this.filePickerOpen = false;
      if (window.openFilesModal) openFilesModal();
    },

    pickUpload() {
      this.filePickerOpen = false;
      document.getElementById('cp-file-input')?.click();
    },

    pickCamera() {
      this.filePickerOpen = false;
      document.getElementById('cp-camera-input')?.click();
    },

    openReplyForm(parentId) {
      this.replyFormFor = parentId;
      this.replyText = '';
      this.$nextTick(() => {
        const inp = document.getElementById('cp-reply-' + parentId);
        if (inp) inp.focus();
        if (window.lucide) lucide.createIcons();
      });
    },

    closeReplyForm() {
      this.replyFormFor = null;
      this.replyText = '';
    },

    async sendReply(parentId) {
      const text = this.replyText.trim();
      if (!text || !this.task) return;
      await this.$api('/lines/comments', {
        method: 'POST',
        body: JSON.stringify({ task_id: this.task.id, user_id: this.user?.id, content: text, parent_id: parentId }),
      });
      this.replyFormFor = null;
      this.replyText = '';
      await this._refreshComments(this.task.id);
    },

    openEdit(comment) {
      this.editingCommentId = comment.id;
      this.editText = comment.content || '';
      this.$nextTick(() => {
        const ta = document.getElementById('cp-edit-textarea-' + comment.id);
        if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      });
    },

    closeEdit() {
      this.editingCommentId = null;
      this.editText = '';
    },

    async saveEdit(comment) {
      const text = this.editText.trim();
      if (!text) return;
      await this.$api('/lines/comments/' + comment.id, {
        method: 'PUT',
        body: JSON.stringify({ content: text }),
      });
      this.editingCommentId = null;
      this.editText = '';
      if (this.task) await this._refreshComments(this.task.id);
    },

    async deleteComment(commentId) {
      const ok = await Alpine.store('modals').confirm('Delete Comment?', 'This cannot be undone.', 'Delete');
      if (!ok) return;
      await this.$api('/lines/comments/' + commentId, { method: 'DELETE' });
      if (this.task) await this._refreshComments(this.task.id);
    },

    async toggleTodo(id) {
      await this.$api(`/lines/todos/${id}/toggle`, { method: 'PUT' });
      await this._refreshTodos();
    },

    editTodo(id) {
      Alpine.store('pipes').openTodoId = id;
      Alpine.store('modals').openModal('todo-edit-modal');
    },

    async deleteTodo(id) {
      if (!(await Alpine.store('modals').confirm('Delete this checklist item?', 'Delete'))) return;
      await this.$api(`/lines/todos/${id}`, { method: 'DELETE' });
      await this._refreshTodos();
    },

    async addTodo() {
      const name = this.newTodoText.trim();
      if (!name || !this.task) return;
      this.newTodoText = '';
      await this.$api('/lines/todos', {
        method: 'POST',
        body: JSON.stringify({ name, owner_id: this.user?.id, task_id: this.task.id }),
      });
      await this._refreshTodos();
    },

    async _refreshComments(taskId) {
      const comments = await this.$api('/lines/comments?task_id=' + taskId);
      Alpine.store('pipes').comments = comments;
      if (window.updateTabCounts) updateTabCounts();
      this.$nextTick(() => {
        this.$el.querySelector('.cp-messages').scrollTop = this.$el.querySelector('.cp-messages').scrollHeight;
        if (window.lucide) lucide.createIcons();
      });
    },

    async _refreshTodos() {
      if (!this.task) return;
      const todos = await this.$api(`/lines/todos?task_id=${this.task.id}`);
      Alpine.store('pipes').todos = todos;
      if (window.updateTabCounts) updateTabCounts();
    },
  }))
}
