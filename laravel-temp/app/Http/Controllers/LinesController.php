<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\LinesBoard;
use App\Models\LinesBoardMember;
use App\Models\LinesColumn;
use App\Models\LinesTask;
use App\Models\LinesTaskAssignee;
use App\Models\LinesComment;
use App\Models\LinesTodo;
use App\Models\LinesFile;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LinesController extends Controller
{
    // ─── Search (global) ───

    public function search(Request $request)
    {
        $q = $request->query('q');
        $tasks = LinesTask::where('title', 'like', "%{$q}%")->limit(5)
            ->select('id', 'title as name')->selectRaw("'task' as type")->get();
        $users = User::where('display_name', 'like', "%{$q}%")
            ->orWhere('username', 'like', "%{$q}%")->limit(5)
            ->select('id', 'display_name as name')->selectRaw("'user' as type")->get();
        $todos = LinesTodo::where('name', 'like', "%{$q}%")->limit(5)
            ->select('id', 'name')->selectRaw("'todo' as type")->get();
        return response()->json(array_merge($tasks->toArray(), $users->toArray(), $todos->toArray()));
    }

    // ─── Boards ───

    public function getBoards(Request $request)
    {
        $user = $request->attributes->get('user');
        $boards = LinesBoard::join('lines_board_members', 'lines_board_members.board_id', '=', 'lines_boards.id')
            ->leftJoin('users', 'users.id', '=', 'lines_boards.created_by')
            ->select('lines_boards.*', 'users.display_name as created_by_name')
            ->where('lines_board_members.user_id', $user->id)
            ->orderBy('lines_boards.name')->get();

        $boardId = $request->query('board_id');
        if (!$boardId && $boards->count()) {
            $boardId = $boards[0]->id;
        }

        $columns = [];
        $members = [];
        if ($boardId) {
            $cols = LinesColumn::where('board_id', $boardId)->orderBy('position')->get();
            $taskIdsByCol = [];
            foreach ($cols as $col) {
                $ids = LinesTask::where('column_id', $col->id)
                    ->where(function ($q) { $q->whereNull('is_archived')->orWhere('is_archived', 0); })
                    ->orderBy('position')->pluck('id');
                $taskIdsByCol[$col->id] = $ids;
            }

            $allTaskIds = collect($taskIdsByCol)->flatten();
            $allTasks = LinesTask::from('lines_tasks')->whereIn('lines_tasks.id', $allTaskIds)
                ->leftJoin('users', 'users.id', '=', 'lines_tasks.assignee_id')
                ->select('lines_tasks.*', 'users.display_name as assignee_name')
                ->withCount(['comments as comment_count', 'files as file_count'])
                ->orderBy('lines_tasks.position')->get()->keyBy('id');

            $assignees = LinesTaskAssignee::whereIn('task_id', $allTaskIds)
                ->join('users', 'users.id', '=', 'lines_task_assignees.user_id')
                ->select('lines_task_assignees.task_id', 'users.id', 'users.username', 'users.display_name', 'users.avatar_color')
                ->get()->groupBy('task_id');

            foreach ($allTasks as $t) {
                $t->assignees = $assignees->get($t->id, collect());
            }

            foreach ($cols as $col) {
                $colTasks = collect($taskIdsByCol[$col->id] ?? [])->map(fn($id) => $allTasks->get($id))->filter()->values();
                $col->tasks = $colTasks;
                $columns[] = $col;
            }

            $members = LinesBoardMember::where('board_id', $boardId)
                ->join('users', 'users.id', '=', 'lines_board_members.user_id')
                ->select('users.id', 'users.username', 'users.display_name', 'users.role', 'users.avatar_color')
                ->get();
        }

        return response()->json([
            'boards' => $boards,
            'columns' => $columns,
            'members' => $members,
            'user' => $user,
        ]);
    }

    public function createBoard(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate(['name' => 'required|string', 'stages' => 'nullable|string']);
        $board = LinesBoard::create(['name' => $data['name'], 'created_by' => $user->id]);
        LinesBoardMember::create(['board_id' => $board->id, 'user_id' => $user->id]);
        $stages = $data['stages'] ? array_filter(array_map('trim', explode("\n", $data['stages']))) : ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
        $stages = array_values($stages);
        if (empty($stages)) $stages = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
        foreach ($stages as $i => $stage) {
            LinesColumn::create(['board_id' => $board->id, 'name' => $stage, 'position' => $i]);
        }
        return response()->json($board);
    }

    public function assignBoardMember(Request $request)
    {
        $data = $request->validate(['board_id' => 'required|integer', 'user_id' => 'required|integer']);
        LinesBoardMember::firstOrCreate(['board_id' => $data['board_id'], 'user_id' => $data['user_id']]);
        return response()->json(['message' => 'Assigned']);
    }

    public function removeBoardMember(Request $request)
    {
        $data = $request->validate(['board_id' => 'required|integer', 'user_id' => 'required|integer']);
        LinesBoardMember::where('board_id', $data['board_id'])->where('user_id', $data['user_id'])->delete();
        return response()->json(['message' => 'Removed']);
    }

    public function updateBoard(Request $request, $id)
    {
        $data = $request->validate(['name' => 'nullable|string', 'description_template' => 'nullable|string']);
        $board = LinesBoard::findOrFail($id);
        if (isset($data['name'])) $board->name = $data['name'];
        if (isset($data['description_template'])) $board->description_template = $data['description_template'];
        $board->save();
        return response()->json($board);
    }

    public function deleteBoard(Request $request, $id)
    {
        $board = LinesBoard::findOrFail($id);
        LinesColumn::where('board_id', $id)->delete();
        LinesBoardMember::where('board_id', $id)->delete();
        $board->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Columns ───

    public function addColumn(Request $request, $id)
    {
        $data = $request->validate(['name' => 'required|string']);
        $maxPos = LinesColumn::where('board_id', $id)->max('position') ?? -1;
        $column = LinesColumn::create(['board_id' => $id, 'name' => $data['name'], 'position' => $maxPos + 1]);
        return response()->json($column);
    }

    public function deleteColumn(Request $request, $id, $colId)
    {
        LinesColumn::findOrFail($colId)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Tasks ───

    public function getTasks(Request $request, $boardId)
    {
        $columns = LinesColumn::where('board_id', $boardId)->orderBy('position')->get();
        $result = [];
        foreach ($columns as $col) {
            $taskIds = LinesTask::where('column_id', $col->id)
                ->where(function($q) { $q->whereNull('is_archived')->orWhere('is_archived', 0); })
                ->orderBy('position')->pluck('id');

            $tasks = LinesTask::from('lines_tasks')->whereIn('lines_tasks.id', $taskIds)
                ->leftJoin('users', 'users.id', '=', 'lines_tasks.assignee_id')
                ->select('lines_tasks.*', 'users.display_name as assignee_name')
                ->withCount(['comments as comment_count', 'files as file_count'])
                ->orderBy('lines_tasks.position')->get();

            $allTaskIds = $tasks->pluck('id');
            $assignees = LinesTaskAssignee::whereIn('task_id', $allTaskIds)
                ->join('users', 'users.id', '=', 'lines_task_assignees.user_id')
                ->select('lines_task_assignees.task_id', 'users.id', 'users.username', 'users.display_name', 'users.avatar_color')
                ->get()->groupBy('task_id');

            foreach ($tasks as $t) {
                $t->assignees = $assignees->get($t->id, collect());
            }

            $result[] = ['column' => $col, 'tasks' => $tasks];
        }
        return response()->json($result);
    }

    public function getTask(Request $request, $id)
    {
        $task = LinesTask::from('lines_tasks')->where('lines_tasks.id', $id)
            ->leftJoin('users as a', 'a.id', '=', 'lines_tasks.assignee_id')
            ->leftJoin('users as c', 'c.id', '=', 'lines_tasks.created_by')
            ->select('lines_tasks.*', 'a.display_name as assignee_name', 'c.display_name as created_by_name')
            ->firstOrFail();
        return response()->json($task);
    }

    public function createTask(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate([
            'column_id' => 'required|integer', 'title' => 'required|string',
            'description' => 'nullable|string', 'assignee_id' => 'nullable|integer',
            'assignee_ids' => 'nullable|array', 'assignee_ids.*' => 'integer',
            'due_date' => 'nullable|string', 'labels' => 'nullable|string',
        ]);
        $maxPos = LinesTask::where('column_id', $data['column_id'])->max('position') ?? -1;
        $task = LinesTask::create([
            'column_id' => $data['column_id'],
            'title' => $data['title'],
            'description' => $data['description'] ?? '',
            'assignee_id' => $data['assignee_id'] ?? ($data['assignee_ids'][0] ?? null),
            'due_date' => $data['due_date'] ?? '',
            'labels' => $data['labels'] ?? '',
            'position' => $maxPos + 1,
            'created_by' => $user->id,
        ]);
        if (!empty($data['assignee_ids'])) {
            foreach ($data['assignee_ids'] as $uid) {
                LinesTaskAssignee::firstOrCreate(['task_id' => $task->id, 'user_id' => $uid]);
            }
        }
        return response()->json($task);
    }

    public function updateTask(Request $request, $id)
    {
        $data = $request->validate([
            'title' => 'nullable|string', 'description' => 'nullable|string',
            'assignee_id' => 'nullable|integer', 'assignee_ids' => 'nullable|array',
            'assignee_ids.*' => 'integer', 'due_date' => 'nullable|string',
            'labels' => 'nullable|string', 'column_id' => 'nullable|integer',
            'position' => 'nullable|integer',
        ]);
        $task = LinesTask::findOrFail($id);
        foreach (['title', 'description', 'assignee_id', 'due_date', 'labels', 'column_id', 'position'] as $f) {
            if (isset($data[$f])) $task->$f = $data[$f];
        }
        $task->save();
        if (isset($data['assignee_ids'])) {
            LinesTaskAssignee::where('task_id', $id)->delete();
            foreach ($data['assignee_ids'] as $uid) {
                LinesTaskAssignee::create(['task_id' => $id, 'user_id' => $uid]);
            }
        }
        return response()->json($task);
    }

    public function moveTask(Request $request, $id)
    {
        $data = $request->validate(['column_id' => 'required|integer', 'position' => 'required|integer']);
        LinesTask::where('id', $id)->update(['column_id' => $data['column_id'], 'position' => $data['position']]);
        return response()->json(['message' => 'Moved']);
    }

    public function deleteTask(Request $request, $id)
    {
        LinesTask::findOrFail($id)->delete();
        LinesComment::where('task_id', $id)->delete();
        LinesTaskAssignee::where('task_id', $id)->delete();
        LinesTodo::where('task_id', $id)->delete();
        LinesFile::where('task_id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Chats ───

    public function getChats(Request $request)
    {
        $tasks = LinesTask::leftJoin('users', 'users.id', '=', 'lines_tasks.assignee_id')
            ->select('lines_tasks.*', 'users.display_name as assignee_name')
            ->withCount(['comments as comment_count', 'files as file_count'])
            ->get();
        return response()->json($tasks);
    }

    // ─── Comments ───

    public function getComments(Request $request)
    {
        $taskId = $request->query('task_id');
        $comments = LinesComment::from('lines_comments')->where('lines_comments.task_id', $taskId)
            ->join('users', 'users.id', '=', 'lines_comments.user_id')
            ->select('lines_comments.*', 'users.display_name', 'users.username', 'users.avatar_color')
            ->orderBy('lines_comments.created_at')->get();
        return response()->json($comments);
    }

    public function createComment(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate([
            'task_id' => 'required|integer', 'content' => 'required|string',
            'parent_id' => 'nullable|integer',
        ]);
        $comment = LinesComment::create([
            'task_id' => $data['task_id'],
            'user_id' => $user->id,
            'content' => $data['content'],
            'parent_id' => $data['parent_id'] ?? null,
        ]);
        return response()->json($comment);
    }

    public function updateComment(Request $request, $id)
    {
        $data = $request->validate(['content' => 'required|string']);
        LinesComment::where('id', $id)->update(['content' => $data['content']]);
        return response()->json(LinesComment::find($id));
    }

    public function deleteComment(Request $request, $id)
    {
        LinesComment::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Todos ───

    public function getTodos(Request $request)
    {
        $taskId = $request->query('task_id');
        $todos = LinesTodo::from('lines_todos')->leftJoin('users', 'users.id', '=', 'lines_todos.owner_id')
            ->select('lines_todos.*', 'users.display_name as owner_name')
            ->where('lines_todos.task_id', $taskId)
            ->orderBy('lines_todos.position')->orderBy('lines_todos.name')->get();
        return response()->json($todos);
    }

    public function createTodo(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate(['name' => 'required|string', 'task_id' => 'nullable|integer']);
        $maxPos = LinesTodo::where('task_id', $data['task_id'] ?? -1)->max('position') ?? -1;
        $todo = LinesTodo::create([
            'name' => $data['name'],
            'owner_id' => $user->id,
            'task_id' => $data['task_id'] ?? null,
            'position' => $maxPos + 1,
        ]);
        return response()->json($todo);
    }

    public function updateTodo(Request $request, $id)
    {
        $data = $request->validate(['name' => 'nullable|string', 'notes' => 'nullable|string', 'status' => 'nullable|string']);
        $todo = LinesTodo::findOrFail($id);
        if (isset($data['name'])) $todo->name = $data['name'];
        if (isset($data['notes'])) $todo->notes = $data['notes'];
        if (isset($data['status'])) $todo->status = $data['status'];
        $todo->save();
        return response()->json($todo);
    }

    public function toggleTodo(Request $request, $id)
    {
        $todo = LinesTodo::findOrFail($id);
        $todo->status = $todo->status === 'done' ? 'active' : 'done';
        $todo->save();
        return response()->json($todo);
    }

    public function deleteTodo(Request $request, $id)
    {
        LinesTodo::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Legacy file upload (Lines attachments) ───

    public function upload(Request $request)
    {
        $user = $request->attributes->get('user');
        $data = $request->validate([
            'file' => 'required|file', 'task_id' => 'required|integer',
            'comment_id' => 'nullable|integer', 'todo_id' => 'nullable|integer',
        ]);
        $file = $request->file('file');
        $filename = Str::random(40) . '.' . $file->getClientOriginalExtension();
        $file->storeAs('uploads', $filename, 'local');
        $item = LinesFile::create([
            'task_id' => $data['task_id'],
            'comment_id' => $data['comment_id'] ?? null,
            'todo_id' => $data['todo_id'] ?? null,
            'user_id' => $user->id,
            'filename' => $filename,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);
        return response()->json($item);
    }

    public function getLinesFiles(Request $request)
    {
        $taskId = $request->query('task_id');
        $commentId = $request->query('comment_id');
        $todoId = $request->query('todo_id');

        $query = LinesFile::where('task_id', $taskId);
        if ($commentId === '-1') { /* no filter — return all */ }
        elseif ($commentId) $query->where('comment_id', $commentId);
        else $query->whereNull('comment_id');
        if ($todoId === '-1') { /* no filter — return all */ }
        elseif ($todoId) $query->where('todo_id', $todoId);
        else $query->whereNull('todo_id');

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function downloadLinesFile(Request $request, $id)
    {
        $file = LinesFile::findOrFail($id);
        $path = storage_path("app/uploads/{$file->filename}");
        if (!file_exists($path)) abort(404);
        return response()->file($path, ['Content-Disposition' => 'inline; filename="' . $file->original_name . '"']);
    }

    public function deleteLinesFile(Request $request, $id)
    {
        $file = LinesFile::findOrFail($id);
        $path = storage_path("app/uploads/{$file->filename}");
        if (file_exists($path)) @unlink($path);
        $file->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ─── Notifications ───

    public function getNotifications(Request $request)
    {
        $user = $request->attributes->get('user');
        $notifications = Notification::from('notifications')->where('notifications.user_id', $user->id)
            ->leftJoin('users', 'users.id', '=', 'notifications.actor_id')
            ->select('notifications.*', 'users.display_name as actor_name', 'users.username as actor_username')
            ->orderBy('notifications.created_at', 'desc')->limit(50)->get();
        return response()->json($notifications);
    }

    public function getUnreadCount(Request $request)
    {
        $user = $request->attributes->get('user');
        $count = Notification::where('user_id', $user->id)->where('is_read', 0)->count();
        return response()->json(['count' => $count]);
    }

    public function markNotificationRead(Request $request, $id)
    {
        $user = $request->attributes->get('user');
        Notification::where('id', $id)->where('user_id', $user->id)->update(['is_read' => 1]);
        return response()->json(['message' => 'Done']);
    }

    public function markAllNotificationsRead(Request $request)
    {
        $user = $request->attributes->get('user');
        Notification::where('user_id', $user->id)->where('is_read', 0)->update(['is_read' => 1]);
        return response()->json(['message' => 'Done']);
    }

    public function checkDueDates(Request $request)
    {
        $user = $request->attributes->get('user');
        $tasks = LinesTask::join('lines_columns', 'lines_columns.id', '=', 'lines_tasks.column_id')
            ->join('lines_boards', 'lines_boards.id', '=', 'lines_columns.board_id')
            ->join('lines_board_members', 'lines_board_members.board_id', '=', 'lines_boards.id')
            ->where('lines_board_members.user_id', $user->id)
            ->where('lines_tasks.due_date', '!=', '')
            ->select('lines_tasks.id', 'lines_tasks.title', 'lines_tasks.due_date')
            ->get();
        return response()->json($tasks);
    }
}
