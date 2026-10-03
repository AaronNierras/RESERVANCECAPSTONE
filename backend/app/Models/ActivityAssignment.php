<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityAssignment extends Model
{
    protected $fillable = ['activity_id', 'scope', 'program_id', 'section_id', 'student_user_id'];

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }
}
