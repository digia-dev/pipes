function toggleFilesSelect(el, key) {
  if (document.getElementById('files-area')?.hasAttribute('x-data')) return;
  const idx = filesState.selected.indexOf(key);
  if (idx > -1) { filesState.selected.splice(idx, 1); el.classList.remove('selected'); }
  else { filesState.selected.push(key); el.classList.add('selected'); }
  updateBulkBar();
}

function rangeFilesSelect(el, prefix) {
  const cards = [...document.querySelectorAll('.fs-folder-card, .fs-file-card, .fs-list-row')];
  const idx = cards.indexOf(el);
  if (idx < 0) return;
  const lastIdx = filesState._lastIdx ?? idx;
  const [start, end] = idx > lastIdx ? [lastIdx, idx] : [idx, lastIdx];
  for (let i = start; i <= end; i++) {
    const card = cards[i];
    const key = (card.dataset.type === 'folder' ? 'f' : 'fi') + card.dataset.id;
    if (!filesState.selected.includes(key)) { filesState.selected.push(key); card.classList.add('selected'); }
  }
  filesState._lastIdx = idx;
  updateBulkBar();
}

function updateBulkBar() {
  if (document.getElementById('files-area')?.hasAttribute('x-data')) return;
  const count = filesState.selected.length;
  let bar = document.querySelector('.fs-bulk-bar');
  if (count === 0 || !filesState.selectMode) { if (bar) bar.classList.remove('visible'); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'fs-bulk-bar';
    bar.innerHTML = `
      <span class="fs-bb-count"></span>
      <button class="fs-bb-cut"><i data-lucide="scissors" size="11"></i> Cut</button>
      <button class="fs-bb-copy"><i data-lucide="copy" size="11"></i> Copy</button>
      <button class="fs-bb-delete"><i data-lucide="trash-2" size="11"></i> Delete</button>
      <button class="fs-bb-cancel">Cancel</button>
    `;
    bar.querySelector('.fs-bb-cut').addEventListener('click', () => bulkCutFiles());
    bar.querySelector('.fs-bb-copy').addEventListener('click', () => bulkCopyFiles());
    bar.querySelector('.fs-bb-delete').addEventListener('click', () => bulkDeleteFiles());
    bar.querySelector('.fs-bb-cancel').addEventListener('click', () => {
      exitFilesSelectMode();
    });
    document.getElementById('fs-main').appendChild(bar);
  }
  bar.classList.add('visible');
  bar.querySelector('.fs-bb-count').textContent = count + ' selected';
  updateSelectAllBtn();
  lucide.createIcons();
}

function exitFilesSelectMode() {
  if (document.getElementById('files-area')?.hasAttribute('x-data')) return;
  filesState.selectMode = false;
  filesState.selected = [];
  document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  updateBulkBar();
  const selAllBtn = document.getElementById('fs-selectall-btn');
  if (selAllBtn) selAllBtn.style.display = 'none';
  lucide.createIcons();
}

function parseSelections() {
  const folders = [], files = [];
  filesState.selected.forEach(k => { if (k.startsWith('f')) folders.push(parseInt(k.slice(1))); else files.push(parseInt(k.slice(2))); });
  return { folders, files };
}

function updateSelectAllBtn() {
  const btn = document.getElementById('fs-selectall-btn');
  if (!btn) return;
  const all = [...document.querySelectorAll('.fs-folder-card, .fs-file-card, .fs-list-row')];
  const allSelected = all.length > 0 && all.every(el => el.classList.contains('selected'));
  btn.innerHTML = allSelected ? '<i data-lucide="x" size="13"></i> Deselect All' : '<i data-lucide="check-square" size="13"></i> Select All';
  lucide.createIcons();
}

function openFilesContextMenu(x, y, type, id) {
  const menu = document.getElementById('fs-context-menu');
  const isAdmin = state.user?.role !== 'user';
  const isArchive = filesState.activePage === 'archive';

  if (type === 'folder') {
    menu.innerHTML = `
      <button class="fs-cm-item" data-action="open"><i data-lucide="folder-open" size="14"></i> Open</button>
      ${isAdmin ? `<button class="fs-cm-item" data-action="rename"><i data-lucide="pencil" size="14"></i> Rename</button>` : ''}
      <button class="fs-cm-item" data-action="cut"><i data-lucide="scissors" size="14"></i> Cut</button>
      ${isAdmin ? `<div class="fs-cm-divider"></div>
      <button class="fs-cm-item danger" data-action="delete"><i data-lucide="trash-2" size="14"></i> Delete</button>` : ''}
    `;
  } else if (isArchive) {
    menu.innerHTML = `
      <button class="fs-cm-item" data-action="open"><i data-lucide="eye" size="14"></i> Open Task</button>
      <button class="fs-cm-item" data-action="restore"><i data-lucide="rotate-ccw" size="14"></i> Restore</button>
      <button class="fs-cm-item" data-action="moveArchive"><i data-lucide="folder" size="14"></i> Move to Folder</button>
      <div class="fs-cm-divider"></div>
      <button class="fs-cm-item danger" data-action="delete"><i data-lucide="trash-2" size="14"></i> Delete</button>
    `;
  } else {
    menu.innerHTML = `
      <button class="fs-cm-item" data-action="open"><i data-lucide="eye" size="14"></i> Open</button>
      ${isAdmin ? `<button class="fs-cm-item" data-action="rename"><i data-lucide="pencil" size="14"></i> Rename</button>` : ''}
      <button class="fs-cm-item" data-action="copy"><i data-lucide="copy" size="14"></i> Copy</button>
      <button class="fs-cm-item" data-action="cut"><i data-lucide="scissors" size="14"></i> Cut</button>
      <div class="fs-cm-divider"></div>
      ${isAdmin ? `<button class="fs-cm-item danger" data-action="delete"><i data-lucide="trash-2" size="14"></i> Delete</button>` : ''}
    `;
  }

  menu._target = { type, id: parseInt(id) };
  menu.style.display = 'block';
  menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 300) + 'px';
}

const _fsCmEl = document.getElementById('fs-context-menu');
if (_fsCmEl && !_fsCmEl.hasAttribute('x-data')) {
_fsCmEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.fs-cm-item');
  if (!btn) return;
  const menu = document.getElementById('fs-context-menu');
  const target = menu._target || {};
  const action = btn.dataset.action;
  menu.style.display = 'none';

  if (action === 'open') {
    if (target.type === 'folder') loadFilesFolder(target.id);
    else if (filesState.activePage === 'archive') { selectTask(target.id); }
    else previewFilesItem(target.id);
  } else if (action === 'rename') {
    openRenameModal(target.type, target.id);
  } else if (action === 'copy') {
    if (target.type === 'folder') return;
    api('/files/items/' + target.id + '/duplicate', { method: 'POST', body: JSON.stringify({ folder_id: filesState.activeFolderId }) }).then(() => {
      loadFilesPage(filesState.activePage);
    });
  } else if (action === 'cut') {
    const key = (target.type === 'folder' ? 'f' : 'fi') + target.id;
    filesState.clipboard = {
      items: [{ key, type: target.type, id: target.id }],
      mode: 'cut',
    };
    updatePasteBtn();
    document.querySelectorAll('.fs-folder-card, .fs-file-card, .fs-list-row').forEach(el => {
      if (el.dataset.id == target.id) el.style.opacity = '0.45';
    });
  } else if (action === 'restore') {
    api('/lines/tasks/' + target.id + '/restore', { method: 'PUT' }).then(() => { loadFilesPage('archive'); });
  } else if (action === 'moveArchive') {
    api('/files/archive-folders').then(folders => {
      const items = (folders || []).map(f => `<button class="fs-move-item" data-fid="${f.id}"><i data-lucide="folder" size="14"></i> ${esc(f.name)} (${f.task_count || 0})</button>`).join('');
      const modal = document.getElementById('archive-move-modal');
      document.getElementById('archive-move-list').innerHTML = items || '<div style="padding:12px;color:var(--gray-400);font-size:13px">No folders</div>';
      document.getElementById('archive-move-id').value = target.id;
      modal.style.display = 'flex';
      setTimeout(() => {
        document.querySelectorAll('#archive-move-list .fs-move-item').forEach(el => {
          el.onclick = () => {
            api('/lines/tasks/' + target.id + '/archive-folder', { method: 'PUT', body: JSON.stringify({ folder_id: parseInt(el.dataset.fid) }) }).then(() => {
              modal.style.display = 'none'; loadFilesPage('archive');
            });
          };
        });
        document.getElementById('archive-move-cancel').onclick = () => { modal.style.display = 'none'; };
      }, 50);
      lucide.createIcons();
    });
  } else if (action === 'delete') {
    if (filesState.activePage === 'archive') {
      if (!confirm('Delete this archived task permanently?')) return;
      api('/lines/archive/bulk', { method: 'POST', body: JSON.stringify({ action: 'delete', task_ids: [target.id] }) }).then(() => { loadFilesPage('archive'); });
    } else if (target.type === 'folder') {
      deleteFilesFolder(target.id);
    } else {
      deleteFilesItem(target.id);
    }
  }
});
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('fs-context-menu');
  if (menu && !menu.contains(e.target) && !menu.hasAttribute('x-data')) menu.style.display = 'none';
});
document.addEventListener('keydown', (e) => {
  const menu = document.getElementById('fs-context-menu');
  if (menu && !menu.hasAttribute('x-data') && e.key === 'Escape') menu.style.display = 'none';
});

async function createFilesFolder(name, parentId) {
  await api('/files/folders', { method: 'POST', body: JSON.stringify({ name, parent_id: parentId }) });
  if (filesState.activeFolderId === parentId || (!parentId && !filesState.activeFolderId)) {
    await loadFilesFolder(filesState.activeFolderId);
  } else {
    const [folders, activity] = await Promise.all([api('/files/folders/tree'), api('/files/activity')]);
    filesState.folderTree = folders || [];
    state._fsActivity = activity || [];
    renderFilesSidebar();
    renderFilesActivity();
    lucide.createIcons();
  }
}

async function deleteFilesFolder(id) {
  try {
    await api('/files/folders/' + id, { method: 'DELETE' });
    if (filesState.activeFolderId === id) filesState.activeFolderId = null;
    const [folders, activity] = await Promise.all([api('/files/folders/tree'), api('/files/activity')]);
    filesState.folderTree = folders || [];
    state._fsActivity = activity || [];
    renderFilesPage();
  } catch (e) {
    alert('Failed to delete folder');
  }
}

async function deleteFilesItem(id) {
  if (!confirm('Delete this file?')) return;
  try {
    await api('/files/items/' + id, { method: 'DELETE' });
    const [files, activity] = await Promise.all([api('/files/items'), api('/files/activity')]);
    filesState.files = files || [];
    state._fsActivity = activity || [];
    renderFilesPage();
  } catch (e) {
    alert('Failed to delete file');
  }
}

async function bulkDeleteFiles() {
  const fileIds = filesState.selected.filter(k => k.startsWith('fi')).map(k => parseInt(k.slice(2)));
  const folderIds = filesState.selected.filter(k => k.startsWith('f') && !k.startsWith('fi')).map(k => parseInt(k.slice(1)));
  const total = fileIds.length + folderIds.length;
  if (!total || !confirm('Delete ' + total + ' item(s)?')) return;
  try {
    for (const fid of folderIds) await api('/files/folders/' + fid, { method: 'DELETE' });
    if (fileIds.length) await api('/files/bulk', { method: 'POST', body: JSON.stringify({ action: 'delete', file_ids: fileIds }) });
    exitFilesSelectMode();
    const [files, activity, tree] = await Promise.all([api('/files/items'), api('/files/activity'), api('/files/folders/tree')]);
    filesState.files = files || [];
    state._fsActivity = activity || [];
    filesState.folderTree = tree || [];
    renderFilesPage();
  } catch (e) {
    alert('Failed to delete items');
  }
}

async function bulkCopyFiles() {
  const fileIds = filesState.selected.filter(k => k.startsWith('fi')).map(k => parseInt(k.slice(2)));
  if (!fileIds.length) return;
  try {
    for (const id of fileIds) {
      await api('/files/items/' + id + '/duplicate', { method: 'POST', body: JSON.stringify({ folder_id: filesState.activeFolderId }) });
    }
    exitFilesSelectMode();
    const [files, activity] = await Promise.all([api('/files/items'), api('/files/activity')]);
    filesState.files = files || [];
    state._fsActivity = activity || [];
    renderFilesPage();
  } catch (e) {
    alert('Failed to copy items');
  }
}

function bulkCutFiles() {
  filesState.clipboard = {
    items: filesState.selected.map(k => ({ key: k, type: k.startsWith('f') && !k.startsWith('fi') ? 'folder' : 'file', id: parseInt(k.replace(/^fi?/, '')) })),
    mode: 'cut',
  };
  exitFilesSelectMode();
  updatePasteBtn();
  document.querySelectorAll('.fs-folder-card, .fs-file-card, .fs-list-row').forEach(el => {
    const key = (el.classList.contains('fs-folder-card') ? 'f' : 'fi') + el.dataset.id;
    if (filesState.clipboard.items.some(i => i.key === key)) {
      el.style.opacity = '0.45';
    }
  });
}

function updatePasteBtn() {
  if (document.getElementById('files-area')?.hasAttribute('x-data')) return;
  const btn = document.getElementById('fs-paste-btn');
  if (!btn) return;
  const count = filesState.clipboard.items.length;
  if (count && filesState.clipboard.mode === 'cut') {
    btn.style.display = 'flex';
    btn.innerHTML = `<i data-lucide="clipboard-paste" size="12"></i> Paste ${count} item${count !== 1 ? 's' : ''}`;
    btn.onclick = async () => {
      const fileIds = filesState.clipboard.items.filter(i => i.type === 'file').map(i => i.id);
      const folderIds = filesState.clipboard.items.filter(i => i.type === 'folder').map(i => i.id);
      try {
        for (const fid of folderIds) {
          await api('/files/folders/' + fid, { method: 'PUT', body: JSON.stringify({ parent_id: filesState.activeFolderId }) });
        }
        if (fileIds.length) {
          await api('/files/bulk', { method: 'POST', body: JSON.stringify({ action: 'move', file_ids: fileIds, folder_id: filesState.activeFolderId }) });
        }
      } catch (e) {
        alert('Failed to paste items');
      }
      filesState.clipboard = { items: [], mode: null };
      btn.style.display = 'none';
      const [files, activity, tree] = await Promise.all([api('/files/items'), api('/files/activity'), api('/files/folders/tree')]);
      filesState.files = files || [];
      state._fsActivity = activity || [];
      filesState.folderTree = tree || [];
      renderFilesPage();
    };
    lucide.createIcons();
  } else {
    btn.style.display = 'none';
  }
}
