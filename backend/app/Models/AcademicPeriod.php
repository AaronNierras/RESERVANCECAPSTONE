<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AcademicPeriod extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_UPCOMING = 'upcoming';

    protected $fillable = [
        'school_year_start',
        'school_year_end',
        'semester',
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

    public function studentProfiles(): HasMany
    {
        return $this->hasMany(StudentProfile::class, 'current_academic_period_id');
    }

    public function academicRecords(): HasMany
    {
        return $this->hasMany(StudentAcademicRecord::class);
    }

    public function schoolYearLabel(): string
    {
        return "{$this->school_year_start}-{$this->school_year_end}";
    }

    public function semesterLabel(): string
    {
        return match ((int) $this->semester) {
            1 => '1st Semester',
            2 => '2nd Semester',
            default => "Semester {$this->semester}",
        };
    }

    public function label(): string
    {
        return "{$this->schoolYearLabel()} • {$this->semesterLabel()}";
    }

    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'school_year_start' => $this->school_year_start,
            'school_year_end' => $this->school_year_end,
            'school_year' => $this->schoolYearLabel(),
            'semester' => (int) $this->semester,
            'semester_label' => $this->semesterLabel(),
            'status' => $this->status,
            'label' => $this->label(),
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
        ];
    }
}
