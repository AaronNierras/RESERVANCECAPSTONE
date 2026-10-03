<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Services\AuditLogService;
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
