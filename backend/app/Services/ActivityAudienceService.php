<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\ActivityAssignment;
use App\Models\StudentProfile;
use App\Models\User;

class ActivityAudienceService
{
    public function studentCanAccess(User $student, Activity $activity): bool
    {
        if ($activity->status !== 'active') {
            return false;
        }

        // Once faculty opens an activity, students may begin regardless of starts_at.
        if ($activity->ends_at && now()->greaterThan($activity->ends_at)) {
            return false;
        }

        $profile = $student->studentProfile;
        if (! $profile) {
            return false;
        }

        if ($profile->academic_status && $profile->academic_status !== 'active') {
            return false;
        }

        $assignments = $activity->assignments;
        if ($assignments->isEmpty()) {
            return false;
        }

        foreach ($assignments as $assignment) {
            if ($this->assignmentMatchesStudent($assignment, $student, $profile)) {
                return true;
            }
        }

        return false;
    }

    public function resolveActivityStudentIds(Activity $activity): array
    {
        $ids = [];
        foreach ($activity->assignments as $assignment) {
            $ids = array_merge($ids, $this->resolveStudentIds($assignment));
        }

        return array_values(array_unique($ids));
    }

    private function assignmentMatchesStudent(ActivityAssignment $assignment, User $student, StudentProfile $profile): bool
    {
        return match ($assignment->scope) {
            'all' => true,
            'program' => (int) $assignment->program_id === (int) $profile->program_id,
            'section' => (int) $assignment->section_id === (int) $profile->section_id,
            'student' => (int) $assignment->student_user_id === (int) $student->id,
            default => false,
        };
    }

    public function resolveStudentIds(ActivityAssignment $assignment): array
    {
        return match ($assignment->scope) {
            'all' => StudentProfile::pluck('user_id')->all(),
            'program' => StudentProfile::where('program_id', $assignment->program_id)->pluck('user_id')->all(),
            'section' => StudentProfile::where('section_id', $assignment->section_id)->pluck('user_id')->all(),
            'student' => $assignment->student_user_id ? [$assignment->student_user_id] : [],
            default => [],
        };
    }
}
