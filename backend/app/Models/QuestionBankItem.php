<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionBankItem extends Model
{
    protected $table = 'question_bank';

    protected $fillable = ['created_by', 'type', 'body', 'explanation', 'timer_seconds', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
