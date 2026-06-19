export default function (Alpine) {
  Alpine.store('modals', {
    open: {},

    _lucide() {
      setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 0);
    },

    openModal(id) {
      document.getElementById(id)?.classList.add('open');
      this.open[id] = true;
      this._lucide();
    },

    closeModal(id) {
      document.getElementById(id)?.classList.remove('open');
      this.open[id] = false;
    },

    confirm(msg, subMsg, btnText) {
      return new Promise((resolve) => {
        document.getElementById('confirm-msg').textContent = msg;
        document.getElementById('confirm-sub').textContent = subMsg || '';
        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');
        yesBtn.textContent = btnText || 'Delete';
        yesBtn.onclick = () => { this.closeModal('confirm-modal'); resolve(true); };
        noBtn.onclick = () => { this.closeModal('confirm-modal'); resolve(false); };
        this.openModal('confirm-modal');
      });
    },
  });
}
