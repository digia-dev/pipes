<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FilesController;
use App\Http\Controllers\LinesController;

// Public
Route::post('auth/login', [AuthController::class, 'login']);

// Authenticated
Route::middleware('token.auth')->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('users', [AuthController::class, 'getUsers']);

    // Global search
    Route::get('search', [LinesController::class, 'search']);

    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/', [LinesController::class, 'getNotifications']);
        Route::get('/unread-count', [LinesController::class, 'getUnreadCount']);
        Route::post('/read-all', [LinesController::class, 'markAllNotificationsRead']);
        Route::post('/check-due-dates', [LinesController::class, 'checkDueDates']);
        Route::post('{id}/read', [LinesController::class, 'markNotificationRead']);
    });

    // Lines (Kanban)
    Route::prefix('lines')->group(function () {
        Route::prefix('boards')->group(function () {
            Route::get('/', [LinesController::class, 'getBoards']);
            Route::post('/', [LinesController::class, 'createBoard']);
            Route::post('/members', [LinesController::class, 'assignBoardMember']);
            Route::delete('/members', [LinesController::class, 'removeBoardMember']);
            Route::put('{id}', [LinesController::class, 'updateBoard']);
            Route::delete('{id}', [LinesController::class, 'deleteBoard']);
            Route::post('{id}/columns', [LinesController::class, 'addColumn']);
            Route::delete('{id}/columns/{colId}', [LinesController::class, 'deleteColumn']);
            Route::get('{id}/tasks', [LinesController::class, 'getTasks']);
        });

        Route::prefix('tasks')->group(function () {
            Route::get('{id}', [LinesController::class, 'getTask']);
            Route::post('/', [LinesController::class, 'createTask']);
            Route::put('{id}', [LinesController::class, 'updateTask']);
            Route::put('{id}/move', [LinesController::class, 'moveTask']);
            Route::put('{id}/archive', [FilesController::class, 'archiveTask']);
            Route::put('{id}/restore', [FilesController::class, 'restoreTask']);
            Route::post('{id}/duplicate', [FilesController::class, 'duplicateTask']);
            Route::delete('{id}', [LinesController::class, 'deleteTask']);
            Route::put('{id}/archive-folder', [FilesController::class, 'setTaskArchiveFolder']);
        });

        Route::get('chats', [LinesController::class, 'getChats']);
        Route::get('comments', [LinesController::class, 'getComments']);
        Route::post('comments', [LinesController::class, 'createComment']);
        Route::put('comments/{id}', [LinesController::class, 'updateComment']);
        Route::delete('comments/{id}', [LinesController::class, 'deleteComment']);
        Route::get('todos', [LinesController::class, 'getTodos']);
        Route::post('todos', [LinesController::class, 'createTodo']);
        Route::put('todos/{id}', [LinesController::class, 'updateTodo']);
        Route::put('todos/{id}/toggle', [LinesController::class, 'toggleTodo']);
        Route::delete('todos/{id}', [LinesController::class, 'deleteTodo']);

        // Legacy file upload (Lines attachments)
        Route::post('upload', [LinesController::class, 'upload']);
        Route::get('files', [LinesController::class, 'getLinesFiles']);
        Route::get('files/{id}/download', [LinesController::class, 'downloadLinesFile']);
        Route::delete('files/{id}', [LinesController::class, 'deleteLinesFile']);

        // Archive
        Route::prefix('archive')->group(function () {
            Route::get('folders', [FilesController::class, 'getArchiveFolders']);
            Route::post('folders', [FilesController::class, 'createArchiveFolder']);
            Route::put('folders/{id}', [FilesController::class, 'updateArchiveFolder']);
            Route::delete('folders/{id}', [FilesController::class, 'deleteArchiveFolder']);
            Route::get('tasks', [FilesController::class, 'getArchivedTasksByFolder']);
            Route::get('search', [FilesController::class, 'searchArchive']);
            Route::get('activity', [FilesController::class, 'getArchiveActivity']);
            Route::post('bulk', [FilesController::class, 'bulkArchiveAction']);
        });
    });

    // Files (Google Drive style)
    Route::prefix('files')->group(function () {
        Route::prefix('folders')->group(function () {
            Route::get('tree', [FilesController::class, 'getFolderTree']);
            Route::get('path', [FilesController::class, 'getFolderPath']);
            Route::post('/', [FilesController::class, 'createFolder']);
            Route::put('{id}', [FilesController::class, 'updateFolder']);
            Route::delete('{id}', [FilesController::class, 'deleteFolder']);
        });
        Route::get('folders', [FilesController::class, 'getFolders']);
        Route::post('folders/ensure', [FilesController::class, 'ensureFolderEndpoint']);
        Route::get('items', [FilesController::class, 'getFiles']);
        Route::get('items/{id}', [FilesController::class, 'getFile']);
        Route::post('upload', [FilesController::class, 'uploadFile']);
        Route::put('items/{id}', [FilesController::class, 'updateFile']);
        Route::delete('items/{id}', [FilesController::class, 'deleteFile']);
        Route::post('items/{id}/duplicate', [FilesController::class, 'duplicateFile']);
        Route::post('items/{id}/star', [FilesController::class, 'toggleStar']);
        Route::get('items/{id}/download', [FilesController::class, 'downloadFile']);
        Route::get('items/{id}/stream', [FilesController::class, 'streamFile']);
        Route::get('items/{id}/versions', [FilesController::class, 'getVersions']);
        Route::post('items/{id}/versions', [FilesController::class, 'uploadVersion']);
        Route::get('starred', [FilesController::class, 'getStarred']);
        Route::get('recent', [FilesController::class, 'getRecent']);
        Route::get('trash', [FilesController::class, 'getTrash']);
        Route::post('trash/{type}/{id}/restore', [FilesController::class, 'restoreTrash']);
        Route::post('trash/empty', [FilesController::class, 'emptyTrash']);
        Route::post('share', [FilesController::class, 'createShareLink']);
        Route::get('share', [FilesController::class, 'getShareLinks']);
        Route::delete('share/{id}', [FilesController::class, 'deleteShareLink']);
        Route::get('activity', [FilesController::class, 'getActivity']);
        Route::get('search', [FilesController::class, 'search']);
        Route::post('bulk', [FilesController::class, 'bulkAction']);
        Route::get('tree', [FilesController::class, 'getFolderTreeOld']);
        Route::get('tasks', [FilesController::class, 'getAllArchivedTasks']);
        Route::get('archive-folders', [FilesController::class, 'getAllFoldersFlat']);
    });

    // Task attachment files (lines_files) — JS calls /api/files/... not /api/lines/files/...
    Route::get('files', [LinesController::class, 'getLinesFiles']);
    Route::get('files/{id}/download', [LinesController::class, 'downloadLinesFile']);
    Route::delete('files/{id}', [LinesController::class, 'deleteLinesFile']);

    // Task file upload (JS calls /api/upload)
    Route::post('upload', [LinesController::class, 'upload']);
});
