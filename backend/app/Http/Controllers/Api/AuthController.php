<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterStudentRequest;
use App\Models\Role;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\NotificationService;
use App\Services\PresenceService;
use App\Services\RealtimeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private AuditLogService $audit,
        private PresenceService $presence,
        private RealtimeService $realtime,
        private NotificationService $notifications,
    ) {}

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::with(['role', 'studentProfile.program', 'studentProfile.section', 'studentProfile.currentAcademicPeriod'])
            ->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }

        if ($user->status === 'inactive') {
            throw ValidationException::withMessages(['email' => ['Account is inactive.']]);
        }

        if ($this->presence->hasActiveLogin($user)) {
            throw ValidationException::withMessages([
                'email' => ['This account is already signed in on another device or browser. Sign out there first, or wait until the session expires after inactivity.'],
            ]);
        }

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('api')->plainTextToken;
        $this->audit->log($user, 'login', 'auth', $request);

        if (in_array($user->roleName(), [Role::STUDENT, Role::FACULTY], true)) {
            $this->presence->heartbeat($user, $request, 'online');
            $this->realtime->refresh('dashboard');
            $this->realtime->refresh('students');
        }

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function register(RegisterStudentRequest $request)
    {
        $data = $request->validated();
        $roleId = Role::where('name', Role::STUDENT)->value('id');

        if (! $roleId) {
            throw ValidationException::withMessages([
                'email' => ['Student registration is not available right now.'],
            ]);
        }

        $user = User::create([
            'name' => $request->fullName(),
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role_id' => $roleId,
            'status' => 'active',
        ]);

        StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => $data['student_number'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'academic_status' => StudentProfile::ACADEMIC_ACTIVE,
        ]);

        $user->load([
            'role',
            'studentProfile.program',
            'studentProfile.section',
            'studentProfile.currentAcademicPeriod',
        ]);

        $chairIds = User::whereHas('role', fn ($q) => $q->where('name', Role::PROGRAM_CHAIR))->pluck('id')->all();
        $this->notifications->notifyUsers($chairIds, 'new_student', 'New student registered', $user->name);
        $this->audit->log($user, 'register_student', 'student_registry', $request);
        $this->realtime->refresh('students');
        $this->realtime->refresh('dashboard');

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('api')->plainTextToken;
        $this->presence->heartbeat($user, $request, 'online');

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function logout(Request $request)
    {
        $this->audit->log($request->user(), 'logout', 'auth', $request);
        $user = $request->user();
        $this->presence->markOffline($user);
        if (in_array($user->roleName(), [Role::STUDENT, Role::FACULTY], true)) {
            $this->realtime->refresh('dashboard');
            $this->realtime->refresh('students');
        }
        $user->tokens()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function user(Request $request)
    {
        return response()->json(['user' => $this->userPayload(
            $request->user()->load(
                'role',
                'facultyProfile',
                'studentProfile.program',
                'studentProfile.section',
                'studentProfile.currentAcademicPeriod',
            )
        )]);
    }

    private function userPayload(User $user): array
    {
        $profile = $user->studentProfile;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->roleName(),
            'status' => $user->status,
            'faculty_profile' => $user->facultyProfile,
            'student_profile' => $profile ? $profile->toAcademicSummary() : null,
        ];
    }
}
