<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $duplicateIds = DB::table('user_sessions')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('user_id');

        foreach ($duplicateIds as $userId) {
            $keepId = DB::table('user_sessions')
                ->where('user_id', $userId)
                ->orderByDesc('last_activity')
                ->value('id');

            DB::table('user_sessions')
                ->where('user_id', $userId)
                ->where('id', '!=', $keepId)
                ->delete();
        }

        Schema::table('user_sessions', function (Blueprint $table) {
            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('user_sessions', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });
    }
};
