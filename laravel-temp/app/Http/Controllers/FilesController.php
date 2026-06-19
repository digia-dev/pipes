<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\FilesFolder;
use App\Models\FilesItem;
use App\Models\FileVersion;
use App\Models\SharedItem;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FilesController extends Controller
{
    // ─── Folders ───

    public function getFolders(Request $request)
    {
        $parentId = $request->query('parent_id');
        $query = FilesFolder::whereNull('deleted_at')
            ->withCount(['items as file_count' => fn($q) => $q->whereNull('deleted_at')]);
        if ($parentId) {
            $query->where('parent_id', $parentId);
        } else {
            $query->whereNull('parent_id');
        }
        return response()->json($query->get());
    }

    public function getFolderTree(Request $request)
    {
        $folders = FilesFolder::whereNull('deleted_at')
            ->withCount(['items as file_count' => fn($q) => $q->whereNull('deleted_at')])
            ->orderBy('name')
            ->get();
        $tree = $this->buildTree($folders);
        return response()->json($tree);
    }

    public function getFolderPath(Request $request)
    {
        $folderId = $request->query('folder_id');
        $path = [];
        while ($folderId) {
            $f = FilesFolder::find($folderId);
            if (!$f) break;
            array_unshift($path, $f);
            $folderId = $f->parent_id;
        }
        return response()->json($path);
    }

    public function createFolder(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate(['name' => 'required|string', 'parent_id' => 'nullable|integer']);
        $folder = FilesFolder::create([
            'parent_id' => $data['parent_id'] ?? null,
            'name' => $data['name'],
            'owner_id' => $user->id,
        ]);
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'create',
            'item_type' => 'folder',
            'item_id' => $folder->id,
            'details' => "Created folder '{$folder->name}'",
        ]);
        return response()->json($folder);
    }

    public function updateFolder(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate(['name' => 'required|string']);
        $folder = FilesFolder::findOrFail($id);
        $oldName = $folder->name;
        $folder->update(['name' => $data['name']]);
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'rename',
            'item_type' => 'folder',
            'item_id' => $folder->id,
            'details' => "Renamed folder from '{$oldName}' to '{$data['name']}'",
        ]);
        return response()->json($folder);
    }

    public function deleteFolder(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $permanent = $request->query('permanent');
        $folder = FilesFolder::findOrFail($id);

        if ($permanent) {
            $this->hardDeleteFolder($folder);
        } else {
            $folder->update(['deleted_at' => now()]);
            FilesItem::where('folder_id', $id)->whereNull('deleted_at')
                ->update(['deleted_at' => now()]);
            ActivityLog::create([
                'user_id' => $user->id, 'action' => 'delete',
                'item_type' => 'folder', 'item_id' => $id,
                'details' => "Deleted folder '{$folder->name}'",
            ]);
        }
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Files ───

    public function getFiles(Request $request)
    {
        $folderId = $request->query('folder_id');
        $type = $request->query('type');
        $query = FilesItem::whereNull('deleted_at')
            ->leftJoin('users', 'users.id', '=', 'files_items.owner_id')
            ->select('files_items.*', 'users.display_name as owner_name');

        if ($folderId !== null && $folderId !== '') {
            $query->where('files_items.folder_id', $folderId);
        } else {
            $query->whereNull('files_items.folder_id');
        }

        if ($type === 'image') $query->where('files_items.mime_type', 'like', 'image/%');
        elseif ($type === 'pdf') $query->where('files_items.mime_type', 'like', 'application/pdf%');
        elseif ($type === 'doc') $query->where('files_items.mime_type', 'not like', 'image/%');

        return response()->json($query->orderBy('files_items.created_at', 'desc')->get());
    }

    public function getFile(Request $request, $id)
    {
        $file = FilesItem::leftJoin('users', 'users.id', '=', 'files_items.owner_id')
            ->select('files_items.*', 'users.display_name as owner_name')
            ->where('files_items.id', $id)->firstOrFail();
        return response()->json($file);
    }

    public function uploadFile(Request $request)
    {
        $user = $request->attributes->get('user');
        $request->validate(['file' => 'required|file']);
        $folderId = $request->input('folder_id');

        $file = $request->file('file');
        $filename = Str::random(40) . '.' . $file->getClientOriginalExtension();
        $file->storeAs('files', $filename, 'local');

        $item = FilesItem::create([
            'folder_id' => $folderId,
            'filename' => $filename,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'owner_id' => $user->id,
        ]);
        ActivityLog::create([
            'user_id' => $user->id, 'action' => 'upload',
            'item_type' => 'file', 'item_id' => $item->id,
            'details' => "Uploaded '{$item->original_name}'",
        ]);
        return response()->json($item);
    }

    public function downloadFile(Request $request, $id)
    {
        $file = FilesItem::findOrFail($id);
        $path = storage_path("app/files/{$file->filename}");
        if (!file_exists($path)) abort(404);
        return response()->download($path, $file->original_name);
    }

    public function streamFile(Request $request, $id)
    {
        $file = FilesItem::findOrFail($id);
        $path = storage_path("app/files/{$file->filename}");
        if (!file_exists($path)) abort(404);
        return response()->file($path);
    }

    public function updateFile(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate(['name' => 'required|string']);
        $file = FilesItem::findOrFail($id);
        $file->update(['original_name' => $data['name']]);
        ActivityLog::create([
            'user_id' => $user->id, 'action' => 'rename',
            'item_type' => 'file', 'item_id' => $id,
            'details' => "Renamed file to '{$data['name']}'",
        ]);
        return response()->json($file);
    }

    public function deleteFile(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $permanent = $request->query('permanent');
        $file = FilesItem::findOrFail($id);

        if ($permanent) {
            $this->hardDeleteFile($file);
        } else {
            $file->update(['deleted_at' => now()]);
            ActivityLog::create([
                'user_id' => $user->id, 'action' => 'delete',
                'item_type' => 'file', 'item_id' => $id,
                'details' => "Deleted file '{$file->original_name}'",
            ]);
        }
        return response()->json(['message' => 'Deleted']);
    }

    public function duplicateFile(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $original = FilesItem::findOrFail($id);
        $newFolderId = $request->input('folder_id', $original->folder_id);

        $copy = FilesItem::create([
            'folder_id' => $newFolderId,
            'filename' => $original->filename,
            'original_name' => $this->copyName($original->original_name),
            'mime_type' => $original->mime_type,
            'size' => $original->size,
            'owner_id' => $user->id,
        ]);
        ActivityLog::create([
            'user_id' => $user->id, 'action' => 'upload',
            'item_type' => 'file', 'item_id' => $copy->id,
            'details' => "Copied '{$original->original_name}'",
        ]);
        return response()->json($copy);
    }

    // ─── Star / Recent / Trash ───

    public function toggleStar(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $file = FilesItem::findOrFail($id);
        $file->is_starred = $file->is_starred ? 0 : 1;
        $file->save();
        ActivityLog::create([
            'user_id' => $user->id, 'action' => $file->is_starred ? 'star' : 'unstar',
            'item_type' => 'file', 'item_id' => $id,
            'details' => $file->is_starred ? "Starred '{$file->original_name}'" : "Unstarred '{$file->original_name}'",
        ]);
        return response()->json(['is_starred' => (bool)$file->is_starred]);
    }

    public function getStarred(Request $request)
    {
        $user = $request->attributes->get('user');
        $files = FilesItem::where('is_starred', 1)->whereNull('deleted_at')
            ->leftJoin('users', 'users.id', '=', 'files_items.owner_id')
            ->select('files_items.*', 'users.display_name as owner_name')
            ->orderBy('updated_at', 'desc')->get();
        return response()->json($files);
    }

    public function getRecent(Request $request)
    {
        $files = FilesItem::whereNull('deleted_at')
            ->leftJoin('users', 'users.id', '=', 'files_items.owner_id')
            ->select('files_items.*', 'users.display_name as owner_name')
            ->orderBy('updated_at', 'desc')->limit(30)->get();
        return response()->json($files);
    }

    public function getTrash(Request $request)
    {
        $files = FilesItem::whereNotNull('deleted_at')
            ->leftJoin('users', 'users.id', '=', 'files_items.owner_id')
            ->select('files_items.*', 'users.display_name as owner_name')
            ->orderBy('deleted_at', 'desc')->get();
        $folders = FilesFolder::whereNotNull('deleted_at')->orderBy('deleted_at', 'desc')->get();
        return response()->json(['files' => $files, 'folders' => $folders]);
    }

    public function restoreTrash(Request $request, $type, $id)
    {
        if ($type === 'folder') {
            FilesFolder::where('id', $id)->update(['deleted_at' => null]);
        } else {
            FilesItem::where('id', $id)->update(['deleted_at' => null]);
        }
        return response()->json(['message' => 'Restored']);
    }

    public function emptyTrash(Request $request)
    {
        $files = FilesItem::whereNotNull('deleted_at')->get();
        foreach ($files as $f) $this->hardDeleteFile($f);
        FilesFolder::whereNotNull('deleted_at')->delete();
        return response()->json(['message' => 'Trash emptied']);
    }

    // ─── Versions ───

    public function getVersions(Request $request, $id)
    {
        $versions = FileVersion::where('file_id', $id)
            ->leftJoin('users', 'users.id', '=', 'file_versions.uploaded_by')
            ->select('file_versions.*', 'users.display_name as uploaded_by_name')
            ->orderBy('created_at', 'desc')->get();
        return response()->json($versions);
    }

    public function uploadVersion(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $request->validate(['file' => 'required|file']);
        $file = $request->file('file');
        $filename = Str::random(40) . '.' . $file->getClientOriginalExtension();
        $file->storeAs('files', $filename, 'local');

        $version = FileVersion::create([
            'file_id' => $id,
            'filename' => $filename,
            'size' => $file->getSize(),
            'uploaded_by' => $user->id,
        ]);
        ActivityLog::create([
            'user_id' => $user->id, 'action' => 'version',
            'item_type' => 'file', 'item_id' => $id,
            'details' => "Uploaded new version",
        ]);
        return response()->json($version);
    }

    // ─── Sharing ───

    public function createShareLink(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate(['item_type' => 'required|string', 'item_id' => 'required|integer', 'permission' => 'nullable|string']);
        $link = SharedItem::create([
            'item_type' => $data['item_type'],
            'item_id' => $data['item_id'],
            'token' => Str::random(32),
            'permission' => $data['permission'] ?? 'view',
            'created_by' => $user->id,
        ]);
        ActivityLog::create([
            'user_id' => $user->id, 'action' => 'share',
            'item_type' => $data['item_type'], 'item_id' => $data['item_id'],
            'details' => "Shared {$data['item_type']}",
        ]);
        return response()->json($link);
    }

    public function getShareLinks(Request $request)
    {
        $data = $request->validate(['item_type' => 'required|string', 'item_id' => 'required|integer']);
        $links = SharedItem::where('item_type', $data['item_type'])
            ->where('item_id', $data['item_id'])
            ->orderBy('created_at', 'desc')->get();
        return response()->json($links);
    }

    public function deleteShareLink(Request $request, $id)
    {
        SharedItem::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Activity ───

    public function getActivity(Request $request)
    {
        $activity = ActivityLog::leftJoin('users', 'users.id', '=', 'activity_logs.user_id')
            ->select('activity_logs.*', 'users.display_name as user_name', 'users.username')
            ->orderBy('created_at', 'desc')->limit(50)->get();
        return response()->json($activity);
    }

    // ─── Search ───

    public function search(Request $request)
    {
        $query = $request->query('q');
        $type = $request->query('type');
        $results = ['files' => [], 'folders' => []];

        $fileQuery = FilesItem::whereNull('deleted_at')
            ->leftJoin('users', 'users.id', '=', 'files_items.owner_id')
            ->select('files_items.id', 'files_items.original_name as name', 'files_items.mime_type', 'files_items.size', 'files_items.created_at', 'users.display_name as owner_name')
            ->where('files_items.original_name', 'like', "%{$query}%");
        if ($type) $fileQuery->where('files_items.mime_type', 'like', "{$type}%");
        $results['files'] = $fileQuery->limit(20)->get()->toArray();

        if (!$type) {
            $results['folders'] = FilesFolder::whereNull('deleted_at')
                ->where('name', 'like', "%{$query}%")
                ->select('id', 'name')->limit(10)->get()->toArray();
        }

        return response()->json($results);
    }

    // ─── Bulk ───

    public function bulkAction(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate([
            'action' => 'required|in:move,delete',
            'file_ids' => 'required|array',
            'file_ids.*' => 'integer',
            'folder_id' => 'nullable|integer',
        ]);

        $fileIds = $data['file_ids'];
        if ($data['action'] === 'delete') {
            foreach ($fileIds as $id) {
                FilesItem::where('id', $id)->update(['deleted_at' => now()]);
                ActivityLog::create([
                    'user_id' => $user->id, 'action' => 'delete',
                    'item_type' => 'file', 'item_id' => $id,
                    'details' => 'Bulk deleted',
                ]);
            }
        } elseif ($data['action'] === 'move') {
            $targetFolderId = $data['folder_id'];
            foreach ($fileIds as $id) {
                FilesItem::where('id', $id)->update(['folder_id' => $targetFolderId]);
                ActivityLog::create([
                    'user_id' => $user->id, 'action' => 'move',
                    'item_type' => 'file', 'item_id' => $id,
                    'details' => "Moved to folder {$targetFolderId}",
                ]);
            }
        }
        return response()->json(['message' => 'Done']);
    }

    // ─── Archive (Lines integration) ───

    public function getAllArchivedTasks(Request $request)
    {
        $tasks = \App\Models\LinesTask::where('is_archived', 1)
            ->leftJoin('lines_columns', 'lines_columns.id', '=', 'lines_tasks.column_id')
            ->leftJoin('lines_boards', 'lines_boards.id', '=', 'lines_columns.board_id')
            ->leftJoin('users', 'users.id', '=', 'lines_tasks.created_by')
            ->select('lines_tasks.*', 'lines_columns.name as column_name', 'lines_boards.name as board_name', 'users.display_name as owner_name')
            ->withCount(['files as file_count'])
            ->orderBy('archived_at', 'desc')->get();
        return response()->json($tasks);
    }

    public function getAllFoldersFlat(Request $request)
    {
        $folders = \App\Models\LinesArchiveFolder::leftJoin('users', 'users.id', '=', 'lines_archive_folders.created_by')
            ->select('lines_archive_folders.*', 'users.display_name as created_by_name')
            ->withCount(['tasks as task_count' => fn($q) => $q->where('is_archived', 1)])
            ->orderBy('name')->get();
        return response()->json($folders);
    }

    public function getArchiveFolders(Request $request)
    {
        $boardId = $request->query('board_id');
        $folders = \App\Models\LinesArchiveFolder::where('board_id', $boardId)
            ->whereNotNull('parent_id')
            ->withCount(['tasks as task_count' => fn($q) => $q->where('is_archived', 1)])
            ->orderBy('name')->get();
        return response()->json($folders);
    }

    public function createArchiveFolder(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate(['board_id' => 'nullable|integer', 'name' => 'required|string', 'parent_id' => 'nullable|integer']);
        $folder = \App\Models\LinesArchiveFolder::create([
            'board_id' => $data['board_id'] ?? null,
            'parent_id' => $data['parent_id'] ?? null,
            'name' => $data['name'],
            'created_by' => $user->id,
        ]);
        return response()->json($folder);
    }

    public function updateArchiveFolder(Request $request, $id)
    {
        $data = $request->validate(['name' => 'required|string']);
        $folder = \App\Models\LinesArchiveFolder::findOrFail($id);
        $folder->update(['name' => $data['name']]);
        return response()->json($folder);
    }

    public function deleteArchiveFolder(Request $request, $id)
    {
        $folder = \App\Models\LinesArchiveFolder::findOrFail($id);
        \App\Models\LinesTask::where('archive_folder_id', $id)->update(['archive_folder_id' => null]);
        \App\Models\LinesArchiveFolder::where('parent_id', $id)->update(['parent_id' => null]);
        $folder->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function setTaskArchiveFolder(Request $request, $id)
    {
        $data = $request->validate(['folder_id' => 'nullable|integer']);
        \App\Models\LinesTask::where('id', $id)->update(['archive_folder_id' => $data['folder_id'] ?? null]);
        return response()->json(['message' => 'Updated']);
    }

    public function getArchivedTasksByFolder(Request $request)
    {
        $boardId = $request->query('board_id');
        $folderId = $request->query('folder_id');
        $columns = \App\Models\LinesColumn::where('board_id', $boardId)->orderBy('position')->get();
        $result = [];
        foreach ($columns as $col) {
            $taskIds = \App\Models\LinesTask::where('column_id', $col->id)
                ->where('is_archived', 1);
            if ($folderId) $taskIds->where('archive_folder_id', $folderId);
            else $taskIds->whereNull('archive_folder_id');
            $taskIds = $taskIds->pluck('id');
            $tasks = \App\Models\LinesTask::whereIn('id', $taskIds)
                ->leftJoin('users', 'users.id', '=', 'lines_tasks.assignee_id')
                ->select('lines_tasks.*', 'users.display_name as assignee_name')
                ->orderBy('position')->get();
            $result[$col->name] = $tasks;
        }
        return response()->json($result);
    }

    public function getArchiveActivity(Request $request)
    {
        $activity = \App\Models\LinesArchiveActivity::leftJoin('users', 'users.id', '=', 'lines_archive_activity.user_id')
            ->select('lines_archive_activity.*', 'users.display_name as user_name', 'users.username')
            ->orderBy('created_at', 'desc')->limit(50)->get();
        return response()->json($activity);
    }

    public function searchArchive(Request $request)
    {
        $boardId = $request->query('board_id');
        $q = $request->query('q');
        $filterBy = $request->query('filter_by');
        $filterVal = $request->query('filter_val');

        $query = \App\Models\LinesTask::where('is_archived', 1)
            ->join('lines_columns', 'lines_columns.id', '=', 'lines_tasks.column_id')
            ->join('lines_boards', 'lines_boards.id', '=', 'lines_columns.board_id')
            ->leftJoin('users', 'users.id', '=', 'lines_tasks.created_by')
            ->select('lines_tasks.*', 'lines_columns.name as column_name', 'lines_boards.name as board_name', 'users.display_name as owner_name')
            ->where('lines_boards.id', $boardId);

        if ($filterBy === 'folder') {
            $query->where('archive_folder_id', $filterVal ?? null);
        }

        if ($q) {
            $query->where(function($qry) use ($q) {
                $qry->where('lines_tasks.title', 'like', "%{$q}%")
                    ->orWhere('lines_tasks.description', 'like', "%{$q}%")
                    ->orWhere('users.display_name', 'like', "%{$q}%")
                    ->orWhere('lines_columns.name', 'like', "%{$q}%");
            });
        }

        return response()->json($query->orderBy('archived_at', 'desc')->limit(100)->get());
    }

    public function duplicateTask(Request $request, $id)
    {
        $task = \App\Models\LinesTask::findOrFail($id);
        $copy = \App\Models\LinesTask::create($task->replicate(['id'])->toArray());
        $copy->title = $task->title . ' (Copy)';
        $copy->save();

        $assignees = \App\Models\LinesTaskAssignee::where('task_id', $id)->get();
        foreach ($assignees as $a) {
            \App\Models\LinesTaskAssignee::create(['task_id' => $copy->id, 'user_id' => $a->user_id]);
        }
        return response()->json($copy);
    }

    public function bulkArchiveAction(Request $request)
    {
        $data = $request->validate(['action' => 'required|in:delete', 'task_ids' => 'required|array']);
        \App\Models\LinesTask::whereIn('id', $data['task_ids'])->delete();
        \App\Models\LinesComment::whereIn('task_id', $data['task_ids'])->delete();
        \App\Models\LinesTaskAssignee::whereIn('task_id', $data['task_ids'])->delete();
        return response()->json(['message' => 'Done']);
    }

    public function archiveTask(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        $task = \App\Models\LinesTask::findOrFail($id);
        $task->update(['is_archived' => 1, 'archived_by' => $user->id, 'archived_at' => now()]);
        \App\Models\LinesArchiveActivity::create([
            'user_id' => $user->id, 'action' => 'archive',
            'target_type' => 'task', 'target_id' => $id,
            'details' => "Archived '{$task->title}'",
        ]);
        return response()->json($task);
    }

    public function restoreTask(Request $request, $id)
    {
        $task = \App\Models\LinesTask::findOrFail($id);
        $task->update(['is_archived' => 0, 'archived_by' => null, 'archived_at' => null]);
        return response()->json($task);
    }

    public function getFolderTreeOld(Request $request)
    {
        return $this->getAllFoldersFlat($request);
    }

    public function ensureFolderEndpoint(Request $request)
    {
        return response()->json(['message' => 'OK']);
    }

    // ─── Private helpers ───

    private function buildTree($items, $parentId = null)
    {
        $branch = [];
        foreach ($items as $item) {
            if ($item->parent_id === $parentId || ($item->parent_id === null && $parentId === null)) {
                $children = $this->buildTree($items, $item->id);
                if ($children) $item->children = $children;
                $branch[] = $item;
            }
        }
        return $branch;
    }

    private function hardDeleteFile(FilesItem $file)
    {
        $path = storage_path("app/files/{$file->filename}");
        if (file_exists($path)) @unlink($path);
        FileVersion::where('file_id', $file->id)->delete();
        SharedItem::where('item_type', 'file')->where('item_id', $file->id)->delete();
        $file->delete();
    }

    private function hardDeleteFolder(FilesFolder $folder)
    {
        $children = FilesFolder::where('parent_id', $folder->id)->get();
        foreach ($children as $c) $this->hardDeleteFolder($c);
        $files = FilesItem::where('folder_id', $folder->id)->get();
        foreach ($files as $f) $this->hardDeleteFile($f);
        $folder->delete();
    }

    private function copyName($name)
    {
        $pathInfo = pathinfo($name);
        if (isset($pathInfo['extension'])) {
            return $pathInfo['filename'] . ' (Copy).' . $pathInfo['extension'];
        }
        return $name . ' (Copy)';
    }
}
