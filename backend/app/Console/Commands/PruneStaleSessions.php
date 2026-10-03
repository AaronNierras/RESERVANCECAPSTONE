<?php

namespace App\Console\Commands;

use App\Services\PresenceService;
use Illuminate\Console\Command;

class PruneStaleSessions extends Command
{
    protected $signature = 'sessions:prune-stale';

    protected $description = 'Mark inactive user sessions offline after the idle timeout';

    public function handle(PresenceService $presence): int
    {
        $count = $presence->pruneStaleSessions();
        $revoked = $presence->revokeExpiredLoginTokens();
        $this->info("Marked {$count} stale session(s) offline.");
        $this->info("Revoked {$revoked} expired login token(s).");

        return self::SUCCESS;
    }
}
