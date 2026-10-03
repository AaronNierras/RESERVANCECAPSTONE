<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StudentAttempt extends Model
{
    protected $fillable = [
        'student_user_id', 'activity_id', 'status', 'started_at',
        'submitted_at', 'server_deadline_at', 'current_question_index',
        'simulation_state', 'simulation_submission',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'submitted_at' => 'datetime',
            'server_deadline_at' => 'datetime',
            'simulation_state' => 'array',
            'simulation_submission' => 'array',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(StudentAnswer::class, 'attempt_id');
    }

    public function score(): HasOne
    {
        return $this->hasOne(Score::class, 'attempt_id');
    }
}
