<?php

namespace Database\Seeders;

use App\Models\AchievementBadge;
use App\Models\AcademicPeriod;
use App\Models\Activity;
use App\Models\ActivityAssignment;
use App\Models\FacultyProfile;
use App\Models\Program;
use App\Models\Question;
use App\Models\QuestionChoice;
use App\Models\Role;
use App\Models\Section;
use App\Models\StudentAcademicRecord;
use App\Models\StudentProfile;
use App\Models\Tutorial;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = collect([
            Role::PROGRAM_CHAIR,
            Role::SUPER_ADMIN,
            Role::FACULTY,
            Role::STUDENT,
        ])->mapWithKeys(fn ($name) => [$name => Role::create(['name' => $name])]);

        $bshm = Program::create(['slug' => 'bshm', 'name' => 'BS Hospitality Management', 'status' => 'active']);
        $bstm = Program::create(['slug' => 'bstm', 'name' => 'BS Tourism Management', 'status' => 'active']);
        Section::create(['program_id' => $bshm->id, 'name' => '1', 'year_level' => 1, 'semester' => 1, 'status' => 'active']);
        $section2a = Section::create(['program_id' => $bstm->id, 'name' => '1', 'year_level' => 2, 'semester' => 1, 'status' => 'active']);

        $period = AcademicPeriod::create([
            'school_year_start' => 2026,
            'school_year_end' => 2027,
            'semester' => 1,
            'status' => AcademicPeriod::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        User::create([
            'name' => 'Program Chair',
            'email' => 'programchair@reservance.local',
            'password' => Hash::make('password'),
            'role_id' => $roles[Role::PROGRAM_CHAIR]->id,
            'status' => 'active',
        ]);

        User::create([
            'name' => 'Superadmin',
            'email' => 'superadmin@reservance.local',
            'password' => Hash::make('password'),
            'role_id' => $roles[Role::SUPER_ADMIN]->id,
            'status' => 'active',
        ]);

        $faculty = User::create([
            'name' => 'Faculty Demo',
            'email' => 'faculty@reservance.local',
            'password' => Hash::make('password'),
            'role_id' => $roles[Role::FACULTY]->id,
            'status' => 'active',
        ]);
        FacultyProfile::create(['user_id' => $faculty->id, 'department' => 'BSHM / BSTM']);

        $student = User::create([
            'name' => 'Student Demo',
            'email' => 'student@reservance.local',
            'password' => Hash::make('password'),
            'role_id' => $roles[Role::STUDENT]->id,
            'status' => 'active',
        ]);
        $profile = StudentProfile::create([
            'user_id' => $student->id,
            'student_number' => '20240001',
            'first_name' => 'Student',
            'last_name' => 'Demo',
            'program_id' => $bstm->id,
            'section_id' => $section2a->id,
            'year_level' => 2,
            'academic_status' => StudentProfile::ACADEMIC_ACTIVE,
            'current_academic_period_id' => $period->id,
        ]);

        StudentAcademicRecord::create([
            'student_user_id' => $student->id,
            'academic_period_id' => $period->id,
            'program_id' => $profile->program_id,
            'section_id' => $profile->section_id,
            'year_level' => $profile->year_level,
            'status' => StudentAcademicRecord::STATUS_ACTIVE,
            'started_at' => now(),
        ]);

        $activity = Activity::create([
            'created_by' => $faculty->id,
            'title' => 'Intro Quiz',
            'description' => 'Sample quiz for RESERVANCE.',
            'instructions' => 'Answer all questions. One attempt only.',
            'type' => 'quiz',
            'difficulty' => 'easy',
            'status' => 'active',
            'time_limit_minutes' => 15,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addWeek(),
        ]);

        ActivityAssignment::create([
            'activity_id' => $activity->id,
            'scope' => 'section',
            'section_id' => $section2a->id,
        ]);

        $q1 = Question::create([
            'activity_id' => $activity->id,
            'type' => 'mcq',
            'body' => 'What does RESERVANCE manage?',
            'explanation' => 'Academic activities.',
            'timer_seconds' => 60,
            'sort_order' => 0,
        ]);
        foreach ([
            ['A', 'Academic activities', true],
            ['B', 'Inventory only', false],
            ['C', 'Payroll', false],
            ['D', 'None', false],
        ] as [$label, $text, $correct]) {
            QuestionChoice::create([
                'question_id' => $q1->id,
                'label' => $label,
                'text' => $text,
                'is_correct' => $correct,
            ]);
        }

        Question::create([
            'activity_id' => $activity->id,
            'type' => 'identification',
            'body' => 'Policy: one ___ per activity.',
            'explanation' => 'Single attempt.',
            'timer_seconds' => 60,
            'sort_order' => 1,
            'metadata' => ['correct_answer' => 'attempt', 'alternatives' => ['Attempt']],
        ]);

        $simConfig = \App\Services\SimulationEngine::defaultSimulationConfig();
        $simConfig['scenario']['briefing'] = 'Maria Santos needs a Deluxe room (202) for 2 nights at rack rate. Book, check in, then check out with cash payment of ₱7,000.';

        $simulation = Activity::create([
            'created_by' => $faculty->id,
            'title' => 'Front Desk — Full Guest Cycle',
            'description' => 'Hotel reservation simulation: book, check-in, and check-out.',
            'instructions' => 'Use the front desk system to complete the guest workflow.',
            'type' => 'simulation',
            'difficulty' => 'medium',
            'status' => 'active',
            'time_limit_minutes' => 30,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addWeek(),
            'simulation_config' => $simConfig,
        ]);

        ActivityAssignment::create([
            'activity_id' => $simulation->id,
            'scope' => 'section',
            'section_id' => $section2a->id,
        ]);

        foreach ([
            ['first_activity', 'First Activity Completed'],
            ['perfect_score', 'Perfect Score'],
            ['speed_master', 'Speed Master'],
            ['consistent_performer', 'Consistent Performer'],
            ['top_ranker', 'Top Ranker'],
        ] as [$slug, $name]) {
            AchievementBadge::create([
                'slug' => $slug,
                'name' => $name,
                'description' => $name,
                'icon' => $slug,
                'points' => 10,
            ]);
        }

        Tutorial::create([
            'role' => 'student',
            'category' => 'manual',
            'title' => 'How to take an activity',
            'content' => 'Open Activities, select one, read instructions, start, submit.',
            'sort_order' => 1,
        ]);
    }
}
