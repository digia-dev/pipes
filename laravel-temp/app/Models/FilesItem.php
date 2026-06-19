<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FilesItem extends Model
{
    protected $table = 'files_items';
    protected $fillable = ['folder_id', 'filename', 'original_name', 'mime_type', 'size', 'owner_id', 'is_starred', 'deleted_at'];
    protected $casts = [
        'is_starred' => 'boolean',
    ];
    public $timestamps = false;
}
