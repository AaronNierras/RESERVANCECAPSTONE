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
use App\Services\AuditLogService;
use App\Services\NotificationService;
use App\Services\DocumentTextExtractor;
use App\Services\QuestionnaireGenerator;
use App\Services\QuestionImageService;
use App\Services\RealtimeService;
use App\Services\SimulationEngine;
use App\Models\Role;
use App\Models\User;
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
    ) {}

    public function index(Request $request)
    {
        $query = Activity::with(['assignments', 'questions.choices'])->latest();

        if ($request->user()->isFaculty() || $request->user()->isSuperAdmin()) {
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
            'file' => 'required|file|max:10240',
            'type' => 'required|in:activity,quiz,exam',
            'title' => 'required|string|max:255',
            'question_count' => 'required|integer|min:1|max:100',
        ]);

        $extension = strtolower($request->file('file')->getClientOriginalExtension());
        if (! in_array($extension, ['docx', 'pdf'], true)) {
            throw ValidationException::withMessages([
                'file' => ['Upload a Word (.docx) or PDF file. Older .doc files need to be saved as .docx first.'],
            ]);
        }

        try {
            $text = $this->documents->extract($request->file('file'));
            $questions = $this->questionnaires->generate($text, (int) $data['question_count']);
        } catch (\RuntimeException $exception) {
            throw ValidationException::withMessages(['file' => [$exception->getMessage()]]);
        }

        return response()->json([
            'title' => $data['title'],
            'type' => $data['type'],
            'questions' => $questions,
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateActivity($request);

        $activity = DB::transaction(function () use ($request, $data) {
            $activity = Activity::create([
                ...collect($data)->only(['title', 'description', 'instructions', 'type', 'difficulty', 'status', 'time_limit_minutes', 'starts_at', 'ends_at', 'simulation_config'])->all(),
                'created_by' => $request->user()->id,
                'status' => $data['status'] ?? 'draft',
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

        if (in_array($activity->status, ['active', 'closed'], true)) {
            abort(422, 'This assessment cannot be edited while it is active or closed.');
        }

        $data = $this->validateActivity($request, $activity);

        DB::transaction(function () use ($activity, $data) {
            $activity->update(collect($data)->only(['title', 'description', 'instructions', 'type', 'difficulty', 'status', 'time_limit_minutes', 'starts_at', 'ends_at', 'simulation_config'])->filter()->all());
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
        $activity->load('questions.choices', 'assignments');

        $errors = $activity->isCombination()
            ? array_merge(
                $this->validateQuestionsForPublish($activity),
                SimulationEngine::validateConfigForPublish($activity->simulation_config ?? [])
            )
            : ($activity->isSimulation()
                ? SimulationEngine::validateConfigForPublish($activity->simulation_config ?? [])
                : $this->validateQuestionsForPublish($activity));
        if (! empty($errors)) {
            $key = $activity->isSimulation() ? 'simulation_config' : 'questions';
            throw ValidationException::withMessages([$key => $errors]);
        }

        if ($activity->assignments->isEmpty()) {
            throw ValidationException::withMessages(['assignments' => ['Select at least one target audience before publishing.']]);
        }

        if ($activity->starts_at && $activity->ends_at && $activity->ends_at->lessThan($activity->starts_at)) {
            throw ValidationException::withMessages(['ends_at' => ['End time cannot be before start time.']]);
        }

        $activity->update(['status' => 'published']);
        $this->audit->log($request->user(), 'publish_activity', 'activity_factory', $request);

        $superIds = User::whereHas('role', fn ($q) => $q->where('name', Role::SUPER_ADMIN))->pluck('id')->all();
        $this->notifications->notifyUsers($superIds, 'activity_published', 'Activity published', $activity->title);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($activity, true)]);
    }

    public function open(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);

        if ($activity->status !== 'published') {
            abort(422, 'Only published assessments can be opened for students.');
        }

        if ($activity->ends_at && now()->greaterThan($activity->ends_at)) {
            abort(422, 'This assessment has already passed its end time.');
        }

        $activity->update(['status' => 'active']);
        $activity->load('assignments');
        $studentIds = $this->audience->resolveActivityStudentIds($activity);
        if ($studentIds !== []) {
            $this->notifications->notifyUsers(
                $studentIds,
                'activity_opened',
                'New activity available',
                "{$activity->title} is now open. Go to Activities to begin.",
                ['activity_id' => $activity->id, 'activity_type' => $activity->type],
            );
        }
        $this->audit->log($request->user(), 'open_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($activity, true)]);
    }

    public function close(Request $request, Activity $activity)
    {
        $this->authorizeActivityEdit($request, $activity);

        if (! in_array($activity->status, ['published', 'active'], true)) {
            abort(422, 'This assessment cannot be closed from its current state.');
        }

        $activity->update(['status' => 'closed']);
        $this->audit->log($request->user(), 'close_activity', 'activity_factory', $request);
        $this->realtime->refresh('activities');
        $this->realtime->refresh('dashboard');

        return response()->json(['activity' => $this->activityPayload($activity, true)]);
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

    private function validateActivity(Request $request, ?Activity $activity = null): array
    {
        return $request->validate([
            'title' => ($activity ? 'sometimes' : 'required').'|string|max:255',
            'description' => 'nullable|string',
            'instructions' => 'nullable|string',
            'type' => ($activity ? 'sometimes' : 'required').'|in:activity,quiz,exam,assignment,simulation,game,combination',
            'difficulty' => 'nullable|string|max:32',
            'status' => 'nullable|in:draft,scheduled,published,active,closed,archived',
            'time_limit_minutes' => 'nullable|integer|min:1',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'questions' => 'nullable|array',
            'questions.*.type' => 'required_with:questions|in:mcq,identification',
            'questions.*.body' => 'required_with:questions|string',
            'questions.*.explanation' => 'nullable|string',
            'questions.*.timer_seconds' => 'nullable|integer|min:5',
            'questions.*.choices' => 'nullable|array',
            'questions.*.metadata' => 'nullable|array',
            'assignments' => 'nullable|array',
            'assignments.*.scope' => 'required_with:assignments|in:all,program,section,student',
            'assignments.*.program_id' => 'nullable|exists:programs,id',
            'assignments.*.section_id' => 'nullable|exists:sections,id',
            'assignments.*.student_user_id' => 'nullable|exists:users,id',
            'rubric' => 'nullable|array',
            'simulation_config' => 'nullable|array',
        ]);
    }

    private function syncQuestions(Activity $activity, array $questions): void
    {
        foreach ($questions as $index => $qData) {
            $question = Question::create([
                'activity_id' => $activity->id,
                'type' => $qData['type'],
                'body' => $qData['body'],
                'explanation' => $qData['explanation'] ?? null,
                'timer_seconds' => $qData['timer_seconds'] ?? null,
                'sort_order' => $index,
                'metadata' => $qData['metadata'] ?? null,
            ]);

            foreach ($qData['choices'] ?? [] as $choice) {
                QuestionChoice::create([
                    'question_id' => $question->id,
                    'label' => $choice['label'],
                    'text' => $choice['text'],
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
        if ($request->user()->isSuperAdmin()) {
            return;
        }
        if ($request->user()->isFaculty() && $activity->created_by === $request->user()->id) {
            return;
        }
        abort(403);
    }

    private function authorizeActivityEdit(Request $request, Activity $activity): void
    {
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
            }

            if ($question->timer_seconds !== null && $question->timer_seconds < 5) {
                $errors[] = "Question {$num}: minimum 5 seconds.";
            }

            if ($question->type === 'mcq') {
                $choices = $question->choices;
                if ($choices->count() < 2) {
                    $errors[] = "Question {$num}: at least two answer choices are required.";
                }

                foreach ($choices as $choice) {
                    if (trim($choice->text) === '') {
                        $errors[] = "Question {$num}: answer choices cannot be empty.";
                        break;
                    }
                }

                if (! $manual && $choices->where('is_correct', true)->count() === 0) {
                    $errors[] = "Question {$num}: select at least one correct answer or enable manual checking.";
                }
            }

            if ($question->type === 'identification') {
                $accepted = array_filter(array_merge(
                    [($meta['correct_answer'] ?? '')],
                    $meta['alternatives'] ?? []
                ), fn ($v) => trim((string) $v) !== '');

                if (! $manual && empty($accepted)) {
                    $errors[] = "Question {$num}: add at least one accepted answer or enable manual checking.";
                }
            }
        }

        return $errors;
    }
}
