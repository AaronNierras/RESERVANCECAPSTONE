<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\LabAssessmentService;
use Illuminate\Http\Request;

class LabAssessmentController extends Controller
{
    public function __construct(private LabAssessmentService $labs) {}

    public function show(Request $request)
    {
        return response()->json($this->labs->payload($request->user()));
    }

    public function update(Request $request, User $user)
    {
        $record = $this->labs->save($request->user(), $user, $request->all());

        return response()->json(['record' => $record]);
    }
}
