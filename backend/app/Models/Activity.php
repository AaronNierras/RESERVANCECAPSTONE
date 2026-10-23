<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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
        'open_mode', 'late_policy',
        'published_at', 'opened_at', 'closed_at',
        'published_by', 'opened_by', 'closed_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'published_at' => 'datetime',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
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

    public function startHasArrived(): bool
    {
        return ! $this->starts_at || now()->greaterThanOrEqualTo($this->starts_at);
    }

    public function deadlineHasPassed(): bool
    {
        return $this->ends_at !== null && now()->greaterThan($this->ends_at);
    }

    public function isLaboratory(): bool
    {
        $config = $this->simulation_config;

        return is_array($config) && ! empty($config['laboratory']);
    }

    public function scopeVisibleInFactory(Builder $query): Builder
    {
        return $query->where(function (Builder $inner) {
            $inner->whereNull('simulation_config->rubric_key')
                ->orWhere('simulation_config->rubric_key', '!=', 'front_office');
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ActivityAssignment::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(ActivityRecipient::class);
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
