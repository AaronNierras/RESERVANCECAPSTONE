<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\StudentAttempt;
use App\Services\PresenceService;
use App\Services\RealtimeService;
use Illuminate\Http\Request;

class PresenceController extends Controller
{
    public function __construct(
        private PresenceService $presence,
        private RealtimeService $realtime,
    ) {}

    public function heartbeat(Request $request)
    {
        $data = $request->validate(['status' => 'nullable|in:online,away,offline']);

        $user = $request->user();
        $status = $data['status'] ?? 'online';

        if ($status === 'offline') {
            $this->presence->markOffline($user);
            if (in_array($user->roleName(), [Role::STUDENT, Role::FACULTY], true)) {
                $this->realtime->refresh('dashboard');
            $this->realtime->refresh('students');
            }

            return response()->json(['message' => 'Offline.']);
        }

        if (! in_array($user->roleName(), [Role::STUDENT, Role::FACULTY], true)) {
            return response()->json(['message' => 'Ignored.']);
        }

        $this->presence->heartbeat($user, $request, $status);

        return response()->json(['message' => 'OK']);
    }

    public function monitor(Request $request)
    {
        $attempts = StudentAttempt::with(['student', 'activity'])
            ->where('status', 'in_progress')
            ->latest('updated_at')
            ->get()
            ->map(function (StudentAttempt $attempt) {
                $timeRemaining = null;
                if ($attempt->server_deadline_at) {
                    $timeRemaining = max(0, (int) now()->diffInSeconds($attempt->server_deadline_at, false));
                }

                return [
                    'student' => $attempt->student?->name,
                    'activity' => $attempt->activity?->title,
                    'question' => ($attempt->current_question_index ?? 0) + 1,
                    'time_remaining' => $timeRemaining,
                    'status' => $attempt->status,
                ];
            });

        return response()->json(['attempts' => $attempts]);
    }
}
