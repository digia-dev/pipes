function renderFileCard(f, isArchive) {
  const sel = filesState.selected.includes('fi' + f.id) ? ' selected' : '';
  const name = isArchive ? (f.title || f.original_name || '') : (f.original_name || '');
  const owner = isArchive ? (f.owner_name || '') : (f.owner_name || '');
  const typeIcon = getFileIcon(f.mime_type);
  const taskThumbUrl = isArchive && f.thumb_file_id ? `/api/files/${f.thumb_file_id}/download?token=${state.token}` : '';
  const thumbUrl = f.id && f.mime_type?.startsWith('image/') ? `/api/files/items/${f.id}/stream?token=${state.token}` : '';
  const isImg = f.mime_type?.startsWith('image/');
  const size = f.size ? formatSize(f.size) : '';
  const starred = f.is_starred ? ' starred' : '';

  return `
    <div class="fs-file-card${sel}" data-type="${isArchive ? 'task' : 'file'}" data-id="${f.id}">
      <div class="fs-fcard-check fs-check-el"></div>
      <div class="fs-fcard-star fs-star-btn${starred}" data-id="${f.id}"><i data-lucide="star" size="12"></i></div>
      <div class="fs-fcard-thumb">
        ${taskThumbUrl ? `<img src="${taskThumbUrl}">` : isImg && thumbUrl ? `<img src="${thumbUrl}">` : `<div class="fs-fcard-icon"><i data-lucide="${typeIcon}" size="36"></i></div>`}
      </div>
      <div class="fs-fcard-body">
        <div class="fs-fcard-name">${esc(name)}</div>
        <div class="fs-fcard-meta">
          ${owner ? `<span class="fs-fcard-owner">${esc(owner)}</span>` : ''}
          ${size ? `<span class="fs-fcard-size">${size}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function renderFileRow(f, isArchive) {
  const sel = filesState.selected.includes('fi' + f.id) ? ' selected' : '';
  const name = isArchive ? (f.title || f.original_name || '') : (f.original_name || '');
  const owner = isArchive ? (f.owner_name || '') : (f.owner_name || '');
  const date = f.created_at ? new Date(f.created_at + 'Z').toLocaleDateString() : '';
  const size = f.size ? formatSize(f.size) : '';
  const typeIcon = getFileIcon(f.mime_type);
  const taskThumbUrl = isArchive && f.thumb_file_id ? `/api/files/${f.thumb_file_id}/download?token=${state.token}` : '';
  const starred = f.is_starred ? ' starred' : '';

  return `
    <div class="fs-list-row${sel}" data-type="${isArchive ? 'task' : 'file'}" data-id="${f.id}">
      <div class="fs-lr-check fs-check-el"></div>
      <div class="fs-lr-name">${taskThumbUrl ? `<img src="${taskThumbUrl}" class="fs-lr-thumb">` : `<i data-lucide="${typeIcon}" size="14"></i>`}<span>${esc(name)}</span></div>
      <div class="fs-lr-owner">${esc(owner)}</div>
      <div class="fs-lr-size">${size}</div>
      <div class="fs-lr-date">${date}</div>
    </div>`;
}

async function loadFilesModule() {
  filesState.activePage = 'home';
  filesState.activeFolderId = null;
  filesState.folderHistory = [];
  await loadFilesPage('home');
  setupFilesStaticListeners();
}

async function loadFilesPage(page) {
  filesState.activePage = page;
  filesState.selected = [];
  filesState.selectMode = false;
  filesState.folderHistory = [];
  filesState.activeFolderId = null;
  if (page === 'home') {
    const [folders, files, activity] = await Promise.all([
      api('/files/folders/tree'),
      api('/files/items'),
      api('/files/activity'),
    ]);
    filesState.folderTree = folders || [];
    filesState.folders = folders || [];
    filesState.files = files || [];
    state._fsActivity = activity || [];
  } else if (page === 'recent') {
    filesState.folderTree = [];
    filesState.folders = [];
    filesState.files = await api('/files/recent');
  } else if (page === 'starred') {
    filesState.folderTree = [];
    filesState.folders = [];
    filesState.files = await api('/files/starred');
  } else if (page === 'archive') {
    filesState.folderTree = [];
    filesState.folders = [];
    filesState.files = await api('/files/tasks');
  }
  _syncFilesToAlpine();
  renderFilesPage();
}

function _syncFilesToAlpine() {
  if (window.Alpine) {
    const s = Alpine.store('pipes');
    s.filesItems = filesState.files || [];
    s.folders = filesState.folders || [];
    s.folderTree = filesState.folderTree || [];
    s.activeFolderId = filesState.activeFolderId;
    s.activeFilesPage = filesState.activePage;
    s.folderHistory = [...(filesState.folderHistory || [])];
    s.expandedFolders = [...(filesState.expandedFolders || [])];
    s.activity = state._fsActivity || [];
  }
}

async function loadFilesFolder(folderId, recordHistory = true) {
  if (recordHistory && filesState.activeFolderId !== null) {
    filesState.folderHistory.push(filesState.activeFolderId);
  }
  filesState.activeFolderId = folderId;
  filesState.activePage = 'home';
  filesState.selected = [];
  filesState.selectMode = false;
  const [folders, files, tree, activity] = await Promise.all([
    api('/files/folders?parent_id=' + (folderId || '')),
    api('/files/items?folder_id=' + (folderId || '')),
    api('/files/folders/tree'),
    api('/files/activity'),
  ]);
  filesState.folders = folders || [];
  filesState.files = files || [];
  filesState.folderTree = tree || [];
  state._fsActivity = activity || [];
  _syncFilesToAlpine();
  renderFilesPage();
}

function renderFilesPage() {
  if (document.getElementById('files-area')?.hasAttribute('x-data')) return;
  renderFilesSidebar();
  renderFilesBreadcrumb();
  renderFilesContent();
  renderFilesActivity();
  lucide.createIcons();
  const newBtn = document.getElementById('fs-new-btn');
  if (newBtn) newBtn.style.display = 'flex';
  const backBtn = document.getElementById('fs-back-btn');
  if (backBtn) backBtn.style.display = filesState.folderHistory.length > 0 ? 'flex' : 'none';
  updatePasteBtn();
  document.querySelectorAll('.fs-folder-card, .fs-file-card, .fs-list-row').forEach(el => el.style.opacity = '');
}

function renderFilesSidebar() {
  document.querySelectorAll('.fs-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === filesState.activePage);
  });
  const container = document.getElementById('fs-folder-tree');
  function renderTree(nodes, depth) {
    return nodes.filter(n => n.id).map(n => {
      const hasChildren = n.children && n.children.length > 0;
      const expanded = filesState.expandedFolders.includes(n.id);
      const pad = depth * 16;
      return `
        <div class="fs-folder-item${n.id == filesState.activeFolderId ? ' active' : ''}" data-folder-id="${n.id}" style="padding-left:${pad + 16}px">
          ${hasChildren ? `<span class="fs-tree-arrow" data-fid="${n.id}">${expanded ? '▾' : '▸'}</span>` : `<span class="fs-tree-arrow" style="visibility:hidden">▸</span>`}
          <i data-lucide="folder" size="14"></i> ${esc(n.name)}
        </div>
        ${hasChildren && expanded ? renderTree(n.children, depth + 1) : ''}
      `;
    }).join('');
  }
  container.innerHTML = renderTree(filesState.folderTree || [], 0);
  container.querySelectorAll('.fs-tree-arrow').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const fid = parseInt(el.dataset.fid);
      const idx = filesState.expandedFolders.indexOf(fid);
      if (idx > -1) filesState.expandedFolders.splice(idx, 1);
      else filesState.expandedFolders.push(fid);
      renderFilesSidebar();
      lucide.createIcons();
    });
  });
  container.querySelectorAll('.fs-folder-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.fs-tree-arrow')) return;
      const fid = parseInt(el.dataset.folderId);
      if (fid) loadFilesFolder(fid, false);
    });
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const targetId = parseInt(el.dataset.folderId);
      if (!targetId) return;
      const ids = filesState._draggedIds.length ? filesState._draggedIds : [e.dataTransfer.getData('text/plain')];
      const fileIds = ids.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));
      api('/files/bulk', { method: 'POST', body: JSON.stringify({ action: 'move', file_ids: fileIds, folder_id: targetId }) }).then(() => {
        loadFilesFolder(filesState.activeFolderId);
      });
    });
  });
}

function renderFilesBreadcrumb() {
  const el = document.getElementById('fs-breadcrumb');
  const labels = { archive: 'Archive', starred: 'Starred', recent: 'Recent' };
  if (filesState.activePage !== 'home') {
    el.innerHTML = `<span class="fs-bc-item active">${labels[filesState.activePage] || 'My Files'}</span>`;
    return;
  }
  if (!filesState.activeFolderId) {
    el.innerHTML = `<span class="fs-bc-item active">My Files</span>`;
    return;
  }
  api('/files/folders/path?folder_id=' + filesState.activeFolderId).then(path => {
    let html = '<span class="fs-bc-item" data-fid="">My Files</span>';
    for (const f of path) {
      html += `<span class="fs-bc-sep">/</span><span class="fs-bc-item" data-fid="${f.id}">${esc(f.name)}</span>`;
    }
    html += `<span class="fs-bc-sep">/</span><span class="fs-bc-item active">...</span>`;
    el.innerHTML = html;
    el.querySelectorAll('.fs-bc-item[data-fid]').forEach(item => {
      item.addEventListener('click', () => {
        const fid = item.dataset.fid ? parseInt(item.dataset.fid) : null;
        if (fid !== null) loadFilesFolder(fid, false);
        else { filesState.activeFolderId = null; loadFilesFolder(null); }
      });
    });
    lucide.createIcons();
  }).catch(() => {
    el.innerHTML = `<span class="fs-bc-item active">My Files</span>`;
  });
}

function renderFilesContent() {
  const grid = document.getElementById('fs-grid');
  const list = document.getElementById('fs-list');
  const folderGrid = document.getElementById('fs-folder-grid');
  const sectionLabel = document.getElementById('fs-section-label');
  const empty = document.getElementById('fs-empty');

  const query = filesState.searchQuery.toLowerCase().trim();
  let files = filesState.files;
  let folders = filesState.folders;

  if (query) {
    files = files.filter(f => (f.original_name || f.name || f.title || '').toLowerCase().includes(query));
    folders = folders.filter(f => f.name.toLowerCase().includes(query));
  }

  const { sortBy, sortDir } = filesState;
  const cmp = (a, b) => {
    let va = '', vb = '';
    if (sortBy === 'name') { va = (a.original_name || a.name || a.title || '').toLowerCase(); vb = (b.original_name || b.name || b.title || '').toLowerCase(); }
    else if (sortBy === 'size') { va = a.size || 0; vb = b.size || 0; return sortDir === 'asc' ? va - vb : vb - va; }
    else if (sortBy === 'created_at') { va = a.created_at || ''; vb = b.created_at || ''; }
    else if (sortBy === 'owner') { va = (a.owner_name || '').toLowerCase(); vb = (b.owner_name || '').toLowerCase(); }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  };
  files.sort(cmp);
  folders.sort((a, b) => {
    const va = (a.name || '').toLowerCase(), vb = (b.name || '').toLowerCase();
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const hasFolders = folders.length > 0;
  const hasFiles = files.length > 0;

  if (!hasFolders && !hasFiles) {
    empty.style.display = 'flex';
    folderGrid.style.display = 'none';
    grid.style.display = 'none';
    list.style.display = 'none';
    sectionLabel.style.display = 'none';
    document.querySelector('.fs-bulk-bar')?.classList.remove('visible');
    return;
  }
  empty.style.display = 'none';

  if (hasFolders) {
    folderGrid.style.display = 'grid';
    folderGrid.innerHTML = folders.map(f => `
      <div class="fs-folder-card" data-type="folder" data-id="${f.id}">
        <div class="fs-fc-check fs-check-el"></div>
        <div class="fs-fc-actions">
          ${state.user?.role !== 'user' ? `<button class="fs-fc-rename" data-id="${f.id}" title="Rename"><i data-lucide="pencil" size="11"></i></button>
          <button class="fs-fc-del danger" data-id="${f.id}" title="Delete"><i data-lucide="trash-2" size="11"></i></button>` : ''}
        </div>
        <div class="fs-fc-icon"><i data-lucide="folder" size="32"></i></div>
        <div class="fs-fc-name">${esc(f.name)}</div>
        <div class="fs-fc-count">${f.file_count || 0} item${f.file_count !== 1 ? 's' : ''}</div>
      </div>
    `).join('');
  } else {
    folderGrid.style.display = 'none';
  }

  if (hasFiles) {
    sectionLabel.style.display = 'block';
    sectionLabel.textContent = filesState.activePage === 'archive' ? 'Archived Tasks' : 'Files';
    const isArchive = filesState.activePage === 'archive';

    if (filesState.view === 'grid') {
      grid.style.display = 'grid';
      list.style.display = 'none';
      list.innerHTML = '';
      grid.innerHTML = files.map(f => renderFileCard(f, isArchive)).join('');
    } else {
      grid.style.display = 'none';
      list.style.display = 'flex';
      grid.innerHTML = '';
      list.innerHTML = `<div class="fs-list-header">
        <span></span>
        <span data-sort="name">Name${sortBy === 'name' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
        <span data-sort="owner">Owner${sortBy === 'owner' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
        <span data-sort="size">Size${sortBy === 'size' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
        <span data-sort="created_at">Date${sortBy === 'created_at' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
      </div>` + files.map(f => renderFileRow(f, isArchive)).join('');
    }
  } else {
    grid.style.display = 'none';
    list.style.display = 'none';
    sectionLabel.style.display = 'none';
  }

  bindFilesContentEvents();
  updateBulkBar();
}

function bindFilesContentEvents() {
  document.querySelectorAll('.fs-check-el').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = el.closest('.fs-folder-card, .fs-file-card, .fs-list-row');
      if (!card) return;
      const prefix = card.classList.contains('fs-folder-card') ? 'f' : 'fi';
      const key = prefix + card.dataset.id;
      if (!filesState.selectMode) {
        filesState.selectMode = true;
        document.getElementById('fs-selectall-btn').style.display = 'flex';
        updateSelectAllBtn();
      }
      toggleFilesSelect(card, key);
      if (filesState.selected.length === 0) {
        filesState.selectMode = false;
        document.getElementById('fs-selectall-btn').style.display = 'none';
        updateBulkBar();
        lucide.createIcons();
      }
    });
  });

  document.querySelectorAll('.fs-folder-card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.fs-fc-actions')) return;
      if (e.target.closest('.fs-check-el')) return;
      loadFilesFolder(parseInt(el.dataset.id));
    });
    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('.fs-fc-actions')) return;
      if (e.target.closest('.fs-check-el')) return;
      loadFilesFolder(parseInt(el.dataset.id), false);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openFilesContextMenu(e.clientX, e.clientY, 'folder', el.dataset.id);
    });
  });

  document.querySelectorAll('.fs-file-card, .fs-list-row').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.fs-check-el')) return;
      const id = parseInt(el.dataset.id);
      const isArchive = filesState.activePage === 'archive';
      if (isArchive) {
        const task = filesState.files.find(f => f.id == id);
        if (task) { selectTask(id); }
      } else {
        previewFilesItem(id);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openFilesContextMenu(e.clientX, e.clientY, 'file', el.dataset.id);
    });
  });

  document.querySelectorAll('.fs-fc-rename').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); openRenameModal('folder', el.dataset.id); });
  });
  document.querySelectorAll('.fs-fc-del').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this folder?')) deleteFilesFolder(parseInt(el.dataset.id));
    });
  });

  document.querySelectorAll('.fs-list-header span[data-sort]').forEach(el => {
    el.addEventListener('click', () => {
      const field = el.dataset.sort;
      if (filesState.sortBy === field) filesState.sortDir = filesState.sortDir === 'asc' ? 'desc' : 'asc';
      else { filesState.sortBy = field; filesState.sortDir = 'asc'; }
      renderFilesContent();
      lucide.createIcons();
    });
  });

  document.querySelectorAll('.fs-fcard-name, .fs-lr-name span').forEach(el => {
    el.addEventListener('dblclick', (e) => {
      if (filesState.activePage === 'archive') return;
      e.stopPropagation();
      const card = el.closest('[data-id]');
      if (!card) return;
      const id = parseInt(card.dataset.id);
      const type = card.dataset.type === 'folder' ? 'folder' : 'file';
      const current = el.textContent;
      const input = document.createElement('input');
      input.className = 'fs-inline-input';
      input.value = current;
      input.style.width = Math.max(current.length * 8, 60) + 'px';
      el.textContent = '';
      el.appendChild(input);
      input.focus();
      input.select();
      const done = () => {
        const val = input.value.trim();
        if (val && val !== current) {
          if (type === 'folder') api('/files/folders/' + id, { method: 'PUT', body: JSON.stringify({ name: val }) });
          else api('/files/items/' + id, { method: 'PUT', body: JSON.stringify({ name: val }) });
        }
        el.textContent = val || current;
        lucide.createIcons();
      };
      input.addEventListener('blur', done);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
        if (ev.key === 'Escape') { el.textContent = current; lucide.createIcons(); }
      });
    });
  });

  document.querySelectorAll('.fs-star-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(el.dataset.id);
      const wasStarred = el.classList.contains('starred');
      api('/files/items/' + id + '/star', { method: 'POST' }).then(res => {
        if (filesState.activePage === 'starred') loadFilesPage('starred');
        else {
          el.classList.toggle('starred', res.is_starred);
          const f = filesState.files.find(x => x.id === id);
          if (f) f.is_starred = res.is_starred ? 1 : 0;
        }
      });
    });
  });

  document.querySelectorAll('.fs-folder-card, .fs-file-card, .fs-list-row').forEach(el => {
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (e) => {
      const isSelected = el.classList.contains('selected');
      if (isSelected && filesState.selected.length > 1) {
        filesState._draggedIds = filesState.selected
          .filter(k => !k.startsWith('f') || k.startsWith('fi'))
          .map(k => parseInt(k.replace(/^fi?/, '')));
      } else {
        filesState._draggedIds = [parseInt(el.dataset.id)];
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', filesState._draggedIds.join(','));
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
      filesState._draggedIds = [];
    });
  });
  document.querySelectorAll('.fs-folder-card, .fs-folder-item').forEach(el => {
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const targetIsFolder = el.classList.contains('fs-folder-item') || el.classList.contains('fs-folder-card');
      if (!targetIsFolder) return;
      const targetId = el.dataset.folderId || el.dataset.id;
      if (!targetId) return;
      const ids = filesState._draggedIds.length ? filesState._draggedIds : [e.dataTransfer.getData('text/plain')];
      const fileIds = ids.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));
      const fid = parseInt(targetId);
      const body = JSON.stringify({ action: 'move', file_ids: fileIds, folder_id: fid });
      api('/files/bulk', { method: 'POST', body }).then(() => {
        loadFilesFolder(filesState.activeFolderId);
      });
    });
  });
}

function setupFilesUpload() {
  if (document.getElementById('files-area')?.hasAttribute('x-data')) return;
  const main = document.getElementById('fs-main');
  const overlay = document.getElementById('fs-upload-overlay');
  let dragCounter = 0;

  main.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; overlay.style.display = 'flex'; });
  main.addEventListener('dragover', (e) => { e.preventDefault(); });
  main.addEventListener('dragleave', (e) => {
    e.preventDefault(); dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; overlay.style.display = 'none'; }
  });
  main.addEventListener('drop', (e) => {
    e.preventDefault(); overlay.style.display = 'none'; dragCounter = 0;
    const fl = e.dataTransfer.files;
    if (fl.length) uploadFilesItems(fl);
  });
}

async function uploadFilesItems(fileList) {
  if (document.getElementById('files-area')?.hasAttribute('x-data')) return;
  const bar = document.getElementById('fs-upload-progress');
  const list = document.getElementById('fs-up-list');
  bar.style.display = 'block';
  list.innerHTML = '';

  const files = Array.from(fileList);
  let completed = 0;

  for (const file of files) {
    const item = document.createElement('div');
    item.className = 'fs-up-item';
    item.innerHTML = `<span class="fs-up-name">${esc(file.name)}</span><div class="fs-up-bar"><div class="fs-up-fill" style="width:0%"></div></div>`;
    list.appendChild(item);

    const fill = item.querySelector('.fs-up-fill');
    fill.style.width = '30%';

    const form = new FormData();
    form.append('file', file);
    if (filesState.activeFolderId) form.append('folder_id', filesState.activeFolderId);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + state.token },
        body: form,
      });
      if (res.ok) {
        fill.style.width = '100%';
        completed++;
        setTimeout(() => item.remove(), 600);
      } else {
        item.innerHTML = `<span class="fs-up-name">${esc(file.name)} — failed</span>`;
      }
    } catch {
      item.innerHTML = `<span class="fs-up-name">${esc(file.name)} — error</span>`;
    }
  }

  setTimeout(async () => {
    bar.style.display = 'none';
    if (filesState.activePage !== 'archive') {
      const [files, activity] = await Promise.all([api('/files/items'), api('/files/activity')]);
      filesState.files = files || [];
      state._fsActivity = activity || [];
      renderFilesPage();
    }
  }, 500);
}

function renderFilesActivity() {
  const list = document.getElementById('fs-activity-list');
  const activity = state._fsActivity || [];
  if (!activity.length) {
    list.innerHTML = '<div class="fs-activity-item" style="color:var(--gray-400)">No recent activity</div>';
    return;
  }
  list.innerHTML = activity.slice(0, 10).map(a => {
    const time = new Date(a.created_at + 'Z').toLocaleString();
    const labels = { upload: 'uploaded', delete: 'deleted', rename: 'renamed', move: 'moved', share: 'shared', version: 'updated', create: 'created' };
    const label = labels[a.action] || a.action;
    return `<div class="fs-activity-item">
      <span><span class="aa-user">${esc(a.user_name)}</span> <span class="aa-action">${label} ${esc(a.item_type)}</span></span>
      <span class="aa-time">${time}</span>
    </div>`;
  }).join('');
}

function setupFilesStaticListeners() {
  const filesArea = document.getElementById('files-area');
  const hasAlpine = filesArea?.hasAttribute('x-data');

  if (!hasAlpine) {
    document.querySelectorAll('#fs-view-toggle .fs-view-btn').forEach(el => {
      el.onclick = null;
      el.addEventListener('click', () => {
        document.querySelectorAll('#fs-view-toggle .fs-view-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        filesState.view = el.dataset.view;
        renderFilesContent();
        lucide.createIcons();
      });
    });
  }

  if (!hasAlpine) {
  const searchInput = document.getElementById('fs-search-input');
  let timeout;
  searchInput.oninput = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      filesState.searchQuery = searchInput.value;
      renderFilesContent();
      lucide.createIcons();
    }, 200);
  };

  const selectAllBtn = document.getElementById('fs-selectall-btn');
  if (selectAllBtn) {
    selectAllBtn.onclick = null;
    selectAllBtn.addEventListener('click', () => {
      const all = [...document.querySelectorAll('.fs-folder-card, .fs-file-card, .fs-list-row')];
      const allSelected = all.length > 0 && all.every(el => el.classList.contains('selected'));
      if (allSelected) {
        filesState.selected = [];
        all.forEach(el => el.classList.remove('selected'));
      } else {
        filesState.selected = [];
        all.forEach(el => {
          const prefix = el.classList.contains('fs-folder-card') ? 'f' : 'fi';
          const key = prefix + el.dataset.id;
          if (!filesState.selected.includes(key)) {
            filesState.selected.push(key);
            el.classList.add('selected');
          }
        });
      }
      updateBulkBar();
      updateSelectAllBtn();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filesState.selectMode) {
      exitFilesSelectMode();
    }
  });

  const backBtn = document.getElementById('fs-back-btn');
  if (backBtn) {
    backBtn.onclick = null;
    backBtn.addEventListener('click', () => {
      if (filesState.folderHistory.length) {
        const prevId = filesState.folderHistory.pop();
        loadFilesFolder(prevId, false);
      }
    });
  }
  }

  if (!hasAlpine) {
  document.querySelectorAll('.fs-nav-item').forEach(el => {
    el.onclick = null;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.page;
      if (page === 'archive') {
        loadFilesPage('archive');
      } else if (page === 'starred') {
        loadFilesPage('starred');
      } else if (page === 'recent') {
        loadFilesPage('recent');
      } else {
        loadFilesPage('home');
      }
    });
  });
  }

  const newBtn = document.getElementById('fs-new-btn');
  const newDd = document.getElementById('fs-new-dd');
  if (!hasAlpine) {
  newBtn.onclick = (e) => {
    e.stopPropagation();
    newDd.style.display = newDd.style.display === 'none' ? 'block' : 'none';
    newDd.style.position = 'absolute';
    newDd.style.top = (newBtn.offsetTop + newBtn.offsetHeight) + 'px';
    newDd.style.left = newBtn.offsetLeft + 'px';
  };
  document.addEventListener('click', (e) => {
    if (!newDd.contains(e.target) && e.target !== newBtn) newDd.style.display = 'none';
  });
  }
  if (!hasAlpine) {
  newDd.querySelectorAll('.fs-new-opt').forEach(el => {
    el.onclick = () => {
      newDd.style.display = 'none';
      const action = el.dataset.action;
      if (action === 'upload-file') {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = () => { if (input.files.length) uploadFilesItems(input.files); };
        input.click();
      } else if (action === 'create-folder') {
        document.getElementById('cf-name').value = '';
        openModal('create-folder-modal');
        document.getElementById('cf-confirm-btn').onclick = async () => {
          const name = document.getElementById('cf-name').value.trim();
          if (!name) return;
          closeModal('create-folder-modal');
          await createFilesFolder(name, filesState.activeFolderId);
        };
        document.getElementById('cf-name').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('cf-confirm-btn').click(); };
        setTimeout(() => document.getElementById('cf-name').focus(), 100);
      }
    };
  });
  }

  setupFilesUpload();
}
