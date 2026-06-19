const state = {
  boards: [], columns: [], users: [],
  boardMembers: [], todos: [],
  selectedTask: null, files: [],
  token: null, user: null,
  notifications: [], notifOpen: false,
  activeBoard: null, isAdmin: false,
  lastColumnId: null,
  manageBoardColumns: [],
  currentPage: 'lines',
};
window.state = state;

const filesState = {
  files: [],
  folders: [],
  folderTree: [],
  activeFolderId: null,
  activePage: 'home',
  searchQuery: '',
  view: 'grid',
  selectMode: false,
  selected: [],
  folderHistory: [],
  sortBy: 'name',
  sortDir: 'asc',
  _lastIdx: null,
  _draggedIds: [],
  expandedFolders: [],
  clipboard: { items: [], mode: null },
};
window.filesState = filesState;
