<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->json('simulation_config')->nullable()->after('ends_at');
        });

        Schema::table('student_attempts', function (Blueprint $table) {
            $table->json('simulation_state')->nullable()->after('current_question_index');
            $table->json('simulation_submission')->nullable()->after('simulation_state');
        });

        Schema::table('scores', function (Blueprint $table) {
            $table->json('details')->nullable()->after('accuracy');
        });
    }

    public function down(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->dropColumn('simulation_config');
        });

        Schema::table('student_attempts', function (Blueprint $table) {
            $table->dropColumn(['simulation_state', 'simulation_submission']);
        });

        Schema::table('scores', function (Blueprint $table) {
            $table->dropColumn('details');
        });
    }
};
