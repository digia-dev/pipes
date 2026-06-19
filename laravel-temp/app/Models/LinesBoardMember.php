<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinesBoardMember extends Model
{
    protected $table = 'lines_board_members';
    protected $fillable = ['board_id', 'user_id'];
    public $timestamps = false;
}
