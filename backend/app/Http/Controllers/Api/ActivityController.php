<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\ActivityAssignment;
use App\Models\ActivityTemplate;
use App\Models\Question;
use App\Models\QuestionChoice;
use App\Models\Rubric;
use App\Services\ActivityAudienceService;
use App\Services\ActivityCopyService;
use App\Services\ActivityScheduleService;
use App\Services\AuditLogService;
use App\Services\NotificationService;
use App\Services\DocumentTextExtractor;
use App\Services\QuestionnaireGenerator;
use App\Services\QuestionImageService;
use App\Services\RealtimeService;
use App\Services\SimulationEngine;
use App\Models\Score;
use App\Models\Section;
use App\Models\StudentAttempt;
use App\Models\Role;
use App\Models\User;
use App\Support\FrontOfficeLabRubric;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ActivityController extends Controller
{
    public function __construct(
        private AuditLogService $audit,
        private NotificationService $notifications,
        private RealtimeService $realtime,
        private QuestionImageService $questionImages,
        private DocumentTextExtractor $documents,
        private QuestionnaireGenerator $questionnaires,
        private ActivityCopyService $activityCopy,
        private ActivityAudienceService $audience,
        private ActivityScheduleService $schedule,
        private FrontOfficeLabRubric $labRubric,
    ) {}

    public function index(Request $request)
    {
        $this->schedule->reconcileDue();

        $query = Activity::with(['assignments', 'questions.choices'])->visibleInFactory()->latest();

        if ($request->user()->isFaculty() || $request->user()->isProgramChair()) {
            $query->where('created_by', $request->user()->id);
        }

        return response()->json([
            'activities' => $query->get()->map(fn ($a) => $this->activityPayload($a, true)),
        ]);
    }

    public function show(Request $request, Activity $activity)
    {
        $this->authorizeActivityView($request, $activity);

        return response()->json(['activity' => $this->activityPayload($activity->load('questions.choices', 'assignments', 'rubric'), true)]);
    }

    public function generateFromDocument(Request $request)
    {
        $data = $request->validate([
            'file' => 'required|file|max:102400',
            'type' => 'required|in:activity,quiz,exam',
            'title' => 'required|string|max:255',
            'question_count' => 'required|integer|min:1|max:100',
        ], [
            'file.max' => 'The file must be 100 MB or smaller.',
        ]);

        try {
            $text = $this->documents->extract($request->file('file'));
            $count = (int) $data['question_count'];
            $questions = $this->questionnaires->generate($text, $count);
            $specification = $this->questionnaires->specification($count);
        } catch (\RuntimeException $exception) {
            throw ValidationException::withMessages(['file' => [$exception->getMessage()]]);
        }

        return response()->json([
            'title' => $data['title'],
            'type' => $data['type'],
            'questions' => $questions,
            'specification' => $specification,
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateActivity($request);

        $activity = DB::transaction(function () use ($request, $data) {
            $activity = Activity::create([
                ...collect($data)->only(['title', 'description', 'instructions', 'type', 'difficulty', 'time_limit_minutes', 'starts_at', 'ends_at', 'open_mode', 'late_policy', 'simulation_config'])->all(),
                'created_by' => $request->user()->id,
                'status' => 'draft',
            ]);

            if ($activity->isSimulation()) {
                // Simulations use simulation_config, not questions.
            } else {
                $this->syncQuestions($activity, $data['questions'] ?? []);
            }
            $this->syncAssignments($activity, $data['assignments'] ?? []);
            Rubric::updateOrCreate(['activity_id' => $activity->id], $data['rubric'] ?? []);

            return $activity;
        });

        $this->audit->log($request->user(), 'create_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($activity->fresh()->load('questions.choices', 'assignments', 'rubric'), true)], 201);
    }

    public function update(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);

        if ($activity->status !== 'draft') {
            abort(422, 'Only a draft can be edited. A published assessment keeps the content that was published.');
        }

        $data = $this->validateActivity($request, $activity);

        DB::transaction(function () use ($activity, $data) {
            $activity->update(collect($data)->only([
                'title', 'description', 'instructions', 'type', 'difficulty',
                'time_limit_minutes', 'starts_at', 'ends_at', 'open_mode', 'late_policy', 'simulation_config',
            ])->all());
            if (isset($data['questions']) && ! $activity->isSimulation()) {
                $activity->questions()->each(fn ($q) => $q->choices()->delete());
                $activity->questions()->delete();
                $this->syncQuestions($activity, $data['questions']);
            }
            if (isset($data['assignments'])) {
                $activity->assignments()->delete();
                $this->syncAssignments($activity, $data['assignments']);
            }
            if (isset($data['rubric'])) {
                Rubric::updateOrCreate(['activity_id' => $activity->id], $data['rubric']);
            }
        });

        $this->audit->log($request->user(), 'update_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($activity->fresh()->load('questions.choices', 'assignments', 'rubric'), true)]);
    }

    public function publish(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);

        $published = DB::transaction(function () use ($request, $activity) {
            $locked = Activity::query()->whereKey($activity->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => ['This assessment is already published.'],
                ]);
            }

            $locked->load('questions.choices', 'assignments');
            $errors = $locked->isCombination()
                ? array_merge(
                    $this->validateQuestionsForPublish($locked),
                    SimulationEngine::validateConfigForPublish($locked->simulation_config ?? [])
                )
                : ($locked->isSimulation()
                    ? SimulationEngine::validateConfigForPublish($locked->simulation_config ?? [])
                    : $this->validateQuestionsForPublish($locked));
            if (! empty($errors)) {
                $key = $locked->isSimulation() ? 'simulation_config' : 'questions';
                throw ValidationException::withMessages([$key => $errors]);
            }

            if ($locked->assignments->isEmpty()) {
                throw ValidationException::withMessages(['assignments' => ['Select at least one recipient before publishing.']]);
            }

            $assignmentErrors = $this->validateAssignmentsForPublish($locked);
            if ($assignmentErrors !== []) {
                throw ValidationException::withMessages(['assignments' => $assignmentErrors]);
            }

            $scheduleErrors = $this->validateScheduleForPublish($locked);
            if ($scheduleErrors !== []) {
                throw ValidationException::withMessages($scheduleErrors);
            }

            $recipients = $this->audience->snapshotRecipients($locked);
            if ($recipients === []) {
                throw ValidationException::withMessages([
                    'assignments' => ['No eligible students match this audience. Choose a section or student that can take the assessment.'],
                ]);
            }

            $locked->update([
                'status' => 'published',
                'published_at' => now(),
                'published_by' => $request->user()->id,
            ]);

            return $locked;
        });

        $this->audit->log($request->user(), 'publish_activity', 'activity_factory', $request);

        $programChairIds = User::whereHas('role', fn ($q) => $q->where('name', Role::PROGRAM_CHAIR))->pluck('id')->all();
        $this->notifications->notifyUsers($programChairIds, 'activity_published', 'Activity published', $published->title);
        $this->schedule->reconcile($published->fresh());
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($published->fresh(), true)]);
    }

    public function open(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);

        $opened = DB::transaction(function () use ($request, $activity) {
            $locked = Activity::query()->whereKey($activity->id)->lockForUpdate()->firstOrFail();
            $reason = $this->schedule->canOpenNow($locked);
            if ($reason) {
                throw ValidationException::withMessages(['status' => [$reason]]);
            }

            $locked->update([
                'status' => 'active',
                'opened_at' => now(),
                'opened_by' => $request->user()->id,
            ]);

            return $locked;
        });

        $opened->load('assignments', 'recipients');
        $studentIds = $this->audience->resolveActivityStudentIds($opened);
        if ($studentIds !== []) {
            $this->notifications->notifyUsers(
                $studentIds,
                'activity_opened',
                'New activity available',
                "{$opened->title} is now open. Go to Activities to begin.",
                ['activity_id' => $opened->id, 'activity_type' => $opened->type],
            );
        }
        $this->audit->log($request->user(), 'open_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($opened, true)]);
    }

    public function close(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);

        $closed = DB::transaction(function () use ($request, $activity) {
            $locked = Activity::query()->whereKey($activity->id)->lockForUpdate()->firstOrFail();
            if (! in_array($locked->status, ['published', 'active'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This assessment cannot be closed from its current state.'],
                ]);
            }

            $locked->update([
                'status' => 'closed',
                'closed_at' => now(),
                'closed_by' => $request->user()->id,
            ]);

            return $locked;
        });

        $this->audit->log($request->user(), 'close_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($closed, true)]);
    }

    public function outputs(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);
        if (! $activity->hasSimulation()) {
            abort(422, 'This rubric grades the hotel simulation output.');
        }

        $tasks = array_values(array_filter(
            FrontOfficeLabRubric::activities(),
            fn (array $task) => in_array($task['key'], FrontOfficeLabRubric::taskKeysForConfig($activity->simulation_config ?? []), true),
        ));

        $attempts = StudentAttempt::query()
            ->with(['student.studentProfile.program', 'student.studentProfile.section', 'score'])
            ->where('activity_id', $activity->id)
            ->where('status', 'submitted')
            ->orderByDesc('submitted_at')
            ->get()
            ->map(function (StudentAttempt $attempt) {
                $flags = [];
                foreach ($attempt->simulation_submission['grading'] ?? [] as $row) {
                    $flags[$row['key']] = (bool) ($row['passed'] ?? false);
                }

                return [
                    'id' => $attempt->id,
                    'submitted_at' => $attempt->submitted_at,
                    'student' => [
                        'id' => $attempt->student?->id,
                        'name' => $attempt->student?->name,
                        'student_number' => $attempt->student?->studentProfile?->student_number,
                        'section' => $attempt->student?->studentProfile?->section?->displayLabel(
                            $attempt->student?->studentProfile?->program?->sectionCode()
                        ),
                    ],
                    'system' => $attempt->simulation_submission['grading'] ?? [],
                    'suggested' => $this->labRubric->suggestFromOutput($flags),
                    'laboratory' => $attempt->score?->details['laboratory'] ?? null,
                ];
            });

        return response()->json([
            'rubric' => [
                'title' => 'Front Office Laboratory Assessment',
                'passing_percent' => FrontOfficeLabRubric::PASSING_PERCENT,
                'note' => 'Grade the reservation, check-in, and check-out output. A task is competent at 75% of its points. Procedure, accuracy, communication, and professionalism follow the laboratory rubric. The answer-key check suggests procedure and accuracy. Communication and professionalism are observed by the professor.',
                'criteria' => FrontOfficeLabRubric::criteria(),
                'tasks' => $tasks,
            ],
            'attempts' => $attempts,
        ]);
    }

    public function gradeOutput(Request $request, Activity $activity, StudentAttempt $attempt)
    {
        $this->authorizeActivityEdit($request, $activity);
        if ((int) $attempt->activity_id !== (int) $activity->id || $attempt->status !== 'submitted') {
            abort(404);
        }
        if (! $activity->hasSimulation()) {
            abort(422, 'This rubric grades the hotel simulation output.');
        }

        $data = $request->validate([
            'marks' => 'required|array',
        ]);

        $taskKeys = FrontOfficeLabRubric::taskKeysForConfig($activity->simulation_config ?? []);
        $marks = $this->labRubric->normalize($data['marks'], $taskKeys);
        $result = $this->labRubric->evaluate($marks, $taskKeys);
        if ($result['rating'] === 'in_progress') {
            throw ValidationException::withMessages([
                'marks' => ['Enter procedure, accuracy, communication, and professionalism for every task.'],
            ]);
        }

        $score = Score::query()->firstOrCreate(
            ['attempt_id' => $attempt->id],
            ['raw_score' => 0, 'percentage' => 0, 'accuracy' => 0],
        );
        $details = $score->details ?? [];
        if (! isset($details['system_percentage'])) {
            $details['system_percentage'] = $score->percentage;
        }
        $details['laboratory'] = $result;
        $score->update([
            'raw_score' => $result['earned'],
            'percentage' => $result['percentage'],
            'accuracy' => $result['percentage'],
            'details' => $details,
        ]);

        $this->audit->log($request->user(), 'grade_simulation_rubric', 'activity_factory', $request);
        $this->realtime->refresh('scores');

        return response()->json(['score' => $score->fresh(), 'laboratory' => $result]);
    }

    public function uploadQuestionImage(Request $request)
    {
        $data = $request->validate([
            'image' => 'required|image|mimes:jpeg,jpg,png,gif,webp|max:10240',
        ]);

        try {
            $result = $this->questionImages->storeOptimized($data['image']);
        } catch (\RuntimeException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json($result, 201);
    }

    public function destroy(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);

        if ($activity->status !== 'draft') {
            abort(422, 'Only draft assessments can be deleted.');
        }

        $activity->delete();
        $this->audit->log($request->user(), 'delete_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['deleted' => true]);
    }

    public function duplicate(Request $request, Activity $activity)
    {
        if ($request->user()->isFaculty() && $activity->created_by !== $request->user()->id) {
            abort(403);
        }

        $copy = $this->activityCopy->copy($activity, $request->user(), [
            'title_prefix' => 'Copy of ',
        ]);

        $this->audit->log($request->user(), 'duplicate_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($copy, true)], 201);
    }

    public function archive(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);
        $activity->update(['status' => 'archived']);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($activity, true)]);
    }

    public function saveTemplate(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'visibility' => 'required|in:private,faculty_shared,institution_shared',
        ]);

        $template = ActivityTemplate::create([
            'created_by' => $request->user()->id,
            'title' => $data['title'],
            'description' => $activity->description,
            'visibility' => $data['visibility'],
            'payload' => $this->activityPayload($activity->load('questions.choices', 'assignments', 'rubric'), true),
        ]);

        return response()->json(['template' => $template], 201);
    }

    public function templates(Request $request)
    {
        $templates = ActivityTemplate::where(function ($q) use ($request) {
            $q->where('created_by', $request->user()->id)
                ->orWhere('visibility', 'institution_shared');
            if ($request->user()->isFaculty()) {
                $q->orWhere('visibility', 'faculty_shared');
            }
        })->latest()->get();

        return response()->json(['templates' => $templates]);
    }

    public function useTemplate(Request $request, ActivityTemplate $template)
    {
        $user = $request->user();
        $visible = ActivityTemplate::query()
            ->whereKey($template->id)
            ->where(function ($query) use ($user) {
                $query->where('created_by', $user->id)
                    ->orWhere('visibility', 'institution_shared');
                if ($user->isFaculty()) {
                    $query->orWhere('visibility', 'faculty_shared');
                }
                if ($user->isProgramChair()) {
                    $query->orWhere('visibility', 'faculty_shared');
                }
            })
            ->exists();

        if (! $visible) {
            abort(403);
        }

        $sourceId = $template->payload['id'] ?? null;
        $source = $sourceId ? Activity::query()->find($sourceId) : null;
        if (! $source) {
            throw ValidationException::withMessages([
                'template' => ['This template can no longer be copied because the original activity was removed.'],
            ]);
        }

        $copy = $this->activityCopy->copy($source, $user, ['title_prefix' => '']);
        $copy->assignments()->delete();
        $copy->update(['title' => $template->title]);

        $this->audit->log($request->user(), 'use_template', 'activity_factory', $request);
        $this->realtime->refresh('activities');

        return response()->json(['activity' => $this->activityPayload($copy->fresh(), true)], 201);
    }

    private function validateActivity(Request $request, ?Activity $activity = null): array
    {
        if ($request->exists('title')) {
            $request->merge(['title' => trim((string) $request->input('title'))]);
        }

        return $request->validate([
            'title' => ($activity ? 'sometimes' : 'required').'|string|min:1|max:255',
            'description' => 'nullable|string|max:5000',
            'instructions' => 'nullable|string|max:5000',
            'type' => ($activity ? 'sometimes' : 'required').'|in:activity,quiz,exam,assignment,simulation,game,combination',
            'difficulty' => 'nullable|string|max:32',
            'time_limit_minutes' => 'nullable|integer|min:1|max:480',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date',
            'open_mode' => 'nullable|in:manual,automatic',
            'late_policy' => 'nullable|in:lock,finish',
            'questions' => 'nullable|array|max:100',
            'questions.*.type' => 'required_with:questions|in:mcq,identification',
            'questions.*.body' => 'nullable|string|max:2000',
            'questions.*.explanation' => 'nullable|string|max:2000',
            'questions.*.timer_seconds' => 'nullable|integer|min:5|max:3600',
            'questions.*.choices' => 'nullable|array|max:8',
            'questions.*.choices.*.label' => 'nullable|string|max:4',
            'questions.*.choices.*.text' => 'nullable|string|max:500',
            'questions.*.metadata' => 'nullable|array',
            'questions.*.metadata.correct_answer' => 'nullable|string|max:300',
            'assignments' => 'nullable|array|max:500',
            'assignments.*.scope' => 'required_with:assignments|in:all,program,section,student',
            'assignments.*.program_id' => 'nullable|exists:programs,id',
            'assignments.*.section_id' => 'nullable|exists:sections,id',
            'assignments.*.student_user_id' => 'nullable|exists:users,id',
            'rubric' => 'nullable|array',
            'simulation_config' => 'nullable|array',
        ]);
    }

    private function validateScheduleForPublish(Activity $activity): array
    {
        $errors = [];
        if (trim((string) $activity->title) === '') {
            $errors['title'] = ['Activity title is required.'];
        }
        if ($activity->open_mode === 'automatic' && ! $activity->starts_at) {
            $errors['starts_at'] = ['Automatic opening needs a start date and time.'];
        }
        if ($activity->ends_at && $activity->ends_at->lessThanOrEqualTo(now())) {
            $errors['ends_at'] = ['End time must still be in the future.'];
        }
        if ($activity->starts_at && $activity->ends_at && $activity->ends_at->lessThanOrEqualTo($activity->starts_at)) {
            $errors['ends_at'] = ['End time must be later than the start time.'];
        }
        if ($activity->time_limit_minutes !== null) {
            $minutes = (int) $activity->time_limit_minutes;
            if ($minutes < 1 || $minutes > 480) {
                $errors['time_limit_minutes'] = ['The time limit must be a whole number from 1 to 480 minutes.'];
            } elseif ($activity->starts_at && $activity->ends_at) {
                $window = (int) floor(($activity->ends_at->getTimestamp() - $activity->starts_at->getTimestamp()) / 60);
                if ($minutes > $window) {
                    $errors['time_limit_minutes'] = ['The time limit cannot be longer than the time between the start and the end.'];
                }
            }
        }

        return $errors;
    }

    private function validateAssignmentsForPublish(Activity $activity): array
    {
        $errors = [];
        $assignments = $activity->assignments;
        $scopes = $assignments->pluck('scope')->unique();
        if ($scopes->contains('all') && $assignments->count() > 1) {
            $errors[] = 'All sections cannot be combined with other recipients.';
        }

        $seenSections = [];
        $seenStudents = [];
        foreach ($assignments as $assignment) {
            if ($assignment->scope === 'section') {
                if (! $assignment->section_id || in_array((int) $assignment->section_id, $seenSections, true)) {
                    $errors[] = 'Each selected section must be listed once.';
                    continue;
                }
                $seenSections[] = (int) $assignment->section_id;
                $section = Section::query()->with('program')->find($assignment->section_id);
                if (! $section || ! in_array($section->program?->slug, ['bshm', 'bstm'], true)) {
                    $errors[] = 'Each section must belong to BS Hospitality Management or BS Tourism Management.';
                }
            }

            if ($assignment->scope === 'student') {
                if (! $assignment->student_user_id || in_array((int) $assignment->student_user_id, $seenStudents, true)) {
                    $errors[] = 'Each selected student must be listed once.';
                    continue;
                }
                $seenStudents[] = (int) $assignment->student_user_id;
                $student = User::query()->with(['role', 'studentProfile.program'])->find($assignment->student_user_id);
                $profile = $student?->studentProfile;
                $eligible = $student
                    && $student->role?->name === Role::STUDENT
                    && $student->status === 'active'
                    && $profile?->section_id
                    && (! $profile->academic_status || $profile->academic_status === 'active')
                    && in_array($profile->program?->slug, ['bshm', 'bstm'], true);
                if (! $eligible) {
                    $errors[] = 'Every selected student must be an active student placed in an official section.';
                }
            }

            if ($assignment->scope === 'program') {
                $errors[] = 'Choose all sections, specific sections, or specific students.';
            }
        }

        return array_values(array_unique($errors));
    }

    private function syncQuestions(Activity $activity, array $questions): void
    {
        foreach ($questions as $index => $qData) {
            $question = Question::create([
                'activity_id' => $activity->id,
                'type' => $qData['type'] ?: 'mcq',
                'body' => trim((string) ($qData['body'] ?? '')),
                'explanation' => isset($qData['explanation']) ? (string) $qData['explanation'] : null,
                'timer_seconds' => $qData['timer_seconds'] ?? null,
                'sort_order' => $index,
                'metadata' => $qData['metadata'] ?? null,
            ]);

            foreach ($qData['choices'] ?? [] as $choice) {
                QuestionChoice::create([
                    'question_id' => $question->id,
                    'label' => trim((string) ($choice['label'] ?? '')),
                    'text' => trim((string) ($choice['text'] ?? '')),
                    'is_correct' => (bool) ($choice['is_correct'] ?? false),
                ]);
            }
        }
    }

    private function syncAssignments(Activity $activity, array $assignments): void
    {
        foreach ($assignments as $assignment) {
            ActivityAssignment::create([
                'activity_id' => $activity->id,
                'scope' => $assignment['scope'],
                'program_id' => $assignment['program_id'] ?? null,
                'section_id' => $assignment['section_id'] ?? null,
                'student_user_id' => $assignment['student_user_id'] ?? null,
            ]);
        }
    }

    private function authorizeActivityView(Request $request, Activity $activity): void
    {
        if ($request->user()->isProgramChair()) {
            return;
        }
        if ($request->user()->isFaculty() && $activity->created_by === $request->user()->id) {
            return;
        }
        abort(403);
    }

    private function authorizeActivityEdit(Request $request, Activity $activity): void
    {
        if ($activity->isLaboratory()) {
            abort(422, 'Score this laboratory from Lab Rubrics.');
        }

        if ($activity->created_by === $request->user()->id) {
            return;
        }
        abort(403);
    }

    private function activityPayload(Activity $activity, bool $includeAnswers): array
    {
        $attemptCount = $activity->attempts()->count();

        return [
            'id' => $activity->id,
            'title' => $activity->title,
            'description' => $activity->description,
            'instructions' => $activity->instructions,
            'type' => $activity->type,
            'difficulty' => $activity->difficulty,
            'status' => $activity->status,
            'time_limit_minutes' => $activity->time_limit_minutes,
            'starts_at' => $activity->starts_at,
            'ends_at' => $activity->ends_at,
            'open_mode' => $activity->open_mode ?: 'manual',
            'late_policy' => $activity->late_policy ?: 'lock',
            'published_at' => $activity->published_at,
            'opened_at' => $activity->opened_at,
            'closed_at' => $activity->closed_at,
            'recipient_count' => $activity->recipients()->count(),
            'created_by' => $activity->created_by,
            'attempt_count' => $attemptCount,
            'question_count' => $activity->isSimulation()
                ? count(($activity->simulation_config ?? [])['rooms'] ?? [])
                : ($activity->questions ?? collect())->count(),
            'simulation_config' => $activity->simulation_config,
            'creator' => $activity->relationLoaded('creator') ? $activity->creator?->only(['id', 'name']) : null,
            'assignments' => $activity->assignments ?? [],
            'rubric' => $activity->rubric,
            'questions' => ($activity->questions ?? collect())->map(function ($q) use ($includeAnswers) {
                $payload = [
                    'id' => $q->id,
                    'type' => $q->type,
                    'body' => $q->body,
                    'timer_seconds' => $q->timer_seconds,
                    'sort_order' => $q->sort_order,
                ];
                if ($includeAnswers) {
                    $payload['explanation'] = $q->explanation;
                    $payload['metadata'] = $q->metadata;
                    $payload['choices'] = $q->choices;
                } else {
                    $payload['choices'] = $q->choices?->map(fn ($c) => $c->only(['id', 'label', 'text']));
                }

                return $payload;
            }),
        ];
    }

    private function validateQuestionsForPublish(Activity $activity): array
    {
        $errors = [];

        if ($activity->questions->isEmpty()) {
            return ['Add at least one question before publishing.'];
        }

        foreach ($activity->questions as $index => $question) {
            $num = $index + 1;
            $meta = $question->metadata ?? [];
            $manual = ! empty($meta['manual_checking']);

            if (trim($question->body) === '') {
                $errors[] = "Question {$num}: question text is required.";
            } elseif (mb_strlen(trim($question->body)) > 2000) {
                $errors[] = "Question {$num}: question text must be 2,000 characters or fewer.";
            }

            if ($question->timer_seconds !== null && ($question->timer_seconds < 5 || $question->timer_seconds > 3600)) {
                $errors[] = "Question {$num}: the timer must be from 5 to 3,600 seconds.";
            }

            if ($question->type === 'mcq') {
                $choices = $question->choices;
                if ($choices->count() < 2) {
                    $errors[] = "Question {$num}: at least two answer choices are required.";
                }
                if ($choices->count() > 8) {
                    $errors[] = "Question {$num}: use no more than eight answer choices.";
                }

                $texts = [];
                foreach ($choices as $choice) {
                    $text = trim($choice->text);
                    if ($text === '') {
                        $errors[] = "Question {$num}: answer choices cannot be empty.";
                        break;
                    }
                    if (mb_strlen($text) > 500) {
                        $errors[] = "Question {$num}: each answer choice must be 500 characters or fewer.";
                    }
                    $texts[] = mb_strtolower($text);
                }
                if (count($texts) !== count(array_unique($texts))) {
                    $errors[] = "Question {$num}: answer choices must be different from each other.";
                }

                $correct = $choices->where('is_correct', true)->count();
                if (! $manual && $correct === 0) {
                    $errors[] = "Question {$num}: select at least one correct answer or enable manual checking.";
                }
                if (! $manual && empty($meta['allow_multiple_correct']) && $correct > 1) {
                    $errors[] = "Question {$num}: select one correct answer, or allow more than one correct answer.";
                }
            }

            if ($question->type === 'identification') {
                $accepted = array_values(array_filter(array_map(
                    fn ($value) => trim((string) $value),
                    array_merge([$meta['correct_answer'] ?? ''], $meta['alternatives'] ?? [])
                ), fn ($value) => $value !== ''));

                if (! $manual && $accepted === []) {
                    $errors[] = "Question {$num}: add at least one accepted answer or enable manual checking.";
                }
                if (count($accepted) > 11) {
                    $errors[] = "Question {$num}: use no more than 10 alternative answers.";
                }
                if (count(array_unique(array_map('mb_strtolower', $accepted))) !== count($accepted)) {
                    $errors[] = "Question {$num}: accepted answers must be different from each other.";
                }
            }
        }

        return $errors;
    }
}
