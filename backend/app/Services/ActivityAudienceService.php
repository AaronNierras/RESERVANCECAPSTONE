<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\ActivityAssignment;
use App\Models\ActivityRecipient;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ActivityAudienceService
{
    public function studentCanAccess(User $student, Activity $activity): bool
    {
        if ($activity->status === 'draft' || $activity->status === 'archived') {
            return false;
        }

        if ($activity->deadlineHasPassed() || ! $activity->startHasArrived()) {
            return false;
        }

        $isOpen = $activity->status === 'active'
            || ($activity->status === 'published' && $activity->open_mode === 'automatic');

        if (! $isOpen) {
            return false;
        }

        $profile = $student->studentProfile;
        if (! $profile || ! $this->profileIsEligible($profile, $student)) {
            return false;
        }

        if ($this->hasRecipientSnapshot($activity)) {
            $recipients = $activity->relationLoaded('recipients')
                ? $activity->recipients
                : $activity->recipients()->get();

            return $recipients->contains(fn (ActivityRecipient $row) => (int) $row->student_user_id === (int) $student->id);
        }

        $assignments = $activity->relationLoaded('assignments')
            ? $activity->assignments
            : $activity->assignments()->get();

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

    public function snapshotRecipients(Activity $activity): array
    {
        $ids = $this->resolveActivityStudentIds($activity);

        DB::transaction(function () use ($activity, $ids) {
            $activity->recipients()->delete();
            foreach ($ids as $studentId) {
                ActivityRecipient::create([
                    'activity_id' => $activity->id,
                    'student_user_id' => $studentId,
                ]);
            }
        });

        return $ids;
    }

    public function resolveActivityStudentIds(Activity $activity): array
    {
        if ($this->hasRecipientSnapshot($activity)) {
            return $activity->recipients()->pluck('student_user_id')->map(fn ($id) => (int) $id)->all();
        }

        $ids = [];
        $assignments = $activity->relationLoaded('assignments')
            ? $activity->assignments
            : $activity->assignments()->get();

        foreach ($assignments as $assignment) {
            $ids = array_merge($ids, $this->resolveStudentIds($assignment));
        }

        return array_values(array_unique($ids));
    }

    public function eligibleCountForSection(int $sectionId): int
    {
        return $this->eligibleProfiles()
            ->where('section_id', $sectionId)
            ->count();
    }

    private function hasRecipientSnapshot(Activity $activity): bool
    {
        if ($activity->relationLoaded('recipients')) {
            return $activity->recipients->isNotEmpty();
        }

        return $activity->recipients()->exists();
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
        $query = $this->eligibleProfiles();

        $ids = match ($assignment->scope) {
            'all' => $query->pluck('user_id'),
            'program' => $query->where('program_id', $assignment->program_id)->pluck('user_id'),
            'section' => $query->where('section_id', $assignment->section_id)->pluck('user_id'),
            'student' => $query->where('user_id', $assignment->student_user_id)->pluck('user_id'),
            default => collect(),
        };

        return $ids->map(fn ($id) => (int) $id)->all();
    }

    private function eligibleProfiles()
    {
        return StudentProfile::query()
            ->whereNotNull('section_id')
            ->where(function ($query) {
                $query->whereNull('academic_status')
                    ->orWhere('academic_status', StudentProfile::ACADEMIC_ACTIVE);
            })
            ->whereHas('program', fn ($query) => $query->whereIn('slug', ['bshm', 'bstm']))
            ->whereHas('user', fn ($query) => $query->where('status', 'active'));
    }

    private function profileIsEligible(StudentProfile $profile, User $student): bool
    {
        if (! $profile->section_id) {
            return false;
        }

        if ($student->status !== 'active') {
            return false;
        }

        if ($profile->academic_status && $profile->academic_status !== StudentProfile::ACADEMIC_ACTIVE) {
            return false;
        }

        $profile->loadMissing('program');

        return in_array($profile->program?->slug, ['bshm', 'bstm'], true);
    }
}
