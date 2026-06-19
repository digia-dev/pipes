<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesArchiveActivity extends Model
{
    protected $table = 'lines_archive_activity';
    protected $fillable = ['user_id', 'action', 'target_type', 'target_id', 'details'];
    public $timestamps = false;
}
