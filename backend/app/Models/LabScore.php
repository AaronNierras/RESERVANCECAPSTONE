<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabScore extends Model
{
    protected $fillable = [
        'student_user_id',
        'assessor_user_id',
        'rubric_key',
        'marks',
        'feedback',
    ];

    protected function casts(): array
    {
        return [
            'marks' => 'array',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessor_user_id');
    }
}
