<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\LabScore;
use App\Models\Program;
use App\Models\Role;
use App\Models\Score;
use App\Models\StudentAttempt;
use App\Models\User;
use App\Support\FrontOfficeLabRubric;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LabAssessmentService
{
    public function __construct(
        private FrontOfficeLabRubric $rubric,
        private AuditLogService $audit,
        private RealtimeService $realtime,
    ) {}

    public function payload(User $viewer): array
    {
        $canScore = $viewer->isFaculty() || $viewer->isProgramChair();
        $payload = [
            'rubric' => FrontOfficeLabRubric::definition(),
            'can_score' => $canScore,
        ];

        if (! $canScore) {
            $payload['record'] = $this->recordFor($viewer);

            return $payload;
        }

        $programs = Program::with('sections')
            ->whereIn('slug', ['bshm', 'bstm'])
            ->orderBy('name')
            ->get();

        $sections = [];
        foreach ($programs as $program) {
            foreach ($program->sections as $section) {
                $section->setRelation('program', $program);
                $sections[] = [
                    'id' => $section->id,
                    'label' => $section->displayLabel(),
                ];
            }
        }

        $students = User::with(['studentProfile.program', 'studentProfile.section.program'])
            ->whereHas('role', fn ($query) => $query->where('name', Role::STUDENT))
            ->orderBy('name')
            ->get();

        $scores = LabScore::where('rubric_key', FrontOfficeLabRubric::KEY)
            ->whereIn('student_user_id', $students->pluck('id'))
            ->get()
            ->keyBy('student_user_id');

        $payload['sections'] = $sections;
        $payload['students'] = $students->map(function (User $student) use ($scores) {
            $profile = $student->studentProfile;
            $section = $profile?->section;
            $stored = $scores->get($student->id);

            return [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'student_number' => $profile?->student_number,
                'section_id' => $profile?->section_id,
                'section_label' => $section ? $section->displayLabel() : 'No section',
                'program' => $profile?->program?->name,
                'record' => $stored ? $this->present($stored) : null,
            ];
        })->values();

        return $payload;
    }

    public function save(User $assessor, User $student, array $input): array
    {
        $student->loadMissing('role');
        if ($student->role?->name !== Role::STUDENT) {
            throw ValidationException::withMessages([
                'student' => ['Choose a student account.'],
            ]);
        }

        $feedback = trim((string) ($input['feedback'] ?? ''));
        if (mb_strlen($feedback) > 2000) {
            throw ValidationException::withMessages([
                'feedback' => ['Feedback must be 2000 characters or fewer.'],
            ]);
        }

        $marks = $this->rubric->normalize($input['marks'] ?? []);
        $evaluation = $this->rubric->evaluate($marks);

        $stored = DB::transaction(function () use ($assessor, $student, $marks, $feedback, $evaluation) {
            $record = LabScore::updateOrCreate(
                [
                    'student_user_id' => $student->id,
                    'rubric_key' => FrontOfficeLabRubric::KEY,
                ],
                [
                    'assessor_user_id' => $assessor->id,
                    'marks' => $marks,
                    'feedback' => $feedback !== '' ? $feedback : null,
                ],
            );

            $this->syncAnalyticsScore($assessor, $student, $evaluation);

            return $record;
        });

        $this->audit->log($assessor, 'score_lab_rubric', 'assessment', request());
        $this->realtime->refresh('scores');
        $this->realtime->refresh('dashboard');

        return $this->present($stored->fresh());
    }

    private function recordFor(User $student): ?array
    {
        $stored = LabScore::where('student_user_id', $student->id)
            ->where('rubric_key', FrontOfficeLabRubric::KEY)
            ->first();

        return $stored ? $this->present($stored) : null;
    }

    private function present(LabScore $stored): array
    {
        $stored->loadMissing('assessor:id,name');

        return [
            'marks' => $stored->marks ?? [],
            'feedback' => $stored->feedback,
            'assessor' => $stored->assessor?->only(['id', 'name']),
            'updated_at' => $stored->updated_at,
            'result' => $this->rubric->evaluate($stored->marks ?? []),
        ];
    }

    private function syncAnalyticsScore(User $assessor, User $student, array $evaluation): void
    {
        $activity = $this->laboratoryActivity($assessor);
        $attempt = StudentAttempt::where('student_user_id', $student->id)
            ->where('activity_id', $activity->id)
            ->first();

        $final = in_array($evaluation['rating'], ['competent', 'not_yet_competent'], true);
        if (! $final) {
            $attempt?->delete();

            return;
        }

        if (! $attempt) {
            $attempt = StudentAttempt::create([
                'student_user_id' => $student->id,
                'activity_id' => $activity->id,
                'status' => 'submitted',
                'started_at' => now(),
                'submitted_at' => now(),
            ]);
        } else {
            $attempt->update([
                'status' => 'submitted',
                'submitted_at' => now(),
                'started_at' => $attempt->started_at ?? now(),
            ]);
        }

        Score::updateOrCreate(
            ['attempt_id' => $attempt->id],
            [
                'raw_score' => $evaluation['earned'],
                'percentage' => $evaluation['percentage'],
                'accuracy' => null,
                'details' => [
                    'laboratory' => true,
                    'rating' => $evaluation['rating'],
                    'activities' => $evaluation['activities'],
                ],
            ],
        );
    }

    private function laboratoryActivity(User $assessor): Activity
    {
        $existing = Activity::query()
            ->where('simulation_config->rubric_key', FrontOfficeLabRubric::KEY)
            ->first();
        if ($existing) {
            return $existing;
        }

        $owner = User::whereHas('role', fn ($query) => $query->where('name', Role::PROGRAM_CHAIR))
            ->orderBy('id')
            ->first() ?? $assessor;

        return Activity::create([
            'created_by' => $owner->id,
            'title' => 'Front Office Laboratory Assessment',
            'description' => 'Output-based front office laboratory scored with the official rubric.',
            'instructions' => 'Passing standard is 75 of 100 points. An activity below 75% of its points is Not Yet Competent and is repeated.',
            'type' => 'assignment',
            'status' => 'closed',
            'simulation_config' => [
                'laboratory' => true,
                'rubric_key' => FrontOfficeLabRubric::KEY,
            ],
        ]);
    }
}
