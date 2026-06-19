export default function (Alpine) {
  Alpine.data('notifications', () => ({
    init() {
      this.$watch('open', (val) => {
        if (val && window.loadNotifications) loadNotifications();
      });
    },

    get notifs() {
      return Alpine.store('pipes').notifications || [];
    },
    get open() {
      return Alpine.store('pipes').notifOpen;
    },
    set open(val) {
      Alpine.store('pipes').notifOpen = val;
    },
    get unread() {
      return this.notifs.filter(n => !n.is_read).length;
    },
    get badgeText() {
      const u = this.unread;
      if (u === 0) return '';
      return u > 99 ? '99+' : '' + u;
    },
    get showBadge() {
      return this.unread > 0;
    },

    toggle() {
      this.open = !this.open;
    },

    close() {
      this.open = false;
    },

    clickOutside(e) {
      if (!this.$el.contains(e.target)) {
        this.close();
      }
    },

    async markAllRead() {
      await this.$api('/notifications/read-all', { method: 'POST' });
      if (window.loadNotifications) loadNotifications();
    },

    async clickItem(n, e) {
      if (!n.is_read) {
        await this.$api(`/notifications/${n.id}/read`, { method: 'POST' });
      }
      this.close();
      if (n.task_id && window.selectTask) {
        selectTask(parseInt(n.task_id));
      }
      if (window.loadNotifications) loadNotifications();
    },

    formatDate(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr + 'Z').toLocaleString();
    },
  }))
}
