<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemError;
use Illuminate\Http\Request;

class SystemErrorController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string|max:500',
            'location' => 'nullable|string|max:255',
        ]);

        $message = trim($data['message']);
        $recent = SystemError::query()
            ->where('user_id', $request->user()->id)
            ->where('message', $message)
            ->where('is_fixed', false)
            ->where('created_at', '>=', now()->subMinutes(10))
            ->exists();

        if (! $recent) {
            SystemError::query()->create([
                'user_id' => $request->user()->id,
                'source' => 'client',
                'message' => $message,
                'location' => $data['location'] ?? null,
            ]);
        }

        return response()->json(['saved' => true]);
    }
}
