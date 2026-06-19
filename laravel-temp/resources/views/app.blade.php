<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ config('app.name', 'Pipes') }}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="{{ asset('js/lucide.min.js') }}"></script>
  <script src="{{ asset('js/Sortable.min.js') }}"></script>
  @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
  <!-- Login Overlay -->
  <div class="login-overlay" id="login-overlay" x-data="login">
    <div class="login-card">
      <div class="login-logo">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#3B82F6"/><path d="M12 20l5 5 11-11" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h1 class="login-title">Pipes</h1>
      <p class="login-sub">Sign in to your workspace</p>
      <form class="login-form" id="login-form" autocomplete="off" x-on:submit.prevent="submit">
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="login-username" class="form-input" placeholder="e.g. admin, alice, bob" x-model="username">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="login-password" class="form-input" placeholder="password123" x-model="password">
        </div>
        <div class="login-error" id="login-error" x-show="error" x-text="error"></div>
        <button type="submit" class="btn btn-primary login-btn" id="login-btn" x-bind:disabled="loading">
          <span x-show="!loading">Sign In</span>
          <span x-show="loading">Signing in...</span>
        </button>
      </form>
      <div class="login-hint">
        <p>Demo accounts &mdash; password: <strong>password123</strong></p>
        <p><strong>admin</strong> (full access) &middot; <strong>alice</strong> (manager) &middot; <strong>bob</strong> (manager) &middot; <strong>charlie</strong> (view) &middot; <strong>diana</strong> (view)</p>
      </div>
    </div>
  </div>

  <!-- Main App -->
  <div class="app" id="app" style="display:none" x-data="appShell">
    <aside class="sidebar">
      <div class="sidebar-header">
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#3B82F6"/><path d="M12 20l5 5 11-11" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="logo-text">Pipes</span>
      </div>
      <nav class="sidebar-nav">
        <a href="#" class="nav-item" :class="{ active: currentPage === 'lines' }" data-page="lines" x-on:click.prevent="switchPage('lines')">
          <i data-lucide="columns"></i>
          <span>Lines</span>
          <span class="nav-indicator"></span>
        </a>
        <a href="#" class="nav-item" :class="{ active: currentPage === 'files' }" data-page="files" x-on:click.prevent="switchPage('files')">
          <i data-lucide="folder-open"></i>
          <span>Files</span>
          <span class="nav-indicator"></span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-user" x-show="user">
          <span class="sidebar-user-avatar" x-text="initials"></span>
          <span class="sidebar-user-name" x-text="user?.display_name || user?.username || ''"></span>
        </div>
        <a href="#" class="nav-item" id="logout-btn" x-on:click.prevent="logout">
          <i data-lucide="log-out"></i>
          <span>Sign Out</span>
        </a>
      </div>
    </aside>

    <div class="content">
      <header class="topbar">
        <div class="topbar-left">
          <div>
            <h1 class="topbar-title" id="topbar-title" x-text="pageTitle">Lines</h1>
            <p class="topbar-subtitle" id="topbar-role" x-text="pageSub">Manage tasks</p>
          </div>
        </div>
        <div class="topbar-center">
          <div class="search-bar">
            <i data-lucide="search" size="16"></i>
            <input type="text" id="search-input" placeholder="Search tasks, users, todos..." x-model="searchQuery" x-on:input="onSearchInput($el)" x-on:blur="onSearchBlur" x-on:focus="onSearchFocus($el)">
            <div class="search-dd" id="search-dd" x-show="searchVisible" x-on:click.outside="searchVisible = false">
              <template x-for="r in searchResults" :key="r.id + r.type">
                <div class="search-dd-item" x-on:mousedown.prevent="searchResultClick(r)">
                  <span class="search-dd-tag" :class="r.type" x-text="r.type"></span>
                  <span x-text="r.name"></span>
                </div>
              </template>
            </div>
          </div>
        </div>
        <div class="topbar-right">
          <div class="notif-wrap" id="notif-wrap" x-data="notifications" x-on:click.outside="close">
            <button class="notif-bell" id="notif-bell" x-on:click="toggle">
              <i data-lucide="bell" size="18"></i>
              <span class="notif-badge" id="notif-badge" x-show="showBadge" x-text="badgeText">0</span>
            </button>
            <div class="notif-dd" id="notif-dd" x-show="open">
              <div class="notif-dd-header">
                <span>Notifications</span>
                <button class="notif-read-all" id="notif-read-all" x-on:click="markAllRead">Mark all read</button>
              </div>
              <div class="notif-dd-list" id="notif-dd-list">
                <template x-for="n in notifs" :key="n.id">
                  <div class="notif-item" :class="{ 'notif-unread': !n.is_read }" :data-nid="n.id" x-on:click="clickItem(n, $event)">
                    <div class="notif-item-body">
                      <div class="notif-item-text" x-text="n.message"></div>
                      <div class="notif-item-time" x-text="formatDate(n.created_at)"></div>
                    </div>
                  </div>
                </template>
                <div class="notif-empty" x-show="notifs.length === 0">No notifications</div>
              </div>
            </div>
          </div>
          <div class="user-badge" id="user-badge" x-text="initials">A</div>
        </div>
      </header>

      <div class="main-body">
        <div class="board-area" x-data="board">
          <div class="board-toolbar">
            <div class="board-tabs" id="board-tabs">
              <template x-for="b in boards" :key="b.id">
                <button class="board-tab" :class="{ active: b.id === activeBoard }" x-on:click="switchBoard(b.id)" x-text="b.name"></button>
              </template>
            </div>
            <div class="board-actions">
              <button class="btn btn-secondary btn-sm" id="new-board-btn" x-on:click="openNewBoard">
                <i data-lucide="plus" size="14"></i> New Board
              </button>
              <button class="btn btn-secondary btn-sm" id="manage-board-btn" x-show="isAdmin" x-on:click="openManageBoard">
                <i data-lucide="settings" size="14"></i> Manage
              </button>
            </div>
          </div>
          <div class="board-columns" id="board-columns">
            <template x-if="!hasColumns">
              <div class="board-empty">No columns yet</div>
            </template>
            <template x-for="col in columns" :key="col.id">
              <div class="col" :data-column-id="col.id">
                <div class="col-header" :style="`background:${col.color || '#E2E8F0'}11`">
                  <span class="col-title" :style="`color:${col.color || '#1E293B'}`" x-text="col.name"></span>
                  <span class="col-count" x-text="(col.tasks || []).length"></span>
                  <button class="col-add-btn" :data-column-id="col.id" x-on:click="addTask(col.id)"><i data-lucide="plus" size="16"></i></button>
                </div>
                <div class="col-cards" :data-column-id="col.id" x-init="initSortable($el)">
                  <template x-for="t in (col.tasks || [])" :key="t.id">
                    <div class="card" :class="{ active: selectedTask && selectedTask.id == t.id }" :data-task-id="t.id" x-on:click="selectTask(t.id)">
                      <div class="card-edit" x-show="canEdit(t)" x-on:click.stop="editTask(t.id)">&hellip;</div>
                      <button class="card-archive-btn" x-show="canEdit(t) && isFinalCol(t.column_id)" x-on:click.stop="archiveTask(t.id)" title="Archive"><i data-lucide="archive" size="13"></i></button>
                      <div class="card-title" x-text="t.title"></div>
                      <div class="card-labels" x-show="t.labels">
                        <template x-for="l in (t.labels || '').split(',').filter(x => x.trim())" :key="l">
                          <span class="card-label" x-text="l.trim()"></span>
                        </template>
                      </div>
                      <div class="card-thumb">
                        <div class="card-thumb-img" x-show="t.thumb_file_id">
                          <img :src="fileImgSrc(t.thumb_file_id)">
                        </div>
                        <div class="card-desc" x-show="t.description && !t.thumb_file_id" x-text="t.description.length > 80 ? t.description.substring(0, 80) + '...' : t.description"></div>
                        <div class="card-thumb-file" x-show="!t.thumb_file_id && !t.description && parseInt(t.file_count || 0) > 0">
                          <i data-lucide="file" size="14"></i> <span x-text="t.file_count || 0"></span>
                        </div>
                      </div>
                      <div class="card-meta">
                        <div class="card-meta-left">
                          <template x-for="a in (t.assignees || [])" :key="a.id || a.user_id">
                            <div class="card-assignee" :style="`background:${assigneeColor(a.id || a.user_id)}`" x-text="(a.display_name || '').charAt(0)"></div>
                          </template>
                          <span class="card-comments"><i data-lucide="message-square" size="12"></i> <span x-text="t.comment_count || 0"></span></span>
                        </div>
                        <span class="card-due-wrap" x-show="t.due_date && !isFinalCol(t.column_id)">
                          <span class="card-due-dot" :class="getDueStatus(t.due_date)"></span>
                          <span class="card-due" x-text="t.due_date"></span>
                        </span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Files Module -->
        <div class="files-area" id="files-area" style="display:none" x-data="files">
          <aside class="fs-sidebar" id="fs-sidebar">
            <button class="fs-new-btn" id="fs-new-btn" x-on:click="toggleNewMenu">
              <i data-lucide="plus" size="16"></i> New
            </button>
            <div class="fs-new-dd" id="fs-new-dd" x-show="newMenuOpen" x-on:click.outside="newMenuOpen = false">
              <button class="fs-new-opt" data-action="upload-file" x-on:click="newAction('upload-file')"><i data-lucide="upload" size="14"></i> Upload File</button>
              <button class="fs-new-opt" data-action="create-folder" x-on:click="newAction('create-folder')"><i data-lucide="folder-plus" size="14"></i> Create Folder</button>
            </div>
            <nav class="fs-nav">
              <a href="#" class="fs-nav-item" :class="{ active: page === 'home' }" data-page="home" x-on:click.prevent="switchPage('home')"><i data-lucide="home" size="15"></i> Home</a>
              <a href="#" class="fs-nav-item" :class="{ active: page === 'starred' }" data-page="starred" x-on:click.prevent="switchPage('starred')"><i data-lucide="star" size="15"></i> Starred</a>
              <a href="#" class="fs-nav-item" :class="{ active: page === 'recent' }" data-page="recent" x-on:click.prevent="switchPage('recent')"><i data-lucide="clock" size="15"></i> Recent</a>
              <a href="#" class="fs-nav-item" :class="{ active: page === 'archive' }" data-page="archive" x-on:click.prevent="switchPage('archive')"><i data-lucide="archive" size="15"></i> Archive</a>
            </nav>
            <div class="fs-nav-divider"></div>
            <div class="fs-nav-label">Folders</div>
            <div class="fs-folder-tree" id="fs-folder-tree">
              <template x-for="n in flatFolderTree" :key="n.id">
                <div class="fs-folder-item" :class="{ active: n.id === activeFolderId }" :data-folder-id="n.id" :style="'padding-left:'+(n.depth*16+16)+'px'" x-on:click="openFolder(n.id)">
                  <span class="fs-tree-arrow" :style="{ visibility: n.children?.length ? '' : 'hidden' }" x-on:click.stop="toggleFolderTree(n.id)" x-text="expandedFolders.includes(n.id) ? '▾' : '▸'"></span>
                  <i data-lucide="folder" size="14"></i> <span x-text="n.name"></span>
                </div>
              </template>
            </div>
            <div class="fs-activity" id="fs-activity">
              <div class="fs-activity-header">Recent Activity</div>
              <div class="fs-activity-list" id="fs-activity-list">
                <div class="fs-activity-item" style="color:var(--gray-400)" x-show="!activity.length">No recent activity</div>
                <template x-for="a in activity.slice(0,10)" :key="a.id || a.created_at">
                  <div class="fs-activity-item">
                    <span><span class="aa-user" x-text="a.user_name||''"></span>                     <span class="aa-action" x-text="(activityLabels[a.action]||a.action)+' '+(a.item_type||'')"></span></span>
                    <span class="aa-time" x-text="new Date((a.created_at||'')+'Z').toLocaleString()"></span>
                  </div>
                </template>
              </div>
            </div>
          </aside>
          <main class="fs-main" id="fs-main" x-on:dragover.prevent x-on:drop.prevent="handleDrop" x-on:dragenter="handleDragEnter" x-on:dragleave="handleDragLeave">
            <div class="fs-toolbar" id="fs-toolbar">
              <div class="fs-toolbar-left">
                <button class="fs-back-btn" id="fs-back-btn" x-show="folderHistory.length" x-on:click="goBack"><i data-lucide="arrow-left" size="14"></i></button>
                <div class="fs-breadcrumb" id="fs-breadcrumb">
                  <span class="fs-bc-item" :class="{ active: !activeFolderId }">My Files</span>
                  <span x-show="activeFolderId"><span class="fs-bc-sep">/</span><span class="fs-bc-item active">...</span></span>
                </div>
              </div>
              <div class="fs-toolbar-center">
                <div class="fs-search">
                  <i data-lucide="search" size="14"></i>
                  <input type="text" id="fs-search-input" placeholder="Search files, folders..." x-model="Alpine.store('pipes').searchQuery">
                </div>
              </div>
              <div class="fs-toolbar-right">
                <button class="fs-selectall-btn" id="fs-selectall-btn" x-show="selectedFileIds.length" x-on:click="toggleSelectAll"><i data-lucide="check-square" size="13"></i> <span x-text="allSelected ? 'Deselect All' : 'Select All'"></span></button>
                <button class="fs-paste-btn" id="fs-paste-btn" x-show="Alpine.store('pipes').clipboard?.items?.length" x-on:click="pasteItems"><i data-lucide="clipboard-paste" size="12"></i> <span x-text="'Paste '+(Alpine.store('pipes').clipboard?.items?.length||0)+' item(s)'"></span></button>
                <div class="fs-view-toggle" id="fs-view-toggle">
                  <button class="fs-view-btn" :class="{ active: view === 'grid' }" data-view="grid" title="Grid view" x-on:click.prevent="switchView('grid')"><i data-lucide="grid" size="14"></i></button>
                  <button class="fs-view-btn" :class="{ active: view === 'list' }" data-view="list" title="List view" x-on:click.prevent="switchView('list')"><i data-lucide="list" size="14"></i></button>
                </div>
              </div>
            </div>
            <div class="fs-content" id="fs-content">
              <div class="fs-empty" id="fs-empty" x-show="!filteredFolders.length && !filteredFiles.length && !loading">
                <i data-lucide="folder-open" size="48"></i>
                <p>No files yet</p>
                <span>Upload files or create a folder to get started</span>
              </div>
              <div class="fs-folder-grid" id="fs-folder-grid" x-show="filteredFolders.length">
                <template x-for="f in filteredFolders" :key="f.id">
                  <div class="fs-folder-card" :data-id="f.id" x-on:click="openFolder(f.id)" x-on:contextmenu.prevent="openContextMenu('folder', f.id, $event)">
                    <div class="fs-fc-check fs-check-el" x-on:click.stop="toggleSelect('folder', f.id)"></div>
                    <div class="fs-fc-actions" x-show="isAdmin">
                      <button class="fs-fc-rename" title="Rename" x-on:click.stop="inlineRename('folder', f.id, $el.parentElement.nextElementSibling.nextElementSibling)">
                        <i data-lucide="pencil" size="11"></i>
                      </button>
                      <button class="fs-fc-del danger" title="Delete" x-on:click.stop="confirmDelete('folder', f.id)">
                        <i data-lucide="trash-2" size="11"></i>
                      </button>
                    </div>
                    <div class="fs-fc-icon"><i data-lucide="folder" size="32"></i></div>
                    <div class="fs-fc-name" x-text="f.name"></div>
                    <div class="fs-fc-count" x-text="(f.file_count||0)+' item'+(f.file_count!==1?'s':'')"></div>
                  </div>
                </template>
              </div>
              <div class="fs-section-label" id="fs-section-label" x-show="filteredFiles.length" x-text="page==='archive'?'Archived Tasks':'Files'"></div>
              <div class="fs-grid" id="fs-grid" x-show="view==='grid' && filteredFiles.length">
                <template x-for="f in filteredFiles" :key="f.id">
                  <div class="fs-file-card" :class="{ selected: selectedFileIds.includes('fi'+f.id) }" :data-type="page==='archive'?'task':'file'" :data-id="f.id" x-on:click="openFile(f.id)" x-on:contextmenu.prevent="openContextMenu('file', f.id, $event)">
                    <div class="fs-fcard-check fs-check-el" x-on:click.stop="toggleSelect('file', f.id)"></div>
                    <div class="fs-fcard-star fs-star-btn" :class="{ starred: f.is_starred }" :data-id="f.id" x-on:click.stop="toggleStar(f.id)">
                      <i data-lucide="star" size="12"></i>
                    </div>
                    <div class="fs-fcard-thumb">
                      <template x-if="f.mime_type?.startsWith('image/')">
                        <img :src="'/api/files/items/'+f.id+'/stream?token='+token">
                      </template>
                      <template x-if="!f.mime_type?.startsWith('image/')">
                        <div class="fs-fcard-icon"><i data-lucide="file" size="36"></i></div>
                      </template>
                    </div>
                    <div class="fs-fcard-body">
                      <div class="fs-fcard-name" x-text="f.original_name||f.title||''"></div>
                      <div class="fs-fcard-meta">
                        <span class="fs-fcard-owner" x-show="f.owner_name" x-text="f.owner_name"></span>
                        <span class="fs-fcard-size" x-show="f.size" x-text="formatSize(f.size)"></span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
              <div class="fs-list" id="fs-list" x-show="view==='list' && filteredFiles.length">
                <div class="fs-list-header">
                  <span></span>
                  <span data-sort="name" x-on:click="setSort('name')">Name<span x-show="sortBy==='name'" x-text="sortDir==='asc'?' ▲':' ▼'"></span></span>
                  <span data-sort="owner" x-on:click="setSort('owner')">Owner<span x-show="sortBy==='owner'" x-text="sortDir==='asc'?' ▲':' ▼'"></span></span>
                  <span data-sort="size" x-on:click="setSort('size')">Size<span x-show="sortBy==='size'" x-text="sortDir==='asc'?' ▲':' ▼'"></span></span>
                  <span data-sort="created_at" x-on:click="setSort('created_at')">Date<span x-show="sortBy==='created_at'" x-text="sortDir==='asc'?' ▲':' ▼'"></span></span>
                </div>
                <template x-for="f in filteredFiles" :key="f.id">
                  <div class="fs-list-row" :class="{ selected: selectedFileIds.includes('fi'+f.id) }" :data-type="page==='archive'?'task':'file'" :data-id="f.id" x-on:click="openFile(f.id)" x-on:contextmenu.prevent="openContextMenu('file', f.id, $event)">
                    <div class="fs-lr-check fs-check-el" x-on:click.stop="toggleSelect('file', f.id)"></div>
                    <div class="fs-lr-name">
                      <i data-lucide="file" size="14"></i>
                      <span x-text="f.original_name||f.title||''"></span>
                    </div>
                    <div class="fs-lr-owner" x-text="f.owner_name||''"></div>
                    <div class="fs-lr-size" x-text="f.size?formatSize(f.size):''"></div>
                    <div class="fs-lr-date" x-text="f.created_at?new Date(f.created_at+'Z').toLocaleDateString():''"></div>
                  </div>
                </template>
              </div>
            </div>
            <div class="fs-context-menu" id="fs-context-menu" x-show="contextMenu.visible" :style="'left:'+contextMenu.x+'px;top:'+contextMenu.y+'px'" x-on:click.outside="contextMenu.visible = false">
              <template x-for="item in contextMenu.items" :key="item.action">
                <button class="fs-cm-item" :class="{ danger: item.danger }" x-on:click="contextAction(item.action)" x-data>
                  <i :data-lucide="item.icon" size="14"></i> <span x-text="item.label"></span>
                </button>
              </template>
            </div>
          </main>
          <div class="fs-upload-overlay" id="fs-upload-overlay" x-show="uploadOverlay" style="display:none">
            <div class="fs-upload-overlay-content">
              <i data-lucide="upload-cloud" size="48"></i>
              <p>Drop files here to upload</p>
            </div>
          </div>
          <div class="fs-upload-progress" id="fs-upload-progress" x-show="uploadProgress.length" style="display:none">
            <div class="fs-up-header">Uploading...</div>
            <div class="fs-up-list" id="fs-up-list">
              <template x-for="(u, i) in uploadProgress" :key="i">
                <div class="fs-up-item"><span class="fs-up-name" x-text="u.name"></span><div class="fs-up-bar"><div class="fs-up-fill" :style="'width:'+Math.max(0,u.progress)+'%'" :class="{ 'fs-up-err': u.progress < 0 }"></div></div></div>
              </template>
            </div>
          </div>
        </div>

        <aside class="comments-panel" id="comments-panel" x-data="comments">
          <div class="cp-header">
            <div class="cp-header-info">
              <div class="cp-avatar" id="cp-avatar" :style="task ? `background:${avatarColor(task.id)}` : ''" x-text="task ? task.title.charAt(0).toUpperCase() : '?'">?</div>
              <div>
                <div class="cp-title" id="cp-title" x-text="task ? task.title : 'Select a task'" x-on:dblclick="openDetail">Select a task</div>
                <div class="cp-sub" id="cp-sub" x-text="task ? '#' + task.id : 'Click a card'">Click a card</div>
              </div>
            </div>
            <button class="btn-icon" id="cp-close" x-on:click="closePanel"><i data-lucide="x" size="16"></i></button>
          </div>
          <div class="cp-body" id="cp-body">
            <div class="cp-empty" x-show="!task"><i data-lucide="message-square" size="36"></i><p>Select a task to view discussion</p></div>
          </div>
          <div class="cp-input-area" id="cp-input-area">
            <div class="cp-recent-files" id="cp-recent-files" x-show="taskFiles.length">
              <div class="cp-desc-label"><i data-lucide="paperclip" size="13"></i> Files</div>
              <div class="cp-files-grid" id="cp-files-grid">
                <template x-for="f in taskFiles" :key="f.id">
                  <div class="file-thumb" :title="f.original_name">
                    <span class="file-thumb-del" x-on:click.stop="deleteTaskFile(f.id)">&times;</span>
                    <div x-on:click="if(window.previewFile) previewFile(f.id)">
                      <template x-if="f.mime_type?.startsWith('image/')">
                        <img :src="fileImgSrc(f.id)">
                      </template>
                      <template x-if="!f.mime_type?.startsWith('image/')">
                        <span class="file-icon"><i data-lucide="file" size="20"></i></span>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div class="cp-tabs">
              <button class="cp-tab" :class="{ active: activeTab === 'comments' }" data-cp-tab="comments" x-on:click="switchTab('comments')">Comments</button>
              <button class="cp-tab" :class="{ active: activeTab === 'todo' }" data-cp-tab="todo" x-on:click="switchTab('todo')">Checklist</button>
            </div>
            <div class="cp-tab-content" id="cp-tab-comments" x-show="activeTab === 'comments'">
              <div class="cp-messages" id="cp-messages">
                <div class="cp-empty-msg" x-show="!comments?.length" style="text-align:center;color:var(--gray-400);font-size:13px;padding:20px">No comments yet</div>
                <template x-for="c in parentComments" :key="c.id">
                  <div>
                    <div class="cp-msg" :data-cid="c.id">
                      <div class="cp-msg-avatar" :style="'background:'+avatarColor(c.user_id)">
                        <span x-text="userInitial(c.user_id)"></span>
                      </div>
                      <div class="cp-msg-body">
                        <div class="cp-msg-header">
                          <span class="cp-msg-author" x-text="userDisplay(c.user_id)"></span>
                          <span class="cp-msg-time" x-text="formatDate(c.created_at)"></span>
                          <span class="cp-msg-actions" x-show="canEdit(c.user_id)">
                            <span class="cp-msg-edit" x-on:click="openEdit(c)"><i data-lucide="pencil" size="1"></i></span>
                            <span class="cp-msg-del" x-on:click="deleteComment(c.id)"><i data-lucide="trash-2" size="1"></i></span>
                          </span>
                        </div>
                        <div x-show="editingCommentId !== c.id" class="cp-msg-content" x-html="renderText(c.content)"></div>
                        <div x-show="editingCommentId === c.id" style="display:flex;gap:6px">
                          <textarea class="form-input cp-edit-input" style="flex:1;min-height:36px;resize:none" x-model="editText" :id="'cp-edit-textarea-'+c.id" x-on:keydown="if ($event.key === 'Enter' && !$event.shiftKey) { $event.preventDefault(); saveEdit(c); }"></textarea>
                          <button class="btn btn-primary btn-sm" x-on:click="saveEdit(c)">Save</button>
                          <button class="btn btn-sm btn-secondary" x-on:click="closeEdit">Cancel</button>
                        </div>
                        <div class="cp-msg-files" :id="'msg-files-'+c.id" x-show="filesForComment(c.id).length">
                          <template x-for="f in filesForComment(c.id)" :key="f.id">
                            <a class="msg-file-attach" x-on:click.prevent="if(window.previewFile) previewFile(f.id)">
                              <template x-if="f.mime_type?.startsWith('image/')">
                                <img :src="fileImgSrc(f.id)">
                              </template>
                              <template x-if="!f.mime_type?.startsWith('image/')">
                                <span class="file-icon"><i data-lucide="file" size="14"></i></span>
                              </template>
                              <span x-text="f.original_name"></span>
                            </a>
                          </template>
                        </div>
                        <span class="cp-msg-reply" :data-cid="c.id" x-on:click="openReplyForm(c.id)">Reply <span x-show="replyCount(c.id)" x-text="'('+replyCount(c.id)+')'"></span></span>
                      </div>
                    </div>
                    <div class="cp-reply-form" x-show="replyFormFor === c.id">
                      <div class="cp-reply-to" x-text="'Replying to @'+userDisplay(c.user_id)"></div>
                      <div style="display:flex;gap:4px;margin-top:4px">
                        <input type="text" class="form-input cp-reply-input" placeholder="Reply..." style="flex:1;font-size:11px" :id="'cp-reply-'+c.id" x-model="replyText" x-on:keydown="if ($event.key === 'Enter' && !$event.shiftKey) { $event.preventDefault(); sendReply(c.id); }" x-on:input="onInput($el)">
                        <button class="btn btn-primary btn-sm" x-on:click="sendReply(c.id)">Send</button>
                        <button class="btn btn-sm btn-secondary" x-on:click="closeReplyForm">Cancel</button>
                      </div>
                    </div>
                    <template x-for="r in repliesFor(c.id)" :key="r.id">
                      <div class="cp-msg cp-reply" :data-cid="r.id">
                        <div class="cp-msg-avatar cp-reply-avatar" :style="'background:'+avatarColor(r.user_id)">
                          <span x-text="userInitial(r.user_id)"></span>
                        </div>
                        <div class="cp-msg-body">
                          <div class="cp-msg-header">
                            <span class="cp-msg-author" x-text="userDisplay(r.user_id)"></span>
                            <span class="cp-msg-time" x-text="formatDate(r.created_at)"></span>
                            <span class="cp-msg-actions" x-show="canEdit(r.user_id)">
                              <span class="cp-msg-edit" x-on:click="openEdit(r)"><i data-lucide="pencil" size="1"></i></span>
                              <span class="cp-msg-del" x-on:click="deleteComment(r.id)"><i data-lucide="trash-2" size="1"></i></span>
                            </span>
                          </div>
                          <div x-show="editingCommentId !== r.id" class="cp-msg-content" x-html="renderText(r.content)"></div>
                          <div x-show="editingCommentId === r.id" style="display:flex;gap:6px">
                            <textarea class="form-input cp-edit-input" style="flex:1;min-height:36px;resize:none" x-model="editText" :id="'cp-edit-textarea-'+r.id" x-on:keydown="if ($event.key === 'Enter' && !$event.shiftKey) { $event.preventDefault(); saveEdit(r); }"></textarea>
                            <button class="btn btn-primary btn-sm" x-on:click="saveEdit(r)">Save</button>
                            <button class="btn btn-sm btn-secondary" x-on:click="closeEdit">Cancel</button>
                          </div>
                          <div class="cp-msg-files" :id="'msg-files-'+r.id" x-show="filesForComment(r.id).length">
                            <template x-for="f in filesForComment(r.id)" :key="f.id">
                              <a class="msg-file-attach" x-on:click.prevent="if(window.previewFile) previewFile(f.id)">
                                <template x-if="f.mime_type?.startsWith('image/')">
                                  <img :src="fileImgSrc(f.id)">
                                </template>
                                <template x-if="!f.mime_type?.startsWith('image/')">
                                  <span class="file-icon"><i data-lucide="file" size="14"></i></span>
                                </template>
                                <span x-text="f.original_name"></span>
                              </a>
                            </template>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </div>
            <div class="cp-tab-content" id="cp-tab-todo" x-show="activeTab === 'todo'">
              <div class="cp-todo-list" id="cp-todo-list">
                <div class="cp-empty-msg" x-show="!todos.length" style="text-align:center;color:var(--gray-400);font-size:13px;padding:20px">No checklist items</div>
                <template x-for="t in todos" :key="t.id">
                  <div class="todo-item" :data-todo-id="t.id">
                    <div class="todo-check" :class="{ checked: t.status === 'completed' }" x-on:click="toggleTodo(t.id)"></div>
                    <span class="todo-name" :class="{ done: t.status === 'completed' }" x-on:click="editTodo(t.id)">
                      <span x-text="t.name"></span>
                      <span class="todo-has-notes" x-show="t.notes">&#9998;</span>
                    </span>
                    <span class="todo-meta" x-text="t.owner_name || ''"></span>
                    <span class="todo-del" x-on:click="deleteTodo(t.id)">&times;</span>
                  </div>
                </template>
                <div class="todo-create-form">
                  <input type="text" id="todo-create-input" class="form-input" placeholder="Add checklist item..." style="flex:1" x-model="newTodoText" x-on:keydown="if ($event.key === 'Enter') addTodo()">
                  <button class="btn btn-primary btn-sm" id="todo-create-btn" x-on:click="addTodo">Add</button>
                </div>
              </div>
            </div>
            <div class="cp-upload-preview" id="cp-upload-preview" x-show="uploadPreviewVisible">
              <span class="up-name" x-text="uploadFileName"></span>
              <span class="up-remove" x-on:click="cancelUpload"><i data-lucide="x" size="14"></i></span>
            </div>
            <div class="cp-input-wrapper" id="cp-input-wrapper" x-show="activeTab === 'comments'">
              <textarea class="cp-input" id="cp-input" rows="1" placeholder="Write a comment... (@user, #todo)" x-model="commentText" x-on:input="onInput($el)" x-on:keydown="onKeydown($event, task?.id)"></textarea>
              <button class="cp-attach-btn" id="cp-file-picker-btn" title="Attach file" x-on:click="toggleFilePicker"><i data-lucide="paperclip" size="16"></i></button>
              <button class="cp-send" id="cp-send" x-on:click="send(task?.id)"><i data-lucide="send" size="16"></i></button>
              <div class="cp-file-picker" id="cp-file-picker" x-show="filePickerOpen" x-on:click.outside="filePickerOpen = false">
                <button class="cp-fp-option" data-action="files" x-on:click="pickFromFiles"><i data-lucide="folder-open" size="16"></i><span>From Files</span></button>
                <button class="cp-fp-option" data-action="upload" x-on:click="pickUpload"><i data-lucide="upload" size="16"></i><span>Upload</span></button>
                <button class="cp-fp-option" data-action="camera" x-on:click="pickCamera"><i data-lucide="camera" size="16"></i><span>Camera</span></button>
              </div>
              <input type="file" id="cp-file-input" hidden x-on:change="onFileSelected">
              <input type="file" id="cp-camera-input" capture="environment" accept="image/*" hidden x-on:change="onCameraSelected">
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>

  <!-- Modals -->
  <div class="modal-overlay" id="task-modal" x-data="newTaskModal" x-on:click="if ($event.target == $el) $store.modals.closeModal('task-modal')">
    <div class="modal">
      <div class="modal-header"><h3>New Task</h3><button class="btn-icon" x-on:click="$store.modals.closeModal('task-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>Title</label><input type="text" id="new-task-title" class="form-input" placeholder="Enter task title..." x-model="title"></div>
        <div class="form-group"><label>Due Date</label><input type="date" id="new-task-due" class="form-input" x-model="due"></div>
        <div class="form-group"><label>Description</label><textarea id="new-task-desc" class="form-input" rows="3" x-model="desc"></textarea></div>
        <div class="form-group"><label>Assignees</label>
          <div class="mb-pills" id="nt-assignee-pills"></div>
          <div class="mb-search-wrap" style="margin-top:6px">
            <input type="text" id="nt-assignee-search" class="form-input" placeholder="Search members..." autocomplete="off">
            <div class="mb-search-dd" id="nt-assignee-dd"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" x-on:click="$store.modals.closeModal('task-modal')">Cancel</button>
        <button class="btn btn-primary" x-on:click="submit">Create</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="card-detail-modal" x-data="editTaskModal" x-on:click="if ($event.target == $el) $store.modals.closeModal('card-detail-modal')">
    <div class="modal modal-lg">
      <div class="modal-header"><h3 id="card-detail-title">Task</h3><button class="btn-icon" x-on:click="$store.modals.closeModal('card-detail-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>Title</label><input type="text" id="edit-task-title" class="form-input" x-model="title"></div>
        <div class="form-group"><label>Description</label><textarea id="edit-task-desc" class="form-input" rows="4" x-model="desc"></textarea></div>
        <div class="form-group"><label>Assignees</label>
          <div class="mb-pills" id="edit-assignee-pills"></div>
          <div class="mb-search-wrap" style="margin-top:6px">
            <input type="text" id="edit-assignee-search" class="form-input" placeholder="Search members..." autocomplete="off">
            <div class="mb-search-dd" id="edit-assignee-dd"></div>
          </div>
        </div>
        <div class="form-group"><label>Due Date</label><input type="date" id="edit-task-due" class="form-input" x-model="due"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" id="delete-task-btn" x-show="canEdit" x-on:click="deleteTask">Delete</button>
        <button class="btn btn-secondary" x-on:click="$store.modals.closeModal('card-detail-modal')">Cancel</button>
        <button class="btn btn-primary" id="confirm-edit-task-btn" x-show="canEdit" x-on:click="submit">Save</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="board-modal" x-data="newBoardModal" x-on:click="if ($event.target == $el) $store.modals.closeModal('board-modal')">
    <div class="modal">
      <div class="modal-header"><h3>New Board</h3><button class="btn-icon" x-on:click="$store.modals.closeModal('board-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>Board Name</label><input type="text" id="new-board-name" class="form-input" placeholder="e.g. Design, Marketing" x-model="name"></div>
        <div class="form-group"><label>Stages</label>
          <div class="mb-pills" id="nb-stage-pills">
            <template x-for="(s, i) in stages" :key="i">
              <span class="mb-pill">
                <span x-text="s"></span>
                <span class="mb-pill-remove" x-on:click="removeStage(i)">&times;</span>
              </span>
            </template>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px">
            <input type="text" id="nb-stage-input" class="form-input" placeholder="Type stage name and press Enter..." style="flex:1" x-model="stageInput" x-on:keydown="if ($event.key === 'Enter') { $event.preventDefault(); addStage(stageInput); stageInput = ''; }">
            <button class="btn btn-primary btn-sm" id="nb-stage-add-btn" x-on:click="addStage(stageInput); stageInput = '';">Add</button>
          </div>
        </div>
        <div class="form-group"><label>Assign Members</label>
          <div class="mb-pills" id="nb-pills">
            <template x-for="(m, i) in members" :key="m.id">
              <span class="mb-pill">
                <span x-text="m.display_name"></span>
                <span class="mb-pill-remove" x-on:click="removeMember(m)">&times;</span>
              </span>
            </template>
          </div>
          <div class="mb-search-wrap" style="margin-top:6px">
            <input type="text" id="nb-search-input" class="form-input" placeholder="Search users..." autocomplete="off" x-model="memberSearch">
            <div class="mb-search-dd" id="nb-search-dd" x-show="searchResults.length">
              <template x-for="u in searchResults" :key="u.id">
                <div class="mb-search-item" :data-uid="u.id" x-on:click="addMember(u)">
                  <span class="mb-search-avatar" x-text="(u.display_name||'?').charAt(0).toUpperCase()"></span>
                  <span x-text="u.display_name"></span>
                  <span class="mb-search-uname" x-text="'@'+(u.username||'')"></span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" x-on:click="$store.modals.closeModal('board-modal')">Cancel</button>
        <button class="btn btn-primary" x-on:click="submit">Create</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="manage-board-modal" x-data="manageBoardModal" x-on:click="if ($event.target == $el) $store.modals.closeModal('manage-board-modal')">
    <div class="modal">
      <div class="modal-header"><h3>Manage Board</h3><button class="btn-icon" x-on:click="$store.modals.closeModal('manage-board-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>Board Name</label><div style="display:flex;gap:6px"><input type="text" id="manage-board-name" class="form-input" style="flex:1" x-model="boardName"><button class="btn btn-primary btn-sm" id="rename-board-btn" x-on:click="renameBoard">Rename</button></div></div>
        <div class="form-group"><label>Default Description</label><textarea id="manage-board-desc-template" class="form-input" rows="3" placeholder="e.g. Describe the task requirements..." x-model="descriptionTemplate"></textarea></div>
        <hr style="margin:12px 0;border-color:var(--gray-200)">
        <div class="form-group"><label>Stages</label>
          <div class="mb-pills" id="mb-stage-pills">
            <template x-for="col in columns" :key="col.id">
              <span class="mb-pill">
                <span x-text="col.name"></span>
                <span class="mb-pill-remove" x-on:click="removeStage(col)">&times;</span>
              </span>
            </template>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px">
            <input type="text" id="mb-stage-input" class="form-input" placeholder="Add stage..." style="flex:1" x-model="stageInput" x-on:keydown="if ($event.key === 'Enter') { $event.preventDefault(); addStage(); }">
            <button class="btn btn-primary btn-sm" id="mb-stage-add-btn" x-on:click="addStage">Add</button>
          </div>
        </div>
        <hr style="margin:12px 0;border-color:var(--gray-200)">
        <div class="form-group"><label>Members</label>
          <div class="mb-search-wrap" style="margin-bottom:6px">
            <input type="text" id="mb-search-input" class="form-input" placeholder="Search users..." autocomplete="off" x-model="memberSearch">
            <div class="mb-search-dd" id="mb-search-dd" x-show="searchResults.length">
              <template x-for="u in searchResults" :key="u.id">
                <div class="mb-search-item" x-on:click="addMember(u)">
                  <span class="mb-search-avatar" x-text="(u.display_name||'?').charAt(0).toUpperCase()"></span>
                  <span x-text="u.display_name"></span>
                  <span class="mb-search-uname" x-text="'@'+(u.username||'')"></span>
                </div>
              </template>
            </div>
          </div>
          <div class="mb-pills" id="mb-pills">
            <template x-for="m in members" :key="m.id">
              <span class="mb-pill">
                <span x-text="m.display_name"></span>
                <span class="mb-pill-remove" x-on:click="removeMember(m)">&times;</span>
              </span>
            </template>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" id="delete-board-btn" x-on:click="deleteBoard">Delete Board</button>
        <button class="btn btn-secondary" x-on:click="$store.modals.closeModal('manage-board-modal')">Cancel</button>
        <button class="btn btn-primary" id="manage-board-done-btn" x-on:click="done">Done</button>
      </div>
    </div>
  </div>

  <div class="mention-dd" id="mention-dd" x-show="mentionDD.visible" :style="'left:'+mentionDD.x+'px;top:'+mentionDD.y+'px;width:'+mentionDD.w+'px;max-height:'+mentionDD.maxH+'px'" x-on:click.outside="closeMentionDD">
    <template x-for="(item, i) in mentionDD.items" :key="i">
      <div class="mention-dd-item" :class="{ active: i === mentionDD.activeIdx }" x-on:mousedown.prevent="insertMention(item.insert)">
        <span class="md-badge" :style="'background:'+item.bg" x-text="item.badge"></span>
        <div><div class="md-label" x-text="item.label"></div><div class="md-sub" x-text="item.sub"></div></div>
      </div>
    </template>
  </div>
  <div class="search-dd" id="search-dd" style="display:none"></div>

  <!-- File Preview Modal -->
  <div class="modal-overlay" id="file-preview-modal" x-data="filePreviewModal" x-on:click="if ($event.target == $el) $store.modals.closeModal('file-preview-modal')">
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3 id="file-preview-name" x-text="file ? (file.original_name||file.filename||'File') : 'File'"></h3>
        <div class="fp-actions">
          <button class="btn-icon" id="fp-zoom-in" title="Zoom in" x-on:click="zoomIn"><i data-lucide="zoom-in" size="14"></i></button>
          <button class="btn-icon" id="fp-zoom-out" title="Zoom out" x-on:click="zoomOut"><i data-lucide="zoom-out" size="14"></i></button>
          <button class="btn-icon" id="fp-rotate" title="Rotate" x-on:click="rotate"><i data-lucide="rotate-cw" size="14"></i></button>
        </div>
        <button class="btn-icon" x-on:click="$store.modals.closeModal('file-preview-modal'); closePreview()"><i data-lucide="x" size="18"></i></button>
      </div>
      <div class="modal-body" style="text-align:center;overflow:auto">
        <img id="file-preview-img" :src="file ? imgSrc : ''" :style="'max-width:100%;max-height:65vh;'+(file && file.mime_type?.startsWith('image/')?'':'display:none')+';transform:'+transform" x-show="file && file.mime_type?.startsWith('image/')">
        <div id="file-preview-video" x-show="file && file.mime_type?.startsWith('video/')" style=""><video controls style="max-width:100%;max-height:65vh"><source :src="imgSrc"></video></div>
        <div id="file-preview-other" x-show="file && !file.mime_type?.startsWith('image/') && !file.mime_type?.startsWith('video/')" style="padding:40px;color:var(--gray-500)">
          <i data-lucide="file" size="48"></i><p id="file-preview-filename" style="margin-top:8px" x-text="file ? (file.original_name||file.filename||'') : ''"></p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" id="file-preview-delete" style="margin-right:auto" x-show="canDelete" x-on:click="deleteFile">Delete</button>
        <button class="btn btn-secondary" id="fp-share-btn" style="margin-right:auto" x-on:click="share"><i data-lucide="share-2" size="13"></i> Share</button>
        <a class="btn btn-primary" id="file-preview-download" :href="imgSrc" download>Download</a>
        <button class="btn btn-secondary" x-on:click="$store.modals.closeModal('file-preview-modal'); closePreview()">Close</button>
      </div>
    </div>
  </div>

  <!-- Share Modal -->
  <div class="modal-overlay" id="share-modal">
    <div class="modal" style="width:400px">
      <div class="modal-header"><h3>Share</h3><button class="btn-icon" onclick="closeModal('share-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>Permission</label><select class="form-input" id="share-permission"><option value="view">View Only</option><option value="comment">Comment</option><option value="edit">Edit</option></select></div>
        <button class="btn btn-primary btn-sm" id="share-generate-btn">Generate Link</button>
        <div id="share-links" style="margin-top:10px"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('share-modal')">Close</button></div>
    </div>
  </div>

  <!-- Rename Modal -->
  <div class="modal-overlay" id="rename-modal">
    <div class="modal" style="width:340px">
      <div class="modal-header"><h3 id="rename-title">Rename</h3><button class="btn-icon" onclick="closeModal('rename-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <input type="hidden" id="rename-id"><input type="hidden" id="rename-type">
        <div class="form-group"><label>Name</label><input type="text" id="rename-input" class="form-input"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('rename-modal')">Cancel</button>
        <button class="btn btn-primary" id="rename-confirm-btn">Save</button>
      </div>
    </div>
  </div>

  <!-- Create Folder Modal -->
  <div class="modal-overlay" id="create-folder-modal" x-data="createFolderModal" x-on:click="if ($event.target == $el) $store.modals.closeModal('create-folder-modal')">
    <div class="modal" style="width:340px">
      <div class="modal-header"><h3>New Folder</h3><button class="btn-icon" x-on:click="$store.modals.closeModal('create-folder-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body"><div class="form-group"><label>Folder Name</label><input type="text" id="cf-name" class="form-input" placeholder="Enter folder name..." x-model="name" x-on:keydown="if ($event.key === 'Enter') submit"></div></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" x-on:click="$store.modals.closeModal('create-folder-modal')">Cancel</button>
        <button class="btn btn-primary" x-on:click="submit">Create</button>
      </div>
    </div>
  </div>

  <!-- Move to Folder Modal -->
  <div class="modal-overlay" id="move-modal">
    <div class="modal" style="width:360px">
      <div class="modal-header"><h3>Move to Folder</h3><button class="btn-icon" onclick="closeModal('move-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body"><div class="form-group"><label>Select destination</label><div class="fs-move-list" id="fs-move-list"></div></div></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('move-modal')">Cancel</button>
        <button class="btn btn-primary" id="move-confirm-btn">Move</button>
      </div>
    </div>
  </div>

  <!-- Archive Move Modal -->
  <div class="modal-overlay" id="archive-move-modal">
    <div class="modal" style="width:360px">
      <div class="modal-header"><h3>Move to Archive Folder</h3><button class="btn-icon" onclick="document.getElementById('archive-move-modal').style.display='none'"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body"><div class="form-group"><label>Select archive folder</label><div class="fs-move-list" id="archive-move-list"></div><input type="hidden" id="archive-move-id"></div></div>
      <div class="modal-footer"><button class="btn btn-secondary" id="archive-move-cancel">Cancel</button></div>
    </div>
  </div>

  <!-- Todo Edit Modal -->
  <div class="modal-overlay" id="todo-edit-modal" x-data="todoEditModal" x-on:click="if ($event.target == $el) $store.modals.closeModal('todo-edit-modal')">
    <div class="modal">
      <div class="modal-header"><h3>Edit Checklist Item</h3><button class="btn-icon" x-on:click="$store.modals.closeModal('todo-edit-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>Name</label><input type="text" id="edit-todo-name" class="form-input" x-model="name"></div>
        <div class="form-group"><label>Notes</label><textarea id="edit-todo-notes" class="form-input" rows="3" placeholder="Add notes..." x-model="notes"></textarea></div>
        <div class="form-group">
          <label>Files</label>
          <div class="todo-files" id="edit-todo-files">
            <template x-for="f in todoFiles" :key="f.id">
              <div class="todo-file-item">
                <span class="file-thumb-del" x-on:click="deleteTodoFile(f.id)">&times;</span>
                <div class="todo-file-thumb" x-on:click="if(window.previewFile) previewFile(f.id)">
                  <template x-if="f.mime_type?.startsWith('image/')">
                    <img :src="'/api/files/'+f.id+'/download?token='+token">
                  </template>
                  <template x-if="!f.mime_type?.startsWith('image/')">
                    <span class="file-icon"><i data-lucide="file" size="16"></i></span>
                  </template>
                  <span class="todo-file-name" x-text="f.original_name"></span>
                </div>
              </div>
            </template>
          </div>
          <input type="file" id="edit-todo-file-input" class="form-input" style="margin-top:6px" x-on:change="onTodoFileSelected">
          <button class="btn btn-sm btn-secondary" style="margin-top:4px" x-on:click="uploadTodoFile">Upload</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" x-on:click="deleteTodo">Delete</button>
        <button class="btn btn-secondary" x-on:click="$store.modals.closeModal('todo-edit-modal')">Cancel</button>
        <button class="btn btn-primary" x-on:click="save">Save</button>
      </div>
    </div>
  </div>

  <!-- Pick from Files Modal -->
  <div class="modal-overlay" id="pick-files-modal">
    <div class="modal" style="width:480px;max-height:80vh">
      <div class="modal-header"><h3>Pick from Files</h3><button class="btn-icon" onclick="closeModal('pick-files-modal')"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><input type="text" id="pf-search" class="form-input" placeholder="Search archived tasks..." style="margin-bottom:8px"></div>
        <div class="pf-list" id="pf-list" style="max-height:300px;overflow-y:auto"></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('pick-files-modal')">Cancel</button></div>
    </div>
  </div>

  <!-- Confirm Modal -->
  <div class="modal-overlay" id="confirm-modal">
    <div class="modal" style="width:340px">
      <div class="modal-header"><h3>Confirm</h3><button class="btn-icon" onclick="closeConfirm(false)"><i data-lucide="x" size="18"></i></button></div>
      <div class="modal-body" style="text-align:center;padding:24px 20px">
        <p id="confirm-msg" style="font-size:14px;color:var(--gray-700);line-height:1.5;margin:0 0 4px 0"></p>
        <p id="confirm-sub" style="font-size:12px;color:var(--gray-500);margin:0"></p>
      </div>
      <div class="modal-footer" style="justify-content:center">
        <button class="btn btn-secondary" id="confirm-no">Cancel</button>
        <button class="btn btn-danger" id="confirm-yes">Delete</button>
      </div>
    </div>
  </div>

  <script src="{{ asset('js/state.js') }}"></script>
  <script src="{{ asset('js/api.js') }}"></script>
  <script src="{{ asset('js/utils.js') }}"></script>
  <script src="{{ asset('js/lines.js') }}"></script>
  <script src="{{ asset('js/files-core.js') }}"></script>
  <script src="{{ asset('js/files-selection.js') }}"></script>
  <script src="{{ asset('js/files-modals.js') }}"></script>
  <script src="{{ asset('js/notifications.js') }}"></script>
  <script src="{{ asset('js/main.js') }}"></script>
</body>
</html>
