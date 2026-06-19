export default function (Alpine) {
  Alpine.data('newTaskModal', () => ({
    title: '',
    due: '',
    desc: '',
    assigneeIds: [],

    init() {
      this.$watch('$store.pipes.newTaskAssigneeIds', (val) => {
        this.assigneeIds = val || [];
      });
    },

    get assignees() {
      return this.assigneeIds;
    },

    async submit() {
      const title = this.title.trim();
      if (!title) return;
      const task = await this.$api('/lines/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          column_id: Alpine.store('pipes').lastColumnId,
          description: this.desc,
          due_date: this.due,
          assignee_ids: this.assigneeIds,
        }),
      });
      Alpine.store('modals').closeModal('task-modal');
      this.title = '';
      this.due = '';
      this.desc = '';
      this.assigneeIds = [];
      Alpine.store('pipes').newTaskAssigneeIds = [];
      if (window.loadBoard) loadBoard();
    },

    open(columnId) {
      if (window.openNewTaskModal) openNewTaskModal(columnId);
    },
  }))

  Alpine.data('editTaskModal', () => ({
    title: '',
    desc: '',
    due: '',
    assigneeIds: [],
    taskId: null,
    canEdit: false,

    init() {
      this.$watch('$store.pipes.editTaskAssigneeIds', (val) => {
        this.assigneeIds = val || [];
      });
    },

    async submit() {
      if (!this.taskId || !this.canEdit) return;
      const title = this.title.trim();
      if (!title) return;
      await this.$api(`/lines/tasks/${this.taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, description: this.desc, due_date: this.due }),
      });
      Alpine.store('modals').closeModal('card-detail-modal');
      if (window.loadBoard) loadBoard();
    },

    async deleteTask() {
      if (!this.taskId) return;
      const ok = await Alpine.store('modals').confirm('Delete this task?', 'This cannot be undone.', 'Delete');
      if (!ok) return;
      await this.$api(`/lines/tasks/${this.taskId}`, { method: 'DELETE' });
      Alpine.store('modals').closeModal('card-detail-modal');
      if (window.closeCommentsPanel) closeCommentsPanel();
      if (window.loadBoard) loadBoard();
    },
  }))

  Alpine.data('newBoardModal', () => ({
    name: '',
    stages: [],
    stageInput: '',
    memberSearch: '',
    members: [],

    get stageText() {
      return this.stages.join('\n');
    },

    get searchResults() {
      const term = this.memberSearch.trim().toLowerCase();
      if (!term) return [];
      const memberIds = this.members.map(m => m.id);
      const users = Alpine.store('pipes').users || [];
      return users.filter(u =>
        !memberIds.includes(u.id) &&
        (u.display_name?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term))
      );
    },

    addStage(stage) {
      if (stage && !this.stages.includes(stage)) {
        this.stages.push(stage);
      }
    },

    removeStage(index) {
      this.stages.splice(index, 1);
    },

    addMember(user) {
      if (!this.members.find(m => m.id === user.id)) {
        this.members.push(user);
        this.memberSearch = '';
      }
    },

    removeMember(user) {
      this.members = this.members.filter(m => m.id !== user.id);
    },

    async submit() {
      const name = this.name.trim();
      if (!name) return;
      const board = await this.$api('/lines/boards', {
        method: 'POST',
        body: JSON.stringify({ name, stages: this.stageText, created_by: Alpine.store('pipes').user?.id }),
      });
      for (const m of this.members) {
        if (m.id != Alpine.store('pipes').user?.id) {
          await this.$api('/lines/boards/members', {
            method: 'POST', body: JSON.stringify({ board_id: board.id, user_id: m.id }),
          });
        }
      }
      Alpine.store('modals').closeModal('board-modal');
      this.name = '';
      this.stages = [];
      this.members = [];
      Alpine.store('pipes').activeBoard = board.id;
      if (window.loadBoard) loadBoard();
    },
  }))

  Alpine.data('createFolderModal', () => ({
    name: '',

    init() {
      this.$nextTick(() => {
        document.getElementById('cf-name')?.focus();
      });
    },

    async submit() {
      const name = this.name.trim();
      if (!name) return;
      const parent = Alpine.store('pipes').activeFolderId || null;
      await this.$api('/lines/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parent }),
      });
      Alpine.store('modals').closeModal('create-folder-modal');
      this.name = '';
      if (window.loadFilesPage) loadFilesPage();
    },
  }))

  Alpine.data('manageBoardModal', () => ({
    boardName: '',
    boardId: null,
    descriptionTemplate: '',
    members: [],
    columns: [],
    stageInput: '',
    memberSearch: '',
    searchTimeout: null,

    init() {
      this.$nextTick(() => {
        this._populate();
      });
    },

    _populate() {
      const store = Alpine.store('pipes');
      const board = (store.boards || []).find(b => b.id == store.activeBoard);
      if (!board) return;
      this.boardName = board.name || '';
      this.boardId = board.id;
      this.descriptionTemplate = board.description_template || '';
      this.members = store.boardMembers || [];
      this.columns = store.columns || [];
    },

    get searchResults() {
      const term = this.memberSearch.trim().toLowerCase();
      if (!term) return [];
      const memberIds = this.members.map(m => m.id);
      const users = Alpine.store('pipes').users || [];
      return users.filter(u =>
        !memberIds.includes(u.id) &&
        (u.display_name?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term))
      );
    },

    async renameBoard() {
      const name = this.boardName.trim();
      if (!this.boardId || !name) return;
      await this.$api(`/lines/boards/${this.boardId}`, {
        method: 'PUT', body: JSON.stringify({ name }),
      });
      if (window.loadBoard) loadBoard();
    },

    async addStage() {
      const name = this.stageInput.trim();
      if (!name || !this.boardId) return;
      const col = await this.$api(`/lines/boards/${this.boardId}/columns`, {
        method: 'POST', body: JSON.stringify({ name }),
      });
      this.columns.push(col);
      this.stageInput = '';
      if (window.loadBoard) loadBoard();
    },

    async removeStage(col) {
      if (!this.boardId) return;
      await this.$api(`/lines/boards/${this.boardId}/columns/${col.id}`, { method: 'DELETE' });
      this.columns = this.columns.filter(c => c.id !== col.id);
      if (window.loadBoard) loadBoard();
    },

    async addMember(user) {
      if (!this.boardId || this.members.find(m => m.id === user.id)) return;
      await this.$api('/lines/boards/members', {
        method: 'POST', body: JSON.stringify({ board_id: this.boardId, user_id: user.id }),
      });
      this.members.push(user);
      this.memberSearch = '';
    },

    async removeMember(member) {
      if (!this.boardId) return;
      await this.$api('/lines/boards/members', {
        method: 'DELETE', body: JSON.stringify({ board_id: this.boardId, user_id: member.id }),
      });
      this.members = this.members.filter(m => m.id !== member.id);
    },

    async deleteBoard() {
      if (!this.boardId) return;
      const ok = await Alpine.store('modals').confirm('Delete this board and all its tasks?', 'This cannot be undone.', 'Delete');
      if (!ok) return;
      await this.$api(`/lines/boards/${this.boardId}`, { method: 'DELETE' });
      Alpine.store('modals').closeModal('manage-board-modal');
      if (window.loadBoard) loadBoard();
    },

    async done() {
      if (this.boardId) {
        const name = this.boardName.trim();
        if (name) {
          await this.$api(`/lines/boards/${this.boardId}`, {
            method: 'PUT', body: JSON.stringify({ name, description_template: this.descriptionTemplate }),
          });
        }
      }
      Alpine.store('modals').closeModal('manage-board-modal');
      if (window.loadBoard) loadBoard();
    },
  }))

  Alpine.data('todoEditModal', () => ({
    todoId: null,
    name: '',
    notes: '',
    todoFiles: [],
    _pendingUpload: null,

    get token() {
      return Alpine.store('pipes').token;
    },

    init() {
      this.$watch('$store.pipes.openTodoId', async (id) => {
        if (!id) return;
        this.todoId = id;
        const todo = (Alpine.store('pipes').todos || []).find(t => t.id === id);
        if (todo) {
          this.name = todo.name || '';
          this.notes = todo.notes || '';
        }
        try {
          const taskId = Alpine.store('pipes').selectedTask?.id;
          if (taskId) {
            const files = await this.$api('/files?task_id=' + taskId + '&todo_id=' + id);
            this.todoFiles = Array.isArray(files) ? files : [];
          }
        } catch { this.todoFiles = []; }
        this._pendingUpload = null;
      });
    },

    async save() {
      if (!this.todoId || !this.name.trim()) return;
      await this.$api('/lines/todos/' + this.todoId, {
        method: 'PUT',
        body: JSON.stringify({ name: this.name.trim(), notes: this.notes.trim() }),
      });
      Alpine.store('modals').closeModal('todo-edit-modal');
      Alpine.store('pipes').openTodoId = null;
    },

    async deleteTodo() {
      if (!this.todoId) return;
      const ok = await Alpine.store('modals').confirm('Delete this checklist item?', 'Delete');
      if (!ok) return;
      await this.$api('/lines/todos/' + this.todoId, { method: 'DELETE' });
      Alpine.store('modals').closeModal('todo-edit-modal');
      Alpine.store('pipes').openTodoId = null;
    },

    onTodoFileSelected(e) {
      this._pendingUpload = e.target.files[0] || null;
    },

    async uploadTodoFile() {
      if (!this._pendingUpload || !this.todoId) return;
      const taskId = Alpine.store('pipes').selectedTask?.id;
      const form = new FormData();
      form.append('file', this._pendingUpload);
      form.append('task_id', taskId);
      form.append('todo_id', this.todoId);
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + this.token },
        body: form,
      });
      this._pendingUpload = null;
      if (taskId) {
        const files = await this.$api('/files?task_id=' + taskId + '&todo_id=' + this.todoId);
        this.todoFiles = Array.isArray(files) ? files : [];
      }
    },

    async deleteTodoFile(fileId) {
      if (!(await Alpine.store('modals').confirm('Delete this file?', 'Delete'))) return;
      await fetch('/api/files/' + fileId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + this.token },
      });
      this.todoFiles = this.todoFiles.filter(f => f.id !== fileId);
    },
  }))

  Alpine.data('filePreviewModal', () => ({
    file: null,
    transform: '',
    _scale: 1,
    _rotation: 0,

    get token() {
      return Alpine.store('pipes').token;
    },

    get imgSrc() {
      return this.file ? '/api/files/' + this.file.id + '/download?token=' + this.token : '';
    },

    get canDelete() {
      if (!this.file) return false;
      const user = Alpine.store('pipes').user;
      if (user?.role === 'admin') return true;
      if (this.file.user_id == user?.id) return true;
      const task = Alpine.store('pipes').selectedTask;
      if (task && task.created_by == user?.id) return true;
      return false;
    },

    open(fileOrId) {
      this._scale = 1;
      this._rotation = 0;
      this.transform = '';
      if (typeof fileOrId === 'object' && fileOrId !== null) {
        this.file = fileOrId;
      } else {
        const files = Alpine.store('pipes').filesItems || [];
        const cfs = Alpine.store('pipes').comments ? (Alpine.store('pipes').comments.flatMap ? Alpine.store('pipes').comments.flatMap(c => c.files || []) : []) : [];
        this.file = files.find(f => f.id == fileOrId) || cfs.find(f => f.id == fileOrId) || { id: fileOrId, mime_type: '', original_name: 'File' };
      }
      Alpine.store('modals').openModal('file-preview-modal');
    },

    closePreview() {
      this.file = null;
      this.transform = '';
      this._scale = 1;
      this._rotation = 0;
    },

    zoomIn() { this._scale = Math.min(this._scale + 0.25, 3); this._updateTransform(); },
    zoomOut() { this._scale = Math.max(this._scale - 0.25, 0.25); this._updateTransform(); },
    rotate() { this._rotation = (this._rotation + 90) % 360; this._updateTransform(); },
    _updateTransform() {
      this.transform = `scale(${this._scale}) rotate(${this._rotation}deg)`;
    },

    async deleteFile() {
      if (!this.file) return;
      const ok = await Alpine.store('modals').confirm('Delete this file?', 'Delete');
      if (!ok) return;
      await fetch('/api/files/' + this.file.id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + this.token },
      });
      Alpine.store('modals').closeModal('file-preview-modal');
      this.closePreview();
    },

    share() {
      if (window.openShareModal) openShareModal(this.file?.id);
    },
  }))
}
