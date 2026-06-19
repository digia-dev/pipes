<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesComment extends Model
{
    protected $table = 'lines_comments';
    protected $fillable = ['task_id', 'user_id', 'content', 'parent_id'];
    public $timestamps = false;
}
