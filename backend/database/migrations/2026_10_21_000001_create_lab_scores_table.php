<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assessor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('rubric_key', 64);
            $table->json('marks');
            $table->text('feedback')->nullable();
            $table->timestamps();
            $table->unique(['student_user_id', 'rubric_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_scores');
    }
};
