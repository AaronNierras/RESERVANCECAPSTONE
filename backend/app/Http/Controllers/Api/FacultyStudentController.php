<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;

class FacultyStudentController extends Controller
{
    public function index()
    {
        $students = User::with(['studentProfile.program', 'studentProfile.section', 'role'])
            ->whereHas('role', fn ($q) => $q->where('name', Role::STUDENT))
            ->orderBy('name')
            ->get();

        return response()->json(['students' => $students]);
    }
}
