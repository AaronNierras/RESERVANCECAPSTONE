<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Score extends Model
{
    protected $fillable = [
        'attempt_id', 'raw_score', 'percentage', 'rank',
        'completion_seconds', 'accuracy', 'details',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(StudentAttempt::class, 'attempt_id');
    }

    public function breakdowns(): HasMany
    {
        return $this->hasMany(ScoreBreakdown::class);
    }
}
