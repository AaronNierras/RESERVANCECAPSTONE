<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogService
{
    public function log(?User $user, string $action, string $module, ?Request $request = null): void
    {
        AuditLog::create([
            'user_id' => $user?->id,
            'action' => $action,
            'module' => $module,
            'ip_address' => $request?->ip(),
            'created_at' => now(),
        ]);
    }
}
