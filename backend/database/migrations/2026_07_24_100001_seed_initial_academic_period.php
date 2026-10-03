<?php

use App\Models\AcademicPeriod;
use App\Models\StudentAcademicRecord;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (AcademicPeriod::query()->exists()) {
            return;
        }

        $period = AcademicPeriod::create([
            'school_year_start' => 2026,
            'school_year_end' => 2027,
            'semester' => 1,
            'status' => AcademicPeriod::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        StudentProfile::query()->each(function (StudentProfile $profile) use ($period) {
            $user = User::find($profile->user_id);
            if (! $user) {
                return;
            }

            $parts = preg_split('/\s+/', trim($user->name), 2) ?: [];
            $firstName = $profile->first_name ?: ($parts[0] ?? $user->name);
            $lastName = $profile->last_name ?: ($parts[1] ?? '');

            $profile->update([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'year_level' => $profile->year_level ?: 2,
                'academic_status' => $profile->academic_status ?: StudentProfile::ACADEMIC_ACTIVE,
                'current_academic_period_id' => $period->id,
            ]);

            StudentAcademicRecord::firstOrCreate(
                [
                    'student_user_id' => $profile->user_id,
                    'academic_period_id' => $period->id,
                ],
                [
                    'program_id' => $profile->program_id,
                    'section_id' => $profile->section_id,
                    'year_level' => $profile->year_level ?: 2,
                    'status' => StudentAcademicRecord::STATUS_ACTIVE,
                    'started_at' => now(),
                ]
            );
        });
    }

    public function down(): void
    {
        DB::table('student_academic_records')->truncate();
        AcademicPeriod::query()->delete();
    }
};
