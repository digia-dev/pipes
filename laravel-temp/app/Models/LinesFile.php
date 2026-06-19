<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesFile extends Model
{
    protected $table = 'lines_files';
    protected $fillable = ['task_id', 'comment_id', 'todo_id', 'user_id', 'filename', 'original_name', 'mime_type', 'size'];
    public $timestamps = false;
}
