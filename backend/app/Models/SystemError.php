<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemError extends Model
{
    protected $fillable = [
        'user_id',
        'source',
        'message',
        'location',
        'is_fixed',
        'fixed_at',
    ];

    protected function casts(): array
    {
        return [
            'is_fixed' => 'boolean',
            'fixed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
