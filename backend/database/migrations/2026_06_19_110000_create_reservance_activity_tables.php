<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('instructions')->nullable();
            $table->string('type', 32);
            $table->string('difficulty', 32)->nullable();
            $table->string('status', 32)->default('draft');
            $table->unsignedSmallInteger('time_limit_minutes')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
        });

        Schema::create('activity_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->constrained('activities')->cascadeOnDelete();
            $table->string('scope', 32);
            $table->foreignId('program_id')->nullable()->constrained('programs')->nullOnDelete();
            $table->foreignId('section_id')->nullable()->constrained('sections')->nullOnDelete();
            $table->foreignId('student_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('activity_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('visibility', 32)->default('private');
            $table->json('payload');
            $table->timestamps();
        });

        Schema::create('question_bank', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('type', 32);
            $table->text('body');
            $table->text('explanation')->nullable();
            $table->unsignedSmallInteger('timer_seconds')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_id')->nullable()->constrained('activities')->cascadeOnDelete();
            $table->foreignId('question_bank_id')->nullable()->constrained('question_bank')->nullOnDelete();
            $table->string('type', 32);
            $table->text('body');
            $table->text('explanation')->nullable();
            $table->unsignedSmallInteger('timer_seconds')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('question_choices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained('questions')->cascadeOnDelete();
            $table->string('label', 4);
            $table->text('text');
            $table->boolean('is_correct')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('question_choices');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_bank');
        Schema::dropIfExists('activity_templates');
        Schema::dropIfExists('activity_assignments');
        Schema::dropIfExists('activities');
    }
};
