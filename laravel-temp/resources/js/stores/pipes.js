export default function (Alpine) {
  Alpine.store('pipes', {
    // Auth
    token: null,
    user: null,
    isAdmin: false,

    // Lines (boards / columns / tasks)
    boards: [],
    columns: [],
    boardMembers: [],
    activeBoard: null,
    manageBoardColumns: [],
    lastColumnId: null,

    // Selected task detail
    selectedTask: null,
    files: [],
    comments: [],
    todos: [],
    commentsTab: 'comments',

    // Users
    users: [],

    // Notifications
    notifications: [],
    notifOpen: false,

    // Current page
    currentPage: 'lines',

    // Files module
    filesItems: [],
    folders: [],
    folderTree: [],
    activeFolderId: null,
    activeFilesPage: 'home',
    searchQuery: '',
    view: 'grid',
    selectMode: false,
    selectedFileIds: [],
    folderHistory: [],
    sortBy: 'name',
    sortDir: 'asc',
    expandedFolders: [],
    clipboard: { items: [], mode: null },
    activity: [],
  });
}
