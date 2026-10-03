<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Notification extends Model
{
    protected $fillable = ['type', 'title', 'body', 'data'];

    protected function casts(): array
    {
        return ['data' => 'array'];
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(NotificationRecipient::class);
    }
}
