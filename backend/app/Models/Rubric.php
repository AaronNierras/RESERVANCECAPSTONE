<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Rubric extends Model
{
    protected $fillable = ['activity_id', 'accuracy_weight', 'completion_weight', 'time_weight'];

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }
}
