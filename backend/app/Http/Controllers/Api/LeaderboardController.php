<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeaderboardEntry;
use Illuminate\Http\Request;

class LeaderboardController extends Controller
{
    public function index(Request $request)
    {
        $scope = $request->query('scope', 'activity');
        $query = LeaderboardEntry::with('student:id,name')->orderBy('rank');

        if ($scope === 'activity') {
            $query->where('scope', 'activity')->where('activity_id', $request->query('activity_id'));
        } elseif ($scope === 'program') {
            $programId = $request->query('program_id') ?? $request->user()->studentProfile?->program_id;
            $query->where('scope', 'program')->where('program_id', $programId);
        } else {
            $query->where('scope', 'semester');
        }

        return response()->json(['leaderboard' => $query->take(10)->get()]);
    }
}
