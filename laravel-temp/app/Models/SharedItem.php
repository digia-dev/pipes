<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SharedItem extends Model
{
    protected $table = 'shared_items';
    protected $fillable = ['item_type', 'item_id', 'token', 'permission', 'created_by'];
    public $timestamps = false;
}
