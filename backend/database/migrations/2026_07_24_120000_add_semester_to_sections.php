<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            $table->unsignedTinyInteger('semester')->default(1)->after('year_level');
        });

        Schema::table('sections', function (Blueprint $table) {
            $table->dropUnique('sections_program_year_name_unique');
            $table->unique(['program_id', 'year_level', 'semester', 'name'], 'sections_program_year_sem_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            $table->dropUnique('sections_program_year_sem_name_unique');
            $table->unique(['program_id', 'year_level', 'name'], 'sections_program_year_name_unique');
            $table->dropColumn('semester');
        });
    }
};
