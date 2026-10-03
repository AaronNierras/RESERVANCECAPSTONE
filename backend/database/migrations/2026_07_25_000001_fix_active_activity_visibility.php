<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Active activities should be visible once opened, even if starts_at is still in the future.
        DB::table('activities')
            ->where('status', 'active')
            ->whereNotNull('starts_at')
            ->where('starts_at', '>', now())
            ->update(['starts_at' => now()]);
    }

    public function down(): void
    {
        // No-op: data correction only.
    }
};
