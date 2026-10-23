<?php

namespace App\Services;

use App\Models\AcademicPeriod;
use App\Models\Section;
use App\Models\StudentAcademicRecord;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class StudentPlacementService
{
    public function __construct(private AcademicPeriodService $academicPeriods) {}

    public function place(User $user, Section $section, AcademicPeriod $period): StudentProfile
    {
        $section->loadMissing('program');
        $profile = $user->studentProfile;

        if (! $profile) {
            throw ValidationException::withMessages([
                'section_id' => ['This account has no student profile.'],
            ]);
        }

        if (! in_array($section->program?->slug, ['bshm', 'bstm'], true)) {
            throw ValidationException::withMessages([
                'section_id' => ['Choose a section under BS Hospitality Management or BS Tourism Management.'],
            ]);
        }

        $profile->update([
            'program_id' => $section->program_id,
            'section_id' => $section->id,
            'year_level' => (int) $section->year_level,
            'academic_status' => StudentProfile::ACADEMIC_ACTIVE,
            'current_academic_period_id' => $period->id,
        ]);

        $record = StudentAcademicRecord::query()
            ->where('student_user_id', $user->id)
            ->where('status', StudentAcademicRecord::STATUS_ACTIVE)
            ->latest('id')
            ->first();

        if ($record) {
            $record->update([
                'academic_period_id' => $period->id,
                'program_id' => $section->program_id,
                'section_id' => $section->id,
                'year_level' => (int) $section->year_level,
            ]);
        } else {
            $this->academicPeriods->attachNewStudent($user, $profile->fresh(), $period);
        }

        return $profile->fresh();
    }
}
