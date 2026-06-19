<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesArchiveFolder extends Model
{
    protected $table = 'lines_archive_folders';
    protected $fillable = ['board_id', 'parent_id', 'name', 'created_by'];
    public $timestamps = false;

    public function tasks() { return $this->hasMany(\App\Models\LinesTask::class, 'archive_folder_id'); }
}
