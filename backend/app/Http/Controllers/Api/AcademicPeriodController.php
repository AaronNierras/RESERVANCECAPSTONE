<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Models\Role;
use App\Models\Section;
use App\Models\StudentAcademicRecord;
use App\Models\User;
use App\Services\AcademicPeriodService;
use App\Services\AuditLogService;
use App\Services\RealtimeService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AcademicPeriodController extends Controller
{
    public function __construct(
        private AcademicPeriodService $academicPeriods,
        private AuditLogService $audit,
        private RealtimeService $realtime,
    ) {}

    public function current()
    {
        $current = $this->academicPeriods->current();

        return response()->json([
            'current' => $current?->toSummary(),
            'next' => $current ? $this->academicPeriods->previewNext($current) : null,
        ]);
    }

    public function index()
    {
        return response()->json([
            'current' => $this->academicPeriods->current()?->toSummary(),
            'periods' => $this->academicPeriods->history(),
        ]);
    }

    public function complete(Request $request)
    {
        $data = $request->validate([
            'progression_mode' => ['nullable', Rule::in(['none', 'advance_eligible', 'manual_review'])],
        ]);

        $current = $this->academicPeriods->current();
        if (! $current) {
            throw ValidationException::withMessages([
                'academic_period' => ['No active academic period found.'],
            ]);
        }

        $mode = $data['progression_mode'] ?? 'none';
        if ($mode === 'manual_review') {
            $mode = 'none';
        }

        $next = $this->academicPeriods->completeSemester($current, $mode);

        $this->audit->log($request->user(), 'complete_academic_period', 'academic_periods', $request);
        $this->realtime->refresh('programs');
        $this->realtime->refresh('students');
        $this->realtime->refresh('dashboard');

        return response()->json([
            'completed' => $current->fresh()->toSummary(),
            'current' => $next->toSummary(),
        ]);
    }

    public function studentHistory(Request $request, User $user)
    {
        if ($user->roleName() !== Role::STUDENT) {
            abort(404);
        }

        $records = StudentAcademicRecord::with(['academicPeriod', 'program', 'section'])
            ->where('student_user_id', $user->id)
            ->orderByDesc('started_at')
            ->get()
            ->map(fn (StudentAcademicRecord $record) => $record->toSummary());

        return response()->json(['records' => $records]);
    }

    public function studentAcademic(Request $request)
    {
        $user = $request->user()->load([
            'studentProfile.program',
            'studentProfile.section',
            'studentProfile.currentAcademicPeriod',
        ]);

        if (! $user->isStudent() || ! $user->studentProfile) {
            abort(403);
        }

        $records = StudentAcademicRecord::with(['academicPeriod', 'program', 'section'])
            ->where('student_user_id', $user->id)
            ->orderByDesc('started_at')
            ->limit(8)
            ->get()
            ->map(fn (StudentAcademicRecord $record) => $record->toSummary());

        return response()->json([
            'academic' => $user->studentProfile->toAcademicSummary(),
            'history' => $records,
        ]);
    }

    public static function validateSectionBelongsToProgram(int $programId, int $sectionId): void
    {
        $valid = Section::query()
            ->where('id', $sectionId)
            ->where('program_id', $programId)
            ->exists();

        if (! $valid) {
            throw ValidationException::withMessages([
                'section_id' => ['The selected section does not belong to the selected program.'],
            ]);
        }
    }
}
