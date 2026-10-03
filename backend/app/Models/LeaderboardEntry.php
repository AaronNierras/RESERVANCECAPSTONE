<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaderboardEntry extends Model
{
    protected $fillable = [
        'scope', 'activity_id', 'program_id', 'student_user_id',
        'composite_score', 'rank', 'semester',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }
}
