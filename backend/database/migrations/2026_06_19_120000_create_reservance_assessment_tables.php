<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('activity_id')->constrained('activities')->cascadeOnDelete();
            $table->string('status', 32)->default('not_started');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('server_deadline_at')->nullable();
            $table->unsignedSmallInteger('current_question_index')->default(0);
            $table->timestamps();
            $table->unique(['student_user_id', 'activity_id']);
        });

        Schema::create('student_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->constrained('student_attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->text('answer_text')->nullable();
            $table->decimal('points_earned', 8, 2)->default(0);
            $table->timestamps();
            $table->unique(['attempt_id', 'question_id']);
        });

        Schema::create('scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->unique()->constrained('student_attempts')->cascadeOnDelete();
            $table->decimal('raw_score', 8, 2)->default(0);
            $table->decimal('percentage', 5, 2)->default(0);
            $table->unsignedInteger('rank')->nullable();
            $table->unsignedInteger('completion_seconds')->nullable();
            $table->decimal('accuracy', 5, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('score_breakdowns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('score_id')->constrained('scores')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->text('student_answer')->nullable();
            $table->text('correct_answer')->nullable();
            $table->decimal('points', 8, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('rubrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->unique()->constrained('activities')->cascadeOnDelete();
            $table->decimal('accuracy_weight', 5, 2)->default(70);
            $table->decimal('completion_weight', 5, 2)->default(20);
            $table->decimal('time_weight', 5, 2)->default(10);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rubrics');
        Schema::dropIfExists('score_breakdowns');
        Schema::dropIfExists('scores');
        Schema::dropIfExists('student_answers');
        Schema::dropIfExists('student_attempts');
    }
};
