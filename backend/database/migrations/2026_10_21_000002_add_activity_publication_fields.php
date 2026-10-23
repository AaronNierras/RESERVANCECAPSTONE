<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->string('open_mode', 16)->default('manual')->after('ends_at');
            $table->string('late_policy', 16)->default('lock')->after('open_mode');
            $table->timestamp('published_at')->nullable()->after('late_policy');
            $table->timestamp('opened_at')->nullable()->after('published_at');
            $table->timestamp('closed_at')->nullable()->after('opened_at');
            $table->foreignId('published_by')->nullable()->after('closed_at')->constrained('users')->nullOnDelete();
            $table->foreignId('opened_by')->nullable()->after('published_by')->constrained('users')->nullOnDelete();
            $table->foreignId('closed_by')->nullable()->after('opened_by')->constrained('users')->nullOnDelete();
        });

        Schema::create('activity_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained('activities')->cascadeOnDelete();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['activity_id', 'student_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_recipients');

        Schema::table('activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('closed_by');
            $table->dropConstrainedForeignId('opened_by');
            $table->dropConstrainedForeignId('published_by');
            $table->dropColumn(['open_mode', 'late_policy', 'published_at', 'opened_at', 'closed_at']);
        });
    }
};
