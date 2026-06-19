export default function (Alpine) {
  Alpine.data('login', () => ({
    username: 'admin',
    password: 'password123',
    error: '',
    loading: false,

    async submit() {
      this.error = '';
      this.loading = true;
      try {
        const res = await this.$api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: this.username, password: this.password }),
        });
        if (res.error) {
          this.error = res.error;
          return;
        }
        const pipes = Alpine.store('pipes');
        pipes.token = res.token;
        pipes.user = res.user;
        pipes.isAdmin = res.user.role === 'admin';
        if (window.state) { window.state.token = res.token; window.state.user = res.user; }

        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        if (window.init) await init();
      } finally {
        this.loading = false;
      }
    },
  }))
}
