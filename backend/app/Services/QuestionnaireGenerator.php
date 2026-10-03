<?php

namespace App\Services;

use RuntimeException;

class QuestionnaireGenerator
{
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
        $terms = $this->terms($text, $sentences);
        if (count($sentences) < 1 || count($terms) < 1) {
            throw new RuntimeException('The file does not have enough sentences to build questions.');
        }

        $questions = [];
        for ($i = 0; $i < $count; $i++) {
            $sentence = $sentences[$i % count($sentences)];
            $term = $this->termInSentence($sentence, $terms) ?? $terms[$i % count($terms)];
            $questions[] = ($i % 2 === 0 && count($terms) >= 4)
                ? $this->multipleChoice($sentence, $term, $terms, $i)
                : $this->identification($sentence, $term);
        }

        return $questions;
    }

    private function sentences(string $text): array
    {
        $parts = preg_split('/(?<=[.!?])\s+/u', $text) ?: [];

        return array_values(array_filter($parts, function ($sentence) {
            $sentence = trim($sentence);

            return mb_strlen($sentence) >= 40 && preg_match('/[A-Za-z]{4,}/', $sentence);
        }));
    }

    private function terms(string $text, array $sentences): array
    {
        preg_match_all("/\b[A-Za-z][A-Za-z'\-]{4,}\b/u", implode(' ', $sentences ?: [$text]), $matches);
        $terms = [];
        foreach ($matches[0] as $word) {
            $key = mb_strtolower($word);
            if (in_array($key, self::STOP, true)) {
                continue;
            }
            $terms[$key] = $word;
        }

        return array_values($terms);
    }

    private function termInSentence(string $sentence, array $terms): ?string
    {
        foreach ($terms as $term) {
            if (preg_match('/\b'.preg_quote($term, '/').'\b/iu', $sentence)) {
                return $term;
            }
        }

        return null;
    }

    private function blank(string $sentence, string $term): string
    {
        $blanked = preg_replace('/\b'.preg_quote($term, '/').'\b/iu', '______', $sentence, 1);

        return $blanked ?: $sentence;
    }

    private function identification(string $sentence, string $term): array
    {
        return [
            'type' => 'identification',
            'body' => 'Identify the missing term: '.$this->blank($sentence, $term),
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
            ],
        ];
    }

    private function multipleChoice(string $sentence, string $term, array $terms, int $index): array
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
        $rotated = $choices;

        return [
            'type' => 'mcq',
            'body' => 'Choose the missing term: '.$this->blank($sentence, $term),
            'explanation' => $sentence,
            'timer_seconds' => '',
            'choices' => array_map(function ($text, $choiceIndex) use ($correctAt) {
                return [
                    'label' => chr(65 + $choiceIndex),
                    'text' => $text,
                    'is_correct' => $choiceIndex === $correctAt,
                ];
            }, $rotated, array_keys($rotated)),
            'metadata' => [
                'correct_answer' => '',
                'alternatives' => [''],
                'manual_checking' => false,
                'allow_multiple_correct' => false,
                'image_path' => '',
                'image_url' => '',
            ],
        ];
    }
}
