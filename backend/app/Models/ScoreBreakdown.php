<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScoreBreakdown extends Model
{
    protected $fillable = ['score_id', 'question_id', 'student_answer', 'correct_answer', 'points'];

    public function score(): BelongsTo
    {
        return $this->belongsTo(Score::class);
    }
}
