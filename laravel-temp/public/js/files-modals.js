function openRenameModal(type, id) {
  if (document.getElementById('rename-modal')?.hasAttribute('x-data')) return;
  const item = type === 'folder'
    ? filesState.folders.flatMap(f => f.children ? [f, ...f.children] : [f]).find(x => parseInt(x.id) === id)
    : filesState.files.find(f => f.id === id);
  const name = type === 'folder' ? (item?.name || '') : (item?.original_name || '');
  document.getElementById('rename-id').value = id;
  document.getElementById('rename-type').value = type;
  document.getElementById('rename-input').value = name;
  document.getElementById('rename-title').textContent = type === 'folder' ? 'Rename Folder' : 'Rename File';
  openModal('rename-modal');
  document.getElementById('rename-confirm-btn').onclick = async () => {
    const newName = document.getElementById('rename-input').value.trim();
    if (!newName) return;
    const tid = parseInt(document.getElementById('rename-id').value);
    const ttype = document.getElementById('rename-type').value;
    if (ttype === 'folder') {
      await api('/files/folders/' + tid, { method: 'PUT', body: JSON.stringify({ name: newName }) });
    } else {
      await api('/files/items/' + tid, { method: 'PUT', body: JSON.stringify({ name: newName }) });
    }
    closeModal('rename-modal');
    const [folders, files, activity] = await Promise.all([api('/files/folders/tree'), api('/files/items'), api('/files/activity')]);
    filesState.folderTree = folders || [];
    filesState.folders = filesState.activeFolderId !== null ? filesState.folders : (folders || []);
    filesState.files = files || [];
    state._fsActivity = activity || [];
    renderFilesPage();
  };
  document.getElementById('rename-input').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('rename-confirm-btn').click(); };
}

async function openMoveModal() {
  if (document.getElementById('move-modal')?.hasAttribute('x-data')) return;
  const list = document.getElementById('fs-move-list');
  const isCopy = filesState._copyMode;
  document.querySelector('#move-modal .modal-header h3').textContent = isCopy ? 'Copy to Folder' : 'Move to Folder';
  document.getElementById('move-confirm-btn').textContent = isCopy ? 'Copy' : 'Move';
  const folders = await api('/files/folders/tree');
  function renderMoveTree(nodes, depth) {
    return nodes.filter(n => n.id).map(n => {
      const childHtml = n.children?.length ? renderMoveTree(n.children, depth + 1) : '';
      const pad = depth * 20 + 8;
      return `<div class="fs-move-item" data-folder-id="${n.id}" style="padding-left:${pad}px"><i data-lucide="folder" size="14"></i><span>${esc(n.name)}</span></div>${childHtml}`;
    }).join('');
  }
  list.innerHTML = '<div class="fs-move-item" data-folder-id=""><i data-lucide="inbox" size="14"></i><span>Root (no folder)</span></div>' + renderMoveTree(folders, 0);
  list.querySelectorAll('.fs-move-item').forEach(el => {
    el.addEventListener('click', () => { list.querySelectorAll('.fs-move-item').forEach(x => x.classList.remove('selected')); el.classList.add('selected'); });
  });
  list.querySelector('.fs-move-item')?.classList.add('selected');
  document.getElementById('move-confirm-btn').onclick = async () => {
    const sel = list.querySelector('.fs-move-item.selected');
    if (!sel) return;
    const folderId = sel.dataset.folderId === '' ? null : parseInt(sel.dataset.folderId);
    const ids = filesState.selected.filter(k => k.startsWith('fi')).map(k => parseInt(k.slice(2)));
    if (ids.length) {
      if (isCopy) {
        for (const id of ids) {
          await api('/files/items/' + id + '/duplicate', { method: 'POST', body: JSON.stringify({ folder_id: folderId }) });
        }
      } else {
        await api('/files/bulk', { method: 'POST', body: JSON.stringify({ action: 'move', file_ids: ids, folder_id: folderId }) });
      }
    }
    filesState._copyMode = false;
    closeModal('move-modal');
    filesState.selected = [];
    const [files, activity] = await Promise.all([api('/files/items'), api('/files/activity')]);
    filesState.files = files || [];
    state._fsActivity = activity || [];
    renderFilesPage();
  };
  openModal('move-modal');
  lucide.createIcons();
}

async function openShareModal(itemType, itemId) {
  if (document.getElementById('share-modal')?.hasAttribute('x-data')) return;
  document.getElementById('share-permission').value = 'view';
  document.getElementById('share-links').innerHTML = '';
  openModal('share-modal');
  document.getElementById('share-generate-btn').onclick = async () => {
    const perm = document.getElementById('share-permission').value;
    const link = await api('/files/share', { method: 'POST', body: JSON.stringify({ item_type: itemType, item_id: itemId, permission: perm }) });
    if (link.id) {
      const shareUrl = window.location.origin + '/share/' + link.token;
      const linksDiv = document.getElementById('share-links');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 8px;background:var(--gray-50);border-radius:6px';
      row.innerHTML = `<span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(shareUrl)}</span>
        <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${shareUrl}')">Copy</button>
        <button class="btn btn-sm btn-danger" onclick="deleteShareLink(this,${link.id})">Remove</button>`;
      linksDiv.appendChild(row);
    }
  };
  const links = await api('/files/share?item_type=' + itemType + '&item_id=' + itemId);
  const linksDiv = document.getElementById('share-links');
  linksDiv.innerHTML = links.map(l => {
    const url = window.location.origin + '/share/' + l.token;
    return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 8px;background:var(--gray-50);border-radius:6px">
      <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(url)}</span>
      <span style="font-size:10px;color:var(--gray-500);text-transform:uppercase">${esc(l.permission)}</span>
      <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${url}')">Copy</button>
      <button class="btn btn-sm btn-danger" onclick="deleteShareLink(this,${l.id})">Remove</button>
    </div>`;
  }).join('');
}

async function deleteShareLink(btn, id) {
  await api('/files/share/' + id, { method: 'DELETE' });
  btn.closest('div')?.remove();
}

async function previewFilesItem(fileId) {
  if (document.getElementById('file-preview-modal')?.hasAttribute('x-data')) {
    if (window.Alpine) Alpine.store('modals').openModal('file-preview-modal');
    const fpEl = document.getElementById('file-preview-modal');
    if (fpEl?.__x) {
      const file = filesState.files.find(f => f.id === fileId);
      fpEl.__x.$data.file = file || { id: fileId, original_name: 'File', mime_type: '' };
      fpEl.__x.$data._scale = 1; fpEl.__x.$data._rotation = 0; fpEl.__x.$data.transform = '';
    }
    return;
  }
  const file = filesState.files.find(f => f.id === fileId);
  if (!file) return;
  const isImg = (file.mime_type || '').startsWith('image/');
  const isVideo = (file.mime_type || '').startsWith('video/');
  const streamUrl = '/api/files/items/' + fileId + '/stream?token=' + state.token;
  const downloadUrl = '/api/files/items/' + fileId + '/download?token=' + state.token;

  document.getElementById('file-preview-name').textContent = file.original_name;
  document.getElementById('file-preview-filename').textContent = file.original_name;
  document.getElementById('file-preview-download').href = downloadUrl;

  document.getElementById('file-preview-img').style.display = isImg ? '' : 'none';
  document.getElementById('file-preview-img').src = isImg ? streamUrl : '';
  document.getElementById('file-preview-img').style.transform = 'scale(1) rotate(0deg)';
  filesState._fpZoom = 1;
  filesState._fpRotation = 0;

  document.getElementById('file-preview-video').style.display = isVideo ? '' : 'none';
  if (isVideo) document.getElementById('fp-video-src').src = streamUrl;

  document.getElementById('file-preview-other').style.display = (!isImg && !isVideo) ? '' : 'none';

  const canDelete = state.user?.role === 'admin' || file.owner_id === state.user?.id;
  document.getElementById('file-preview-delete').style.display = canDelete ? '' : 'none';
  document.getElementById('fp-share-btn').style.display = canDelete ? '' : 'none';

  document.getElementById('file-preview-delete').onclick = async () => {
    closeModal('file-preview-modal');
    await deleteFilesItem(fileId);
  };
  document.getElementById('fp-share-btn').onclick = () => {
    closeModal('file-preview-modal');
    openShareModal('file', fileId);
  };

  openModal('file-preview-modal');
  lucide.createIcons();
}
