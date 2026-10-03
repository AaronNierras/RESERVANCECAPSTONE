<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Rubric;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ActivityCopyService
{
    public function copy(Activity $activity, User $newOwner, array $options = []): Activity
    {
        $activity->loadMissing(['questions.choices', 'assignments', 'rubric']);

        $titlePrefix = $options['title_prefix'] ?? 'Copy of ';
        $resetSchedule = $options['reset_schedule'] ?? true;

        return DB::transaction(function () use ($activity, $newOwner, $titlePrefix, $resetSchedule) {
            $copy = $activity->replicate(['status']);
            $copy->title = $titlePrefix.$activity->title;
            $copy->status = 'draft';
            $copy->created_by = $newOwner->id;

            if ($resetSchedule) {
                $copy->starts_at = null;
                $copy->ends_at = null;
            }

            $copy->save();

            foreach ($activity->questions as $question) {
                $questionCopy = $question->replicate();
                $questionCopy->activity_id = $copy->id;
                $questionCopy->save();

                foreach ($question->choices as $choice) {
                    $choiceCopy = $choice->replicate();
                    $choiceCopy->question_id = $questionCopy->id;
                    $choiceCopy->save();
                }
            }

            foreach ($activity->assignments as $assignment) {
                $assignmentCopy = $assignment->replicate();
                $assignmentCopy->activity_id = $copy->id;
                $assignmentCopy->save();
            }

            if ($activity->rubric) {
                Rubric::updateOrCreate(
                    ['activity_id' => $copy->id],
                    $activity->rubric->only(['accuracy_weight', 'completion_weight', 'time_weight']),
                );
            }

            return $copy->fresh(['questions.choices', 'assignments', 'rubric']);
        });
    }
}
