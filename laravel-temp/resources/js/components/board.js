const COLORS = ['#0B2D52', '#FF8A00', '#1e40af', '#9333EA', '#0891B2', '#059669', '#DC2626', '#D97706'];

function dueDateStatus(date) {
  if (!date) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 2) return 'soon';
  return '';
}

export default function (Alpine) {
  Alpine.data('board', () => ({
    activeTaskEdit: null,

    get boards() {
      return Alpine.store('pipes').boards;
    },
    get columns() {
      return Alpine.store('pipes').columns;
    },
    get activeBoard() {
      return Alpine.store('pipes').activeBoard;
    },
    get user() {
      return Alpine.store('pipes').user;
    },
    get isAdmin() {
      return Alpine.store('pipes').isAdmin;
    },
    get selectedTask() {
      return Alpine.store('pipes').selectedTask;
    },
    get lastColumnId() {
      const cols = this.columns;
      return cols.length ? cols[cols.length - 1].id : null;
    },

    switchBoard(id) {
      const p = Alpine.store('pipes');
      p.activeBoard = id;
      if (window.loadBoard) loadBoard();
    },

    openNewBoard() {
      Alpine.store('modals').openModal('new-board-modal');
    },

    openManageBoard() {
      Alpine.store('modals').openModal('manage-board-modal');
    },

    initSortable(el) {
      if (!el) return;
      this.$nextTick(() => {
        if (window.Sortable) {
          Sortable.create(el, {
            group: 'board-columns',
            handle: '.card',
            onEnd: async (evt) => {
              const taskId = parseInt(evt.item.dataset.taskId);
              const newColId = parseInt(evt.to.dataset.columnId);
              const pos = evt.newIndex;
              await this.$api(`/lines/tasks/${taskId}/move`, {
                method: 'PUT',
                body: JSON.stringify({ column_id: newColId, position: pos }),
              });
              if (window.loadBoard) loadBoard();
            },
          });
        }
      });
    },

    selectTask(taskId) {
      if (window.selectTask) selectTask(taskId);
    },

    editTask(taskId) {
      if (window.openCardDetail) openCardDetail(taskId);
    },

    archiveTask(taskId) {
      if (confirm('Archive this task?')) {
        this.$api(`/lines/tasks/${taskId}/archive`, { method: 'PUT' }).then(() => {
          if (window.loadBoard) loadBoard();
        });
      }
    },

    addTask(columnId) {
      if (window.openNewTaskModal) openNewTaskModal(columnId);
    },

    canEdit(task) {
      if (!this.user) return false;
      return this.isAdmin || task.created_by === this.user.id;
    },

    isFinalCol(colId) {
      return colId === this.lastColumnId;
    },

    getDueStatus(date) {
      return dueDateStatus(date);
    },

    assigneeColor(id) {
      return COLORS[(id || 0) % COLORS.length];
    },

    fileImgSrc(thumbId) {
      if (!thumbId) return '';
      return `/api/files/${thumbId}/download?token=${Alpine.store('pipes').token}`;
    },

    esc(str) {
      if (!str) return '';
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    },
  }))
}
