<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAcademicRecord extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_GRADUATED = 'graduated';

    protected $fillable = [
        'student_user_id',
        'academic_period_id',
        'program_id',
        'section_id',
        'year_level',
        'status',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function academicPeriod(): BelongsTo
    {
        return $this->belongsTo(AcademicPeriod::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    public function toSummary(): array
    {
        $period = $this->relationLoaded('academicPeriod') ? $this->academicPeriod : null;

        return [
            'id' => $this->id,
            'academic_period' => $period?->toSummary(),
            'program' => $this->program?->only(['id', 'name']),
            'section' => $this->section?->only(['id', 'name']),
            'year_level' => (int) $this->year_level,
            'year_level_label' => self::yearLevelLabel((int) $this->year_level),
            'status' => $this->status,
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
        ];
    }

    public static function yearLevelLabel(int $level): string
    {
        return match ($level) {
            1 => '1st Year',
            2 => '2nd Year',
            3 => '3rd Year',
            4 => '4th Year',
            default => "Year {$level}",
        };
    }
}
