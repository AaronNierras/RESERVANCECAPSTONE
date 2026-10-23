<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Question;
use App\Models\QuestionChoice;
use App\Models\Score;
use App\Models\ScoreBreakdown;
use App\Models\StudentAnswer;
use App\Models\StudentAttempt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AssessmentEngine
{
    public function __construct(
        private LeaderboardService $leaderboards,
        private BadgeService $badges,
        private NotificationService $notifications,
    ) {}

    public function startAttempt(User $student, Activity $activity): StudentAttempt
    {
        return DB::transaction(function () use ($student, $activity) {
            $existing = StudentAttempt::where('student_user_id', $student->id)
                ->where('activity_id', $activity->id)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                if (in_array($existing->status, ['submitted', 'missed', 'failed'], true)) {
                    throw new ConflictHttpException('Single attempt policy: you cannot retake this activity.');
                }
                if ($existing->status === 'simulation_pending') {
                    $existing->update(['status' => 'in_progress']);

                    return $existing->fresh()->load('activity.questions.choices');
                }
                if ($existing->status === 'in_progress') {
                    return $existing->load('activity.questions.choices');
                }
            }

            if (! $activity->startHasArrived()) {
                throw new HttpException(403, 'This activity is not open yet.');
            }

            if ($activity->deadlineHasPassed()) {
                throw new HttpException(403, 'Activity deadline has passed.');
            }

            $deadline = null;
            if ($activity->time_limit_minutes) {
                $deadline = now()->addMinutes((int) $activity->time_limit_minutes);
            } elseif ($activity->ends_at && ($activity->late_policy ?: 'lock') !== 'finish') {
                $deadline = $activity->ends_at;
            }

            return StudentAttempt::create([
                'student_user_id' => $student->id,
                'activity_id' => $activity->id,
                'status' => 'in_progress',
                'started_at' => now(),
                'server_deadline_at' => $deadline,
                'current_question_index' => 0,
            ]);
        });
    }

    public function saveAnswer(StudentAttempt $attempt, Question $question, ?string $answerText): StudentAnswer
    {
        if ($attempt->status !== 'in_progress') {
            throw new HttpException(403, 'Attempt is not in progress.');
        }

        if ($attempt->server_deadline_at && now()->greaterThan($attempt->server_deadline_at)) {
            $this->autoSubmit($attempt);

            throw new HttpException(403, 'Time expired. Attempt auto-submitted.');
        }

        $meta = $question->metadata ?? [];
        if (! empty($meta['manual_checking'])) {
            return StudentAnswer::updateOrCreate(
                ['attempt_id' => $attempt->id, 'question_id' => $question->id],
                ['answer_text' => $answerText, 'points_earned' => 0]
            );
        }

        $points = $this->gradeAnswer($question, $answerText);

        return StudentAnswer::updateOrCreate(
            ['attempt_id' => $attempt->id, 'question_id' => $question->id],
            ['answer_text' => $answerText, 'points_earned' => $points]
        );
    }

    public function submit(StudentAttempt $attempt): Score
    {
        if ($attempt->status === 'submitted') {
            return $attempt->score ?? $this->computeScore($attempt);
        }

        if ($attempt->status !== 'in_progress') {
            throw new HttpException(403, 'Attempt cannot be submitted.');
        }

        $attempt->loadMissing('activity');
        if ($attempt->activity?->isCombination() && empty($attempt->simulation_state)) {
            return DB::transaction(function () use ($attempt) {
                $attempt->update(['status' => 'simulation_pending']);

                return $this->computeScore($attempt->fresh());
            });
        }

        return DB::transaction(function () use ($attempt) {
            $attempt->update([
                'status' => 'submitted',
                'submitted_at' => now(),
            ]);

            $fresh = $attempt->fresh();
            $score = $this->computeScore($fresh);
            $this->leaderboards->recomputeForActivity($fresh->activity_id);
            $profile = $fresh->student->studentProfile;
            if ($profile?->program_id) {
                $this->leaderboards->recomputeForProgram($profile->program_id);
            }
            $this->leaderboards->recomputeSemester();
            $this->badges->evaluateAfterScore($fresh, $score);

            $activity = $fresh->activity;
            if ($activity->creator) {
                $this->notifications->notifyUser(
                    $activity->creator,
                    'activity_completed',
                    'Student finished activity',
                    "{$fresh->student->name} completed {$activity->title}."
                );
            }

            return $score;
        });
    }

    public function repairMissingScores(): int
    {
        $count = 0;
        $attempts = StudentAttempt::with(['activity.questions.choices', 'score'])
            ->whereIn('status', ['submitted', 'failed'])
            ->whereDoesntHave('score')
            ->get();

        foreach ($attempts as $attempt) {
            $this->computeScore($attempt);
            $this->leaderboards->recomputeForActivity($attempt->activity_id);
            $count++;
        }

        return $count;
    }

    public function disqualifyAttempt(StudentAttempt $attempt): Score
    {
        if (in_array($attempt->status, ['submitted', 'failed', 'missed'], true)) {
            return $attempt->score ?? $this->computeScore($attempt);
        }

        $attempt->update([
            'status' => 'failed',
            'submitted_at' => now(),
        ]);

        $completionSeconds = $attempt->started_at
            ? max(0, (int) $attempt->started_at->diffInSeconds(now()))
            : null;

        $score = Score::updateOrCreate(
            ['attempt_id' => $attempt->id],
            [
                'raw_score' => 0,
                'percentage' => 0,
                'accuracy' => 0,
                'completion_seconds' => $completionSeconds,
            ]
        );

        $this->leaderboards->recomputeForActivity($attempt->activity_id);

        return $score;
    }

    public function autoSubmit(StudentAttempt $attempt): Score
    {
        if ($attempt->status === 'submitted') {
            return $attempt->score ?? $this->computeScore($attempt);
        }

        $attempt->update([
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        return $this->computeScore($attempt->fresh());
    }

    public function markMissedActivities(): int
    {
        $count = 0;
        $activities = Activity::whereIn('status', ['published', 'active'])
            ->whereNotNull('ends_at')
            ->where('ends_at', '<', now())
            ->get();

        foreach ($activities as $activity) {
            if ($activity->status === 'active') {
                $activity->update(['status' => 'closed']);
            }
            $studentIds = $this->assignedStudentIds($activity);
            foreach ($studentIds as $studentId) {
                $attempt = StudentAttempt::firstOrCreate(
                    ['student_user_id' => $studentId, 'activity_id' => $activity->id],
                    ['status' => 'not_started']
                );

                if (in_array($attempt->status, ['not_started'], true)) {
                    $attempt->update(['status' => 'missed', 'submitted_at' => now()]);
                    Score::updateOrCreate(
                        ['attempt_id' => $attempt->id],
                        ['raw_score' => 0, 'percentage' => 0, 'accuracy' => 0]
                    );
                    $count++;
                }
            }
        }

        return $count;
    }

    public function closeStaleAttempts(): int
    {
        $count = 0;
        $stale = StudentAttempt::where('status', 'in_progress')
            ->whereNotNull('server_deadline_at')
            ->where('server_deadline_at', '<', now())
            ->get();

        foreach ($stale as $attempt) {
            $this->autoSubmit($attempt);
            $count++;
        }

        return $count;
    }

    private function computeScore(StudentAttempt $attempt): Score
    {
        $activity = $attempt->activity()->with('questions.choices')->first();
        $questions = $activity->questions;
        $maxPoints = max(1, $questions->count());
        $earned = 0;
        $correct = 0;

        foreach ($questions as $question) {
            $answer = StudentAnswer::where('attempt_id', $attempt->id)->where('question_id', $question->id)->first();
            $points = $answer ? (float) $answer->points_earned : 0;
            $earned += $points;
            if ($points > 0) {
                $correct++;
            }
        }

        $percentage = round(($earned / $maxPoints) * 100, 2);
        $accuracy = round(($correct / $maxPoints) * 100, 2);
        $seconds = $attempt->started_at && $attempt->submitted_at
            ? max(0, (int) $attempt->started_at->diffInSeconds($attempt->submitted_at))
            : null;

        $score = Score::updateOrCreate(
            ['attempt_id' => $attempt->id],
            [
                'raw_score' => $earned,
                'percentage' => $percentage,
                'accuracy' => $accuracy,
                'completion_seconds' => $seconds,
            ]
        );

        foreach ($questions as $question) {
            $answer = StudentAnswer::where('attempt_id', $attempt->id)->where('question_id', $question->id)->first();
            ScoreBreakdown::updateOrCreate(
                ['score_id' => $score->id, 'question_id' => $question->id],
                [
                    'student_answer' => $answer?->answer_text,
                    'correct_answer' => $this->correctAnswerText($question),
                    'points' => $answer ? (float) $answer->points_earned : 0,
                ]
            );
        }

        return $score->load('breakdowns');
    }

    private function gradeAnswer(Question $question, ?string $answerText): float
    {
        if ($answerText === null || $answerText === '') {
            return 0;
        }

        if ($question->type === 'mcq') {
            $meta = $question->metadata ?? [];
            $allowMultiple = ! empty($meta['allow_multiple_correct']);
            $correctLabels = QuestionChoice::where('question_id', $question->id)
                ->where('is_correct', true)
                ->pluck('label')
                ->map(fn ($l) => strtoupper(trim($l)))
                ->sort()
                ->values()
                ->all();

            if ($allowMultiple) {
                $selected = collect(explode(',', strtoupper($answerText)))
                    ->map(fn ($l) => trim($l))
                    ->filter()
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();

                return $selected === $correctLabels ? 1 : 0;
            }

            $choice = QuestionChoice::where('question_id', $question->id)
                ->where('label', strtoupper(trim($answerText)))
                ->first();

            return ($choice && $choice->is_correct) ? 1 : 0;
        }

        $meta = $question->metadata ?? [];
        $accepted = array_map(
            fn ($v) => mb_strtolower(trim((string) $v)),
            array_merge([($meta['correct_answer'] ?? '')], $meta['alternatives'] ?? [])
        );
        $normalized = mb_strtolower(trim($answerText));

        return in_array($normalized, array_filter($accepted, fn ($v) => $v !== ''), true) ? 1 : 0;
    }

    private function correctAnswerText(Question $question): ?string
    {
        if ($question->type === 'mcq') {
            $choice = QuestionChoice::where('question_id', $question->id)->where('is_correct', true)->first();

            return $choice?->label;
        }

        return $question->metadata['correct_answer'] ?? null;
    }

    private function assignedStudentIds(Activity $activity): array
    {
        $ids = [];
        foreach ($activity->assignments as $assignment) {
            $ids = array_merge($ids, app(ActivityAudienceService::class)->resolveStudentIds($assignment));
        }

        return array_unique($ids);
    }
}
