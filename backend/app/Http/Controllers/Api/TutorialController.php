<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tutorial;
use Illuminate\Http\Request;

class TutorialController extends Controller
{
    public function index(Request $request)
    {
        $role = $request->user()->roleName();
        $tutorials = Tutorial::query()
            ->where(function ($q) use ($role) {
                $q->whereNull('role')->orWhere('role', $role);
            })
            ->orderBy('sort_order')
            ->get();

        return response()->json(['tutorials' => $tutorials]);
    }
}
