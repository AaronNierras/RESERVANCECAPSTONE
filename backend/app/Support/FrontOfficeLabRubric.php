<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class FrontOfficeLabRubric
{
    public const KEY = 'front_office';

    public const SIMULATION_TASKS = ['reservations', 'check_in', 'cashier'];

    public const PASSING_PERCENT = 75;

    public static function definition(): array
    {
        return [
            'key' => self::KEY,
            'title' => 'Front Office Laboratory Assessment',
            'passing_points' => 75,
            'passing_percent' => self::PASSING_PERCENT,
            'passing_note' => 'Suggested passing standard: 75 out of 100 points. Rate the student Competent only when every activity reaches 75% of its points. Any activity below that is Not Yet Competent and is repeated with a different scenario.',
            'criteria' => self::criteria(),
            'activities' => self::activities(),
            'preparation' => self::preparation(),
        ];
    }

    public static function criteria(): array
    {
        return [
            [
                'key' => 'process',
                'label' => 'Procedure / Process',
                'share' => 40,
                'description' => 'Checks whether the student follows the correct steps in the right sequence, such as greeting, verifying the reservation, completing registration, assigning a room, and explaining hotel policies during check-in.',
            ],
            [
                'key' => 'accuracy',
                'label' => 'Accuracy of Output',
                'share' => 28,
                'description' => 'Checks whether the forms, folios, and reports are complete, correctly computed, and free of errors, for example correct room rates, dates, taxes, and balances.',
            ],
            [
                'key' => 'communication',
                'label' => 'Communication and Guest Relations',
                'share' => 20,
                'description' => 'Checks courtesy, clarity, telephone etiquette, active listening, and the use of standard hotel phrases.',
            ],
            [
                'key' => 'professionalism',
                'label' => 'Grooming, Professionalism and Time',
                'share' => 12,
                'description' => 'Checks proper uniform and grooming, posture, workstation tidiness, and completing the task within the allotted time.',
            ],
        ];
    }

    public static function activities(): array
    {
        return [
            self::activity('reservations', '1. Taking and Processing Reservations', '1. Reservations', 'Receive and process reservation requests accurately', 6, 0.15, 15, 'Role play (phone and walk-in)', 'Completed reservation form, reservation confirmation slip', 5, [6, 4, 3, 2]),
            self::activity('check_in', '2. Guest Registration and Check-in', '2. Registration and Check-in', 'Register guests and assign rooms following hotel procedure', 8, 0.20, 20, 'Demonstration / role play', 'Completed registration card, room assignment, key card or key issuance log', 8, [8, 6, 4, 2]),
            self::activity('guest_services', '3. Guest Services and Telephone Handling', '3. Guest Services and Telephone', 'Provide information, take messages, and handle guest requests', 6, 0.15, 15, 'Role play', 'Message slip, guest request log, local information sheet', 5, [6, 4, 3, 2]),
            self::activity('complaints', '4. Handling Guest Complaints', '4. Handling Complaints', 'Respond to complaints using a service recovery process', 6, 0.15, 15, 'Role play (scenario cards)', 'Guest complaint/incident report form', 7, [6, 4, 3, 2]),
            self::activity('cashier', '5. Front Office Cashiering and Check-out', '5. Cashiering and Check-out', 'Settle guest accounts and process departure', 8, 0.20, 20, 'Demonstration', 'Accurate guest folio, official receipt, check-out record', 8, [8, 6, 4, 2]),
            self::activity('night_audit', '6. Night Audit and Reports', '6. Night Audit and Reports', 'Prepare end-of-day front office reports', 6, 0.15, 15, 'Output-based (written/computed)', 'Night audit report, daily room status / occupancy report', 60, [6, 4, 3, 2]),
        ];
    }

    public static function preparation(): array
    {
        return [
            [
                'title' => 'Phase 1: Pre-Assessment (Preparation)',
                'steps' => [
                    ['title' => 'Prepare the assessment tools.', 'body' => 'Finalize the scoring rubric for each activity, the scenario cards for role plays, the oral questioning guide, and the blank forms students will fill out: reservation forms, registration cards, guest folios, message slips, complaint reports, and night audit sheets.'],
                    ['title' => 'Set up the mock front desk.', 'body' => 'Arrange the laboratory as a working front office: a front desk counter, telephone, computer or manual room rack, key cards or keys, a cash drawer with play money, a calculator, a bell, brochures, and a guest information directory. If several assessors are present, set up stations so different activities can run at the same time.'],
                    ['title' => 'Prepare the scenarios.', 'body' => 'Write several versions of each scenario, for example a walk-in guest with no reservation, a guest with a guaranteed reservation, an overbooking case, or a guest disputing a charge on the folio. Students draw a card on the day so they cannot memorize one script. Keep the difficulty equal across versions.'],
                    ['title' => 'Assign role players.', 'body' => 'Use co-teachers, trained senior students, or classmates as guests. Brief them on their script so every candidate faces the same level of challenge.'],
                    ['title' => 'Orient the students.', 'body' => 'Ahead of the assessment day, explain the tasks, time limits, criteria, passing score, grooming requirements, and what happens if they do not pass. A self-assessment checklist lets students judge their own readiness beforehand.'],
                ],
            ],
            [
                'title' => 'Phase 2: Assessment Proper',
                'steps' => [
                    ['title' => 'Check attendance and grooming.', 'body' => 'Students report in full uniform. The grooming portion of the score can be recorded at this point.'],
                    ['title' => 'Brief the candidates.', 'body' => 'Restate the instructions, time allotment per task, and conduct rules. Students draw their scenario cards.'],
                    ['title' => 'Run the demonstration and role plays.', 'body' => 'A practical flow is reservation by phone, check-in of the same guest, a guest request or message, a complaint, then check-out and settlement of the folio. Linking the tasks into one guest stay lets outputs carry into the next task. Night audit is a separate written or computed task, often for the whole group, in a 45 to 60 minute session.'],
                    ['title' => 'Observe and score in real time.', 'body' => 'The assessor watches without coaching or interrupting, and marks each criterion as followed, partially followed, or missed. Notes on specific mistakes are used later for feedback.'],
                    ['title' => 'Collect the outputs.', 'body' => 'After each task, the student submits the completed form. Check it for completeness and accuracy against the model output.'],
                    ['title' => 'Conduct oral questioning.', 'body' => 'After the performance, ask two or three questions per task, such as what to do if the guest credit card is declined, or why the guest ID is verified during check-in. Oral questioning is part of the conduct. It is not a separate point column.'],
                    ['title' => 'Suggested time per student.', 'body' => 'About 5 minutes for the reservation, 8 for check-in, 5 for guest services, 7 for the complaint, 8 for check-out, and 5 for oral questioning, around 40 minutes total. Night audit is separate.'],
                ],
            ],
            [
                'title' => 'Phase 3: Post-Assessment',
                'steps' => [
                    ['title' => 'Compute the scores.', 'body' => 'Total the points per activity using procedure, output accuracy, communication, and professionalism. Check each activity against 75% of its points.'],
                    ['title' => 'Decide the result.', 'body' => 'A student who meets the standard in all activities is Competent. A student who falls short in any activity is Not Yet Competent for that activity only.'],
                    ['title' => 'Give feedback right away.', 'body' => 'Explain strengths and the exact step that was missed, for example confirming the room rate without explaining the check-out time.'],
                    ['title' => 'Schedule re-assessment.', 'body' => 'Students who did not pass an activity practice that activity and are re-assessed only on it, using a different scenario card.'],
                    ['title' => 'Record and file.', 'body' => 'Keep the score sheet, outputs, and rubric as evidence for grading and review.'],
                ],
            ],
        ];
    }

    public static function taskKeysForConfig(array $config): array
    {
        $known = array_column(self::activities(), 'key');
        $included = [];
        foreach ($config['scenario']['scoring']['scenarios'] ?? [] as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (array_key_exists('included', $row) && empty($row['included']) && empty($row['action'])) {
                continue;
            }
            $key = (string) ($row['task'] ?? $row['key'] ?? '');
            if (in_array($key, $known, true)) {
                $included[] = $key;
            }
        }

        return $included !== [] ? array_values(array_unique($included)) : self::SIMULATION_TASKS;
    }

    public function normalize(array $marks, ?array $only = null): array
    {
        $clean = [];
        $errors = [];

        foreach (self::activities() as $activity) {
            if ($only !== null && ! in_array($activity['key'], $only, true)) {
                continue;
            }
            $input = $marks[$activity['key']] ?? [];
            if (! is_array($input)) {
                $errors["marks.{$activity['key']}"] = "{$activity['short']} must be a set of scores.";
                continue;
            }

            $row = ['note' => mb_substr(trim((string) ($input['note'] ?? '')), 0, 500)];
            foreach (self::criteria() as $criterion) {
                $max = $activity['criteria'][$criterion['key']];
                $raw = $input[$criterion['key']] ?? null;
                if ($raw === null || $raw === '') {
                    $row[$criterion['key']] = null;
                    continue;
                }
                if (! is_numeric($raw)) {
                    $errors["marks.{$activity['key']}.{$criterion['key']}"] = "{$activity['short']} {$criterion['label']} must be a number.";
                    continue;
                }
                $value = round((float) $raw, 2);
                if ($value < 0 || $value > $max) {
                    $errors["marks.{$activity['key']}.{$criterion['key']}"] = "{$activity['short']} {$criterion['label']} must be from 0 to {$max}.";
                    continue;
                }
                $row[$criterion['key']] = $value;
            }
            $clean[$activity['key']] = $row;
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $clean;
    }

    public function evaluate(array $marks, ?array $only = null): array
    {
        $results = [];
        $earned = 0.0;
        $allScored = true;
        $allPassed = true;
        $activities = array_values(array_filter(
            self::activities(),
            fn (array $activity) => $only === null || in_array($activity['key'], $only, true),
        ));

        foreach ($activities as $activity) {
            $input = $marks[$activity['key']] ?? [];
            $criteria = [];
            $activityEarned = 0.0;
            $complete = true;

            foreach (self::criteria() as $criterion) {
                $max = $activity['criteria'][$criterion['key']];
                $raw = is_array($input) ? ($input[$criterion['key']] ?? null) : null;
                if ($raw === null || $raw === '') {
                    $complete = false;
                    $criteria[] = [
                        'key' => $criterion['key'],
                        'earned' => null,
                        'points' => $max,
                    ];
                    continue;
                }
                $value = round((float) $raw, 2);
                $activityEarned += $value;
                $criteria[] = [
                    'key' => $criterion['key'],
                    'earned' => $value,
                    'points' => $max,
                ];
            }

            $rating = 'not_scored';
            $percent = null;
            if ($complete) {
                $passing = $activity['points'] * self::PASSING_PERCENT / 100;
                $passed = $activityEarned + 0.0001 >= $passing;
                $rating = $passed ? 'competent' : 'not_yet_competent';
                $percent = round(($activityEarned / $activity['points']) * 100, 2);
                $earned += $activityEarned;
                if (! $passed) {
                    $allPassed = false;
                }
            } else {
                $allScored = false;
            }

            $results[] = [
                'key' => $activity['key'],
                'earned' => $complete ? round($activityEarned, 2) : null,
                'points' => $activity['points'],
                'percent' => $percent,
                'rating' => $rating,
                'passing_points' => round($activity['points'] * self::PASSING_PERCENT / 100, 2),
                'criteria' => $criteria,
                'note' => trim((string) (is_array($input) ? ($input['note'] ?? '') : '')),
            ];
        }

        $totalPoints = array_sum(array_column($activities, 'points'));
        $total = $allScored ? round($earned, 2) : null;
        $percentage = $total === null
            ? null
            : ($only === null ? $total : round(($total / max(1, $totalPoints)) * 100, 2));

        return [
            'activities' => $results,
            'earned' => $total,
            'points' => $only === null ? 100 : $totalPoints,
            'percentage' => $percentage,
            'rating' => $allScored ? ($allPassed ? 'competent' : 'not_yet_competent') : 'in_progress',
            'passing_points' => $only === null ? 75 : round($totalPoints * self::PASSING_PERCENT / 100, 2),
        ];
    }

    public function suggestFromOutput(array $flags): array
    {
        $passed = [
            'reservations' => (! empty($flags['guest_details']) && ! empty($flags['reservation'])) || ! empty($flags['reservations']),
            'check_in' => ! empty($flags['check_in']),
            'cashier' => ! empty($flags['check_out']) || ! empty($flags['cashier']),
        ];
        $marks = [];

        foreach (self::activities() as $activity) {
            if (! in_array($activity['key'], self::SIMULATION_TASKS, true)) {
                continue;
            }

            $ok = $passed[$activity['key']] ?? false;
            $marks[$activity['key']] = [
                'process' => $ok ? $activity['criteria']['process'] : 0,
                'accuracy' => $ok ? $activity['criteria']['accuracy'] : 0,
                'communication' => null,
                'professionalism' => null,
                'note' => $ok
                    ? 'The submitted output matched the scenario answer key.'
                    : 'The submitted output did not match the scenario answer key.',
            ];
        }

        return $marks;
    }

    private static function activity(
        string $key,
        string $title,
        string $short,
        string $outcome,
        int $hours,
        float $weight,
        int $points,
        string $method,
        string $output,
        int $minutes,
        array $criteriaPoints,
    ): array {
        return [
            'key' => $key,
            'title' => $title,
            'short' => $short,
            'outcome' => $outcome,
            'hours' => $hours,
            'weight' => $weight,
            'points' => $points,
            'method' => $method,
            'output' => $output,
            'minutes' => $minutes,
            'criteria' => [
                'process' => $criteriaPoints[0],
                'accuracy' => $criteriaPoints[1],
                'communication' => $criteriaPoints[2],
                'professionalism' => $criteriaPoints[3],
            ],
        ];
    }
}
