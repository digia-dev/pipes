<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesBoard extends Model
{
    protected $table = 'lines_boards';
    protected $fillable = ['name', 'created_by', 'description_template'];
    public $timestamps = false;
}
