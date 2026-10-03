<?php

namespace App\Services;

use App\Models\AchievementBadge;
use App\Models\LeaderboardEntry;
use App\Models\Score;
use App\Models\StudentAttempt;
use App\Models\StudentBadge;
use App\Models\StudentProfile;
use App\Models\User;

class LeaderboardService
{
    public function recomputeForActivity(int $activityId): void
    {
        $scores = Score::query()
            ->whereHas('attempt', fn ($q) => $q->where('activity_id', $activityId)->where('status', 'submitted'))
            ->with('attempt.student')
            ->get();

        LeaderboardEntry::where('scope', 'activity')->where('activity_id', $activityId)->delete();

        $entries = $scores->map(function (Score $score) {
            return [
                'scope' => 'activity',
                'activity_id' => $score->attempt->activity_id,
                'student_user_id' => $score->attempt->student_user_id,
                'composite_score' => $this->compositeScore($score),
            ];
        })->sortByDesc('composite_score')->values();

        $rank = 1;
        foreach ($entries->take(10) as $entry) {
            LeaderboardEntry::create([...$entry, 'rank' => $rank++]);
        }
    }

    public function recomputeForProgram(int $programId): void
    {
        LeaderboardEntry::where('scope', 'program')->where('program_id', $programId)->delete();

        $studentIds = StudentProfile::where('program_id', $programId)->pluck('user_id');
        $scores = Score::query()
            ->whereHas('attempt', fn ($q) => $q->whereIn('student_user_id', $studentIds)->where('status', 'submitted'))
            ->with('attempt')
            ->get()
            ->groupBy(fn ($s) => $s->attempt->student_user_id)
            ->map(fn ($group) => $group->avg(fn ($s) => $this->compositeScore($s)));

        $rank = 1;
        foreach ($scores->sortDesc()->take(10) as $studentId => $composite) {
            LeaderboardEntry::create([
                'scope' => 'program',
                'program_id' => $programId,
                'student_user_id' => $studentId,
                'composite_score' => $composite,
                'rank' => $rank++,
            ]);
        }
    }

    public function recomputeSemester(?string $semester = null): void
    {
        $semester = $semester ?? now()->format('Y-S');
        LeaderboardEntry::where('scope', 'semester')->where('semester', $semester)->delete();

        $scores = Score::query()
            ->whereHas('attempt', fn ($q) => $q->where('status', 'submitted'))
            ->with('attempt')
            ->get()
            ->groupBy(fn ($s) => $s->attempt->student_user_id)
            ->map(fn ($group) => $group->avg(fn ($s) => $this->compositeScore($s)));

        $rank = 1;
        foreach ($scores->sortDesc()->take(20) as $studentId => $composite) {
            LeaderboardEntry::create([
                'scope' => 'semester',
                'student_user_id' => $studentId,
                'composite_score' => $composite,
                'semester' => $semester,
                'rank' => $rank++,
            ]);
        }
    }

    public function compositeScore(Score $score): float
    {
        $scorePart = (float) $score->percentage;
        $accuracyPart = (float) ($score->accuracy ?? $score->percentage);
        $timePart = $score->completion_seconds
            ? max(0, 100 - min(100, $score->completion_seconds / 60))
            : 50;

        return round(0.7 * $scorePart + 0.2 * $accuracyPart + 0.1 * $timePart, 4);
    }
}
