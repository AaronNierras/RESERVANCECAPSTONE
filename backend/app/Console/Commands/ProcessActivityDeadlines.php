<?php

namespace App\Console\Commands;

use App\Services\AssessmentEngine;
use Illuminate\Console\Command;

class ProcessActivityDeadlines extends Command
{
    protected $signature = 'activities:process-deadlines';

    protected $description = 'Mark missed activities and auto-submit stale attempts';

    public function handle(AssessmentEngine $engine): int
    {
        $missed = $engine->markMissedActivities();
        $auto = $engine->closeStaleAttempts();
        $this->info("Marked {$missed} missed, auto-submitted {$auto} stale attempts.");

        return self::SUCCESS;
    }
}
