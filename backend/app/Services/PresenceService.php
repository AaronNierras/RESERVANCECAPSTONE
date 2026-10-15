<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Http\Request;

class PresenceService
{
    public const ONLINE_WINDOW_MINUTES = 2;

    public const IDLE_OFFLINE_MINUTES = 10;

    /**
     * Whether the account already has an active API login (one session per account).
     * Stale or offline sessions are cleared so a real logout / closed tab does not lock the account.
     */
    public function hasActiveLogin(User $user): bool
    {
        $this->revokeExpiredLoginTokens();

        $session = UserSession::query()->where('user_id', $user->id)->first();
        if ($session && $session->status === 'offline') {
            $user->tokens()->delete();

            return false;
        }

        $recentCutoff = now()->subMinutes(self::ONLINE_WINDOW_MINUTES);

        $hasRecentToken = $user->tokens()
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->where(function ($query) use ($recentCutoff) {
                $query->where('last_used_at', '>=', $recentCutoff)
                    ->orWhere(function ($inner) use ($recentCutoff) {
                        $inner->whereNull('last_used_at')
                            ->where('created_at', '>=', $recentCutoff);
                    });
            })
            ->exists();

        if (! $hasRecentToken) {
            $user->tokens()->delete();

            return false;
        }

        return true;
    }

    /**
     * Remove Sanctum tokens idle longer than the session timeout so accounts can sign in again.
     */
    public function revokeExpiredLoginTokens(): int
    {
        $cutoff = now()->subMinutes(self::IDLE_OFFLINE_MINUTES);
        $revoked = 0;

        User::query()
            ->whereHas('tokens', function ($query) use ($cutoff) {
                $query->where(function ($inner) use ($cutoff) {
                    $inner->whereNotNull('last_used_at')
                        ->where('last_used_at', '<', $cutoff);
                })->orWhere(function ($inner) use ($cutoff) {
                    $inner->whereNull('last_used_at')
                        ->where('created_at', '<', $cutoff);
                });
            })
            ->each(function (User $user) use (&$revoked) {
                $revoked += $user->tokens()->delete();
                $this->markOffline($user);
            });

        return $revoked;
    }

    public function heartbeat(User $user, Request $request, string $status = 'online'): UserSession
    {
        $this->pruneStaleSessions();

        return UserSession::updateOrCreate(
            ['user_id' => $user->id],
            [
                'ip_address' => $request->ip(),
                'device' => $request->userAgent(),
                'last_activity' => now(),
                'status' => $status,
            ]
        );
    }

    public function markOffline(User $user): void
    {
        UserSession::where('user_id', $user->id)->update([
            'status' => 'offline',
            'last_activity' => now(),
        ]);
    }

    public function countOnlineForRole(string $roleName): int
    {
        $this->pruneStaleSessions();

        return UserSession::query()
            ->where('status', 'online')
            ->where('last_activity', '>=', now()->subMinutes(self::ONLINE_WINDOW_MINUTES))
            ->whereHas('user.role', fn ($q) => $q->where('name', $roleName))
            ->count();
    }

    /**
     * @param  array<int>  $userIds
     * @return array<int>
     */
    public function onlineUserIds(array $userIds = []): array
    {
        $this->pruneStaleSessions();

        $query = UserSession::query()
            ->where('status', 'online')
            ->where('last_activity', '>=', now()->subMinutes(self::ONLINE_WINDOW_MINUTES));

        if ($userIds !== []) {
            $query->whereIn('user_id', $userIds);
        }

        return $query->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }

    public function pruneStaleSessions(): int
    {
        return UserSession::query()
            ->where('status', '!=', 'offline')
            ->where('last_activity', '<', now()->subMinutes(self::IDLE_OFFLINE_MINUTES))
            ->update([
                'status' => 'offline',
                'last_activity' => now(),
            ]);
    }
}
