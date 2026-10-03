<?php

namespace App\Services;

use App\Models\AcademicPeriod;
use App\Models\Role;
use App\Models\StudentAcademicRecord;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AcademicPeriodService
{
    public function current(): ?AcademicPeriod
    {
        return AcademicPeriod::query()
            ->where('status', AcademicPeriod::STATUS_ACTIVE)
            ->orderByDesc('started_at')
            ->first();
    }

    public function history(int $limit = 20)
    {
        return AcademicPeriod::query()
            ->orderByDesc('school_year_start')
            ->orderByDesc('semester')
            ->limit($limit)
            ->get()
            ->map(fn (AcademicPeriod $period) => $period->toSummary());
    }

    public function previewNext(AcademicPeriod $current): array
    {
        $next = $this->buildNextPeriodAttributes($current);

        return [
            'school_year_start' => $next['school_year_start'],
            'school_year_end' => $next['school_year_end'],
            'school_year' => "{$next['school_year_start']}-{$next['school_year_end']}",
            'semester' => $next['semester'],
            'semester_label' => $this->semesterLabel($next['semester']),
            'label' => "{$next['school_year_start']}-{$next['school_year_end']} • ".$this->semesterLabel($next['semester']),
        ];
    }

    public function completeSemester(AcademicPeriod $period, string $progressionMode = 'none'): AcademicPeriod
    {
        if ($period->status !== AcademicPeriod::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'academic_period' => ['Only the active academic period can be completed.'],
            ]);
        }

        return DB::transaction(function () use ($period, $progressionMode) {
            $now = now();
            $nextAttributes = $this->buildNextPeriodAttributes($period);

            $period->update([
                'status' => AcademicPeriod::STATUS_COMPLETED,
                'completed_at' => $now,
            ]);

            $this->closeStudentRecordsForPeriod($period, $now);

            $nextPeriod = AcademicPeriod::firstOrCreate(
                [
                    'school_year_start' => $nextAttributes['school_year_start'],
                    'school_year_end' => $nextAttributes['school_year_end'],
                    'semester' => $nextAttributes['semester'],
                ],
                [
                    'status' => AcademicPeriod::STATUS_UPCOMING,
                ]
            );

            if ($nextPeriod->status === AcademicPeriod::STATUS_COMPLETED) {
                throw ValidationException::withMessages([
                    'academic_period' => ['The next academic period has already been completed.'],
                ]);
            }

            AcademicPeriod::query()
                ->where('status', AcademicPeriod::STATUS_ACTIVE)
                ->where('id', '!=', $nextPeriod->id)
                ->update(['status' => AcademicPeriod::STATUS_COMPLETED]);

            $nextPeriod->update([
                'status' => AcademicPeriod::STATUS_ACTIVE,
                'started_at' => $nextPeriod->started_at ?? $now,
                'completed_at' => null,
            ]);

            $this->progressStudents($period, $nextPeriod, $progressionMode, $now);

            return $nextPeriod->fresh();
        });
    }

    public function attachNewStudent(User $student, StudentProfile $profile, AcademicPeriod $period): StudentAcademicRecord
    {
        return StudentAcademicRecord::create([
            'student_user_id' => $student->id,
            'academic_period_id' => $period->id,
            'program_id' => $profile->program_id,
            'section_id' => $profile->section_id,
            'year_level' => $profile->year_level,
            'status' => StudentAcademicRecord::STATUS_ACTIVE,
            'started_at' => now(),
        ]);
    }

    public function semesterLabel(int $semester): string
    {
        return match ($semester) {
            1 => '1st Semester',
            2 => '2nd Semester',
            default => "Semester {$semester}",
        };
    }

    private function buildNextPeriodAttributes(AcademicPeriod $current): array
    {
        if ((int) $current->semester === 1) {
            return [
                'school_year_start' => (int) $current->school_year_start,
                'school_year_end' => (int) $current->school_year_end,
                'semester' => 2,
            ];
        }

        return [
            'school_year_start' => (int) $current->school_year_end,
            'school_year_end' => (int) $current->school_year_end + 1,
            'semester' => 1,
        ];
    }

    private function closeStudentRecordsForPeriod(AcademicPeriod $period, $completedAt): void
    {
        StudentAcademicRecord::query()
            ->where('academic_period_id', $period->id)
            ->where('status', StudentAcademicRecord::STATUS_ACTIVE)
            ->update([
                'status' => StudentAcademicRecord::STATUS_COMPLETED,
                'completed_at' => $completedAt,
            ]);
    }

    private function progressStudents(
        AcademicPeriod $completedPeriod,
        AcademicPeriod $nextPeriod,
        string $progressionMode,
        $startedAt,
    ): void {
        $students = User::with('studentProfile')
            ->whereHas('role', fn ($q) => $q->where('name', Role::STUDENT))
            ->whereHas('studentProfile', fn ($q) => $q->where('current_academic_period_id', $completedPeriod->id))
            ->get();

        foreach ($students as $student) {
            $profile = $student->studentProfile;
            if (! $profile) {
                continue;
            }

            $yearLevel = (int) $profile->year_level;
            $academicStatus = $profile->academic_status;

            if ($progressionMode === 'advance_eligible' && (int) $completedPeriod->semester === 2) {
                if ($yearLevel >= 4) {
                    $academicStatus = StudentProfile::ACADEMIC_GRADUATED;
                } else {
                    $yearLevel += 1;
                }
            }

            $profile->update([
                'year_level' => $yearLevel,
                'academic_status' => $academicStatus,
                'current_academic_period_id' => $nextPeriod->id,
            ]);

            if ($academicStatus === StudentProfile::ACADEMIC_GRADUATED) {
                continue;
            }

            StudentAcademicRecord::create([
                'student_user_id' => $student->id,
                'academic_period_id' => $nextPeriod->id,
                'program_id' => $profile->program_id,
                'section_id' => $profile->section_id,
                'year_level' => $yearLevel,
                'status' => StudentAcademicRecord::STATUS_ACTIVE,
                'started_at' => $startedAt,
            ]);
        }
    }
}
