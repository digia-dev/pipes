<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FilesFolder extends Model
{
    protected $table = 'files_folders';
    protected $fillable = ['parent_id', 'name', 'owner_id', 'deleted_at'];
    public $timestamps = false;

    public function items() { return $this->hasMany(\App\Models\FilesItem::class, 'folder_id'); }
}
