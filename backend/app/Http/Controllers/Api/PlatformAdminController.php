<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Program;
use App\Models\Role;
use App\Models\Section;
use App\Models\SystemError;
use App\Models\User;
use App\Services\AcademicPeriodService;
use App\Services\AuditLogService;
use App\Services\PresenceService;
use App\Services\RealtimeService;
use App\Services\StudentPlacementService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PlatformAdminController extends Controller
{
    public function __construct(
        private PresenceService $presence,
        private AcademicPeriodService $academicPeriods,
        private StudentPlacementService $placement,
        private AuditLogService $audit,
        private RealtimeService $realtime,
    ) {}

    public function dashboard()
    {
        $students = User::whereHas('role', fn ($query) => $query->where('name', Role::STUDENT))->count();
        $faculty = User::whereHas('role', fn ($query) => $query->where('name', Role::FACULTY))->count();
        $onlineStudents = $this->presence->countOnlineForRole(Role::STUDENT);
        $onlineFaculty = $this->presence->countOnlineForRole(Role::FACULTY);

        return response()->json([
            'students_registered' => $students,
            'faculty_registered' => $faculty,
            'students_online' => $onlineStudents,
            'faculty_online' => $onlineFaculty,
            'students_offline' => max(0, $students - $onlineStudents),
            'faculty_offline' => max(0, $faculty - $onlineFaculty),
        ]);
    }

    public function students()
    {
        $students = $this->studentUsers();
        $onlineIds = array_flip($this->presence->onlineUserIds($students->pluck('id')->all()));

        $programs = Program::query()
            ->with(['sections' => fn ($query) => $query->orderBy('year_level')->orderBy('name')])
            ->whereIn('slug', ['bshm', 'bstm'])
            ->orderBy('name')
            ->get();

        $grouped = $programs->map(function (Program $program) use ($students, $onlineIds) {
            return [
                'id' => $program->id,
                'name' => $program->name,
                'code' => $program->code,
                'sections' => $program->sections->map(function (Section $section) use ($program, $students, $onlineIds) {
                    $rows = $students
                        ->filter(fn (User $user) => (int) $user->studentProfile?->section_id === (int) $section->id)
                        ->map(fn (User $user) => $this->studentRow($user, isset($onlineIds[$user->id])))
                        ->values();

                    return [
                        'id' => $section->id,
                        'label' => $section->displayLabel($program->sectionCode()),
                        'year_level' => (int) $section->year_level,
                        'students' => $rows,
                    ];
                })->values(),
            ];
        })->values();

        $unassigned = $students
            ->filter(fn (User $user) => ! $user->studentProfile?->section_id)
            ->map(fn (User $user) => $this->studentRow($user, isset($onlineIds[$user->id])))
            ->values();

        return response()->json([
            'programs' => $grouped,
            'unassigned' => $unassigned,
            'section_choices' => $programs->flatMap(fn (Program $program) => $program->sections->map(fn (Section $section) => [
                'id' => $section->id,
                'label' => $section->displayLabel($program->sectionCode()),
            ]))->values(),
        ]);
    }

    public function updateStudent(Request $request, User $user)
    {
        $this->assertRole($user, Role::STUDENT);

        $data = $request->validate([
            'section_id' => 'nullable|exists:sections,id',
            'status' => 'required|in:active,inactive',
        ]);

        if (! empty($data['section_id'])) {
            $period = $this->academicPeriods->current();
            if (! $period) {
                throw ValidationException::withMessages([
                    'section_id' => ['An active academic period is required before assigning a section.'],
                ]);
            }
            $this->placement->place($user, Section::query()->findOrFail($data['section_id']), $period);
        }

        $profile = $user->studentProfile?->fresh();
        if ($data['status'] === 'active' && ! $profile?->section_id) {
            throw ValidationException::withMessages([
                'status' => ['Assign a section before this student can sign in.'],
            ]);
        }

        $user->update(['status' => $data['status']]);
        if ($data['status'] === 'inactive') {
            $user->tokens()->delete();
        }

        $this->audit->log($request->user(), 'update_student', 'platform_students', $request);
        $this->realtime->refresh('students');
        $this->realtime->refresh('dashboard');

        return response()->json(['student' => $this->studentRow($user->fresh()->load('studentProfile.program', 'studentProfile.section', 'role'), false)]);
    }

    public function faculty()
    {
        $faculty = User::query()
            ->with('facultyProfile', 'role')
            ->whereHas('role', fn ($query) => $query->where('name', Role::FACULTY))
            ->orderBy('name')
            ->get();
        $onlineIds = array_flip($this->presence->onlineUserIds($faculty->pluck('id')->all()));

        return response()->json([
            'faculty' => $faculty->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'department' => $user->facultyProfile?->department,
                'is_online' => isset($onlineIds[$user->id]),
            ])->values(),
        ]);
    }

    public function updateFaculty(Request $request, User $user)
    {
        $this->assertRole($user, Role::FACULTY);

        $data = $request->validate([
            'status' => 'required|in:active,inactive',
        ]);

        $user->update(['status' => $data['status']]);
        if ($data['status'] === 'inactive') {
            $user->tokens()->delete();
        }

        $this->audit->log($request->user(), 'update_faculty', 'platform_faculty', $request);
        $this->realtime->refresh('faculty');
        $this->realtime->refresh('dashboard');

        return response()->json([
            'faculty' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
            ],
        ]);
    }

    public function errors()
    {
        $errors = SystemError::query()
            ->with('user:id,name')
            ->latest()
            ->limit(200)
            ->get()
            ->map(fn (SystemError $error) => [
                'id' => $error->id,
                'message' => $error->message,
                'location' => $error->location,
                'source' => $error->source,
                'user' => $error->user?->name,
                'is_fixed' => $error->is_fixed,
                'fixed_at' => $error->fixed_at?->toIso8601String(),
                'created_at' => $error->created_at?->toIso8601String(),
            ]);

        return response()->json(['errors' => $errors]);
    }

    public function updateError(Request $request, SystemError $systemError)
    {
        $data = $request->validate([
            'is_fixed' => 'required|boolean',
        ]);

        $systemError->update([
            'is_fixed' => $data['is_fixed'],
            'fixed_at' => $data['is_fixed'] ? now() : null,
        ]);

        $this->audit->log(
            $request->user(),
            $data['is_fixed'] ? 'mark_error_fixed' : 'reopen_error',
            'system_errors',
            $request,
        );

        return response()->json(['error' => [
            'id' => $systemError->id,
            'is_fixed' => $systemError->is_fixed,
            'fixed_at' => $systemError->fixed_at?->toIso8601String(),
        ]]);
    }

    private function studentUsers()
    {
        return User::query()
            ->with(['studentProfile.program', 'studentProfile.section', 'role'])
            ->whereHas('role', fn ($query) => $query->where('name', Role::STUDENT))
            ->orderBy('name')
            ->get();
    }

    private function studentRow(User $user, bool $isOnline): array
    {
        $profile = $user->studentProfile;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'is_online' => $isOnline,
            'student_number' => $profile?->student_number,
            'year_level' => $profile?->year_level ? (int) $profile->year_level : null,
            'year_level_label' => $profile?->yearLevelLabel(),
            'section_id' => $profile?->section_id,
            'section_label' => $profile?->section
                ? $profile->section->displayLabel($profile->program?->sectionCode())
                : null,
        ];
    }

    private function assertRole(User $user, string $role): void
    {
        $user->loadMissing('role');
        if ($user->role?->name !== $role) {
            throw ValidationException::withMessages([
                'user' => ['That account is not a '.$role.' account.'],
            ]);
        }
    }
}
