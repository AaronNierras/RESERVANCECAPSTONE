<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationRecipient;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $items = NotificationRecipient::with('notification')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->take(50)
            ->get();

        return response()->json(['notifications' => $items]);
    }

    public function markRead(Request $request, int $recipientId)
    {
        $item = NotificationRecipient::where('user_id', $request->user()->id)->where('id', $recipientId)->firstOrFail();
        $item->update(['read_at' => now()]);

        return response()->json(['notification' => $item]);
    }
}
