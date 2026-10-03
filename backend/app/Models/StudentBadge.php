<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentBadge extends Model
{
    protected $fillable = ['student_user_id', 'badge_id', 'earned_at'];

    protected function casts(): array
    {
        return ['earned_at' => 'datetime'];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function badge(): BelongsTo
    {
        return $this->belongsTo(AchievementBadge::class, 'badge_id');
    }
}
