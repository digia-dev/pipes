<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class User extends Model
{
    protected $table = 'users';
    protected $fillable = ['username', 'display_name', 'email', 'role', 'password_hash', 'avatar_color'];
    protected $hidden = ['password_hash'];
    public $timestamps = false;

    public function tokens()
    {
        return $this->hasMany(AuthToken::class);
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }
}
