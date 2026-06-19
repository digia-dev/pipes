async function loadBoard() {
  const data = await api('/lines/boards' + (state.activeBoard ? '?board_id=' + state.activeBoard : ''));
  state.boards = data.boards || [];
  state.columns = data.columns || [];
  state.boardMembers = data.members || [];
  if (data.user) state.user = data.user;
  if (!state.activeBoard && state.boards.length) {
    state.activeBoard = state.boards[0].id;
  }
  if (!state.lastColumnId && state.columns.length) {
    state.lastColumnId = state.columns[state.columns.length - 1]?.id;
  }
  if (window.Alpine) {
    const p = Alpine.store('pipes');
    p.boards = state.boards;
    p.columns = state.columns;
    p.boardMembers = state.boardMembers;
    p.activeBoard = state.activeBoard;
    p.lastColumnId = state.lastColumnId;
  }
  lucide.createIcons();
}



function renderNewTaskAssigneePills() {
  if (document.getElementById('task-modal')?.hasAttribute('x-data')) return;
  const container = document.getElementById('nt-assignee-pills');
  const ids = state.newTaskAssigneeIds || [];
  container.innerHTML = ids.map(uid => {
    const u = state.boardMembers.find(m => m.id == uid) || state.users.find(m => m.id == uid);
    if (!u) return '';
    return `<span class="mb-pill" data-uid="${u.id}">${esc(u.display_name)}<span class="mb-pill-remove" data-uid="${u.id}">&times;</span></span>`;
  }).join('');
  container.querySelectorAll('.mb-pill-remove').forEach(el => {
    el.addEventListener('click', () => {
      const uid = parseInt(el.dataset.uid);
      state.newTaskAssigneeIds = state.newTaskAssigneeIds.filter(id => id !== uid);
      renderNewTaskAssigneePills();
    });
  });
}

function renderEditAssigneePills() {
  if (document.getElementById('card-detail-modal')?.hasAttribute('x-data')) return;
  const container = document.getElementById('edit-assignee-pills');
  const ids = state.editTaskAssigneeIds || [];
  container.innerHTML = ids.map(uid => {
    const u = state.boardMembers.find(m => m.id == uid) || state.users.find(m => m.id == uid);
    if (!u) return '';
    return `<span class="mb-pill" data-uid="${u.id}">${esc(u.display_name)}<span class="mb-pill-remove" data-uid="${u.id}">&times;</span></span>`;
  }).join('');
  container.querySelectorAll('.mb-pill-remove').forEach(el => {
    el.addEventListener('click', () => {
      const uid = parseInt(el.dataset.uid);
      state.editTaskAssigneeIds = state.editTaskAssigneeIds.filter(id => id !== uid);
      renderEditAssigneePills();
    });
  });
}

function openNewTaskModal(columnId) {
  state.lastColumnId = columnId;
  const board = state.boards.find(b => b.id == state.activeBoard);
  const desc = board?.description_template || '';
  document.getElementById('new-task-title').value = '';
  document.getElementById('new-task-desc').value = desc;
  document.getElementById('new-task-due').value = '';
  state.newTaskAssigneeIds = [];
  renderNewTaskAssigneePills();
  document.getElementById('nt-assignee-search').value = '';
  document.getElementById('nt-assignee-dd').style.display = 'none';
  if (typeof Alpine !== 'undefined') {
    Alpine.store('pipes').lastColumnId = columnId;
    Alpine.store('pipes').newTaskAssigneeIds = [];
    const modal = document.getElementById('task-modal');
    if (modal.__x) {
      modal.__x.$data.title = '';
      modal.__x.$data.desc = desc;
      modal.__x.$data.due = '';
      modal.__x.$data.assigneeIds = [];
    }
  }
  openModal('task-modal');
}

async function selectTask(taskId) {
  pendingUpload = null;
  document.getElementById('cp-upload-preview').style.display = 'none';
  document.getElementById('cp-file-input').value = '';
  const task = await api(`/lines/tasks/${taskId}`);
  state.selectedTask = task;
  document.querySelectorAll('.card').forEach(el => el.classList.toggle('active', parseInt(el.dataset.taskId) == taskId));

  if (window.Alpine) {
    Alpine.store('pipes').selectedTask = task;
  }

  await loadTaskFiles();

  const comments = await api(`/lines/comments?task_id=${taskId}`);
  if (window.Alpine) Alpine.store('pipes').comments = comments;

  const inp = document.getElementById('cp-input');
  const cpPanel = document.getElementById('comments-panel');
  const useAlpineInp = cpPanel?.hasAttribute('x-data');
  inp.value = '';
  inp.style.height = 'auto';
  if (!useAlpineInp) {
    inp.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(taskId); }
    };
    inp.oninput = function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; };
    document.getElementById('cp-send').onclick = () => postComment(taskId);
  }
  if (!cpPanel?.hasAttribute('x-data')) setupMentions(inp);
  else { document.getElementById('mention-dd').style.display = 'none'; }

  setupFileUpload(taskId);

  const todos = await api(`/lines/todos?task_id=${taskId}`);
  state.todos = todos;
  if (window.Alpine) Alpine.store('pipes').todos = todos;

  if (!document.getElementById('comments-panel')?.hasAttribute('x-data')) {
    document.getElementById('cp-close').onclick = closeCommentsPanel;
    document.getElementById('cp-title').ondblclick = () => openCardDetail(taskId);
  }
}

function renderComments(comments) {
  const container = document.getElementById('cp-messages');
  const cpPanel = document.getElementById('comments-panel');
  if (!container || cpPanel?.hasAttribute('x-data')) return;
  comments = [...comments].reverse();
  if (comments.length === 0) {
    container.innerHTML = '<div class="cp-empty-msg" style="text-align:center;color:var(--gray-400);font-size:13px;padding:20px">No comments yet</div>';
    return;
  }
  const colors = ['#0B2D52', '#FF8A00', '#1e40af', '#9333EA', '#0891B2', '#059669', '#DC2626', '#D97706'];
  const parents = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);
  const repCounts = {};
  replies.forEach(r => { repCounts[r.parent_id] = (repCounts[r.parent_id] || 0) + 1; });
  container.innerHTML = parents.map(p => {
    const user = state.users.find(u => u.id == p.user_id);
    const time = new Date(p.created_at + 'Z').toLocaleString();
    let content = esc(p.content);
    content = content.replace(/@(\w+)/g, '<span class="mention-user">@$1</span>');
    content = content.replace(/#(\w+)/g, '<span class="mention-todo" data-todo="$1">#$1</span>');
    const canEdit = state.user?.role === 'admin' || p.user_id == state.user?.id;
    const reps = replies.filter(r => r.parent_id == p.id);
    return '<div class="cp-msg" data-cid="' + p.id + '">' +
      '<div class="cp-msg-avatar" style="background:' + (user ? colors[user.id % colors.length] : '#999') + '">' + (user ? user.display_name.charAt(0).toUpperCase() : '?') + '</div>' +
      '<div class="cp-msg-body">' +
      '<div class="cp-msg-header">' +
      '<span class="cp-msg-author">' + esc(user ? user.display_name : 'Unknown') + '</span>' +
      '<span class="cp-msg-time">' + time + '</span>' +
      (canEdit ? '<span class="cp-msg-actions"><span class="cp-msg-edit" data-cid="' + p.id + '"><i data-lucide="pencil" size="1"></i></span><span class="cp-msg-del" data-cid="' + p.id + '"><i data-lucide="trash-2" size="1"></i></span></span>' : '') +
      '</div>' +
      '<div class="cp-msg-content">' + content + '</div>' +
      '<div class="cp-msg-files" id="msg-files-' + p.id + '"></div>' +
      '<span class="cp-msg-reply" data-cid="' + p.id + '">' + (repCounts[p.id] ? 'Reply (' + repCounts[p.id] + ')' : 'Reply') + '</span>' +
      '</div>' +
      '</div>' +
      reps.map(r => {
        const ru = state.users.find(u => u.id == r.user_id);
        const rt = new Date(r.created_at + 'Z').toLocaleString();
        let rc = esc(r.content);
        rc = rc.replace(/@(\w+)/g, '<span class="mention-user">@$1</span>');
        rc = rc.replace(/#(\w+)/g, '<span class="mention-todo" data-todo="$1">#$1</span>');
        const canEditReply = state.user?.role === 'admin' || r.user_id == state.user?.id;
        return '<div class="cp-msg cp-reply" data-cid="' + r.id + '">' +
          '<div class="cp-msg-avatar cp-reply-avatar" style="background:' + (ru ? colors[ru.id % colors.length] : '#999') + '">' + (ru ? ru.display_name.charAt(0).toUpperCase() : '?') + '</div>' +
          '<div class="cp-msg-body">' +
          '<div class="cp-msg-header">' +
          '<span class="cp-msg-author">' + esc(ru ? ru.display_name : 'Unknown') + '</span>' +
          '<span class="cp-msg-time">' + rt + '</span>' +
          (canEditReply ? '<span class="cp-msg-actions"><span class="cp-msg-edit" data-cid="' + r.id + '"><i data-lucide="pencil" size="1"></i></span><span class="cp-msg-del" data-cid="' + r.id + '"><i data-lucide="trash-2" size="1"></i></span></span>' : '') +
          '</div>' +
          '<div class="cp-msg-content">' + rc + '</div>' +
          '<div class="cp-msg-files" id="msg-files-' + r.id + '"></div>' +
          '</div>' +
          '</div>';
      }).join('') +
      '</div>';
  }).join('');
  container.querySelectorAll('.cp-msg-reply').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllReplyForms();
      const parentId = parseInt(el.dataset.cid);
      const parent = comments.find(c => c.id === parentId);
      if (!parent) return;
      const msgEl = el.closest('.cp-msg');
      const form = document.createElement('div');
      form.className = 'cp-reply-form';
      form.innerHTML =
        '<div class="cp-reply-to">Replying to @' + esc(parent.username) + '</div>' +
        '<div style="display:flex;gap:4px">' +
        '<input type="text" class="form-input cp-reply-input" placeholder="Reply..." style="flex:1;font-size:11px">' +
        '<label class="cp-reply-attach" title="Attach file"><i data-lucide="paperclip" size="10"></i><input type="file" class="cp-reply-file" hidden></label>' +
        '<button class="btn btn-primary btn-sm cp-reply-send">Send</button>' +
        '<button class="btn btn-sm btn-secondary cp-reply-cancel">Cancel</button>' +
        '</div>';
      msgEl.insertAdjacentElement('afterend', form);
      lucide.createIcons();
      const inp = form.querySelector('.cp-reply-input');
      inp.id = 'cp-reply-' + parentId;
      inp.focus();
      setupMentions(inp);
      const fileInput = form.querySelector('.cp-reply-file');
      let replyFile = null;
      fileInput.addEventListener('change', () => {
        replyFile = fileInput.files[0] || null;
      });
      form.querySelector('.cp-reply-send').addEventListener('click', async () => {
        const text = inp.value.trim();
        if (!text && !replyFile) return;
        let replyComment = null;
        if (text || replyFile) {
          replyComment = await api('/lines/comments', {
            method: 'POST',
            body: JSON.stringify({ task_id: state.selectedTask.id, user_id: state.user.id, content: text || '', parent_id: parentId }),
          });
        }
        if (replyFile && replyComment) {
          const fd = new FormData();
          fd.append('file', replyFile);
          fd.append('task_id', state.selectedTask.id);
          fd.append('comment_id', replyComment.id);
          await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + state.token },
            body: fd,
          });
        }
        form.remove();
        const comments = await api('/lines/comments?task_id=' + state.selectedTask.id);
        if (Array.isArray(comments)) renderComments(comments);
        comments.forEach(c => loadCommentFiles(c.id, c.task_id));
        updateTabCounts();
        await loadBoard();
      });
      form.querySelector('.cp-reply-cancel').addEventListener('click', () => form.remove());
      inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.defaultPrevented) { ev.preventDefault(); form.querySelector('.cp-reply-send').click(); }
      });
    });
  });
  container.querySelectorAll('.cp-msg-edit').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = parseInt(el.dataset.cid);
      const msgEl = el.closest('.cp-msg');
      const contentEl = msgEl.querySelector('.cp-msg-content');
      if (contentEl.querySelector('textarea')) return;
      const text = contentEl.innerText;
      contentEl.innerHTML = '<div style="display:flex;gap:6px"><textarea class="form-input cp-edit-input" style="flex:1;min-height:36px;resize:none">' + esc(text) + '</textarea><button class="btn btn-primary btn-sm cp-edit-save">Save</button><button class="btn btn-sm btn-secondary cp-edit-cancel">Cancel</button></div>';
      const ta = contentEl.querySelector('textarea');
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      contentEl.querySelector('.cp-edit-save').addEventListener('click', async () => {
        const val = ta.value.trim();
        if (!val) return;
        await api('/lines/comments/' + cid, { method: 'PUT', body: JSON.stringify({ content: val }) });
        const comments = await api('/lines/comments?task_id=' + state.selectedTask.id);
        if (Array.isArray(comments)) renderComments(comments);
        comments.forEach(c => loadCommentFiles(c.id, c.task_id));
        updateTabCounts();
        await loadBoard();
      });
      contentEl.querySelector('.cp-edit-cancel').addEventListener('click', async () => {
        const fresh = await api('/lines/comments?task_id=' + state.selectedTask.id);
        if (Array.isArray(fresh)) renderComments(fresh);
        fresh.forEach(c => loadCommentFiles(c.id, c.task_id));
      });
      ta.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); contentEl.querySelector('.cp-edit-save').click(); }
      });
    });
  });
  container.querySelectorAll('.cp-msg-del').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = parseInt(el.dataset.cid);
      showConfirm('Delete Comment?', 'This cannot be undone.', 'Delete').then(async (ok) => {
        if (!ok) return;
        await api('/lines/comments/' + cid, { method: 'DELETE' });
        const comments = await api('/lines/comments?task_id=' + state.selectedTask.id);
        if (Array.isArray(comments)) renderComments(comments);
        comments.forEach(c => loadCommentFiles(c.id, c.task_id));
        updateTabCounts();
        await loadBoard();
      });
    });
  });
  comments.forEach(c => loadCommentFiles(c.id, c.task_id));
  container.scrollTop = container.scrollHeight;
  updateTabCounts();
  lucide.createIcons();
}

function closeAllReplyForms() {
  document.querySelectorAll('.cp-reply-form').forEach(el => el.remove());
}

async function loadCommentFiles(commentId, taskId) {
  const container = document.getElementById(`msg-files-${commentId}`);
  if (!container) return;
  const files = await api(`/files?task_id=${taskId}&comment_id=${commentId}`);
  if (!Array.isArray(files) || !files.length) return;
  files.forEach(f => { if (!state.files.find(x => x.id == f.id)) state.files.push(f); });
  container.innerHTML = files.map(f => {
    const isImg = f.mime_type?.startsWith('image/');
    return `<a class="msg-file-attach" onclick="previewFile(${f.id})">
      ${isImg ? `<img src="/api/files/${f.id}/download?token=${state.token}">` : '<span class="file-icon"><i data-lucide="file" size="14"></i></span>'}
      ${esc(f.original_name)}
    </a>`;
  }).join('');
  lucide.createIcons();
}

function fileImgSrc(fid) {
  return '/api/files/' + fid + '/download?token=' + state.token;
}

async function loadTaskFiles() {
  if (!state.selectedTask || document.getElementById('comments-panel')?.hasAttribute('x-data')) return;
  const files = await api(`/files?task_id=${state.selectedTask.id}&comment_id=-1`);
  if (!Array.isArray(files)) return;
  files.forEach(f => { if (!state.files.find(x => x.id == f.id)) state.files.push(f); });
  const grid = document.getElementById('cp-files-grid');
  const section = document.getElementById('cp-recent-files');
  if (!files.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  grid.innerHTML = files.slice(0, 8).map(f => {
    const isImg = f.mime_type?.startsWith('image/');
    const canDelete = state.user?.role === 'admin' || f.user_id == state.user?.id;
    return `<div class="file-thumb" title="${esc(f.original_name)}">
      ${canDelete ? `<span class="file-thumb-del" data-fid="${f.id}">&times;</span>` : ''}
      <div onclick="previewFile(${f.id})">
        ${isImg ? `<img src="${fileImgSrc(f.id)}">` : '<span class="file-icon"><i data-lucide="file" size="20"></i></span>'}
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.file-thumb-del').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await showConfirm('Delete this file?', 'Delete'))) return;
      await api(`/files/${parseInt(el.dataset.fid)}`, { method: 'DELETE' });
      state.files = state.files.filter(f => f.id != parseInt(el.dataset.fid));
      await loadTaskFiles();
    });
  });
  lucide.createIcons();
}

let _previewFileId = null;
async function previewFile(fileId) {
  const fpModal = document.getElementById('file-preview-modal');
  if (fpModal?.hasAttribute('x-data')) {
    const el = Alpine.raw(fpModal);
    if (el?.__x) {
      const data = el.__x.$data;
      let f = (state.files || []).find(x => x.id == fileId);
      if (!f) {
        try {
          const res = await fetch('/api/files/' + fileId + '/download', { headers: { 'Authorization': 'Bearer ' + state.token } });
          if (res.ok) {
            const ct = res.headers.get('Content-Type');
            f = { id: fileId, original_name: 'File', mime_type: ct, filename: '' };
          }
        } catch {}
        if (!f) f = { id: fileId, original_name: 'File', mime_type: '' };
      }
      data.file = f;
      data._scale = 1; data._rotation = 0; data.transform = '';
      openModal('file-preview-modal');
      return;
    }
  }
  _previewFileId = fileId;
  let f = state.files.find(x => x.id == fileId);
  if (!f) {
    const res = await fetch('/api/files/' + fileId + '/download', {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    if (!res.ok) return;
    const ct = res.headers.get('Content-Type');
    f = { id: fileId, original_name: 'File', mime_type: ct, filename: '' };
  }
  const url = fileImgSrc(fileId);
  document.getElementById('file-preview-name').textContent = f.original_name;
  document.getElementById('file-preview-filename').textContent = f.original_name;
  document.getElementById('file-preview-download').href = url;
  const isImg = f.mime_type?.startsWith('image/');
  document.getElementById('file-preview-img').style.display = isImg ? '' : 'none';
  document.getElementById('file-preview-img').src = isImg ? url : '';
  document.getElementById('file-preview-other').style.display = isImg ? 'none' : '';
  const delBtn = document.getElementById('file-preview-delete');
  const task = state.selectedTask;
  const canDelete = state.user?.role === 'admin' || f.user_id == state.user?.id || (task && task.created_by == state.user?.id);
  delBtn.style.display = canDelete ? '' : 'none';
  openModal('file-preview-modal');
}

let pendingUpload = null;
function setupFileUpload(taskId) {
  const cpPanel = document.getElementById('comments-panel');
  if (cpPanel?.hasAttribute('x-data')) {
    const fileInput = document.getElementById('cp-file-input');
    const cameraInput = document.getElementById('cp-camera-input');
    const preview = document.getElementById('cp-upload-preview');
    if (fileInput) fileInput.onchange = null;
    if (cameraInput) cameraInput.onchange = null;
    if (preview) preview.style.display = 'none';
    return;
  }
  const fileInput = document.getElementById('cp-file-input');
  const cameraInput = document.getElementById('cp-camera-input');
  const preview = document.getElementById('cp-upload-preview');
  const pickerBtn = document.getElementById('cp-file-picker-btn');
  const picker = document.getElementById('cp-file-picker');

  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    pendingUpload = { file, taskId };
    preview.style.display = 'flex';
    preview.innerHTML = `
      <span class="up-name">${esc(file.name)}</span>
      <span class="up-remove" id="up-remove"><i data-lucide="x" size="14"></i></span>
    `;
    document.getElementById('up-remove').onclick = () => { pendingUpload = null; preview.style.display = 'none'; fileInput.value = ''; };
    lucide.createIcons();
    picker.style.display = 'none';
  };

  cameraInput.onchange = () => {
    const file = cameraInput.files[0];
    if (!file) return;
    pendingUpload = { file, taskId };
    preview.style.display = 'flex';
    preview.innerHTML = `
      <span class="up-name">${esc(file.name)}</span>
      <span class="up-remove" id="up-remove"><i data-lucide="x" size="14"></i></span>
    `;
    document.getElementById('up-remove').onclick = () => { pendingUpload = null; preview.style.display = 'none'; cameraInput.value = ''; };
    lucide.createIcons();
    picker.style.display = 'none';
  };

  pickerBtn.onclick = (e) => {
    e.stopPropagation();
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
  };

  picker.querySelectorAll('.cp-fp-option').forEach(opt => {
    opt.onclick = () => {
      const action = opt.dataset.action;
      picker.style.display = 'none';
      if (action === 'upload') {
        fileInput.click();
      } else if (action === 'camera') {
        cameraInput.click();
      } else if (action === 'files') {
        openPickFilesModal(taskId);
      }
    };
  });

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target) && e.target !== pickerBtn && !pickerBtn.contains(e.target)) {
      picker.style.display = 'none';
    }
  }, { once: false });
}

function openPickFilesModal(taskId) {
  const modal = document.getElementById('pick-files-modal');
  const list = document.getElementById('pf-list');
  const search = document.getElementById('pf-search');

  async function loadTasks(q) {
    const url = q ? `/files/tasks?q=${encodeURIComponent(q)}` : '/files/tasks';
    const tasks = await api(url);
    if (!tasks.length) {
      list.innerHTML = '<div class="pf-empty">No archived tasks found</div>';
      return;
    }
    list.innerHTML = tasks.slice(0, 30).map(t => {
      const thumbId = t.thumb_file_id;
      return `
        <div class="pf-item" data-task-id="${t.id}">
          <div class="pf-icon">
            ${thumbId ? `<img src="${fileImgSrc(thumbId)}">` : `<i data-lucide="file-text" size="16"></i>`}
          </div>
          <div class="pf-info">
            <div class="pf-title">${esc(t.title)}</div>
            <div class="pf-meta">${esc(t.board_name || '')}</div>
          </div>
        </div>
      `;
    }).join('');
    list.querySelectorAll('.pf-item').forEach(el => {
      el.addEventListener('click', () => {
        const tid = el.dataset.taskId;
        const inp = document.getElementById('cp-input');
        inp.value += ` [ref:task-${tid}] `;
        closeModal('pick-files-modal');
      });
    });
    lucide.createIcons();
  }

  search.value = '';
  search.oninput = () => {
    clearTimeout(search._t);
    search._t = setTimeout(() => loadTasks(search.value.trim()), 200);
  };

  loadTasks('');
  openModal('pick-files-modal');
}

async function uploadFile(taskId) {
  if (!pendingUpload) return;
  const form = new FormData();
  form.append('file', pendingUpload.file);
  form.append('task_id', taskId);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + state.token },
    body: form,
  });
  const file = await res.json();
  state.files.push(file);
  pendingUpload = null;
  document.getElementById('cp-file-input').value = '';
  document.getElementById('cp-camera-input').value = '';
  document.getElementById('cp-upload-preview').style.display = 'none';
}

async function postComment(taskId) {
  const cpPanel = document.getElementById('comments-panel');
  if (cpPanel?.hasAttribute('x-data')) return;
  const inp = document.getElementById('cp-input');
  const content = inp.value.trim();
  if (!content && !pendingUpload) return;

  if (!content && pendingUpload) {
    await uploadFile(taskId);
    return;
  }

  const comment = await api('/lines/comments', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId, user_id: state.user.id, content }),
  });

  if (pendingUpload) {
    await uploadFileWithComment(taskId, comment.id);
  }

  inp.value = '';
  inp.style.height = 'auto';
  const container = document.getElementById('cp-messages');
  const empty = container.querySelector('.cp-empty-msg');
  if (empty) empty.remove();
  const colors = ['#0B2D52', '#FF8A00', '#1e40af', '#9333EA', '#0891B2', '#059669', '#DC2626', '#D97706'];
  const user = state.user;
  const time = new Date().toLocaleString();
  let text = esc(comment.content || content);
  text = text.replace(/@(\w+)/g, '<span class="mention-user">@$1</span>');
  text = text.replace(/#(\w+)/g, '<span class="mention-todo" data-todo="$1">#$1</span>');
  container.insertAdjacentHTML('beforeend', `
    <div class="cp-msg" data-cid="${comment.id}">
      <div class="cp-msg-avatar" style="background:${user ? colors[user.id % colors.length] : '#999'}">${user ? user.display_name.charAt(0).toUpperCase() : '?'}</div>
      <div class="cp-msg-body">
        <div class="cp-msg-header">
          <span class="cp-msg-author">${esc(user ? user.display_name : 'You')}</span>
          <span class="cp-msg-time">${time}</span>
          <span class="cp-msg-actions"><span class="cp-msg-edit" data-cid="${comment.id}"><i data-lucide="pencil" size="1"></i></span><span class="cp-msg-del" data-cid="${comment.id}"><i data-lucide="trash-2" size="1"></i></span></span>
        </div>
        <div class="cp-msg-content">${text}</div>
        <div class="cp-msg-files" id="msg-files-${comment.id}"></div>
      </div>
    </div>
  `);
  const newMsg = container.querySelector(`[data-cid="${comment.id}"]`);
  if (newMsg) {
    newMsg.querySelector('.cp-msg-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = comment.id;
      const contentEl = newMsg.querySelector('.cp-msg-content');
      if (contentEl.querySelector('textarea')) return;
      const text = contentEl.innerText;
      contentEl.innerHTML = '<div style="display:flex;gap:6px"><textarea class="form-input cp-edit-input" style="flex:1;min-height:36px;resize:none">' + esc(text) + '</textarea><button class="btn btn-primary btn-sm cp-edit-save">Save</button><button class="btn btn-sm btn-secondary cp-edit-cancel">Cancel</button></div>';
      const ta = contentEl.querySelector('textarea');
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      contentEl.querySelector('.cp-edit-save').addEventListener('click', async () => {
        const val = ta.value.trim();
        if (!val) return;
        await api('/lines/comments/' + cid, { method: 'PUT', body: JSON.stringify({ content: val }) });
        const comments = await api('/lines/comments?task_id=' + taskId);
        if (Array.isArray(comments)) renderComments(comments);
        comments.forEach(c => loadCommentFiles(c.id, c.task_id));
        updateTabCounts();
        await loadBoard();
      });
      contentEl.querySelector('.cp-edit-cancel').addEventListener('click', async () => {
        const comments = await api('/lines/comments?task_id=' + taskId);
        if (Array.isArray(comments)) renderComments(comments);
      });
      ta.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); contentEl.querySelector('.cp-edit-save').click(); }
      });
    });
    newMsg.querySelector('.cp-msg-del').addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm('Delete Comment?', 'This cannot be undone.', 'Delete').then(async (ok) => {
        if (!ok) return;
        await api('/lines/comments/' + comment.id, { method: 'DELETE' });
        const comments = await api('/lines/comments?task_id=' + taskId);
        if (Array.isArray(comments)) renderComments(comments);
        comments.forEach(c => loadCommentFiles(c.id, c.task_id));
        updateTabCounts();
        await loadBoard();
      });
    });
  }
  setTimeout(async () => {
    const files = await api(`/files?task_id=${taskId}&comment_id=${comment.id}`);
    const fc = document.getElementById(`msg-files-${comment.id}`);
    if (fc && Array.isArray(files) && files.length) {
      files.forEach(f => state.files.push(f));
      fc.innerHTML = files.map(f => {
        const isImg = f.mime_type?.startsWith('image/');
        return `<a class="msg-file-attach" onclick="previewFile(${f.id})">
          ${isImg ? `<img src="${fileImgSrc(f.id)}">` : '<span class="file-icon"><i data-lucide="file" size="14"></i></span>'}
          ${esc(f.original_name)}
        </a>`;
      }).join('');
  if (window.lucide) lucide.createIcons();
}
  }, 300);
  container.scrollTop = container.scrollHeight;
  await loadBoard();
}

async function uploadFileWithComment(taskId, commentId) {
  if (!pendingUpload) return;
  const form = new FormData();
  form.append('file', pendingUpload.file);
  form.append('task_id', taskId);
  form.append('comment_id', commentId);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + state.token },
    body: form,
  });
  const file = await res.json();
  state.files.push(file);
  pendingUpload = null;
  document.getElementById('cp-file-input').value = '';
  document.getElementById('cp-upload-preview').style.display = 'none';
  await loadTaskFiles();
}

function closeCommentsPanel() {
  state.selectedTask = null;
  if (window.Alpine) {
    Alpine.store('pipes').selectedTask = null;
    Alpine.store('pipes').comments = [];
    Alpine.store('pipes').todos = [];
    Alpine.store('pipes').commentsTab = 'comments';
  }
  document.querySelectorAll('.card').forEach(el => el.classList.remove('active'));
  if (!document.getElementById('comments-panel')?.hasAttribute('x-data')) {
    document.getElementById('cp-input-area').classList.remove('visible');
    document.getElementById('cp-body').style.display = '';
    document.getElementById('cp-title').textContent = 'Select a task';
    document.getElementById('cp-sub').textContent = 'Click a card to view details';
    document.getElementById('cp-upload-preview').style.display = 'none';
  }
}

async function openCardDetail(taskId) {
  let t = state.selectedTask;
  if (!t || t.id != taskId) {
    t = await api(`/lines/tasks/${taskId}`);
    if (!t || t.error) return;
  }
  const canEdit = state.user?.role === 'admin' || t.created_by == state.user?.id;
  if (document.getElementById('card-detail-modal').hasAttribute('x-data')) {
    const alpineEl = document.getElementById('card-detail-modal');
    if (alpineEl.__x) {
      const assigneeIds = (t.assignees || []).map(a => a.id);
      if (!assigneeIds.length && t.assignee_id) assigneeIds.push(t.assignee_id);
      alpineEl.__x.$data.title = t.title;
      alpineEl.__x.$data.desc = t.description || '';
      alpineEl.__x.$data.due = t.due_date || '';
      alpineEl.__x.$data.taskId = taskId;
      alpineEl.__x.$data.canEdit = canEdit;
      alpineEl.__x.$data.assigneeIds = assigneeIds;
    }
    openModal('card-detail-modal'); return;
  }
  document.getElementById('card-detail-title').textContent = '#' + t.id + ' ' + t.title;
  document.getElementById('edit-task-title').value = t.title;
  document.getElementById('edit-task-desc').value = t.description || '';
  state.editTaskAssigneeIds = (t.assignees || []).map(a => a.id);
  if (!state.editTaskAssigneeIds.length && t.assignee_id) state.editTaskAssigneeIds = [t.assignee_id];
  if (window.Alpine) Alpine.store('pipes').editTaskAssigneeIds = state.editTaskAssigneeIds;
  renderEditAssigneePills();
  document.getElementById('edit-assignee-search').value = '';
  document.getElementById('edit-assignee-dd').style.display = 'none';
  document.getElementById('edit-task-due').value = t.due_date || '';
  document.getElementById('delete-task-btn').style.display = canEdit ? '' : 'none';
  document.getElementById('confirm-edit-task-btn').style.display = canEdit ? '' : 'none';
  document.querySelectorAll('#card-detail-modal .form-input').forEach(el => el.disabled = !canEdit);
  document.getElementById('confirm-edit-task-btn').onclick = () => saveEditTask(taskId);
  document.getElementById('delete-task-btn').onclick = () => deleteTask(taskId);
  openModal('card-detail-modal');
}

async function saveEditTask(taskId) {
  const title = document.getElementById('edit-task-title').value.trim();
  if (!title) return;
  await api(`/lines/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title,
      description: document.getElementById('edit-task-desc').value,
      assignee_ids: state.editTaskAssigneeIds || [],
      due_date: document.getElementById('edit-task-due').value,
    }),
  });
  closeModal('card-detail-modal');
  await loadBoard();
  selectTask(taskId);
}

async function deleteTask(taskId) {
  if (!(await showConfirm('Delete this task?', 'Delete'))) return;
  await api(`/lines/tasks/${taskId}`, { method: 'DELETE' });
  closeModal('card-detail-modal');
  closeCommentsPanel();
  await loadBoard();
}

function setupMentions(textarea) {
  let activeIdx = 0;
  textarea._mentionTarget = textarea;
  textarea.addEventListener('input', () => {
    const pos = textarea.selectionStart;
    const before = textarea.value.substring(0, pos);
    const at = before.lastIndexOf('@');
    const hash = before.lastIndexOf('#');
    const nl = before.lastIndexOf('\n');
    const sp = before.lastIndexOf(' ');
    let type = null, idx = -1;
    if (at > nl && at > sp) { type = 'user'; idx = at; }
    else if (hash > nl && hash > sp) { type = 'todo'; idx = hash; }
    if (!type) { hideMDD(); return; }
    const term = before.substring(idx + 1);
    if (term.includes(' ')) { hideMDD(); return; }
    activeIdx = 0;
    showMDD(textarea, type, term.toLowerCase());
  });
  textarea.addEventListener('keydown', (e) => {
    const dd = document.getElementById('mention-dd');
    if (dd.style.display == 'none') return;
    if (e.key == 'ArrowDown') { e.preventDefault(); activeIdx++; highlightMDD(dd); }
    else if (e.key == 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); highlightMDD(dd); }
    else if (e.key == 'Enter' || e.key == 'Tab') {
      const sel = dd.querySelector('.active');
      if (sel) { e.preventDefault(); insertMention(textarea, sel.dataset); hideMDD(); }
    } else if (e.key == 'Escape') hideMDD();
  });
  textarea.addEventListener('blur', () => setTimeout(hideMDD, 200));
}

async function showMDD(textarea, type, term) {
  const dd = document.getElementById('mention-dd');
  let items = [];
  if (type == 'user') {
    items = state.users.filter(u => u.username.toLowerCase().includes(term)).map(u => ({
      insert: '@' + u.username, label: u.display_name, sub: '@' + u.username,
      badge: u.display_name.charAt(0).toUpperCase(), bg: '#0B2D52',
    }));
  } else {
    items = (state.todos || []).filter(t => t.name.toLowerCase().includes(term)).map(t => ({
      insert: '#' + t.name, label: t.name, sub: '#' + t.name,
      badge: t.name.charAt(0).toUpperCase(), bg: '#2563EB',
    }));
  }
  if (!items.length) { dd.style.display = 'none'; return; }
  if (_mddTimeout) clearTimeout(_mddTimeout);
  dd.innerHTML = items.map((item, i) => {
    const taId = textarea.id || 'cp-input';
    return `<div class="mention-dd-item ${i == 0 ? 'active' : ''}" data-insert="${item.insert}"
      onmousedown="insertMention(document.getElementById('${taId}') || document.getElementById('cp-input'), this.dataset); hideMDD();">` +
      `<span class="md-badge" style="background:${item.bg}">${item.badge}</span>` +
      `<div><div class="md-label">${item.label}</div><div class="md-sub">${item.sub}</div></div>` +
      `</div>`;
  }).join('');
  const r = textarea.getBoundingClientRect();
  const spaceBelow = window.innerHeight - r.bottom;
  if (spaceBelow < 160) {
    dd.style.top = (r.top - Math.min(160, r.top)) + 'px';
    dd.style.maxHeight = Math.min(150, r.top - 10) + 'px';
  } else {
    dd.style.top = (r.bottom + 4) + 'px';
    dd.style.maxHeight = '150px';
  }
  dd.style.left = r.left + 'px';
  dd.style.width = Math.min(r.width, 300) + 'px';
  dd.style.display = 'block';
  dd.classList.remove('mdd-hide');
  dd.classList.add('mdd-show');
}

let _mddTimeout = null;
function hideMDD() {
  const dd = document.getElementById('mention-dd');
  if (_mddTimeout) clearTimeout(_mddTimeout);
  dd.classList.remove('mdd-show');
  dd.classList.add('mdd-hide');
  _mddTimeout = setTimeout(() => {
    dd.style.display = 'none';
    dd.classList.remove('mdd-hide');
    _mddTimeout = null;
  }, 150);
}
function highlightMDD(dd) {
  const items = dd.querySelectorAll('.mention-dd-item');
  items.forEach((el, i) => el.classList.toggle('active', i == activeIdx));
  activeIdx = Math.min(activeIdx, items.length - 1);
}

function insertMention(textarea, data) {
  const pos = textarea.selectionStart;
  const before = textarea.value.substring(0, pos);
  const triggerChar = data.insert.startsWith('@') ? '@' : '#';
  const last = before.lastIndexOf(triggerChar);
  let insert = data.insert;
  if (triggerChar === '#') insert = '#' + insert.substring(1).replace(/\s+/g, '_');
  textarea.value = textarea.value.substring(0, last) + insert + ' ' + textarea.value.substring(pos);
  const np = last + insert.length + 1;
  textarea.setSelectionRange(np, np);
  textarea.focus();
  textarea.dispatchEvent(new Event('input'));
}

function renderTodos() {
  const container = document.getElementById('cp-todo-list');
  if (!container) return;
  const panel = document.getElementById('comments-panel');
  if (panel?.hasAttribute('x-data')) {
    if (window.Alpine) Alpine.store('pipes').todos = state.todos;
    updateTabCounts();
    return;
  }
  container.innerHTML = state.todos.map(t => {
    const done = t.status === 'completed';
    return `
    <div class="todo-item" data-todo-id="${t.id}">
      <div class="todo-check ${done ? 'checked' : ''}"></div>
      <span class="todo-name ${done ? 'done' : ''}">${esc(t.name)}${t.notes ? ' <span class="todo-has-notes">&#9998;</span>' : ''}</span>
      <span class="todo-meta">${esc(t.owner_name || '')}</span>
      <span class="todo-del" data-todo-id="${t.id}">&times;</span>
    </div>`;
  }).join('') + `
    <div class="todo-create-form">
      <input type="text" id="todo-create-input" class="form-input" placeholder="Add checklist item..." style="flex:1">
      <button class="btn btn-primary btn-sm" id="todo-create-btn">Add</button>
    </div>
  `;

  container.querySelectorAll('.todo-item').forEach((el, i) => {
    const todoId = parseInt(el.dataset.todoId);
    el.querySelector('.todo-check').addEventListener('click', async (e) => {
      e.stopPropagation();
      await api(`/lines/todos/${todoId}/toggle`, { method: 'PUT' });
      const todos = await api(`/lines/todos?task_id=${state.selectedTask.id}`);
      state.todos = todos;
      renderTodos();
    });
    el.querySelector('.todo-name').addEventListener('click', (e) => {
      e.stopPropagation();
      openTodoEditModal(todoId);
    });
    el.querySelector('.todo-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await showConfirm('Delete this checklist item?', 'Delete'))) return;
      await api(`/lines/todos/${todoId}`, { method: 'DELETE' });
      const todos = await api(`/lines/todos?task_id=${state.selectedTask.id}`);
      state.todos = todos;
      renderTodos();
    });
  });

  const input = document.getElementById('todo-create-input');
  const btn = document.getElementById('todo-create-btn');
  if (input && btn) {
    const submitTodo = async () => {
      const name = input.value.trim();
      if (!name) return;
      input.value = '';
      await api('/lines/todos', {
        method: 'POST',
        body: JSON.stringify({ name, owner_id: state.user.id, task_id: state.selectedTask.id })
      });
      const todos = await api(`/lines/todos?task_id=${state.selectedTask.id}`);
      state.todos = todos;
      renderTodos();
    };
    btn.addEventListener('click', submitTodo);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitTodo();
    });
  }
  lucide.createIcons();
  updateTabCounts();
}

function updateTabCounts() {
  const commentCount = document.querySelectorAll('#cp-messages .cp-msg').length;
  const commentTab = document.querySelector('.cp-tab[data-cp-tab="comments"]');
  if (commentTab) {
    const badge = commentTab.querySelector('.tab-badge');
    if (badge) {
      badge.textContent = commentCount;
    } else if (commentCount) {
      commentTab.insertAdjacentHTML('beforeend', `<span class="tab-badge">${commentCount}</span>`);
    }
  }
  const totalTodos = state.todos.length;
  const doneTodos = state.todos.filter(t => t.status === 'completed').length;
  const todoTab = document.querySelector('.cp-tab[data-cp-tab="todo"]');
  if (todoTab) {
    let badge = todoTab.querySelector('.tab-badge');
    const label = totalTodos ? `${doneTodos}/${totalTodos}` : '';
    if (badge) {
      if (label) badge.textContent = label;
      else badge.remove();
    } else if (label) {
      todoTab.insertAdjacentHTML('beforeend', `<span class="tab-badge">${label}</span>`);
    }
  }
}

function openTodoEditModal(todoId) {
  if (document.getElementById('todo-edit-modal')?.hasAttribute('x-data')) return;
  const t = state.todos.find(x => x.id == todoId);
  if (!t) return;
  document.getElementById('edit-todo-name').value = t.name;
  document.getElementById('edit-todo-notes').value = t.notes || '';
  const filesContainer = document.getElementById('edit-todo-files');
  const fileInput = document.getElementById('edit-todo-file-input');
  const uploadBtn = document.getElementById('upload-todo-file-btn');

  async function loadTodoFiles() {
    const files = await api(`/files?task_id=${state.selectedTask.id}&todo_id=${todoId}`);
    if (!Array.isArray(files)) return;
    filesContainer.innerHTML = files.map(f => {
      const isImg = f.mime_type?.startsWith('image/');
      const canDelete = state.user?.role === 'admin' || f.user_id == state.user?.id;
      return `<div class="todo-file-item">
        ${canDelete ? `<span class="file-thumb-del" data-fid="${f.id}">&times;</span>` : ''}
        <div class="todo-file-thumb" onclick="previewFile(${f.id})">
          ${isImg ? `<img src="${fileImgSrc(f.id)}">` : '<span class="file-icon"><i data-lucide="file" size="16"></i></span>'}
          <span class="todo-file-name">${esc(f.original_name)}</span>
        </div>
      </div>`;
    }).join('');
    filesContainer.querySelectorAll('.file-thumb-del').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!(await showConfirm('Delete this file?', 'Delete'))) return;
        await api(`/files/${parseInt(el.dataset.fid)}`, { method: 'DELETE' });
        await loadTodoFiles();
      });
    });
    lucide.createIcons();
  }

  loadTodoFiles();

  uploadBtn.onclick = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('task_id', state.selectedTask.id);
    form.append('todo_id', todoId);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + state.token },
      body: form,
    });
    if (res.ok) {
      fileInput.value = '';
      await loadTodoFiles();
    }
  };

  document.getElementById('confirm-edit-todo-btn').onclick = async () => {
    const name = document.getElementById('edit-todo-name').value.trim();
    const notes = document.getElementById('edit-todo-notes').value;
    if (!name) return;
    await api(`/lines/todos/${todoId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, notes, status: 'completed' }),
    });
    closeModal('todo-edit-modal');
    const todos = await api(`/lines/todos?task_id=${state.selectedTask.id}`);
    state.todos = todos;
    renderTodos();
  };
  document.getElementById('delete-todo-btn').onclick = async () => {
    if (!(await showConfirm('Delete this checklist item?', 'Delete'))) return;
    await api(`/lines/todos/${todoId}`, { method: 'DELETE' });
    closeModal('todo-edit-modal');
    const todos = await api(`/lines/todos?task_id=${state.selectedTask.id}`);
    state.todos = todos;
    renderTodos();
  };
  openModal('todo-edit-modal');
}

let searchTimeout = null;
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput?.hasAttribute('x-model')) return;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const q = searchInput.value.trim();
      if (!q) { document.getElementById('search-dd').style.display = 'none'; return; }
      const results = await api(`/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(results);
    }, 200);
  });
  searchInput.addEventListener('blur', () => setTimeout(() => {
    document.getElementById('search-dd').style.display = 'none';
  }, 200));
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) searchInput.dispatchEvent(new Event('input'));
  });
});

function renderSearchResults(results) {
  if (document.getElementById('search-dd')?.hasAttribute('x-data') || document.getElementById('app')?.querySelector('[x-data]')?.hasAttribute('x-data')) { return; }
  const dd = document.getElementById('search-dd');
  if (!results.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = results.map(r => `
    <div class="search-dd-item" data-type="${r.type}" data-id="${r.id}">
      <span class="search-dd-tag ${r.type}">${r.type}</span>
      <span>${esc(r.name)}</span>
    </div>
  `).join('');
  dd.querySelectorAll('.search-dd-item').forEach(el => {
    el.addEventListener('mousedown', () => {
      const type = el.dataset.type;
      const id = parseInt(el.dataset.id);
      if (type == 'task') selectTask(id);
      document.getElementById('search-input').value = '';
      dd.style.display = 'none';
    });
  });
  dd.style.display = 'block';
}

function openNewBoardModal() {
  const nbModal = document.getElementById('board-modal');
  if (nbModal?.hasAttribute('x-data')) return;
  state.newBoardMembers = state.users.filter(u => u.id == state.user.id);
  document.getElementById('new-board-name').value = '';
  state.newBoardStages = ['Backlog', 'In Progress', 'Review', 'Done'];
  renderNewBoardPills();
  renderStagePills();
  document.getElementById('nb-search-input').value = '';
  document.getElementById('nb-search-dd').style.display = 'none';
  document.getElementById('nb-stage-input').value = '';
  openModal('board-modal');
}

function renderStagePills() {
  const container = document.getElementById('nb-stage-pills');
  if (!container || document.getElementById('board-modal')?.hasAttribute('x-data')) return;
  container.innerHTML = state.newBoardStages.map((s, i) => `
    <span class="mb-pill" data-idx="${i}">
      ${esc(s)}
      <span class="mb-pill-remove" data-idx="${i}">&times;</span>
    </span>
  `).join('');
  container.querySelectorAll('.mb-pill-remove').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      state.newBoardStages.splice(idx, 1);
      renderStagePills();
    });
  });
}

function renderNewBoardPills() {
  const container = document.getElementById('nb-pills');
  if (!container || document.getElementById('board-modal')?.hasAttribute('x-data')) return;
  container.innerHTML = state.newBoardMembers.map(m => `
    <span class="mb-pill" data-uid="${m.id}">
      ${esc(m.display_name)}
      <span class="mb-pill-remove" data-uid="${m.id}">&times;</span>
    </span>
  `).join('');
  container.querySelectorAll('.mb-pill-remove').forEach(el => {
    el.addEventListener('click', () => {
      const uid = parseInt(el.dataset.uid);
      state.newBoardMembers = state.newBoardMembers.filter(m => m.id !== uid);
      renderNewBoardPills();
    });
  });
}

function switchPage(page) {
  state.currentPage = page;
  const boardArea = document.querySelector('.board-area');
  const filesArea = document.getElementById('files-area');
  const searchInput = document.getElementById('search-input');

  if (page === 'files') {
    boardArea.style.display = 'none';
    filesArea.style.display = 'flex';
    searchInput.placeholder = 'Search files...';
    loadFilesModule();
  } else {
    boardArea.style.display = 'flex';
    filesArea.style.display = 'none';
    searchInput.placeholder = 'Search tasks, users, todos...';
  }
}

function setup() {
  switchPage('lines');

  const taskModalEl = document.getElementById('task-modal');
  const nbModal = document.getElementById('board-modal');
  const nbHasAlpine = nbModal?.hasAttribute('x-data');
  const mgModal = document.getElementById('manage-board-modal');
  const mgHasAlpine = mgModal?.hasAttribute('x-data');
  const taskModal = document.getElementById('task-modal');
  const taskHasAlpine = taskModal?.hasAttribute('x-data');
  const editModal = document.getElementById('card-detail-modal');
  const editHasAlpine = editModal?.hasAttribute('x-data');
  const modalOverlays = document.querySelectorAll('.modal-overlay');
  const modalHasAlpine = Array.from(modalOverlays).some(el => el.hasAttribute('x-on:click'));
  if (!taskModalEl.hasAttribute('x-data')) {
    document.getElementById('confirm-task-btn').addEventListener('click', async () => {
      const title = document.getElementById('new-task-title').value.trim();
      if (!title) return;
      const task = await api('/lines/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          column_id: state.lastColumnId,
          description: document.getElementById('new-task-desc').value,
          due_date: document.getElementById('new-task-due').value,
          assignee_ids: state.newTaskAssigneeIds || [],
        }),
      });
      closeModal('task-modal');
      await loadBoard();
    });
  }

  const boardModalEl = document.getElementById('board-modal');
  if (!boardModalEl.hasAttribute('x-data')) {
    document.getElementById('confirm-board-btn').addEventListener('click', async () => {
      const name = document.getElementById('new-board-name').value.trim();
      if (!name) return;
      const stages = state.newBoardStages.join('\n');
      const board = await api('/lines/boards', {
        method: 'POST', body: JSON.stringify({ name, stages, created_by: state.user.id }),
      });
      for (const m of state.newBoardMembers) {
        if (m.id != state.user.id) {
          await api('/lines/boards/members', {
            method: 'POST', body: JSON.stringify({ board_id: board.id, user_id: m.id }),
          });
        }
      }
      closeModal('board-modal');
      state.activeBoard = board.id;
      await loadBoard();
    });
  }

  function renderMemberPills() {
    const container = document.getElementById('mb-pills');
    if (!container || document.getElementById('manage-board-modal')?.hasAttribute('x-data')) return;
    container.innerHTML = state.boardMembers.map(m => `
      <span class="mb-pill" data-uid="${m.id}">
        ${esc(m.display_name)}
        <span class="mb-pill-remove" data-uid="${m.id}">&times;</span>
      </span>
    `).join('');
    container.querySelectorAll('.mb-pill-remove').forEach(el => {
      el.addEventListener('click', async () => {
        const uid = parseInt(el.dataset.uid);
        const boardId = document.getElementById('manage-board-name')._boardId;
        state.boardMembers = state.boardMembers.filter(m => m.id !== uid);
        renderMemberPills();
        await api('/lines/boards/members', {
          method: 'DELETE', body: JSON.stringify({ board_id: boardId, user_id: uid }),
        });
      });
    });
  }

  function renderManageStagePills() {
    const container = document.getElementById('mb-stage-pills');
    if (!container || document.getElementById('manage-board-modal')?.hasAttribute('x-data')) return;
    container.innerHTML = state.manageBoardColumns.map(col => `
      <span class="mb-pill" data-cid="${col.id}">
        ${esc(col.name)}
        <span class="mb-pill-remove" data-cid="${col.id}">&times;</span>
      </span>
    `).join('');
    container.querySelectorAll('.mb-pill-remove').forEach(el => {
      el.addEventListener('click', async () => {
        const cid = parseInt(el.dataset.cid);
        const boardId = document.getElementById('manage-board-name')._boardId;
        await api(`/lines/boards/${boardId}/columns/${cid}`, { method: 'DELETE' });
        state.manageBoardColumns = state.manageBoardColumns.filter(c => c.id !== cid);
        renderManageStagePills();
        await loadBoard();
      });
    });
  }

  const mgModalEl = document.getElementById('manage-board-modal');
  const mgHasAlpineEl = mgModalEl?.hasAttribute('x-data');

  if (!mgHasAlpineEl) {
  document.getElementById('rename-board-btn').addEventListener('click', async () => {
    const boardId = document.getElementById('manage-board-name')._boardId;
    const name = document.getElementById('manage-board-name').value.trim();
    if (!boardId || !name) return;
    await api(`/lines/boards/${boardId}`, {
      method: 'PUT', body: JSON.stringify({ name }),
    });
    await loadBoard();
  });

  document.getElementById('delete-board-btn').addEventListener('click', async () => {
    const boardId = document.getElementById('manage-board-name')._boardId;
    if (!boardId) return;
    if (!(await showConfirm('Delete this board and all its tasks?', 'Delete'))) return;
    await api(`/lines/boards/${boardId}`, { method: 'DELETE' });
    closeModal('manage-board-modal');
    state.activeBoard = null;
    await loadBoard();
  });
  }

  if (!mgHasAlpineEl) {
  document.getElementById('mb-search-input').addEventListener('input', function () {
    const dd = document.getElementById('mb-search-dd');
    const term = this.value.trim().toLowerCase();
    if (!term) { dd.style.display = 'none'; return; }
    const memberIds = state.boardMembers.map(m => m.id);
    const matches = state.users.filter(u =>
      !memberIds.includes(u.id) &&
      (u.display_name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term))
    );
    if (!matches.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = matches.map(u => `
      <div class="mb-search-item" data-uid="${u.id}">
        <span class="mb-search-avatar">${u.display_name.charAt(0).toUpperCase()}</span>
        <span>${esc(u.display_name)}</span>
        <span class="mb-search-uname">@${esc(u.username)}</span>
      </div>
    `).join('');
    dd.querySelectorAll('.mb-search-item').forEach(el => {
      el.addEventListener('mousedown', async (e) => {
        e.preventDefault();
        const uid = parseInt(el.dataset.uid);
        const boardId = document.getElementById('manage-board-name')._boardId;
        const user = state.users.find(u => u.id === uid);
        if (!user || state.boardMembers.find(m => m.id === uid)) return;
        state.boardMembers.push(user);
        renderMemberPills();
        await api('/lines/boards/members', {
          method: 'POST', body: JSON.stringify({ board_id: boardId, user_id: uid }),
        });
        document.getElementById('mb-search-input').value = '';
        dd.style.display = 'none';
      });
    });
    dd.style.display = 'block';
  });

  document.getElementById('mb-search-input').addEventListener('blur', () => {
    setTimeout(() => document.getElementById('mb-search-dd').style.display = 'none', 200);
  });
  }

  if (!nbHasAlpine) {
  document.getElementById('nb-search-input').addEventListener('input', function () {
    const dd = document.getElementById('nb-search-dd');
    const term = this.value.trim().toLowerCase();
    if (!term) { dd.style.display = 'none'; return; }
    const memberIds = state.newBoardMembers.map(m => m.id);
    const matches = state.users.filter(u =>
      !memberIds.includes(u.id) &&
      (u.display_name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term))
    );
    if (!matches.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = matches.map(u => `
      <div class="mb-search-item" data-uid="${u.id}">
        <span class="mb-search-avatar">${u.display_name.charAt(0).toUpperCase()}</span>
        <span>${esc(u.display_name)}</span>
        <span class="mb-search-uname">@${esc(u.username)}</span>
      </div>
    `).join('');
    dd.querySelectorAll('.mb-search-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const uid = parseInt(el.dataset.uid);
        const user = state.users.find(u => u.id === uid);
        if (!user || state.newBoardMembers.find(m => m.id === uid)) return;
        state.newBoardMembers.push(user);
        renderNewBoardPills();
        document.getElementById('nb-search-input').value = '';
        dd.style.display = 'none';
      });
    });
    dd.style.display = 'block';
  });

  document.getElementById('nb-search-input').addEventListener('blur', () => {
    setTimeout(() => document.getElementById('nb-search-dd').style.display = 'none', 200);
  });
  }

  function renderAssigneeSearchResults(inputId, ddId, stateKey) {
    const inp = document.getElementById(inputId);
    const dd = document.getElementById(ddId);
    const term = inp.value.trim().toLowerCase();
    if (!term) { dd.style.display = 'none'; return; }
    const ids = state[stateKey] || [];
    const pool = state.boardMembers.length ? state.boardMembers : state.users;
    const matches = pool.filter(u =>
      !ids.includes(u.id) &&
      (u.display_name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term))
    );
    if (!matches.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = matches.map(u => `
      <div class="mb-search-item" data-uid="${u.id}">
        <span class="mb-search-avatar">${u.display_name.charAt(0).toUpperCase()}</span>
        <span>${esc(u.display_name)}</span>
        <span class="mb-search-uname">@${esc(u.username)}</span>
      </div>
    `).join('');
    dd.querySelectorAll('.mb-search-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const uid = parseInt(el.dataset.uid);
        const user = pool.find(u => u.id === uid);
        if (!user) return;
        state[stateKey] = [...(state[stateKey] || []), uid];
        if (stateKey === 'newTaskAssigneeIds') renderNewTaskAssigneePills();
        else renderEditAssigneePills();
        inp.value = '';
        dd.style.display = 'none';
      });
    });
    dd.style.display = 'block';
  }

  if (!taskHasAlpine) {
  document.getElementById('nt-assignee-search').addEventListener('input', function () {
    renderAssigneeSearchResults('nt-assignee-search', 'nt-assignee-dd', 'newTaskAssigneeIds');
  });
  document.getElementById('nt-assignee-search').addEventListener('blur', () => {
    setTimeout(() => document.getElementById('nt-assignee-dd').style.display = 'none', 200);
  });
  }

  if (!editHasAlpine) {
  document.getElementById('edit-assignee-search').addEventListener('input', function () {
    renderAssigneeSearchResults('edit-assignee-search', 'edit-assignee-dd', 'editTaskAssigneeIds');
  });
  document.getElementById('edit-assignee-search').addEventListener('blur', () => {
    setTimeout(() => document.getElementById('edit-assignee-dd').style.display = 'none', 200);
  });
  }

  if (!nbHasAlpine) {
  function addStage() {
    const inp = document.getElementById('nb-stage-input');
    const name = inp.value.trim();
    if (!name) return;
    if (state.newBoardStages.includes(name)) return;
    state.newBoardStages.push(name);
    inp.value = '';
    renderStagePills();
  }

  document.getElementById('nb-stage-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addStage(); }
  });
  document.getElementById('nb-stage-add-btn').addEventListener('click', addStage);
  }

  if (!mgHasAlpine) {
  document.getElementById('mb-stage-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('mb-stage-add-btn').click(); }
  });
  document.getElementById('mb-stage-add-btn').addEventListener('click', async () => {
    const inp = document.getElementById('mb-stage-input');
    const name = inp.value.trim();
    if (!name) return;
    const boardId = document.getElementById('manage-board-name')._boardId;
    const col = await api(`/lines/boards/${boardId}/columns`, {
      method: 'POST', body: JSON.stringify({ name }),
    });
    state.manageBoardColumns.push(col);
    inp.value = '';
    renderManageStagePills();
    await loadBoard();
  });

  document.getElementById('manage-board-done-btn').addEventListener('click', async () => {
    const boardId = document.getElementById('manage-board-name')._boardId;
    if (!boardId) { closeModal('manage-board-modal'); return; }
    const desc = document.getElementById('manage-board-desc-template').value;
    const name = document.getElementById('manage-board-name').value.trim();
    if (name) {
      await api(`/lines/boards/${boardId}`, {
        method: 'PUT', body: JSON.stringify({ name, description_template: desc }),
      });
    }
    closeModal('manage-board-modal');
    await loadBoard();
  });
  }

  if (!modalHasAlpine) {
    modalOverlays.forEach(el => {
      el.addEventListener('click', (e) => { if (e.target == el) closeModal(el.id); });
    });
  }

  const notifWrap = document.getElementById('notif-wrap');
  if (!notifWrap?.hasAttribute('x-data')) {
    document.getElementById('notif-bell').addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('notif-dd');
      state.notifOpen = !state.notifOpen;
      dd.style.display = state.notifOpen ? 'block' : 'none';
      if (state.notifOpen) loadNotifications();
    });
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('notif-wrap');
      if (!wrap.contains(e.target)) {
        document.getElementById('notif-dd').style.display = 'none';
        state.notifOpen = false;
      }
    });
    document.getElementById('notif-read-all').addEventListener('click', async () => {
      await api('/notifications/read-all', { method: 'POST' });
      loadNotifications();
    });
  }

  if (!document.getElementById('comments-panel')?.hasAttribute('x-data')) {
    document.getElementById('cp-messages').addEventListener('click', (e) => {
      const el = e.target.closest('.mention-todo');
      if (!el) return;
      const todoName = el.dataset.todo.replace(/_/g, ' ');
      const found = state.todos.find(t => t.name === todoName);
      if (found) openTodoEditModal(found.id);
    });
  }
}
