export default function (Alpine) {
  Alpine.data('appShell', () => ({
    searchQuery: '',
    searchResults: [],
    searchVisible: false,
    _searchTimer: null,

    get user() {
      return Alpine.store('pipes').user;
    },
    get isAdmin() {
      return Alpine.store('pipes').isAdmin;
    },
    get currentPage() {
      return Alpine.store('pipes').currentPage;
    },
    get pageTitle() {
      return this.currentPage === 'files' ? 'Files' : 'Lines';
    },
    get pageSub() {
      if (this.currentPage === 'files') return 'Manage your files and folders';
      if (!this.user) return '';
      return this.user.role === 'admin' ? 'Full Access'
        : this.user.role === 'manager' ? 'Can manage tasks'
        : 'View only';
    },
    get roleDisplay() {
      if (!this.user) return '';
      const names = { admin: 'Full Access', manager: 'Can manage tasks', user: 'View only' };
      return names[this.user.role] || '';
    },
    get initials() {
      if (!this.user) return '?';
      return (this.user.display_name || this.user.username || '?').charAt(0).toUpperCase();
    },
    switchPage(page) {
      if (window.switchPage) switchPage(page);
    },
    async logout() {
      await this.$api('/auth/logout', { method: 'POST' });
      const p = Alpine.store('pipes');
      p.token = null;
      p.user = null;
      p.isAdmin = false;
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-overlay').style.display = 'flex';
    },

    onSearchInput(el) {
      const q = el.value.trim();
      clearTimeout(this._searchTimer);
      if (!q) { this.searchVisible = false; this.searchResults = []; return; }
      this._searchTimer = setTimeout(async () => {
        try {
          const results = await this.$api('/search?q=' + encodeURIComponent(q));
          this.searchResults = Array.isArray(results) ? results : [];
          this.searchVisible = this.searchResults.length > 0;
        } catch { this.searchVisible = false; }
      }, 200);
    },
    onSearchBlur() {
      setTimeout(() => { this.searchVisible = false; }, 200);
    },
    onSearchFocus(el) {
      if (el.value.trim()) {
        el.dispatchEvent(new Event('input'));
      }
    },
    searchResultClick(result) {
      this.searchQuery = '';
      this.searchVisible = false;
      this.searchResults = [];
      if (result.type === 'task' && window.selectTask) selectTask(parseInt(result.id));
      else if (result.type === 'board' && window.loadBoard) loadBoard(parseInt(result.id));
    },
  }))
}
