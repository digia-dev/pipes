<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesColumn extends Model
{
    protected $table = 'lines_columns';
    protected $fillable = ['board_id', 'name', 'position', 'color'];
    public $timestamps = false;
}
