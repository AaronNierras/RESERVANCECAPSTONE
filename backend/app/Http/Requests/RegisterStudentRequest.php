<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $first = $this->input('first_name');
        $last = $this->input('last_name');
        $studentNumber = $this->input('student_number');

        $this->merge([
            'first_name' => is_string($first) ? $this->capitalizeName($first) : $first,
            'last_name' => is_string($last) ? $this->capitalizeName($last) : $last,
            'email' => is_string($this->input('email')) ? strtolower(trim($this->input('email'))) : $this->input('email'),
            'student_number' => is_string($studentNumber) ? trim($studentNumber) : $studentNumber,
        ]);
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z\s\-]+$/'],
            'last_name' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z\s\-]+$/'],
            'email' => ['required', 'email', 'regex:/@student\.mcu\.edu\.ph$/i', 'unique:users,email'],
            'password' => [
                'required',
                'string',
                'min:8',
                'regex:/[A-Z]/',
                'regex:/[a-z]/',
                'regex:/[0-9]/',
                'regex:/[^A-Za-z0-9]/',
                'confirmed',
            ],
            'student_number' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9]+$/', 'unique:student_profiles,student_number'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.regex' => 'First name may contain letters only.',
            'last_name.regex' => 'Last name may contain letters only.',
            'email.regex' => 'Email must end with @student.mcu.edu.ph.',
            'student_number.regex' => 'Student number cannot contain special characters.',
            'password.regex' => 'Password must include uppercase, lowercase, number, and special character.',
            'password.confirmed' => 'Password confirmation does not match.',
        ];
    }

    public function fullName(): string
    {
        return trim($this->input('first_name').' '.$this->input('last_name'));
    }

    private function capitalizeName(string $value): string
    {
        $trimmed = trim($value);

        return mb_convert_case($trimmed, MB_CASE_TITLE, 'UTF-8');
    }
}
