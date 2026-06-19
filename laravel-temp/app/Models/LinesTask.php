<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesTask extends Model
{
    protected $table = 'lines_tasks';
    protected $fillable = ['column_id', 'title', 'description', 'assignee_id', 'due_date', 'labels', 'position', 'created_by', 'is_archived', 'archived_by', 'archived_at', 'archive_folder_id'];
    protected $casts = [
        'is_archived' => 'boolean',
    ];
    public $timestamps = false;

    public function comments() { return $this->hasMany(\App\Models\LinesComment::class, 'task_id'); }
    public function files() { return $this->hasMany(\App\Models\LinesFile::class, 'task_id'); }
    public function assignees() { return $this->hasMany(\App\Models\LinesTaskAssignee::class, 'task_id'); }
}
