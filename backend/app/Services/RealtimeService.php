<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RealtimeService
{
    public function broadcast(string $event, array $payload = [], ?string $room = null): void
    {
        $url = rtrim(config('realtime.url'), '/').'/broadcast';
        $secret = config('realtime.secret');

        try {
            Http::timeout(2)
                ->withHeaders(['X-Realtime-Secret' => $secret])
                ->post($url, [
                    'event' => $event,
                    'room' => $room,
                    'payload' => $payload,
                ]);
        } catch (\Throwable $e) {
            Log::debug('Realtime broadcast failed: '.$e->getMessage());
        }
    }

    public function refresh(string $resource = 'all', array $extra = []): void
    {
        $this->broadcast('system:refresh', array_merge(['resource' => $resource], $extra));
    }

    public function notifyUpdate(): void
    {
        $this->broadcast('notifications:update', []);
    }
}
