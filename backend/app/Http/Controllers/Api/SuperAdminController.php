<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\AcademicPeriodController;
use App\Http\Requests\StoreFacultyRequest;
use App\Http\Requests\StoreStudentRequest;
use App\Models\Activity;
use App\Models\AuditLog;
use App\Models\FacultyProfile;
use App\Models\Program;
use App\Models\Role;
use App\Models\Score;
use App\Models\Section;
use App\Models\StudentAttempt;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\ActivityCopyService;
use App\Services\AcademicPeriodService;
use App\Services\AuditLogService;
use App\Services\NotificationService;
use App\Services\PresenceService;
use App\Services\RealtimeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SuperAdminController extends Controller
{
    public function __construct(
        private AuditLogService $audit,
        private NotificationService $notifications,
        private PresenceService $presence,
        private RealtimeService $realtime,
        private AcademicPeriodService $academicPeriods,
        private ActivityCopyService $activityCopy,
    ) {}

    public function dashboard(Request $request)
    {
        $totalStudents = User::whereHas('role', fn ($q) => $q->where('name', Role::STUDENT))->count();
        $totalFaculty = User::whereHas('role', fn ($q) => $q->where('name', Role::FACULTY))->count();
        $onlineStudents = $this->presence->countOnlineForRole(Role::STUDENT);
        $onlineFaculty = $this->presence->countOnlineForRole(Role::FACULTY);
        $publishedCount = Activity::where('status', 'published')->count();
        $scheduledCount = Activity::where('status', 'scheduled')->count();
        $activeCount = $publishedCount + $scheduledCount;
        $activeUsers = User::whereHas('role', fn ($q) => $q->whereIn('name', [Role::STUDENT, Role::FACULTY]))
            ->where('status', 'active')
            ->count();

        $activityPage = max(1, (int) $request->query('activity_page', 1));
        $recent = AuditLog::with('user:id,name')
            ->whereHas('user.role', fn ($q) => $q->where('name', Role::SUPER_ADMIN))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(50, ['*'], 'activity_page', $activityPage);

        return response()->json([
            'users' => [
                'students' => $totalStudents,
                'faculty' => $totalFaculty,
                'online_students' => $onlineStudents,
                'online_faculty' => $onlineFaculty,
                'active' => $activeUsers,
            ],
            'activities' => [
                'published' => $publishedCount,
                'active' => $activeCount,
                'scheduled' => $scheduledCount,
            ],
            'recent_activity' => [
                'data' => $recent->getCollection()->map(fn (AuditLog $log) => [
                    'action' => $log->action,
                    'module' => $log->module,
                    'user' => $log->user?->name,
                    'created_at' => $log->created_at?->toIso8601String(),
                ])->values(),
                'current_page' => $recent->currentPage(),
                'last_page' => $recent->lastPage(),
                'per_page' => $recent->perPage(),
                'total' => $recent->total(),
            ],
        ]);
    }

    public function students()
    {
        $students = User::with([
            'studentProfile.program',
            'studentProfile.section',
            'studentProfile.currentAcademicPeriod',
            'role',
        ])
            ->whereHas('role', fn ($q) => $q->where('name', Role::STUDENT))
            ->orderBy('name')
            ->get();

        $onlineIds = array_flip($this->presence->onlineUserIds($students->pluck('id')->all()));

        return response()->json([
            'students' => $students->map(
                fn (User $user) => $this->studentPayload($user, isset($onlineIds[$user->id])),
            ),
        ]);
    }

    public function storeStudent(StoreStudentRequest $request)
    {
        $data = $request->validated();
        $period = $this->academicPeriods->current();

        if (! $period) {
            throw ValidationException::withMessages([
                'academic_period' => ['An active academic period is required before registering students.'],
            ]);
        }

        AcademicPeriodController::validateSectionBelongsToProgram(
            (int) $data['program_id'],
            (int) $data['section_id'],
        );

        $user = User::create([
            'name' => $request->fullName(),
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role_id' => Role::where('name', Role::STUDENT)->value('id'),
            'status' => $data['status'] ?? 'active',
        ]);

        $profile = StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => $data['student_number'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'program_id' => $data['program_id'],
            'section_id' => $data['section_id'],
            'year_level' => $data['year_level'],
            'academic_status' => StudentProfile::ACADEMIC_ACTIVE,
            'current_academic_period_id' => $period->id,
        ]);

        $this->academicPeriods->attachNewStudent($user, $profile, $period);

        $this->audit->log($request->user(), 'register_student', 'student_registry', $request);
        $this->notifySuperAdmins($request->user(), 'new_student', 'New student registered', $user->name);
        $this->realtime->refresh('students');
        $this->realtime->refresh('dashboard');

        return response()->json(['student' => $this->studentPayload($user->fresh()->load([
            'studentProfile.program',
            'studentProfile.section',
            'studentProfile.currentAcademicPeriod',
            'role',
        ]))], 201);
    }

    public function updateStudent(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$user->id,
            'status' => 'sometimes|in:active,inactive',
            'password' => 'nullable|min:8',
            'student_number' => 'sometimes|string|unique:student_profiles,student_number,'.optional($user->studentProfile)->id,
            'program_id' => 'sometimes|exists:programs,id',
            'section_id' => 'sometimes|exists:sections,id',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if (isset($data['program_id'], $data['section_id'])) {
            AcademicPeriodController::validateSectionBelongsToProgram(
                (int) $data['program_id'],
                (int) $data['section_id'],
            );
        }

        $user->update(collect($data)->only(['name', 'email', 'status', 'password'])->filter()->all());

        if ($user->studentProfile) {
            $profileData = collect($data)->only([
                'student_number', 'program_id', 'section_id', 'year_level',
            ])->filter()->all();

            if (isset($data['first_name'], $data['last_name'])) {
                $profileData['first_name'] = $data['first_name'];
                $profileData['last_name'] = $data['last_name'];
                $user->update(['name' => trim($data['first_name'].' '.$data['last_name'])]);
            }

            $user->studentProfile->update($profileData);
        }

        $this->audit->log($request->user(), 'update_student', 'student_registry', $request);
        $this->realtime->refresh('students');
        $this->realtime->refresh('dashboard');

        return response()->json(['student' => $this->studentPayload($user->fresh()->load([
            'studentProfile.program',
            'studentProfile.section',
            'studentProfile.currentAcademicPeriod',
            'role',
        ]))]);
    }

    public function faculty()
    {
        $faculty = User::with(['facultyProfile', 'role'])
            ->whereHas('role', fn ($q) => $q->where('name', Role::FACULTY))
            ->orderBy('name')
            ->get();

        return response()->json(['faculty' => $faculty]);
    }

    public function storeFaculty(StoreFacultyRequest $request)
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $request->fullName(),
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role_id' => Role::where('name', Role::FACULTY)->value('id'),
            'status' => $data['status'] ?? 'active',
        ]);

        FacultyProfile::create([
            'user_id' => $user->id,
        ]);

        $this->audit->log($request->user(), 'register_faculty', 'faculty_registry', $request);
        $this->notifySuperAdmins($request->user(), 'new_faculty', 'New faculty registered', $user->name);
        $this->realtime->refresh('faculty');
        $this->realtime->refresh('dashboard');

        return response()->json(['faculty' => $user->load('facultyProfile')], 201);
    }

    public function updateFaculty(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$user->id,
            'department' => 'nullable|string|max:255',
            'status' => 'sometimes|in:active,inactive',
            'password' => 'nullable|min:8',
        ]);

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update(collect($data)->only(['name', 'email', 'status', 'password'])->filter()->all());
        $user->facultyProfile?->update(['department' => $data['department'] ?? $user->facultyProfile->department]);

        $this->audit->log($request->user(), 'update_faculty', 'faculty_registry', $request);
        $this->realtime->refresh('faculty');
        $this->realtime->refresh('dashboard');

        return response()->json(['faculty' => $user->fresh()->load('facultyProfile')]);
    }

    public function programs()
    {
        return response()->json(['programs' => Program::with('sections')->orderBy('name')->get()]);
    }

    public function storeProgram(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z]+$/'],
            'slug' => 'nullable|string|max:255|unique:programs,slug',
        ], [
            'name.regex' => 'Program name must contain letters only.',
        ]);

        $program = Program::create([
            'name' => strtoupper($data['name']),
            'slug' => $data['slug'] ?? Str::slug(strtoupper($data['name'])),
        ]);

        $this->realtime->refresh('programs');

        return response()->json(['program' => $program], 201);
    }

    public function storeSection(Request $request)
    {
        $data = $request->validate([
            'program_id' => 'required|exists:programs,id',
            'name' => ['required', 'string', 'max:8', 'regex:/^[A-Za-z]+$/'],
            'year_level' => 'required|integer|in:1,2,3,4',
            'semester' => 'required|integer|in:1,2,3',
        ], [
            'name.regex' => 'Section name must contain letters only (example: A, B).',
        ]);

        $data['name'] = strtoupper($data['name']);

        $section = Section::create([
            ...$data,
            'status' => 'active',
        ]);

        $this->realtime->refresh('programs');

        return response()->json(['section' => $section->load('program')], 201);
    }

    public function facultyActivities()
    {
        $activities = Activity::with(['creator', 'assignments', 'attempts'])
            ->whereHas('creator.role', fn ($q) => $q->where('name', Role::FACULTY))
            ->latest()
            ->get()
            ->map(function (Activity $activity) {
                $attempts = $activity->attempts;
                $submitted = $attempts->where('status', 'submitted')->count();
                $total = max(1, $attempts->count());

                return [
                    'id' => $activity->id,
                    'title' => $activity->title,
                    'type' => $activity->type,
                    'status' => $activity->status,
                    'creator' => $activity->creator?->only(['id', 'name', 'email']),
                    'completion_rate' => round(($submitted / $total) * 100, 2),
                    'average_score' => round((float) Score::whereHas('attempt', fn ($q) => $q->where('activity_id', $activity->id))->avg('percentage'), 2),
                ];
            });

        return response()->json(['activities' => $activities]);
    }

    public function copyFacultyActivity(Request $request, Activity $activity)
    {
        $activity->loadMissing('creator.role');

        if ($activity->creator?->role?->name !== Role::FACULTY) {
            abort(422, 'Only faculty assessments can be copied from this screen.');
        }

        $copy = $this->activityCopy->copy($activity, $request->user(), [
            'title_prefix' => 'Copy of ',
        ]);

        $this->audit->log($request->user(), 'copy_faculty_activity', 'faculty_activities', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json([
            'activity' => [
                'id' => $copy->id,
                'title' => $copy->title,
                'type' => $copy->type,
                'status' => $copy->status,
                'question_count' => $copy->questions->count(),
                'copied_from' => [
                    'id' => $activity->id,
                    'title' => $activity->title,
                    'creator' => $activity->creator?->only(['id', 'name']),
                ],
            ],
            'message' => 'Assessment copied to your Activity Factory drafts. The original faculty assessment was not changed.',
        ], 201);
    }

    private function notifySuperAdmins(User $actor, string $type, string $title, string $body): void
    {
        $ids = User::whereHas('role', fn ($q) => $q->where('name', Role::SUPER_ADMIN))->pluck('id')->all();
        $this->notifications->notifyUsers($ids, $type, $title, $body);
    }

    private function studentPayload(User $user, bool $isOnline = false): array
    {
        $profile = $user->studentProfile;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'is_online' => $isOnline,
            'role' => $user->role?->name,
            'student_profile' => $profile ? [
                'student_number' => $profile->student_number,
                'first_name' => $profile->first_name,
                'last_name' => $profile->last_name,
                'program' => $profile->program?->only(['id', 'name']),
                'section' => $profile->section ? [
                    'id' => $profile->section->id,
                    'name' => $profile->section->name,
                    'year_level' => $profile->section->year_level ? (int) $profile->section->year_level : null,
                    'semester' => $profile->section->semester ? (int) $profile->section->semester : null,
                    'semester_label' => $profile->section->semesterLabel(),
                    'display_label' => $profile->section->displayLabel($profile->program?->name),
                ] : null,
                'year_level' => $profile->year_level ? (int) $profile->year_level : null,
                'year_level_label' => $profile->yearLevelLabel(),
                'academic_status' => $profile->academic_status,
                'current_period' => $profile->currentAcademicPeriod?->toSummary(),
            ] : null,
        ];
    }
}
