<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'notifications';
    protected $fillable = ['user_id', 'type', 'message', 'task_id', 'comment_id', 'actor_id', 'is_read'];
    protected $casts = [
        'is_read' => 'boolean',
    ];
    public $timestamps = false;
}
