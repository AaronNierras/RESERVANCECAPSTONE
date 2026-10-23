<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AchievementBadge;
use App\Models\AuditLog;
use App\Models\Program;
use App\Models\Role;
use App\Models\Section;
use App\Models\User;
use App\Services\AcademicPeriodService;
use App\Services\AuditLogService;
use App\Services\NotificationService;
use App\Services\RealtimeService;
use App\Services\StudentPlacementService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OversightController extends Controller
{
    public function __construct(
        private AcademicPeriodService $academicPeriods,
        private AuditLogService $audit,
        private NotificationService $notifications,
        private RealtimeService $realtime,
        private StudentPlacementService $placement,
    ) {}

    public function registrations()
    {
        $students = User::query()
            ->with(['studentProfile.program', 'studentProfile.section'])
            ->where('status', 'inactive')
            ->whereHas('role', fn ($query) => $query->where('name', Role::STUDENT))
            ->whereHas('studentProfile', fn ($query) => $query->whereNull('section_id'))
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->registrationPayload($user));

        return response()->json([
            'registrations' => $students,
            'programs' => Program::query()
                ->with('sections')
                ->whereIn('slug', ['bshm', 'bstm'])
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function acceptRegistration(Request $request, User $user)
    {
        $this->assertWaitingStudent($user);

        $data = $request->validate([
            'section_id' => 'required|exists:sections,id',
        ]);

        $period = $this->academicPeriods->current();
        if (! $period) {
            throw ValidationException::withMessages([
                'section_id' => ['An active academic period is required before accepting a student.'],
            ]);
        }

        $section = Section::query()->findOrFail($data['section_id']);
        $this->placement->place($user, $section, $period);
        $user->update(['status' => 'active']);

        $this->audit->log($request->user(), 'accept_student', 'registration_gate', $request);
        $this->notifications->notifyUser(
            $user,
            'registration_accepted',
            'Registration accepted',
            'You can now sign in. Your section is '.$section->fresh()->load('program')->displayLabel().'.',
        );
        $this->realtime->refresh('students');
        $this->realtime->refresh('dashboard');

        return response()->json(['student' => $this->registrationPayload($user->fresh()->load('studentProfile.program', 'studentProfile.section'))]);
    }

    public function history(Request $request)
    {
        $data = $request->validate([
            'role' => 'nullable|in:self,program_chair,faculty,super_admin',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
        ]);

        $role = $data['role'] ?? 'self';
        $actor = $request->user();

        if ($actor->roleName() !== Role::SUPER_ADMIN && $role !== 'self') {
            throw ValidationException::withMessages([
                'role' => ['Only Superadmin can open another role history.'],
            ]);
        }

        $logs = AuditLog::query()
            ->with('user.role')
            ->when($role === 'self', fn ($query) => $query->where('user_id', $actor->id))
            ->when($role !== 'self', function ($query) use ($role) {
                $name = match ($role) {
                    'faculty' => Role::FACULTY,
                    'super_admin' => Role::SUPER_ADMIN,
                    default => Role::PROGRAM_CHAIR,
                };
                $query->whereHas('user.role', fn ($roles) => $roles->where('name', $name));
            })
            ->when($data['date_from'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($data['date_to'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'module' => $log->module,
                'user' => $log->user?->name,
                'role' => $log->user?->role?->name,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return response()->json(['history' => $logs]);
    }

    public function achievements()
    {
        $badges = AchievementBadge::query()
            ->withCount('studentBadges')
            ->with(['studentBadges.student:id,name'])
            ->orderBy('name')
            ->get()
            ->map(fn (AchievementBadge $badge) => [
                'id' => $badge->id,
                'name' => $badge->name,
                'description' => $badge->description,
                'earned_count' => $badge->student_badges_count,
                'students' => $badge->studentBadges
                    ->sortBy(fn ($row) => $row->student?->name)
                    ->values()
                    ->map(fn ($row) => [
                        'name' => $row->student?->name,
                        'earned_at' => $row->earned_at?->toIso8601String(),
                    ]),
            ]);

        return response()->json(['achievements' => $badges]);
    }

    private function assertWaitingStudent(User $user): void
    {
        $user->loadMissing('role', 'studentProfile');
        if ($user->role?->name !== Role::STUDENT || $user->status !== 'inactive' || $user->studentProfile?->section_id) {
            throw ValidationException::withMessages([
                'student' => ['This registration is no longer waiting for acceptance.'],
            ]);
        }
    }

    private function registrationPayload(User $user): array
    {
        $profile = $user->studentProfile;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'student_number' => $profile?->student_number,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
