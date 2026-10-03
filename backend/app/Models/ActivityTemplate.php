<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityTemplate extends Model
{
    protected $fillable = ['created_by', 'title', 'description', 'visibility', 'payload'];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
