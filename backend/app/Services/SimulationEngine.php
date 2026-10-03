<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Score;
use App\Models\StudentAttempt;
use App\Models\User;
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

        return [
            'hotel_name' => $config['hotel_name'] ?? 'RESERVANCE Grand Hotel',
            'briefing' => $config['scenario']['briefing'] ?? $activity->instructions,
            'room_types' => $config['room_types'] ?? [],
            'rooms' => $state['rooms'] ?? [],
            'reservations' => $state['reservations'] ?? [],
            'folios' => $state['folios'] ?? [],
            'actions' => $state['actions'] ?? [],
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

        if (empty($config['room_types'])) {
            $errors[] = 'Add at least one room type.';
        }
        if (empty($config['rooms'])) {
            $errors[] = 'Add at least one room.';
        }

        $guest = $config['scenario']['guest'] ?? [];
        if (trim($guest['last_name'] ?? '') === '' || trim($guest['first_name'] ?? '') === '') {
            $errors[] = 'Scenario guest name is required.';
        }

        $res = $config['scenario']['reservation'] ?? [];
        if (trim($res['room_number'] ?? '') === '' || trim($res['room_type'] ?? '') === '') {
            $errors[] = 'Scenario reservation room type and room number are required.';
        }

        return $errors;
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
}
