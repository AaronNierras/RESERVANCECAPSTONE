<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\IntegrityLog;
use App\Models\LeaderboardEntry;
use App\Models\StudentAttempt;
use App\Services\ActivityAudienceService;
use App\Services\AssessmentEngine;
use App\Services\RealtimeService;
use App\Services\SimulationEngine;
use Illuminate\Http\Request;

class StudentActivityController extends Controller
{
    public function __construct(
        private ActivityAudienceService $audience,
        private AssessmentEngine $engine,
        private SimulationEngine $simulation,
        private RealtimeService $realtime,
    ) {}

    public function index(Request $request)
    {
        $student = $request->user()->load('studentProfile');
        $activities = Activity::with([
            'assignments',
            'recipients',
            'attempts' => fn ($q) => $q->where('student_user_id', $student->id),
        ])
            ->whereIn('status', ['active', 'published'])
            ->latest()
            ->get();

        app(\App\Services\ActivityScheduleService::class)->reconcileDue();

        $activities = $activities
            ->map(fn ($activity) => $activity->fresh() ?? $activity)
            ->filter(fn ($a) => $this->audience->studentCanAccess($student, $a))
            ->map(fn ($a) => $this->listItem($a, $student->id))
            ->values();

        return response()->json(['activities' => $activities]);
    }

    public function show(Request $request, Activity $activity)
    {
        if (! $this->audience->studentCanAccess($request->user(), $activity)) {
            abort(403);
        }

        $attempt = StudentAttempt::where('student_user_id', $request->user()->id)
            ->where('activity_id', $activity->id)
            ->first();

        $payload = [
            'id' => $activity->id,
            'title' => $activity->title,
            'description' => $activity->description,
            'instructions' => $activity->instructions,
            'type' => $activity->type,
            'time_limit_minutes' => $activity->time_limit_minutes,
            'ends_at' => $activity->ends_at,
            'question_count' => $activity->isSimulation()
                ? count(($activity->simulation_config ?? [])['rooms'] ?? [])
                : $activity->questions()->count(),
        ];

        if ($activity->hasSimulation()) {
            $config = $activity->simulation_config ?? [];
            $payload['hotel_name'] = $config['hotel_name'] ?? 'RESERVANCE Grand Hotel';
            $payload['briefing'] = $config['scenario']['briefing'] ?? $activity->instructions;
            $payload['scenarios'] = SimulationEngine::publicScenarios($config);
            $payload['manual_computation'] = ! empty($config['scenario']['scoring']['manual_computation']);
        }

        return response()->json([
            'activity' => $payload,
            'attempt' => $attempt,
        ]);
    }

    public function start(Request $request, Activity $activity)
    {
        if (! $this->audience->studentCanAccess($request->user(), $activity)) {
            abort(403);
        }

        $existing = StudentAttempt::where('student_user_id', $request->user()->id)
            ->where('activity_id', $activity->id)
            ->first();

        if ($activity->isSimulation() || ($activity->isCombination() && $existing?->status === 'simulation_pending')) {
            $result = $this->simulation->startAttempt($request->user(), $activity);
            $this->realtime->refresh('monitor');

            return response()->json($result);
        }

        $attempt = $this->engine->startAttempt($request->user(), $activity);
        $this->realtime->refresh('monitor');
        $questions = $activity->questions()->with('choices')->orderBy('sort_order')->get()
            ->map(fn ($q) => [
                'id' => $q->id,
                'type' => $q->type,
                'body' => $q->body,
                'timer_seconds' => $q->timer_seconds,
                'metadata' => [
                    'image_url' => $q->metadata['image_url'] ?? null,
                    'allow_multiple_correct' => ! empty($q->metadata['allow_multiple_correct']),
                ],
                'choices' => $q->choices->map(fn ($c) => $c->only(['id', 'label', 'text'])),
            ]);

        return response()->json([
            'attempt' => $attempt,
            'questions' => $questions,
        ]);
    }

    public function simulationBook(Request $request, StudentAttempt $attempt)
    {
        $this->ensureOwnAttempt($request, $attempt);
        $data = $request->validate([
            'guest_last_name' => 'required|string|max:120',
            'guest_first_name' => 'required|string|max:120',
            'phone' => 'required|string|max:32',
            'arrival_date' => 'required|date',
            'nights' => 'required|integer|min:1|max:30',
            'guests' => 'required|integer|min:1|max:20',
            'room_type' => 'required|string|max:16',
            'room_number' => 'required|string|max:16',
            'rate_type' => 'required|string|max:32',
        ]);

        $hotel = $this->simulation->bookRoom($attempt, $data);

        return response()->json(['hotel' => $hotel]);
    }

    public function simulationCheckIn(Request $request, StudentAttempt $attempt)
    {
        $this->ensureOwnAttempt($request, $attempt);
        $data = $request->validate([
            'reservation_id' => 'required|string|max:32',
        ]);

        $hotel = $this->simulation->checkIn($attempt, $data);

        return response()->json(['hotel' => $hotel]);
    }

    public function simulationCheckOut(Request $request, StudentAttempt $attempt)
    {
        $this->ensureOwnAttempt($request, $attempt);
        $data = $request->validate([
            'reservation_id' => 'required|string|max:32',
            'payment_type' => 'required|string|max:32',
            'amount_tendered' => 'required|numeric|min:0',
        ]);

        $hotel = $this->simulation->checkOut($attempt, $data);

        return response()->json(['hotel' => $hotel]);
    }

    public function simulationSubmit(Request $request, StudentAttempt $attempt)
    {
        $this->ensureOwnAttempt($request, $attempt);
        $score = $this->simulation->submit($attempt->fresh());
        $this->realtime->refresh('scores');
        $this->realtime->refresh('leaderboards');
        $this->realtime->refresh('monitor');
        $this->realtime->refresh('dashboard');

        return response()->json([
            'score' => $score,
            'pending_manual_review' => false,
        ]);
    }

    public function answer(Request $request, StudentAttempt $attempt)
    {
        $this->ensureOwnAttempt($request, $attempt);
        $attempt->load('activity');
        $data = $request->validate([
            'question_id' => 'required|exists:questions,id',
            'answer_text' => 'nullable|string',
        ]);

        $question = $attempt->activity->questions()->where('id', $data['question_id'])->firstOrFail();
        $answer = $this->engine->saveAnswer($attempt, $question, $data['answer_text'] ?? null);

        return response()->json(['answer' => $answer->only(['id', 'question_id', 'answer_text'])]);
    }

    public function submit(Request $request, StudentAttempt $attempt)
    {
        $this->ensureOwnAttempt($request, $attempt);
        $score = $this->engine->submit($attempt->fresh());
        $this->realtime->refresh('scores');
        $this->realtime->refresh('leaderboards');
        $this->realtime->refresh('monitor');
        $this->realtime->refresh('dashboard');

        return response()->json([
            'score' => $score->load('breakdowns'),
            'pending_manual_review' => $this->activityHasManualReview($attempt->activity_id),
        ]);
    }

    public function attemptResult(Request $request, StudentAttempt $attempt)
    {
        $this->ensureOwnAttempt($request, $attempt);

        if (! in_array($attempt->status, ['submitted', 'failed', 'simulation_pending'], true)) {
            abort(404);
        }

        $attempt->load(['score.breakdowns', 'activity']);

        $leaderboard = LeaderboardEntry::with('student:id,name')
            ->where('scope', 'activity')
            ->where('activity_id', $attempt->activity_id)
            ->orderBy('rank')
            ->take(10)
            ->get()
            ->map(fn ($entry) => [
                'rank' => $entry->rank,
                'student' => $entry->student?->only(['id', 'name']),
                'composite_score' => $entry->composite_score,
            ]);

        return response()->json([
            'status' => $attempt->status,
            'score' => $attempt->score,
            'pending_manual_review' => $this->activityHasManualReview($attempt->activity_id),
            'leaderboard' => $leaderboard,
        ]);
    }

    public function logIntegrity(Request $request, Activity $activity)
    {
        $data = $request->validate([
            'violation_type' => 'required|string|max:64',
            'attempt_id' => 'nullable|exists:student_attempts,id',
            'metadata' => 'nullable|array',
        ]);

        $attempt = null;
        if (! empty($data['attempt_id'])) {
            $attempt = StudentAttempt::find($data['attempt_id']);
            if ($attempt && $attempt->student_user_id !== $request->user()->id) {
                abort(403);
            }
        }

        IntegrityLog::create([
            'student_user_id' => $request->user()->id,
            'activity_id' => $activity->id,
            'attempt_id' => $data['attempt_id'] ?? null,
            'violation_type' => $data['violation_type'],
            'metadata' => $data['metadata'] ?? null,
            'created_at' => now(),
        ]);

        $response = [
            'logged' => true,
            'warnings_left' => 3,
            'warning_number' => 0,
            'disqualified' => false,
        ];

        if ($data['violation_type'] === 'tab_switch' && $attempt && $attempt->status === 'in_progress') {
            $switchCount = IntegrityLog::where('attempt_id', $attempt->id)
                ->where('violation_type', 'tab_switch')
                ->count();

            if ($switchCount >= 3) {
                $this->engine->disqualifyAttempt($attempt);
                $this->realtime->refresh('scores');
                $this->realtime->refresh('leaderboards');
                $this->realtime->refresh('monitor');
                $response['disqualified'] = true;
                $response['warnings_left'] = 0;
                $response['warning_number'] = 3;
            } else {
                $response['warnings_left'] = 3 - $switchCount;
                $response['warning_number'] = $switchCount;
            }
        }

        return response()->json($response);
    }

    private function activityHasManualReview(int $activityId): bool
    {
        return Activity::find($activityId)?->questions()
            ->get()
            ->contains(fn ($question) => ! empty($question->metadata['manual_checking'])) ?? false;
    }

    public function history(Request $request)
    {
        $attempts = StudentAttempt::with(['activity', 'score'])
            ->where('student_user_id', $request->user()->id)
            ->whereIn('status', ['submitted', 'missed', 'failed'])
            ->latest('submitted_at')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'activity' => $a->activity?->only(['id', 'title', 'type']),
                'date' => $a->submitted_at ?? $a->updated_at,
                'score' => $a->score?->percentage,
                'status' => $a->status,
            ]);

        return response()->json(['history' => $attempts]);
    }

    public function scores(Request $request)
    {
        $attempts = StudentAttempt::with(['activity', 'score.breakdowns'])
            ->where('student_user_id', $request->user()->id)
            ->where('status', 'submitted')
            ->latest('submitted_at')
            ->get();

        $percentages = $attempts->pluck('score.percentage')->filter();

        return response()->json([
            'summary' => [
                'average' => round((float) $percentages->avg(), 2),
                'highest' => round((float) $percentages->max(), 2),
                'lowest' => round((float) $percentages->min(), 2),
            ],
            'records' => $attempts,
        ]);
    }

    private function listItem(Activity $activity, int $studentId): array
    {
        $attempt = $activity->attempts->first();
        $bucket = 'available';

        if (in_array($attempt?->status, ['in_progress', 'simulation_pending'], true)) {
            $bucket = 'ongoing';
        } elseif (in_array($attempt?->status, ['submitted', 'missed', 'failed'], true)) {
            $bucket = 'completed';
        }

        return [
            'id' => $activity->id,
            'title' => $activity->title,
            'type' => $activity->type,
            'starts_at' => $activity->starts_at,
            'ends_at' => $activity->ends_at,
            'bucket' => $bucket,
            'attempt_status' => $attempt?->status,
        ];
    }

    private function ensureOwnAttempt(Request $request, StudentAttempt $attempt): void
    {
        if ($attempt->student_user_id !== $request->user()->id) {
            abort(403);
        }
    }
}
