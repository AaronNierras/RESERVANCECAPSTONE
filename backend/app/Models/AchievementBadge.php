<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AchievementBadge extends Model
{
    protected $table = 'achievement_badges';

    protected $fillable = ['slug', 'name', 'description', 'icon', 'points'];

    public function studentBadges(): HasMany
    {
        return $this->hasMany(StudentBadge::class, 'badge_id');
    }
}
