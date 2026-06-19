function getFileIcon(mimeType) {
  const mt = (mimeType || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'music';
  if (mt.includes('pdf')) return 'file-text';
  if (mt.includes('zip') || mt.includes('rar')) return 'archive';
  if (mt.includes('msword') || mt.includes('document')) return 'file-text';
  if (mt.includes('sheet') || mt.includes('excel')) return 'file-text';
  return 'file';
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function openModal(id) { document.getElementById(id).classList.add('open'); lucide.createIcons(); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

let _confirmResolve = null;
function closeConfirm(val) {
  closeModal('confirm-modal');
  if (_confirmResolve) _confirmResolve(val !== undefined ? val : false);
  _confirmResolve = null;
}

function showConfirm(msg, subMsg, btnText) {
  return new Promise((resolve) => {
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-sub').textContent = subMsg || '';
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    yesBtn.textContent = btnText || 'Delete';
    _confirmResolve = resolve;
    yesBtn.onclick = () => closeConfirm(true);
    noBtn.onclick = () => closeConfirm(false);
    const overlay = document.getElementById('confirm-modal');
    overlay.onclick = (e) => {
      if (e.target === overlay) closeConfirm(false);
    };
    openModal('confirm-modal');
  });
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
