<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use RuntimeException;
use ZipArchive;

class DocumentTextExtractor
{
    public function extract(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());

        $text = match ($extension) {
            'docx' => $this->extractDocx($file->getRealPath()),
            'pdf' => $this->extractPdf($file->getRealPath()),
            default => throw new RuntimeException('Upload a Word (.docx) or PDF file.'),
        };

        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
        if (mb_strlen($text) < 40) {
            throw new RuntimeException('The file does not contain enough readable text. Use a .docx file, or a PDF with selectable text rather than a scanned image.');
        }

        return $text;
    }

    private function extractDocx(string $path): string
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new RuntimeException('The Word file could not be opened.');
        }

        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if ($xml === false) {
            throw new RuntimeException('The Word file does not contain readable text.');
        }

        $xml = preg_replace('/<w:p[^>]*>/', "\n", $xml) ?? $xml;

        return html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private function extractPdf(string $path): string
    {
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('The PDF could not be opened.');
        }

        $chunks = [];
        if (preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $raw, $matches)) {
            foreach ($matches[1] as $stream) {
                $decoded = @gzuncompress($stream);
                if ($decoded === false) {
                    $decoded = @gzinflate($stream);
                }
                $chunks[] = $decoded !== false ? $decoded : $stream;
            }
        }
        $chunks[] = $raw;

        $text = '';
        foreach ($chunks as $chunk) {
            if (preg_match_all('/\((?:\\\\.|[^\\\\)]){2,}\)/s', $chunk, $strings)) {
                foreach ($strings[0] as $literal) {
                    $value = stripcslashes(substr($literal, 1, -1));
                    $value = preg_replace('/[^\P{C}\n]+/u', ' ', $value) ?? $value;
                    if (preg_match('/[A-Za-z]{3,}/', $value)) {
                        $text .= ' '.$value;
                    }
                }
            }
        }

        return $text;
    }
}
