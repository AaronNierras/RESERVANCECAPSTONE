<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAnswer extends Model
{
    protected $fillable = ['attempt_id', 'question_id', 'answer_text', 'points_earned'];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(StudentAttempt::class, 'attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
