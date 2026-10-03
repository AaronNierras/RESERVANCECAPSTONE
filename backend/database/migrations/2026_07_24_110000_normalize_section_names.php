<?php

use App\Models\Section;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Section::with('program')->get()->each(function (Section $section) {
            $normalized = $this->normalizeSection($section->name, $section->program?->name, $section->year_level);

            $section->update([
                'name' => $normalized['name'],
                'year_level' => $normalized['year_level'] ?? 1,
            ]);
        });

        Schema::table('sections', function (Blueprint $table) {
            if (! $this->indexExists('sections', 'sections_program_id_index')) {
                $table->index('program_id', 'sections_program_id_index');
            }
        });

        Schema::table('sections', function (Blueprint $table) {
            $table->dropUnique(['program_id', 'name']);
            $table->unique(['program_id', 'year_level', 'name'], 'sections_program_year_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            $table->dropUnique('sections_program_year_name_unique');
            $table->unique(['program_id', 'name']);
        });
    }

    private function normalizeSection(string $rawName, ?string $programName, ?int $existingYearLevel): array
    {
        $name = trim($rawName);

        if ($programName) {
            $prefix = preg_quote($programName, '/');
            $name = preg_replace('/^'.$prefix.'\s*/i', '', $name) ?? $name;
        }

        $name = trim($name);

        if (preg_match('/^(\d)([A-Za-z]+)$/', $name, $matches)) {
            return [
                'name' => strtoupper($matches[2]),
                'year_level' => (int) $matches[1],
            ];
        }

        if (preg_match('/^[A-Za-z]+$/', $name)) {
            return [
                'name' => strtoupper($name),
                'year_level' => $existingYearLevel,
            ];
        }

        return [
            'name' => strtoupper(preg_replace('/\d/', '', $name) ?: $name),
            'year_level' => $existingYearLevel,
        ];
    }

    private function indexExists(string $table, string $index): bool
    {
        $result = DB::select('SHOW INDEX FROM '.$table.' WHERE Key_name = ?', [$index]);

        return count($result) > 0;
    }
};
