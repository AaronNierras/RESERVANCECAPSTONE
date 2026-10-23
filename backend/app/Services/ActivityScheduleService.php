<?php

namespace App\Services;

use App\Models\Activity;

class ActivityScheduleService
{
    public function __construct(
        private ActivityAudienceService $audience,
        private NotificationService $notifications,
    ) {}

    public function reconcileDue(): array
    {
        $opened = 0;
        $closed = 0;

        Activity::query()
            ->visibleInFactory()
            ->whereIn('status', ['published', 'active'])
            ->orderBy('id')
            ->each(function (Activity $activity) use (&$opened, &$closed) {
                $result = $this->reconcile($activity);
                if ($result === 'opened') {
                    $opened++;
                }
                if ($result === 'closed') {
                    $closed++;
                }
            });

        return ['opened' => $opened, 'closed' => $closed];
    }

    public function reconcile(Activity $activity): string
    {
        if (in_array($activity->status, ['published', 'active'], true) && $activity->deadlineHasPassed()) {
            $activity->update([
                'status' => 'closed',
                'closed_at' => $activity->closed_at ?? now(),
            ]);

            return 'closed';
        }

        if ($activity->status === 'published'
            && $activity->open_mode === 'automatic'
            && $activity->startHasArrived()
            && ! $activity->deadlineHasPassed()) {
            $activity->update([
                'status' => 'active',
                'opened_at' => now(),
            ]);
            $activity->load('assignments');
            $studentIds = $this->audience->resolveActivityStudentIds($activity);
            if ($studentIds !== []) {
                $this->notifications->notifyUsers(
                    $studentIds,
                    'activity_opened',
                    'New activity available',
                    "{$activity->title} is now open. Go to Activities to begin.",
                    ['activity_id' => $activity->id, 'activity_type' => $activity->type],
                );
            }

            return 'opened';
        }

        return 'unchanged';
    }

    public function canOpenNow(Activity $activity): ?string
    {
        if ($activity->status !== 'published') {
            return 'Only a published assessment can be opened for students.';
        }

        if ($activity->open_mode === 'automatic') {
            return 'This assessment opens automatically when its start time arrives.';
        }

        if (! $activity->startHasArrived()) {
            return 'This assessment cannot be opened before its start time.';
        }

        if ($activity->deadlineHasPassed()) {
            return 'This assessment has already passed its end time.';
        }

        return null;
    }
}
