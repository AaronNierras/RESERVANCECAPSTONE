<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\User;

class NotificationService
{
    public function __construct(private RealtimeService $realtime) {}

    public function notifyUsers(array $userIds, string $type, string $title, ?string $body = null, ?array $data = null): Notification
    {
        $notification = Notification::create([
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ]);

        foreach (array_unique($userIds) as $userId) {
            NotificationRecipient::create([
                'notification_id' => $notification->id,
                'user_id' => $userId,
            ]);
        }

        $this->realtime->notifyUpdate();

        return $notification;
    }

    public function notifyUser(User $user, string $type, string $title, ?string $body = null, ?array $data = null): Notification
    {
        return $this->notifyUsers([$user->id], $type, $title, $body, $data);
    }
}
