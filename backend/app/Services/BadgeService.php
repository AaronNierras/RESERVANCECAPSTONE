<?php

namespace App\Services;

use App\Models\AchievementBadge;
use App\Models\LeaderboardEntry;
use App\Models\Score;
use App\Models\StudentAttempt;
use App\Models\StudentBadge;
use App\Models\User;

class BadgeService
{
    public function __construct(private NotificationService $notifications) {}

    public function evaluateAfterScore(StudentAttempt $attempt, Score $score): void
    {
        $studentId = $attempt->student_user_id;

        $this->awardIfNew($studentId, 'first_activity', 'First Activity Completed', 'Completed your first activity.');

        if ($score->percentage >= 100) {
            $this->awardIfNew($studentId, 'perfect_score', 'Perfect Score', 'Achieved 100% on an activity.');
        }

        $submittedCount = StudentAttempt::where('student_user_id', $studentId)->where('status', 'submitted')->count();
        if ($submittedCount >= 10) {
            $this->awardIfNew($studentId, 'consistent_performer', 'Consistent Performer', 'Passed 10 activities.');
        }

        $top = LeaderboardEntry::where('scope', 'activity')
            ->where('activity_id', $attempt->activity_id)
            ->where('rank', 1)
            ->first();
        if ($top && $top->student_user_id === $studentId) {
            $this->awardIfNew($studentId, 'top_ranker', 'Top Ranker', 'Ranked #1 on an activity leaderboard.');
        }
    }

    private function awardIfNew(int $studentId, string $slug, string $name, string $description): void
    {
        $badge = AchievementBadge::firstOrCreate(
            ['slug' => $slug],
            ['name' => $name, 'description' => $description, 'icon' => $slug, 'points' => 10]
        );

        if (StudentBadge::where('student_user_id', $studentId)->where('badge_id', $badge->id)->exists()) {
            return;
        }

        StudentBadge::create([
            'student_user_id' => $studentId,
            'badge_id' => $badge->id,
            'earned_at' => now(),
        ]);

        $user = User::find($studentId);
        if ($user) {
            $this->notifications->notifyUser($user, 'badge_earned', 'Badge earned', $name);
        }
    }
}
