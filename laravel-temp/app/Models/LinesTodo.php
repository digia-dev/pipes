<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesTodo extends Model
{
    protected $table = 'lines_todos';
    protected $fillable = ['task_id', 'name', 'notes', 'owner_id', 'status', 'position'];
    public $timestamps = false;
}
