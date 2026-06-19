async function loadNotifications() {
  const notifications = await api('/notifications');
  if (!Array.isArray(notifications)) return;
  state.notifications = notifications;
  if (window.Alpine) Alpine.store('pipes').notifications = notifications;

  const notifWrap = document.getElementById('notif-wrap');
  if (notifWrap?.hasAttribute('x-data')) return;

  const unread = notifications.filter(n => !n.is_read).length;
  const badge = document.getElementById('notif-badge');
  if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.style.display = ''; }
  else badge.style.display = 'none';
  const list = document.getElementById('notif-dd-list');
  if (!notifications.length) {
    list.innerHTML = '<div class="notif-empty">No notifications</div>';
    return;
  }
  list.innerHTML = notifications.map(n => {
    const time = new Date(n.created_at + 'Z').toLocaleString();
    return '<div class="notif-item' + (n.is_read ? '' : ' notif-unread') + '" data-nid="' + n.id + '" data-task="' + (n.task_id || '') + '">' +
      '<div class="notif-item-body">' +
      '<div class="notif-item-text">' + esc(n.message) + '</div>' +
      '<div class="notif-item-time">' + time + '</div>' +
      '</div>' +
      '</div>';
  }).join('');
  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async () => {
      const nid = parseInt(el.dataset.nid);
      const taskId = el.dataset.task;
      if (el.classList.contains('notif-unread')) {
        await api('/notifications/' + nid + '/read', { method: 'POST' });
      }
      if (taskId) { document.getElementById('notif-dd').style.display = 'none'; state.notifOpen = false; selectTask(parseInt(taskId)); }
      loadNotifications();
    });
  });
}

async function checkDueDates() {
  const result = await api('/notifications/check-due-dates', { method: 'POST' });
  if (result && Array.isArray(result) && result.length) {
    loadNotifications();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('task-modal')?.hasAttribute('x-data')) {
    document.getElementById('new-task-title')?.addEventListener('keydown', (e) => {
      if (e.key == 'Enter') document.getElementById('confirm-task-btn').click();
    });
  }
  if (!document.getElementById('board-modal')?.hasAttribute('x-data')) {
    document.getElementById('new-board-name')?.addEventListener('keydown', (e) => {
      if (e.key == 'Enter') document.getElementById('confirm-board-btn').click();
    });
  }
  if (!document.getElementById('file-preview-modal')?.hasAttribute('x-data')) {
    document.getElementById('file-preview-delete')?.addEventListener('click', async () => {
      if (!_previewFileId) return;
      if (!(await showConfirm('Delete this file?', 'Delete'))) return;
      await api('/files/' + _previewFileId, { method: 'DELETE' });
      closeModal('file-preview-modal');
      if (state.selectedTask) loadTaskFiles();
    });
  }
});
