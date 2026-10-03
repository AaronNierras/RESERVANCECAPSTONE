<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achievement_badges', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('icon')->nullable();
            $table->unsignedInteger('points')->default(0);
            $table->timestamps();
        });

        Schema::create('student_badges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('badge_id')->constrained('achievement_badges')->cascadeOnDelete();
            $table->timestamp('earned_at');
            $table->timestamps();
            $table->unique(['student_user_id', 'badge_id']);
        });

        Schema::create('leaderboard_entries', function (Blueprint $table) {
            $table->id();
            $table->string('scope', 32);
            $table->foreignId('activity_id')->nullable()->constrained('activities')->nullOnDelete();
            $table->foreignId('program_id')->nullable()->constrained('programs')->nullOnDelete();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('composite_score', 10, 4)->default(0);
            $table->unsignedInteger('rank')->nullable();
            $table->string('semester', 32)->nullable();
            $table->timestamps();
            $table->index(['scope', 'activity_id', 'rank']);
            $table->index(['scope', 'program_id', 'rank']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type', 64);
            $table->string('title');
            $table->text('body')->nullable();
            $table->json('data')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('notification_id')->constrained('notifications')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->unique(['notification_id', 'user_id']);
        });

        Schema::create('user_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->string('device')->nullable();
            $table->timestamp('last_activity');
            $table->string('status', 20)->default('online');
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('module');
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('integrity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('activity_id')->constrained('activities')->cascadeOnDelete();
            $table->foreignId('attempt_id')->nullable()->constrained('student_attempts')->nullOnDelete();
            $table->string('violation_type', 64);
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('tutorials', function (Blueprint $table) {
            $table->id();
            $table->string('role', 32)->nullable();
            $table->string('category', 64)->default('manual');
            $table->string('title');
            $table->text('content')->nullable();
            $table->string('video_url')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tutorials');
        Schema::dropIfExists('integrity_logs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('notification_recipients');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('leaderboard_entries');
        Schema::dropIfExists('student_badges');
        Schema::dropIfExists('achievement_badges');
    }
};
