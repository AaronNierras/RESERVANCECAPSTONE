<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudentBadge;
use Illuminate\Http\Request;

class BadgeController extends Controller
{
    public function index(Request $request)
    {
        $badges = StudentBadge::with('badge')
            ->where('student_user_id', $request->user()->id)
            ->latest('earned_at')
            ->get();

        return response()->json(['badges' => $badges]);
    }
}
