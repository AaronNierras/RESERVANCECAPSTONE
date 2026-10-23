<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Role;
use App\Models\Score;
use App\Models\StudentAttempt;
use App\Models\User;
use App\Services\PresenceService;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function __construct(private PresenceService $presence) {}

    public function superAdmin()
    {
        return response()->json([
            'faculty' => User::whereHas('role', fn ($q) => $q->where('name', Role::FACULTY))
                ->withCount('createdActivities')
                ->get()
                ->map(fn ($u) => [
                    'name' => $u->name,
                    'activities_created' => $u->created_activities_count,
                ]),
            'activities' => [
                'most_failed' => Activity::withCount(['attempts as failed_count' => fn ($q) => $q->whereIn('status', ['missed', 'failed'])])
                    ->orderByDesc('failed_count')->take(5)->get(['id', 'title', 'failed_count']),
                'highest_completion' => Activity::withCount(['attempts as done_count' => fn ($q) => $q->where('status', 'submitted')])
                    ->orderByDesc('done_count')->take(5)->get(['id', 'title', 'done_count']),
            ],
            'institutional' => [
                'average_score' => round((float) Score::avg('percentage'), 2),
                'total_attempts' => StudentAttempt::where('status', 'submitted')->count(),
            ],
            'students' => $this->studentMasterlist(null),
        ]);
    }

    public function faculty(Request $request)
    {
        $userId = $request->user()->id;
        $activityIds = Activity::where('created_by', $userId)->pluck('id');
        $total = StudentAttempt::whereIn('activity_id', $activityIds)->count();
        $done = StudentAttempt::whereIn('activity_id', $activityIds)->where('status', 'submitted')->count();

        return response()->json([
            'activities_created' => Activity::where('created_by', $userId)->count(),
            'activities_published' => Activity::where('created_by', $userId)->where('status', 'published')->count(),
            'participation' => $done,
            'completion_rate' => $total ? round(($done / $total) * 100, 2) : 0,
            'students' => $this->studentMasterlist($userId),
        ]);
    }

    public function studentPerformance(Request $request, User $user)
    {
        if ($user->role?->name !== Role::STUDENT) {
            abort(404);
        }

        $facultyScope = $request->user()->role?->name === Role::FACULTY
            ? $request->user()->id
            : null;

        $user->load(['studentProfile.program', 'studentProfile.section']);

        $attempts = StudentAttempt::with(['activity.creator', 'score'])
            ->where('student_user_id', $user->id)
            ->whereIn('status', ['submitted', 'missed', 'failed', 'in_progress'])
            ->when($facultyScope, fn ($q) => $q->whereHas(
                'activity',
                fn ($activity) => $activity->where('created_by', $facultyScope),
            ))
            ->orderByDesc('submitted_at')
            ->orderByDesc('updated_at')
            ->get();

        $submittedScores = $attempts
            ->filter(fn ($attempt) => $attempt->status === 'submitted' && $attempt->score)
            ->pluck('score.percentage');

        return response()->json([
            'student' => $this->studentSummary($user),
            'summary' => [
                'activities_taken' => $attempts->where('status', 'submitted')->count(),
                'average_score' => $submittedScores->isEmpty()
                    ? null
                    : round((float) $submittedScores->avg(), 2),
                'highest_score' => $submittedScores->isEmpty()
                    ? null
                    : round((float) $submittedScores->max(), 2),
            ],
            'records' => $attempts->map(fn (StudentAttempt $attempt) => [
                'id' => $attempt->id,
                'activity' => [
                    'id' => $attempt->activity?->id,
                    'title' => $attempt->activity?->title,
                    'type' => $attempt->activity?->type,
                    'creator' => $attempt->activity?->creator?->only(['id', 'name']),
                ],
                'status' => $attempt->status,
                'started_at' => $attempt->started_at,
                'submitted_at' => $attempt->submitted_at,
                'score' => $attempt->score ? [
                    'percentage' => $attempt->score->percentage,
                    'raw_score' => $attempt->score->raw_score,
                    'accuracy' => $attempt->score->accuracy,
                    'completion_seconds' => $attempt->score->completion_seconds,
                ] : null,
            ])->values(),
        ]);
    }

    private function studentMasterlist(?int $facultyUserId): array
    {
        $students = User::with([
            'studentProfile.program',
            'studentProfile.section',
        ])
            ->whereHas('role', fn ($q) => $q->where('name', Role::STUDENT))
            ->orderBy('name')
            ->get();

        $statsByStudent = $this->attemptStatsByStudent($facultyUserId);
        $onlineIds = array_flip($this->presence->onlineUserIds($students->pluck('id')->all()));

        return $students->map(function (User $user) use ($statsByStudent, $onlineIds) {
            $stats = $statsByStudent[$user->id] ?? [
                'activities_taken' => 0,
                'average_score' => null,
                'last_activity_at' => null,
            ];

            return array_merge(
                $this->studentSummary($user, isset($onlineIds[$user->id])),
                ['analytics' => $stats],
            );
        })->values()->all();
    }

    private function attemptStatsByStudent(?int $facultyUserId): array
    {
        $attempts = StudentAttempt::query()
            ->with('score')
            ->whereIn('status', ['submitted', 'missed', 'failed'])
            ->when($facultyUserId, fn ($q) => $q->whereHas(
                'activity',
                fn ($activity) => $activity->where('created_by', $facultyUserId),
            ))
            ->get();

        $stats = [];

        foreach ($attempts as $attempt) {
            $studentId = $attempt->student_user_id;

            if (! isset($stats[$studentId])) {
                $stats[$studentId] = [
                    'activities_taken' => 0,
                    'score_total' => 0.0,
                    'score_count' => 0,
                    'last_activity_at' => null,
                ];
            }

            if ($attempt->status === 'submitted') {
                $stats[$studentId]['activities_taken']++;
            }

            if ($attempt->status === 'submitted' && $attempt->score?->percentage !== null) {
                $stats[$studentId]['score_total'] += (float) $attempt->score->percentage;
                $stats[$studentId]['score_count']++;
            }

            $activityAt = $attempt->submitted_at ?? $attempt->updated_at;
            if ($activityAt && (
                ! $stats[$studentId]['last_activity_at']
                || $activityAt->gt($stats[$studentId]['last_activity_at'])
            )) {
                $stats[$studentId]['last_activity_at'] = $activityAt;
            }
        }

        foreach ($stats as $studentId => $row) {
            $stats[$studentId] = [
                'activities_taken' => $row['activities_taken'],
                'average_score' => $row['score_count']
                    ? round($row['score_total'] / $row['score_count'], 2)
                    : null,
                'last_activity_at' => $row['last_activity_at'],
            ];
        }

        return $stats;
    }

    private function studentSummary(User $user, bool $isOnline = false): array
    {
        $profile = $user->studentProfile;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'is_online' => $isOnline,
            'student_profile' => $profile ? [
                'student_number' => $profile->student_number,
                'first_name' => $profile->first_name,
                'last_name' => $profile->last_name,
                'program' => $profile->program?->only(['id', 'name', 'code']),
                'section' => $profile->section ? [
                    'id' => $profile->section->id,
                    'name' => $profile->section->name,
                    'year_level' => $profile->section->year_level ? (int) $profile->section->year_level : null,
                    'semester' => $profile->section->semester ? (int) $profile->section->semester : null,
                    'semester_label' => $profile->section->semesterLabel(),
                    'display_label' => $profile->section->displayLabel($profile->program?->sectionCode()),
                ] : null,
                'year_level' => $profile->year_level ? (int) $profile->year_level : null,
                'year_level_label' => $profile->yearLevelLabel(),
                'academic_status' => $profile->academic_status,
            ] : null,
        ];
    }
}
