<?php

namespace App\Services;

use RuntimeException;

class QuestionnaireGenerator
{
    /**
     * Objective-test table of specification.
     * Remembering is identification. The other levels are multiple choice.
     */
    private const TOS = [
        ['level' => 'Remembering', 'share' => 20, 'type' => 'identification'],
        ['level' => 'Understanding', 'share' => 30, 'type' => 'mcq'],
        ['level' => 'Applying', 'share' => 30, 'type' => 'mcq'],
        ['level' => 'Analyzing', 'share' => 20, 'type' => 'mcq'],
    ];

    private const STOP = [
        'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between',
        'could', 'during', 'every', 'first', 'from', 'have', 'into', 'more', 'most',
        'only', 'other', 'over', 'some', 'such', 'than', 'that', 'their', 'them',
        'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
        'using', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'with',
        'would', 'your',
    ];

    public function generate(string $text, int $count): array
    {
        $sentences = $this->sentences($text);
        $terms = $this->terms($sentences);
        if ($sentences === [] || $terms === []) {
            throw new RuntimeException('The file does not have enough clean sentences to build questions.');
        }

        $plan = $this->allocate($count);
        $questions = [];
        $used = [];
        $cursor = 0;

        foreach ($plan as $row) {
            for ($n = 0; $n < $row['count']; $n++) {
                $sentence = $this->nextSentence($sentences, $used, $cursor);
                $term = $this->termInSentence($sentence, $terms) ?? $terms[$cursor % count($terms)];
                $questions[] = $row['type'] === 'identification'
                    ? $this->identification($sentence, $term, $row['level'])
                    : $this->multipleChoice($sentence, $term, $terms, count($questions), $row['level']);
                $cursor++;
            }
        }

        return $questions;
    }

    public function specification(int $count): array
    {
        return $this->allocate($count);
    }

    private function allocate(int $count): array
    {
        $rows = [];
        $assigned = 0;
        foreach (self::TOS as $index => $row) {
            $exact = $count * $row['share'] / 100;
            $rows[$index] = $row + [
                'count' => (int) floor($exact),
                'fraction' => $exact - floor($exact),
            ];
            $assigned += $rows[$index]['count'];
        }

        $order = array_keys($rows);
        usort($order, fn (int $a, int $b) => $rows[$b]['fraction'] <=> $rows[$a]['fraction']);
        $left = max(0, $count - $assigned);
        foreach ($order as $index) {
            if ($left === 0) {
                break;
            }
            $rows[$index]['count']++;
            $left--;
        }

        return array_map(function (array $row) {
            unset($row['fraction']);

            return $row;
        }, $rows);
    }

    private function sentences(string $text): array
    {
        $text = preg_replace('/\(cid:\d+\)/iu', ' ', $text) ?? $text;
        $text = preg_replace('/\bpage\s+\d+\b/iu', ' ', $text) ?? $text;
        $text = preg_replace('/[^\p{L}\p{N}\s\.\,\;\:\'\"\?\!\-]/u', ' ', $text) ?? $text;
        $text = $this->tidy($text);
        $parts = preg_split('/(?<=[.!?])\s+/u', $text) ?: [];
        $clean = [];
        foreach ($parts as $sentence) {
            $sentence = $this->tidy($sentence);
            $words = preg_match_all("/\b[\p{L}][\p{L}'\-]{2,}\b/u", $sentence);
            $letters = preg_match_all('/\p{L}/u', $sentence);
            $length = mb_strlen($sentence);
            if ($words < 6 || $length < 40 || $length > 320 || $length === 0 || ($letters / $length) < 0.7) {
                continue;
            }
            if (preg_match('/[^\p{L}\p{N}\s\.\,\;\:\'\"\?\!\-\(\)]/u', $sentence)) {
                continue;
            }
            $clean[$sentence] = $sentence;
        }

        return array_values($clean);
    }

    private function terms(array $sentences): array
    {
        preg_match_all("/\b[\p{L}][\p{L}'\-]{4,18}\b/u", implode(' ', $sentences), $matches);
        $terms = [];
        foreach ($matches[0] as $word) {
            if (preg_match('/[^A-Za-z]/', $word)) {
                continue;
            }
            $key = mb_strtolower($word);
            if (in_array($key, self::STOP, true)) {
                continue;
            }
            $terms[$key] = $word;
        }

        return array_values($terms);
    }

    private function nextSentence(array $sentences, array &$used, int $cursor): string
    {
        $total = count($sentences);
        for ($step = 0; $step < $total; $step++) {
            $sentence = $sentences[($cursor + $step) % $total];
            if (! isset($used[$sentence])) {
                $used[$sentence] = true;

                return $sentence;
            }
        }

        return $sentences[$cursor % $total];
    }

    private function termInSentence(string $sentence, array $terms): ?string
    {
        foreach ($terms as $term) {
            if (preg_match('/\b'.preg_quote($term, '/').'\b/u', $sentence)) {
                return $term;
            }
        }

        return null;
    }

    private function blank(string $sentence, string $term): string
    {
        $blanked = preg_replace('/\b'.preg_quote($term, '/').'\b/u', '______', $sentence, 1);

        return $this->tidy($blanked ?: $sentence);
    }

    private function tidy(string $value): string
    {
        $value = str_replace(
            ["\u{00A0}", "\u{202F}", "\u{2018}", "\u{2019}", "\u{201C}", "\u{201D}", "\u{2013}", "\u{2014}"],
            [' ', ' ', "'", "'", '"', '"', '-', '-'],
            $value
        );
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);
        $value = preg_replace('/\s+([,.;:!?])/', '$1', $value) ?? $value;

        return trim($value);
    }

    private function identification(string $sentence, string $term, string $level): array
    {
        return [
            'type' => 'identification',
            'body' => $this->tidy('What is the missing term? '.$this->blank($sentence, $term)),
            'explanation' => $sentence,
            'timer_seconds' => '',
            'choices' => [],
            'metadata' => [
                'correct_answer' => $term,
                'alternatives' => [''],
                'manual_checking' => false,
                'allow_multiple_correct' => false,
                'image_path' => '',
                'image_url' => '',
                'tos_level' => $level,
            ],
        ];
    }

    private function multipleChoice(string $sentence, string $term, array $terms, int $index, string $level): array
    {
        $distractors = [];
        foreach ($terms as $item) {
            if (mb_strtolower($item) === mb_strtolower($term)) {
                continue;
            }
            $distractors[$item] = $item;
            if (count($distractors) >= 12) {
                break;
            }
        }
        $distractors = array_values($distractors);
        $offset = $distractors ? $index % count($distractors) : 0;
        $choices = [$term];
        for ($n = 0; $n < count($distractors) && count($choices) < 4; $n++) {
            $choices[] = $distractors[($offset + $n) % count($distractors)];
        }
        while (count($choices) < 4) {
            $choices[] = 'None of these';
        }
        $choices = array_slice($choices, 0, 4);
        $correctAt = $index % 4;
        $correct = array_shift($choices);
        array_splice($choices, $correctAt, 0, [$correct]);

        $lead = match ($level) {
            'Applying' => 'Which term is used in this procedure?',
            'Analyzing' => 'Which term does this statement rely on?',
            default => 'Which term completes the statement?',
        };

        return [
            'type' => 'mcq',
            'body' => $this->tidy($lead.' '.$this->blank($sentence, $term)),
            'explanation' => $sentence,
            'timer_seconds' => '',
            'choices' => array_map(function ($text, $choiceIndex) use ($correctAt) {
                return [
                    'label' => chr(65 + $choiceIndex),
                    'text' => $this->tidy($text),
                    'is_correct' => $choiceIndex === $correctAt,
                ];
            }, $choices, array_keys($choices)),
            'metadata' => [
                'correct_answer' => '',
                'alternatives' => [''],
                'manual_checking' => false,
                'allow_multiple_correct' => false,
                'image_path' => '',
                'image_url' => '',
                'tos_level' => $level,
            ],
        ];
    }
}
