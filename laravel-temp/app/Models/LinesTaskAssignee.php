<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesTaskAssignee extends Model
{
    protected $table = 'lines_task_assignees';
    protected $fillable = ['task_id', 'user_id'];
    public $timestamps = false;
}
