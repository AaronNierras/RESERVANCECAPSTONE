<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Score;
use App\Models\StudentAttempt;
use App\Models\User;
use App\Support\FrontOfficeLabRubric;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class SimulationEngine
{
    public function __construct(
        private AssessmentEngine $assessment,
        private LeaderboardService $leaderboards,
        private BadgeService $badges,
        private NotificationService $notifications,
    ) {}

    public function startAttempt(User $student, Activity $activity): array
    {
        if (! $activity->hasSimulation()) {
            throw new HttpException(422, 'Activity is not a simulation.');
        }

        $config = $activity->simulation_config ?? [];
        $attempt = $this->assessment->startAttempt($student, $activity);

        if (! $attempt->simulation_state) {
            $attempt->update([
                'simulation_state' => $this->buildInitialState($config),
            ]);
            $attempt->refresh();
        }

        return [
            'attempt' => $attempt->only(['id', 'status', 'started_at', 'server_deadline_at']),
            'hotel' => $this->getStudentView($activity, $attempt),
        ];
    }

    public function getStudentView(Activity $activity, StudentAttempt $attempt): array
    {
        $config = $activity->simulation_config ?? [];
        $state = $attempt->simulation_state ?? [];

        $reservations = $state['reservations'] ?? [];
        $folios = $state['folios'] ?? [];
        $sheet = $this->scoringSheet($config);
        $manual = $sheet && ! empty($sheet['manual_computation']);
        if ($manual) {
            $reservations = array_map(function (array $row) {
                unset($row['total'], $row['rate_per_night']);

                return $row;
            }, $reservations);
            $folios = array_map(function (array $row) {
                unset($row['total']);

                return $row;
            }, $folios);
        }

        $triesLeft = [];
        if ($sheet) {
            $misses = $state['misses'] ?? [];
            foreach (['reservations', 'check_in', 'cashier'] as $key) {
                $triesLeft[$key] = max(0, 3 - (int) ($misses[$key] ?? 0));
            }
        }

        return [
            'hotel_name' => $config['hotel_name'] ?? 'RESERVANCE Grand Hotel',
            'briefing' => $config['scenario']['briefing'] ?? $activity->instructions,
            'room_types' => $config['room_types'] ?? [],
            'rooms' => $state['rooms'] ?? [],
            'reservations' => $reservations,
            'folios' => $folios,
            'actions' => $state['actions'] ?? [],
            'manual_computation' => $manual,
            'scenarios' => self::publicScenarios($config),
            'tries_left' => $triesLeft,
        ];
    }

    public function bookRoom(StudentAttempt $attempt, array $data): array
    {
        $this->ensureInProgress($attempt);
        $attempt->load('activity');
        $config = $attempt->activity->simulation_config ?? [];
        $state = $attempt->simulation_state ?? $this->buildInitialState($config);

        $guestLast = trim($data['guest_last_name'] ?? '');
        $guestFirst = trim($data['guest_first_name'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $arrivalDate = trim($data['arrival_date'] ?? '');
        $nights = max(1, (int) ($data['nights'] ?? 1));
        $guests = max(1, (int) ($data['guests'] ?? 1));
        $roomType = trim($data['room_type'] ?? '');
        $roomNumber = trim($data['room_number'] ?? '');
        $rateType = strtolower(trim($data['rate_type'] ?? 'rack'));

        if ($guestLast === '' || $guestFirst === '' || $phone === '' || $arrivalDate === '' || $roomType === '' || $roomNumber === '') {
            throw ValidationException::withMessages(['booking' => ['All guest and booking fields are required.']]);
        }

        $roomIndex = $this->findRoomIndex($state['rooms'], $roomNumber);
        if ($roomIndex === null) {
            throw ValidationException::withMessages(['room_number' => ['Room not found.']]);
        }

        $room = $state['rooms'][$roomIndex];
        if ($room['status'] !== 'available') {
            throw ValidationException::withMessages(['room_number' => ['Room is not available.']]);
        }

        $typeDef = collect($config['room_types'] ?? [])->firstWhere('code', $roomType);
        if (! $typeDef) {
            throw ValidationException::withMessages(['room_type' => ['Invalid room type.']]);
        }

        if ($room['room_type'] !== $roomType) {
            throw ValidationException::withMessages(['room_type' => ['Room type does not match selected room.']]);
        }

        if ($guests > ($typeDef['max_guests'] ?? 99)) {
            throw ValidationException::withMessages(['guests' => ['Guest count exceeds room capacity.']]);
        }

        $rate = $typeDef['rates'][$rateType] ?? null;
        if ($rate === null) {
            throw ValidationException::withMessages(['rate_type' => ['Invalid rate type.']]);
        }

        $scoring = $this->scoringSheet($config);
        if ($scoring && $this->scenarioIncluded($scoring, 'reservations')) {
            $expectedTotal = (float) $rate * $nights;
            $manual = ! empty($scoring['manual_computation']);
            $computed = $data['computed_total'] ?? null;
            if ($manual && ! is_numeric($computed)) {
                throw ValidationException::withMessages([
                    'computed_total' => ['Compute the stay total yourself and enter it. The system will not calculate it for you.'],
                ]);
            }
            $computedOk = ! $manual || abs((float) $computed - $expectedTotal) < 0.01;
            $matches = $this->bookingMatches($config, [
                'guest_last_name' => $guestLast,
                'guest_first_name' => $guestFirst,
                'phone' => $phone,
                'arrival_date' => $arrivalDate,
                'nights' => $nights,
                'guests' => $guests,
                'room_type' => $roomType,
                'room_number' => $roomNumber,
                'rate_type' => $rateType,
            ]);
            if (! $matches || ! $computedOk) {
                $this->rejectTry($attempt, $state, 'reservations', $scoring);
            }
        }

        $reservationId = 'RES-'.(count($state['reservations'] ?? []) + 1);
        $reservation = [
            'id' => $reservationId,
            'guest_last_name' => $guestLast,
            'guest_first_name' => $guestFirst,
            'phone' => $phone,
            'arrival_date' => $arrivalDate,
            'nights' => $nights,
            'guests' => $guests,
            'room_type' => $roomType,
            'room_number' => $roomNumber,
            'rate_type' => $rateType,
            'rate_per_night' => $rate,
            'total' => $rate * $nights,
            'status' => 'booked',
        ];

        $state['rooms'][$roomIndex]['status'] = 'booked';
        $state['reservations'] = array_merge($state['reservations'] ?? [], [$reservation]);
        $state['actions'] = array_merge($state['actions'] ?? [], [[
            'type' => 'book',
            'at' => now()->toIso8601String(),
            'reservation_id' => $reservationId,
        ]]);

        $attempt->update(['simulation_state' => $state]);

        return $this->getStudentView($attempt->activity, $attempt->fresh());
    }

    public function checkIn(StudentAttempt $attempt, array $data): array
    {
        $this->ensureInProgress($attempt);
        $attempt->load('activity');
        $config = $attempt->activity->simulation_config ?? [];
        $state = $attempt->simulation_state ?? [];

        $reservationId = trim($data['reservation_id'] ?? '');
        if ($reservationId === '') {
            throw ValidationException::withMessages(['reservation_id' => ['Select a reservation to check in.']]);
        }

        $resIndex = $this->findReservationIndex($state['reservations'] ?? [], $reservationId);
        if ($resIndex === null) {
            throw ValidationException::withMessages(['reservation_id' => ['Reservation not found.']]);
        }

        $reservation = $state['reservations'][$resIndex];
        if ($reservation['status'] !== 'booked') {
            throw ValidationException::withMessages(['reservation_id' => ['Reservation is not eligible for check-in.']]);
        }

        $roomIndex = $this->findRoomIndex($state['rooms'], $reservation['room_number']);
        if ($roomIndex === null || $state['rooms'][$roomIndex]['status'] !== 'booked') {
            throw ValidationException::withMessages(['reservation_id' => ['Room is not in booked status.']]);
        }

        $scoring = $this->scoringSheet($config);
        if ($scoring && $this->scenarioIncluded($scoring, 'check_in') && ! $this->reservationMatchesTarget($config, $reservation)) {
            $this->rejectTry($attempt, $state, 'check_in', $scoring);
        }

        $state['reservations'][$resIndex]['status'] = 'checked_in';
        $state['rooms'][$roomIndex]['status'] = 'occupied';
        $state['actions'] = array_merge($state['actions'] ?? [], [[
            'type' => 'check_in',
            'at' => now()->toIso8601String(),
            'reservation_id' => $reservationId,
        ]]);

        $attempt->update(['simulation_state' => $state]);

        return $this->getStudentView($attempt->activity, $attempt->fresh());
    }

    public function checkOut(StudentAttempt $attempt, array $data): array
    {
        $this->ensureInProgress($attempt);
        $attempt->load('activity');
        $config = $attempt->activity->simulation_config ?? [];
        $state = $attempt->simulation_state ?? [];

        $reservationId = trim($data['reservation_id'] ?? '');
        $paymentType = strtolower(trim($data['payment_type'] ?? 'cash'));
        $amountTendered = (float) ($data['amount_tendered'] ?? 0);

        if ($reservationId === '') {
            throw ValidationException::withMessages(['reservation_id' => ['Select a reservation to check out.']]);
        }

        $resIndex = $this->findReservationIndex($state['reservations'] ?? [], $reservationId);
        if ($resIndex === null) {
            throw ValidationException::withMessages(['reservation_id' => ['Reservation not found.']]);
        }

        $reservation = $state['reservations'][$resIndex];
        if ($reservation['status'] !== 'checked_in') {
            throw ValidationException::withMessages(['reservation_id' => ['Guest must be checked in before check-out.']]);
        }

        $roomIndex = $this->findRoomIndex($state['rooms'], $reservation['room_number']);
        if ($roomIndex === null) {
            throw ValidationException::withMessages(['reservation_id' => ['Room not found.']]);
        }

        $scoring = $this->scoringSheet($config);
        if ($scoring && $this->scenarioIncluded($scoring, 'cashier')) {
            $computed = $data['computed_total'] ?? null;
            if (! is_numeric($computed)) {
                throw ValidationException::withMessages([
                    'computed_total' => ['Compute the bill yourself and enter it. The system will not calculate it for you.'],
                ]);
            }
            $target = $config['scenario']['check_out'] ?? [];
            $expected = is_numeric($target['folio_total'] ?? null)
                ? (float) $target['folio_total']
                : (float) ($reservation['total'] ?? 0);
            $paymentOk = strtolower($paymentType) === strtolower((string) ($target['payment_type'] ?? 'cash'));
            $tenderTarget = is_numeric($target['amount_tendered'] ?? null) ? (float) $target['amount_tendered'] : $expected;
            $tenderOk = abs($amountTendered - $tenderTarget) < 0.01;
            $computedOk = abs((float) $computed - $expected) < 0.01;
            if (! $paymentOk || ! $tenderOk || ! $computedOk) {
                $this->rejectTry($attempt, $state, 'cashier', $scoring);
            }
        }

        $folio = [
            'reservation_id' => $reservationId,
            'guest' => "{$reservation['guest_first_name']} {$reservation['guest_last_name']}",
            'room_number' => $reservation['room_number'],
            'total' => $reservation['total'],
            'payment_type' => $paymentType,
            'amount_tendered' => $amountTendered,
            'checked_out_at' => now()->toIso8601String(),
        ];

        $state['reservations'][$resIndex]['status'] = 'checked_out';
        $state['rooms'][$roomIndex]['status'] = 'available';
        $state['folios'] = array_merge($state['folios'] ?? [], [$folio]);
        $state['actions'] = array_merge($state['actions'] ?? [], [[
            'type' => 'check_out',
            'at' => now()->toIso8601String(),
            'reservation_id' => $reservationId,
            'payment_type' => $paymentType,
            'amount_tendered' => $amountTendered,
        ]]);

        $attempt->update(['simulation_state' => $state]);

        return $this->getStudentView($attempt->activity, $attempt->fresh());
    }

    public function submit(StudentAttempt $attempt): Score
    {
        if ($attempt->status === 'submitted') {
            return $attempt->score ?? $this->gradeAttempt($attempt);
        }

        if ($attempt->status !== 'in_progress') {
            throw new HttpException(403, 'Attempt cannot be submitted.');
        }

        return DB::transaction(function () use ($attempt) {
            $attempt->load('activity');
            $state = $attempt->simulation_state ?? [];
            $grading = $this->gradeAttempt($attempt, $state);

            $attempt->update([
                'status' => 'submitted',
                'submitted_at' => now(),
                'simulation_submission' => [
                    'state' => $state,
                    'grading' => $grading['criteria'],
                ],
            ]);

            $fresh = $attempt->fresh()->load('student.studentProfile', 'activity');
            $score = $this->persistScore($fresh, $grading);

            $this->leaderboards->recomputeForActivity($fresh->activity_id);
            $profile = $fresh->student->studentProfile;
            if ($profile?->program_id) {
                $this->leaderboards->recomputeForProgram($profile->program_id);
            }
            $this->leaderboards->recomputeSemester();
            $this->badges->evaluateAfterScore($fresh, $score);

            $activity = $fresh->activity;
            if ($activity->creator) {
                $this->notifications->notifyUser(
                    $activity->creator,
                    'activity_completed',
                    'Student finished simulation',
                    "{$fresh->student->name} completed {$activity->title}."
                );
            }

            return $score;
        });
    }

    public function gradeAttempt(StudentAttempt $attempt, ?array $state = null): array
    {
        $attempt->load('activity');
        $config = $attempt->activity->simulation_config ?? [];
        $state = $state ?? $attempt->simulation_state ?? [];
        $scenario = $config['scenario'] ?? [];
        $criteriaDefs = $config['grading']['criteria'] ?? $this->defaultCriteria();

        $reservations = collect($state['reservations'] ?? []);
        $folios = collect($state['folios'] ?? []);
        $targetGuest = $scenario['guest'] ?? [];
        $targetRes = $scenario['reservation'] ?? [];
        $targetCheckOut = $scenario['check_out'] ?? [];

        $matchedReservation = $reservations->first(function ($r) use ($targetGuest, $targetRes) {
            return $this->normalize($r['guest_last_name'] ?? '') === $this->normalize($targetGuest['last_name'] ?? '')
                && $this->normalize($r['guest_first_name'] ?? '') === $this->normalize($targetGuest['first_name'] ?? '')
                && $this->normalizePhone($r['phone'] ?? '') === $this->normalizePhone($targetGuest['phone'] ?? '')
                && ($r['arrival_date'] ?? '') === ($targetRes['arrival_date'] ?? '')
                && (int) ($r['nights'] ?? 0) === (int) ($targetRes['nights'] ?? 0)
                && (int) ($r['guests'] ?? 0) === (int) ($targetRes['guests'] ?? 0)
                && ($r['room_type'] ?? '') === ($targetRes['room_type'] ?? '')
                && ($r['room_number'] ?? '') === ($targetRes['room_number'] ?? '')
                && strtolower($r['rate_type'] ?? '') === strtolower($targetRes['rate_type'] ?? 'rack');
        });

        $guestOk = $matchedReservation !== null;
        $reservationOk = $matchedReservation !== null && in_array($matchedReservation['status'] ?? '', ['booked', 'checked_in', 'checked_out'], true);

        $checkInRequired = ! empty($scenario['check_in']['required']);
        $checkInOk = ! $checkInRequired || $reservations->contains(fn ($r) => in_array($r['status'] ?? '', ['checked_in', 'checked_out'], true)
            && ($r['room_number'] ?? '') === ($targetRes['room_number'] ?? ''));

        $checkOutRequired = ! empty($scenario['check_out']['required']);
        $checkOutOk = false;
        if ($checkOutRequired) {
            $folio = $folios->firstWhere('reservation_id', $matchedReservation['id'] ?? null);
            if ($folio) {
                $checkOutOk = strtolower($folio['payment_type'] ?? '') === strtolower($targetCheckOut['payment_type'] ?? 'cash')
                    && abs((float) ($folio['amount_tendered'] ?? 0) - (float) ($targetCheckOut['amount_tendered'] ?? $folio['total'] ?? 0)) < 0.01
                    && abs((float) ($folio['total'] ?? 0) - (float) ($targetCheckOut['folio_total'] ?? $folio['total'] ?? 0)) < 0.01;
            }
        } else {
            $checkOutOk = true;
        }

        $flags = [
            'guest_details' => $guestOk,
            'reservation' => $reservationOk,
            'check_in' => $checkInOk,
            'check_out' => $checkOutOk,
        ];

        $criteria = [];
        $earned = 0;
        $maxPoints = 0;
        $sheet = $this->scoringSheet($config);

        if ($sheet) {
            [$criteria, $earned, $maxPoints] = $this->scoreNumberedScenarios($sheet, $state, [
                'reservations' => $guestOk && $reservationOk,
                'check_in' => $checkInOk,
                'cashier' => $checkOutOk,
            ]);
        } else {
            foreach ($criteriaDefs as $def) {
                $key = $def['key'];
                $points = (float) ($def['points'] ?? 0);
                $maxPoints += $points;
                $passed = $flags[$key] ?? false;
                $earnedPoints = $passed ? $points : 0;
                $earned += $earnedPoints;
                $criteria[] = [
                    'key' => $key,
                    'label' => $def['label'] ?? $key,
                    'points' => $points,
                    'earned' => $earnedPoints,
                    'passed' => $passed,
                ];
            }
        }

        if ($attempt->activity->isCombination()) {
            $questionRaw = (float) ($attempt->score?->raw_score ?? 0);
            $questionMax = max(1, $attempt->activity->questions()->count());
            $earned += $questionRaw;
            $maxPoints += $questionMax;
        }

        $maxPoints = max(1, $maxPoints);
        $percentage = round(($earned / $maxPoints) * 100, 2);

        return [
            'criteria' => $criteria,
            'raw_score' => $earned,
            'max_points' => $maxPoints,
            'percentage' => $percentage,
            'accuracy' => $percentage,
        ];
    }

    public static function defaultSimulationConfig(): array
    {
        return [
            'hotel_name' => 'RESERVANCE Grand Hotel',
            'room_types' => [
                ['code' => 'STD', 'label' => 'Standard', 'max_guests' => 2, 'rates' => ['rack' => 2500, 'discount' => 2000]],
                ['code' => 'DLX', 'label' => 'Deluxe', 'max_guests' => 3, 'rates' => ['rack' => 3500, 'discount' => 2800]],
            ],
            'rooms' => [
                ['number' => '101', 'room_type' => 'STD', 'status' => 'available'],
                ['number' => '102', 'room_type' => 'STD', 'status' => 'available'],
                ['number' => '201', 'room_type' => 'DLX', 'status' => 'available'],
                ['number' => '202', 'room_type' => 'DLX', 'status' => 'available'],
            ],
            'scenario' => [
                'briefing' => 'A guest calls to book a Deluxe room for 2 nights. Check them in on arrival, then check them out.',
                'guest' => ['last_name' => 'Santos', 'first_name' => 'Maria', 'phone' => '09171234567'],
                'reservation' => [
                    'arrival_date' => now()->addDay()->format('Y-m-d'),
                    'nights' => 2,
                    'guests' => 2,
                    'room_type' => 'DLX',
                    'room_number' => '202',
                    'rate_type' => 'rack',
                ],
                'check_in' => ['required' => true],
                'check_out' => [
                    'required' => true,
                    'folio_total' => 7000,
                    'payment_type' => 'cash',
                    'amount_tendered' => 7000,
                ],
                'scoring' => [
                    'tries' => 3,
                    'deduction' => 2,
                    'manual_computation' => true,
                    'scenarios' => [
                        ['id' => 'reservations', 'task' => 'reservations', 'action' => 'reservations', 'title' => 'Taking and Processing Reservations', 'instruction' => 'Take the reservation from the briefing and compute the stay total yourself.', 'image_url' => '', 'image_path' => ''],
                        ['id' => 'check_in', 'task' => 'check_in', 'action' => 'check_in', 'title' => 'Guest Registration and Check-in', 'instruction' => 'Register the same guest and assign the room from the briefing.', 'image_url' => '', 'image_path' => ''],
                        ['id' => 'guest_services', 'task' => 'guest_services', 'action' => 'instruction', 'title' => 'Guest Services and Telephone Handling', 'instruction' => 'Follow the guest-service instruction on this card.', 'image_url' => '', 'image_path' => ''],
                        ['id' => 'complaints', 'task' => 'complaints', 'action' => 'instruction', 'title' => 'Handling Guest Complaints', 'instruction' => 'Follow the complaint instruction on this card.', 'image_url' => '', 'image_path' => ''],
                        ['id' => 'cashier', 'task' => 'cashier', 'action' => 'cashier', 'title' => 'Front Office Cashiering and Check-out', 'instruction' => 'Compute the bill yourself, then collect the correct payment.', 'image_url' => '', 'image_path' => ''],
                    ],
                ],
            ],
            'grading' => [
                'criteria' => self::defaultCriteria(),
            ],
        ];
    }

    public static function defaultCriteria(): array
    {
        return [
            ['key' => 'guest_details', 'label' => 'Guest details correct', 'points' => 15],
            ['key' => 'reservation', 'label' => 'Reservation correct', 'points' => 35],
            ['key' => 'check_in', 'label' => 'Check-in completed', 'points' => 25],
            ['key' => 'check_out', 'label' => 'Check-out completed', 'points' => 25],
        ];
    }

    public static function validateConfigForPublish(array $config): array
    {
        $errors = [];
        $hotel = trim((string) ($config['hotel_name'] ?? ''));
        if ($hotel === '') {
            $errors[] = 'Hotel name is required.';
        } elseif (mb_strlen($hotel) > 120) {
            $errors[] = 'Hotel name must be 120 characters or fewer.';
        }

        $types = $config['room_types'] ?? [];
        if (! is_array($types) || $types === []) {
            $errors[] = 'Add at least one room type.';
            $types = [];
        } elseif (count($types) > 20) {
            $errors[] = 'Use no more than 20 room types.';
        }

        $codes = [];
        foreach ($types as $index => $type) {
            if (! is_array($type)) {
                $errors[] = 'Room type '.($index + 1).' is incomplete.';
                continue;
            }
            $number = $index + 1;
            $code = trim((string) ($type['code'] ?? ''));
            $label = trim((string) ($type['label'] ?? ''));
            if ($code === '' || ! preg_match('/^[A-Za-z0-9]{1,8}$/', $code)) {
                $errors[] = "Room type {$number} needs a short code of letters and numbers.";
            } elseif (isset($codes[strtoupper($code)])) {
                $errors[] = 'Room type codes must be unique.';
            }
            $codes[strtoupper($code)] = $type;
            if ($label === '' || mb_strlen($label) > 40) {
                $errors[] = "Room type {$number} needs a display name of 40 characters or fewer.";
            }
            $guests = $type['max_guests'] ?? null;
            if (! is_numeric($guests) || (int) $guests < 1 || (int) $guests > 20 || (int) $guests != $guests) {
                $errors[] = "Room type {$number} must allow 1 to 20 guests.";
            }
            $rack = $type['rates']['rack'] ?? null;
            $promo = $type['rates']['discount'] ?? null;
            if (! is_numeric($rack) || (float) $rack < 0 || (float) $rack > 1000000) {
                $errors[] = "Room type {$number} needs a regular rate of 0 or more.";
            } elseif (! is_numeric($promo) || (float) $promo < 0 || (float) $promo > (float) $rack) {
                $errors[] = "Room type {$number}: the promo rate cannot be higher than the regular rate.";
            }
        }

        $rooms = $config['rooms'] ?? [];
        if (! is_array($rooms) || $rooms === []) {
            $errors[] = 'Add at least one room.';
            $rooms = [];
        } elseif (count($rooms) > 200) {
            $errors[] = 'Use no more than 200 rooms.';
        }

        $numbers = [];
        $available = 0;
        foreach ($rooms as $index => $room) {
            if (! is_array($room)) {
                $errors[] = 'Room '.($index + 1).' is incomplete.';
                continue;
            }
            $number = trim((string) ($room['number'] ?? ''));
            if ($number === '' || mb_strlen($number) > 10) {
                $errors[] = 'Room '.($index + 1).' needs a room number.';
            } elseif (isset($numbers[strtolower($number)])) {
                $errors[] = 'Room numbers must be unique.';
            }
            $numbers[strtolower($number)] = $room;
            $typeCode = strtoupper(trim((string) ($room['room_type'] ?? '')));
            if (! isset($codes[$typeCode])) {
                $errors[] = "Room {$number} must use a room type from the list.";
            }
            if (! in_array($room['status'] ?? '', ['available', 'booked', 'occupied'], true)) {
                $errors[] = "Room {$number} has an unknown starting status.";
            }
            if (($room['status'] ?? '') === 'available') {
                $available++;
            }
        }
        if ($rooms !== [] && $available < 1) {
            $errors[] = 'At least one room must start as available.';
        }

        $briefing = trim((string) ($config['scenario']['briefing'] ?? ''));
        if ($briefing === '') {
            $errors[] = 'The student briefing is required.';
        } elseif (mb_strlen($briefing) > 2000) {
            $errors[] = 'The briefing must be 2,000 characters or fewer.';
        }

        $guest = $config['scenario']['guest'] ?? [];
        $first = trim((string) ($guest['first_name'] ?? ''));
        $last = trim((string) ($guest['last_name'] ?? ''));
        $phone = trim((string) ($guest['phone'] ?? ''));
        if ($first === '' || $last === '' || mb_strlen($first) > 80 || mb_strlen($last) > 80) {
            $errors[] = 'Scenario guest first and last name are required.';
        }
        if (! preg_match('/^[0-9+\-\s()]{7,20}$/', $phone)) {
            $errors[] = 'Scenario guest phone must be 7 to 20 digits.';
        }

        $reservation = $config['scenario']['reservation'] ?? [];
        $roomNumber = strtolower(trim((string) ($reservation['room_number'] ?? '')));
        $roomType = strtoupper(trim((string) ($reservation['room_type'] ?? '')));
        $matched = $numbers[$roomNumber] ?? null;
        if ($roomNumber === '' || $roomType === '') {
            $errors[] = 'Scenario reservation room type and room number are required.';
        } elseif (! $matched) {
            $errors[] = 'The answer-key room number must be one of the hotel rooms.';
        } elseif (strtoupper(trim((string) ($matched['room_type'] ?? ''))) !== $roomType) {
            $errors[] = 'The answer-key room type must match that room.';
        } elseif (($matched['status'] ?? '') !== 'available') {
            $errors[] = 'The answer-key room must start as available.';
        }

        $arrival = trim((string) ($reservation['arrival_date'] ?? ''));
        if ($arrival === '' || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $arrival) || strtotime($arrival) === false) {
            $errors[] = 'The answer-key arrival date is required.';
        }
        $nights = $reservation['nights'] ?? null;
        if (! is_numeric($nights) || (int) $nights < 1 || (int) $nights > 30 || (int) $nights != $nights) {
            $errors[] = 'The stay must be from 1 to 30 nights.';
        }
        $party = $reservation['guests'] ?? null;
        $capacity = isset($codes[$roomType]) ? (int) ($codes[$roomType]['max_guests'] ?? 0) : 0;
        if (! is_numeric($party) || (int) $party < 1 || (int) $party != $party || ($capacity > 0 && (int) $party > $capacity)) {
            $errors[] = 'The guest count must fit the selected room type.';
        }
        if (! in_array(strtolower((string) ($reservation['rate_type'] ?? 'rack')), ['rack', 'discount'], true)) {
            $errors[] = 'The price to charge must be the regular or promo rate.';
        }

        $checkOut = $config['scenario']['check_out'] ?? [];
        if (! empty($checkOut['required'])) {
            $folio = $checkOut['folio_total'] ?? null;
            $tendered = $checkOut['amount_tendered'] ?? null;
            $payment = strtolower((string) ($checkOut['payment_type'] ?? ''));
            if (! is_numeric($folio) || (float) $folio < 0) {
                $errors[] = 'The bill total must be zero or more.';
            }
            if (! in_array($payment, ['cash', 'card'], true)) {
                $errors[] = 'Payment must be cash or card.';
            }
            if (! is_numeric($tendered) || (float) $tendered < 0) {
                $errors[] = 'The amount tendered must be zero or more.';
            } elseif ($payment === 'cash' && is_numeric($folio) && (float) $tendered + 0.001 < (float) $folio) {
                $errors[] = 'Cash tendered must cover the bill.';
            } elseif ($payment === 'card' && is_numeric($folio) && abs((float) $tendered - (float) $folio) > 0.01) {
                $errors[] = 'A card payment must match the bill total.';
            }
        }

        $sheet = $config['scenario']['scoring'] ?? null;
        if (is_array($sheet) && ($sheet['scenarios'] ?? []) !== []) {
            $deduction = $sheet['deduction'] ?? null;
            if (! is_numeric($deduction) || (int) $deduction < 0 || (int) $deduction > 20 || (int) $deduction != $deduction) {
                $errors[] = 'The deduction for a wrong try must be a whole number from 0 to 20.';
            }
            $known = array_column(FrontOfficeLabRubric::activities(), 'key');
            $actions = ['reservations', 'check_in', 'cashier', 'instruction'];
            $included = 0;
            $usedActions = [];
            foreach ($sheet['scenarios'] as $index => $row) {
                if (! is_array($row) || ! self::scenarioRowActive($row)) {
                    continue;
                }
                $included++;
                $number = $index + 1;
                $task = self::scenarioTask($row);
                $action = self::scenarioAction($row);
                if (! in_array($task, $known, true)) {
                    $errors[] = "Scenario {$number} needs a laboratory point range.";
                }
                if (! in_array($action, $actions, true)) {
                    $errors[] = "Scenario {$number} needs a student task.";
                } elseif ($action !== 'instruction' && isset($usedActions[$action])) {
                    $errors[] = 'Each front-desk step can belong to one scenario. Use Follow this instruction for the extra situations.';
                }
                $usedActions[$action] = true;
                $title = trim((string) ($row['title'] ?? ''));
                if (($title === '' && ! isset($row['key'])) || mb_strlen($title) > 120) {
                    $errors[] = 'Each scenario needs a title of 120 characters or fewer.';
                }
                $instruction = trim((string) ($row['instruction'] ?? ''));
                if ($instruction === '') {
                    $errors[] = 'Each scenario needs the instruction students must follow.';
                } elseif (mb_strlen($instruction) > 2000) {
                    $errors[] = 'Each scenario instruction must be 2,000 characters or fewer.';
                }
                $image = (string) ($row['image_url'] ?? '');
                if (mb_strlen($image) > 500) {
                    $errors[] = 'A scenario image address is too long.';
                }
            }
            if ($included < 1) {
                $errors[] = 'Add at least one scenario.';
            } elseif ($included > 12) {
                $errors[] = 'Use no more than 12 scenarios.';
            }
        }

        return array_values(array_unique($errors));
    }

    private function persistScore(StudentAttempt $attempt, array $grading): Score
    {
        $seconds = $attempt->started_at && $attempt->submitted_at
            ? max(0, (int) $attempt->started_at->diffInSeconds($attempt->submitted_at))
            : null;

        return Score::updateOrCreate(
            ['attempt_id' => $attempt->id],
            [
                'raw_score' => $grading['raw_score'],
                'percentage' => $grading['percentage'],
                'accuracy' => $grading['accuracy'],
                'completion_seconds' => $seconds,
                'details' => [
                    'type' => 'simulation',
                    'criteria' => $grading['criteria'],
                    'max_points' => $grading['max_points'],
                ],
            ]
        );
    }

    private function buildInitialState(array $config): array
    {
        $rooms = collect($config['rooms'] ?? [])->map(fn ($r) => [
            'number' => $r['number'],
            'room_type' => $r['room_type'],
            'status' => $r['status'] ?? 'available',
        ])->values()->all();

        return [
            'rooms' => $rooms,
            'reservations' => [],
            'folios' => [],
            'actions' => [],
        ];
    }

    private function ensureInProgress(StudentAttempt $attempt): void
    {
        if ($attempt->status !== 'in_progress') {
            throw new HttpException(403, 'Attempt is not in progress.');
        }

        if ($attempt->server_deadline_at && now()->greaterThan($attempt->server_deadline_at)) {
            throw new HttpException(403, 'Time expired.');
        }
    }

    private function findRoomIndex(array $rooms, string $number): ?int
    {
        foreach ($rooms as $i => $room) {
            if (($room['number'] ?? '') === $number) {
                return $i;
            }
        }

        return null;
    }

    private function findReservationIndex(array $reservations, string $id): ?int
    {
        foreach ($reservations as $i => $res) {
            if (($res['id'] ?? '') === $id) {
                return $i;
            }
        }

        return null;
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim($value));
    }

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    public static function publicScenarios(array $config): array
    {
        $sheet = $config['scenario']['scoring'] ?? null;
        if (! is_array($sheet)) {
            return [];
        }

        $catalog = collect(FrontOfficeLabRubric::activities())->keyBy('key');
        $cards = [];
        $number = 1;
        foreach ($sheet['scenarios'] ?? [] as $row) {
            if (! is_array($row) || ! self::scenarioRowActive($row)) {
                continue;
            }
            $task = $catalog->get(self::scenarioTask($row));
            if (! $task) {
                continue;
            }
            $action = self::scenarioAction($row);
            $title = trim((string) ($row['title'] ?? ''));
            $cards[] = [
                'id' => (string) ($row['id'] ?? $task['key'].'-'.$number),
                'number' => $number,
                'key' => $action === 'instruction' ? (string) ($row['id'] ?? $task['key']) : $action,
                'action' => $action,
                'title' => $title !== '' ? $title : $task['short'],
                'points' => $task['points'],
                'range' => $task['criteria']['process'].' / '.$task['criteria']['accuracy'].' / '.$task['criteria']['communication'].' / '.$task['criteria']['professionalism'],
                'instruction' => (string) ($row['instruction'] ?? ''),
                'image_url' => (string) ($row['image_url'] ?? ''),
                'tries' => 3,
                'deduction' => (int) ($sheet['deduction'] ?? 2),
                'playable' => $action !== 'instruction',
            ];
            $number++;
        }

        return $cards;
    }

    private function scoringSheet(array $config): ?array
    {
        $sheet = $config['scenario']['scoring'] ?? null;
        if (! is_array($sheet) || ! is_array($sheet['scenarios'] ?? null) || $sheet['scenarios'] === []) {
            return null;
        }

        return $sheet;
    }

    private function scenarioIncluded(array $sheet, string $key): bool
    {
        foreach ($sheet['scenarios'] as $row) {
            if (is_array($row) && self::scenarioRowActive($row) && self::scenarioAction($row) === $key) {
                return true;
            }
        }

        return false;
    }

    private static function scenarioRowActive(array $row): bool
    {
        return ! array_key_exists('included', $row) || ! empty($row['included']) || ! empty($row['action']);
    }

    private static function scenarioTask(array $row): string
    {
        return (string) ($row['task'] ?? $row['key'] ?? '');
    }

    private static function scenarioAction(array $row): string
    {
        $action = (string) ($row['action'] ?? '');
        if (in_array($action, ['reservations', 'check_in', 'cashier', 'instruction'], true)) {
            return $action;
        }
        $task = self::scenarioTask($row);

        return in_array($task, ['reservations', 'check_in', 'cashier'], true) ? $task : 'instruction';
    }

    private function bookingMatches(array $config, array $booking): bool
    {
        return $this->reservationMatchesTarget($config, $booking);
    }

    private function reservationMatchesTarget(array $config, array $reservation): bool
    {
        $guest = $config['scenario']['guest'] ?? [];
        $target = $config['scenario']['reservation'] ?? [];

        return $this->normalize($reservation['guest_last_name'] ?? '') === $this->normalize($guest['last_name'] ?? '')
            && $this->normalize($reservation['guest_first_name'] ?? '') === $this->normalize($guest['first_name'] ?? '')
            && $this->normalizePhone($reservation['phone'] ?? '') === $this->normalizePhone($guest['phone'] ?? '')
            && ($reservation['arrival_date'] ?? '') === ($target['arrival_date'] ?? '')
            && (int) ($reservation['nights'] ?? 0) === (int) ($target['nights'] ?? 0)
            && (int) ($reservation['guests'] ?? 0) === (int) ($target['guests'] ?? 0)
            && ($reservation['room_type'] ?? '') === ($target['room_type'] ?? '')
            && ($reservation['room_number'] ?? '') === ($target['room_number'] ?? '')
            && strtolower((string) ($reservation['rate_type'] ?? '')) === strtolower((string) ($target['rate_type'] ?? 'rack'));
    }

    private function rejectTry(StudentAttempt $attempt, array $state, string $key, array $sheet): void
    {
        $allowed = 3;
        $deduction = (int) ($sheet['deduction'] ?? 2);
        $misses = $state['misses'] ?? [];
        $used = (int) ($misses[$key] ?? 0);
        if ($used >= $allowed) {
            throw ValidationException::withMessages([
                'try' => ["No tries left on this scenario. Each wrong try deducted {$deduction} points, so this scenario scores 0."],
            ]);
        }

        $used++;
        $misses[$key] = $used;
        $state['misses'] = $misses;
        $attempt->update(['simulation_state' => $state]);
        $left = $allowed - $used;
        if ($left === 0) {
            throw ValidationException::withMessages([
                'try' => ['That was the last try. This scenario is locked and scores 0.'],
            ]);
        }

        throw ValidationException::withMessages([
            'try' => ["That does not follow the scenario. {$left} tries left. Each wrong try deducts {$deduction} points."],
        ]);
    }

    private function scoreNumberedScenarios(array $sheet, array $state, array $passed): array
    {
        $catalog = collect(FrontOfficeLabRubric::activities())->keyBy('key');
        $deductionEach = max(0, (int) ($sheet['deduction'] ?? 0));
        $criteria = [];
        $earned = 0.0;
        $maxPoints = 0.0;

        foreach ($sheet['scenarios'] as $row) {
            if (! is_array($row) || ! self::scenarioRowActive($row)) {
                continue;
            }
            $action = self::scenarioAction($row);
            if (! isset($passed[$action])) {
                continue;
            }
            $task = $catalog->get(self::scenarioTask($row));
            if (! $task) {
                continue;
            }
            $points = (float) $task['points'];
            $misses = (int) (($state['misses'][$action] ?? 0));
            $ok = $passed[$action] && $misses < 3;
            $taken = $ok ? min($points, $misses * $deductionEach) : 0;
            $earnedPoints = $ok ? max(0, $points - $taken) : 0;
            $maxPoints += $points;
            $earned += $earnedPoints;
            $title = trim((string) ($row['title'] ?? ''));
            $criteria[] = [
                'key' => $action,
                'label' => $title !== '' ? $title : $task['short'],
                'points' => $points,
                'earned' => $earnedPoints,
                'passed' => $ok,
                'tries_used' => $misses,
                'deduction' => $taken,
            ];
        }

        return [$criteria, $earned, $maxPoints];
    }
}
