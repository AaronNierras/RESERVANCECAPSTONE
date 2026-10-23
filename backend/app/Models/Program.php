<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Program extends Model
{
    protected $fillable = ['slug', 'name', 'status'];

    protected $appends = ['code'];

    public function sections(): HasMany
    {
        return $this->hasMany(Section::class);
    }

    public function students(): HasMany
    {
        return $this->hasMany(StudentProfile::class);
    }

    public function getCodeAttribute(): string
    {
        return $this->sectionCode();
    }

    public function sectionCode(): string
    {
        $slug = strtoupper((string) $this->slug);

        return $slug !== '' ? $slug : (string) $this->name;
    }
}
