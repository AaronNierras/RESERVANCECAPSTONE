<?php

use App\Http\Controllers\Api\AcademicPeriodController;
use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BadgeController;
use App\Http\Controllers\Api\FacultyStudentController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PresenceController;
use App\Http\Controllers\Api\StudentActivityController;
use App\Http\Controllers\Api\SuperAdminController;
use App\Http\Controllers\Api\TutorialController;
use App\Http\Middleware\EnsureRole;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/presence/heartbeat', [PresenceController::class, 'heartbeat']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{recipientId}/read', [NotificationController::class, 'markRead']);
    Route::get('/tutorials', [TutorialController::class, 'index']);
    Route::get('/leaderboards', [LeaderboardController::class, 'index']);
    Route::get('/badges', [BadgeController::class, 'index']);

    Route::middleware(EnsureRole::class.':super_admin')->prefix('super-admin')->group(function () {
        Route::get('/dashboard', [SuperAdminController::class, 'dashboard']);
        Route::get('/students', [SuperAdminController::class, 'students']);
        Route::post('/students', [SuperAdminController::class, 'storeStudent']);
        Route::patch('/students/{user}', [SuperAdminController::class, 'updateStudent']);
        Route::get('/faculty', [SuperAdminController::class, 'faculty']);
        Route::post('/faculty', [SuperAdminController::class, 'storeFaculty']);
        Route::patch('/faculty/{user}', [SuperAdminController::class, 'updateFaculty']);
        Route::get('/programs', [SuperAdminController::class, 'programs']);
        Route::post('/programs', [SuperAdminController::class, 'storeProgram']);
        Route::post('/sections', [SuperAdminController::class, 'storeSection']);
        Route::get('/academic-periods', [AcademicPeriodController::class, 'index']);
        Route::get('/academic-periods/current', [AcademicPeriodController::class, 'current']);
        Route::post('/academic-periods/complete', [AcademicPeriodController::class, 'complete']);
        Route::get('/students/{user}/academic-history', [AcademicPeriodController::class, 'studentHistory']);
        Route::get('/faculty-activities', [SuperAdminController::class, 'facultyActivities']);
        Route::post('/faculty-activities/{activity}/copy', [SuperAdminController::class, 'copyFacultyActivity']);
        Route::get('/analytics', [AnalyticsController::class, 'superAdmin']);
        Route::get('/analytics/students/{user}', [AnalyticsController::class, 'studentPerformance']);
    });

    Route::middleware(EnsureRole::class.':faculty,super_admin')->group(function () {
        Route::get('/programs', [SuperAdminController::class, 'programs']);
    });

    Route::middleware(EnsureRole::class.':faculty,super_admin')->prefix('faculty')->group(function () {
        Route::get('/students', [FacultyStudentController::class, 'index']);
        Route::get('/analytics', [AnalyticsController::class, 'faculty']);
        Route::get('/analytics/students/{user}', [AnalyticsController::class, 'studentPerformance']);
        Route::get('/monitor', [PresenceController::class, 'monitor']);
    });

    Route::middleware(EnsureRole::class.':faculty,super_admin')->group(function () {
        Route::get('/activities', [ActivityController::class, 'index']);
        Route::post('/activities', [ActivityController::class, 'store']);
        Route::post('/activities/generate-from-document', [ActivityController::class, 'generateFromDocument']);
        Route::get('/activities/{activity}', [ActivityController::class, 'show']);
        Route::put('/activities/{activity}', [ActivityController::class, 'update']);
        Route::post('/activities/{activity}/publish', [ActivityController::class, 'publish']);
        Route::post('/activities/{activity}/open', [ActivityController::class, 'open']);
        Route::post('/activities/{activity}/close', [ActivityController::class, 'close']);
        Route::post('/activities/{activity}/duplicate', [ActivityController::class, 'duplicate']);
        Route::post('/activities/{activity}/archive', [ActivityController::class, 'archive']);
        Route::delete('/activities/{activity}', [ActivityController::class, 'destroy']);
        Route::post('/activities/question-image', [ActivityController::class, 'uploadQuestionImage']);
        Route::post('/activities/{activity}/template', [ActivityController::class, 'saveTemplate']);
        Route::get('/templates', [ActivityController::class, 'templates']);
    });

    Route::middleware(EnsureRole::class.':student')->prefix('student')->group(function () {
        Route::get('/activities', [StudentActivityController::class, 'index']);
        Route::get('/activities/{activity}', [StudentActivityController::class, 'show']);
        Route::post('/activities/{activity}/start', [StudentActivityController::class, 'start']);
        Route::post('/attempts/{attempt}/answer', [StudentActivityController::class, 'answer']);
        Route::post('/attempts/{attempt}/submit', [StudentActivityController::class, 'submit']);
        Route::post('/attempts/{attempt}/simulation/book', [StudentActivityController::class, 'simulationBook']);
        Route::post('/attempts/{attempt}/simulation/check-in', [StudentActivityController::class, 'simulationCheckIn']);
        Route::post('/attempts/{attempt}/simulation/check-out', [StudentActivityController::class, 'simulationCheckOut']);
        Route::post('/attempts/{attempt}/simulation/submit', [StudentActivityController::class, 'simulationSubmit']);
        Route::get('/attempts/{attempt}/result', [StudentActivityController::class, 'attemptResult']);
        Route::post('/activities/{activity}/integrity', [StudentActivityController::class, 'logIntegrity']);
        Route::get('/history', [StudentActivityController::class, 'history']);
        Route::get('/scores', [StudentActivityController::class, 'scores']);
        Route::get('/academic', [AcademicPeriodController::class, 'studentAcademic']);
    });
});
