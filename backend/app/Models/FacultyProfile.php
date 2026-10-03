<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FacultyProfile extends Model
{
    protected $fillable = ['user_id', 'department'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
