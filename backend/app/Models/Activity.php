<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Activity extends Model
{
    protected $fillable = [
        'created_by', 'title', 'description', 'instructions', 'type',
        'difficulty', 'status', 'time_limit_minutes', 'starts_at', 'ends_at',
        'simulation_config',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'simulation_config' => 'array',
        ];
    }

    public function isSimulation(): bool
    {
        return $this->type === 'simulation';
    }

    public function isCombination(): bool
    {
        return $this->type === 'combination';
    }

    public function hasSimulation(): bool
    {
        return $this->isSimulation() || $this->isCombination();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ActivityAssignment::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('sort_order');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(StudentAttempt::class);
    }

    public function rubric(): HasOne
    {
        return $this->hasOne(Rubric::class);
    }
}
