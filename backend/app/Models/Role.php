<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $fillable = ['name'];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public const SUPER_ADMIN = 'super_admin';
    public const PROGRAM_CHAIR = 'program_chair';
    public const FACULTY = 'faculty';
    public const STUDENT = 'student';
}
