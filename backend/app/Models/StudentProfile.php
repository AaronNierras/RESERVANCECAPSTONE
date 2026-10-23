<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudentProfile extends Model
{
    public const ACADEMIC_ACTIVE = 'active';

    public const ACADEMIC_COMPLETED = 'completed';

    public const ACADEMIC_GRADUATED = 'graduated';

    public const ACADEMIC_INACTIVE = 'inactive';

    protected $fillable = [
        'user_id',
        'student_number',
        'first_name',
        'last_name',
        'program_id',
        'section_id',
        'year_level',
        'academic_status',
        'current_academic_period_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    public function currentAcademicPeriod(): BelongsTo
    {
        return $this->belongsTo(AcademicPeriod::class, 'current_academic_period_id');
    }

    public function academicRecords(): HasMany
    {
        return $this->hasMany(StudentAcademicRecord::class, 'student_user_id', 'user_id');
    }

    public function yearLevelLabel(): ?string
    {
        return $this->year_level
            ? StudentAcademicRecord::yearLevelLabel((int) $this->year_level)
            : null;
    }

    public function toAcademicSummary(): array
    {
        $period = $this->relationLoaded('currentAcademicPeriod')
            ? $this->currentAcademicPeriod
            : null;

        return [
            'student_number' => $this->student_number,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'program' => $this->program?->only(['id', 'name', 'code']),
            'section' => $this->section ? [
                'id' => $this->section->id,
                'name' => $this->section->name,
                'year_level' => $this->section->year_level ? (int) $this->section->year_level : null,
                'semester' => $this->section->semester ? (int) $this->section->semester : null,
                'semester_label' => $this->section->semesterLabel(),
                'display_label' => $this->section->displayLabel($this->program?->sectionCode()),
            ] : null,
            'year_level' => $this->year_level ? (int) $this->year_level : null,
            'year_level_label' => $this->yearLevelLabel(),
            'academic_status' => $this->academic_status,
            'current_period' => $period?->toSummary(),
        ];
    }
}
