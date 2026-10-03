<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Section extends Model
{
    protected $fillable = ['program_id', 'name', 'year_level', 'semester', 'status'];

    public const SEMESTER_FIRST = 1;

    public const SEMESTER_SECOND = 2;

    public const SEMESTER_SUMMER = 3;

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function students(): HasMany
    {
        return $this->hasMany(StudentProfile::class);
    }

    public function displayLabel(?string $programName = null): string
    {
        $programName ??= $this->relationLoaded('program') ? $this->program?->name : null;

        if ($programName && $this->year_level) {
            $label = trim("{$programName} {$this->year_level}-{$this->name}");
        } elseif ($programName) {
            $label = trim("{$programName} {$this->name}");
        } else {
            $label = $this->name;
        }

        if ($this->semester) {
            $label .= ' | '.$this->semesterShortLabel();
        }

        return $label;
    }

    public function semesterShortLabel(): string
    {
        return match ((int) $this->semester) {
            self::SEMESTER_FIRST => 'FIRST SEM',
            self::SEMESTER_SECOND => 'SECOND SEM',
            self::SEMESTER_SUMMER => 'SUMMER',
            default => 'SEM '.strtoupper((string) $this->semester),
        };
    }

    public function semesterLabel(): string
    {
        return match ((int) $this->semester) {
            self::SEMESTER_FIRST => '1st Sem',
            self::SEMESTER_SECOND => '2nd Sem',
            self::SEMESTER_SUMMER => 'Summer',
            default => "Sem {$this->semester}",
        };
    }
}
