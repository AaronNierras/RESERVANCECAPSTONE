<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_periods', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('school_year_start');
            $table->unsignedSmallInteger('school_year_end');
            $table->unsignedTinyInteger('semester');
            $table->string('status', 20)->default('upcoming');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['school_year_start', 'school_year_end', 'semester'], 'academic_periods_term_unique');
        });

        Schema::table('programs', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->after('name');
        });

        Schema::table('sections', function (Blueprint $table) {
            $table->unsignedTinyInteger('year_level')->nullable()->after('name');
            $table->string('status', 20)->default('active')->after('year_level');
        });

        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('first_name')->nullable()->after('student_number');
            $table->string('last_name')->nullable()->after('first_name');
            $table->unsignedTinyInteger('year_level')->nullable()->after('section_id');
            $table->string('academic_status', 20)->default('active')->after('year_level');
            $table->foreignId('current_academic_period_id')->nullable()->after('academic_status')
                ->constrained('academic_periods')->nullOnDelete();
        });

        Schema::create('student_academic_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('academic_period_id')->constrained('academic_periods')->cascadeOnDelete();
            $table->foreignId('program_id')->nullable()->constrained('programs')->nullOnDelete();
            $table->foreignId('section_id')->nullable()->constrained('sections')->nullOnDelete();
            $table->unsignedTinyInteger('year_level');
            $table->string('status', 20)->default('active');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['student_user_id', 'academic_period_id'], 'student_academic_records_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_academic_records');

        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_academic_period_id');
            $table->dropColumn(['first_name', 'last_name', 'year_level', 'academic_status']);
        });

        Schema::table('sections', function (Blueprint $table) {
            $table->dropColumn(['year_level', 'status']);
        });

        Schema::table('programs', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        Schema::dropIfExists('academic_periods');
    }
};
