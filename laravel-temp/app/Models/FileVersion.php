<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FileVersion extends Model
{
    protected $table = 'file_versions';
    protected $fillable = ['file_id', 'filename', 'size', 'uploaded_by'];
    public $timestamps = false;
}
