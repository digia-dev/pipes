async function loadUsers() {
  state.users = await api('/users');
}

async function init() {
  await loadUsers();
  await loadBoard();
  setup();
  loadNotifications();
  checkDueDates();
  setInterval(loadNotifications, 30000);
  setInterval(checkDueDates, 300000);
  lucide.createIcons();
}
