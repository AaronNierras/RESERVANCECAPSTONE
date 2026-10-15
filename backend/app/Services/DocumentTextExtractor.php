<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use RuntimeException;
use ZipArchive;

class DocumentTextExtractor
{
    public function extract(UploadedFile $file): string
    {
        $path = $file->getRealPath();
        if (! $path || ! is_readable($path)) {
            throw new RuntimeException('The uploaded file could not be opened on this computer.');
        }

        $kind = $this->detectKind($file, $path);

        $text = match ($kind) {
            'docx' => $this->extractDocx($path),
            'pdf' => $this->extractPdf($path),
            'doc' => throw new RuntimeException('Older .doc Word files are not supported. Open the file in Word and Save As .docx, then upload again.'),
            default => throw new RuntimeException('Upload a Word (.docx) or PDF file. The system could not recognize this file type.'),
        };

        $text = $this->normalizeText($text);
        if (mb_strlen($text) < 40) {
            throw new RuntimeException('The file does not contain enough readable text. Use a .docx file, or a PDF with selectable text rather than a scanned image.');
        }

        return $text;
    }

    private function detectKind(UploadedFile $file, string $path): string
    {
        $header = @file_get_contents($path, false, null, 0, 8) ?: '';
        $bytes = array_values(unpack('C*', $header) ?: []);

        // %PDF
        if (($bytes[0] ?? null) === 0x25 && ($bytes[1] ?? null) === 0x50 && ($bytes[2] ?? null) === 0x44 && ($bytes[3] ?? null) === 0x46) {
            return 'pdf';
        }

        // ZIP / DOCX
        if (($bytes[0] ?? null) === 0x50 && ($bytes[1] ?? null) === 0x4B) {
            return 'docx';
        }

        // OLE Compound File = old .doc
        if (($bytes[0] ?? null) === 0xD0 && ($bytes[1] ?? null) === 0xCF && ($bytes[2] ?? null) === 0x11 && ($bytes[3] ?? null) === 0xE0) {
            return 'doc';
        }

        $extension = strtolower($file->getClientOriginalExtension() ?: pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));
        $mime = strtolower((string) ($file->getMimeType() ?: $file->getClientMimeType()));

        if ($extension === 'pdf' || str_contains($mime, 'pdf')) {
            return 'pdf';
        }
        if (in_array($extension, ['docx', 'docm'], true) || str_contains($mime, 'wordprocessingml') || str_contains($mime, 'officedocument')) {
            return 'docx';
        }
        if ($extension === 'doc' || str_contains($mime, 'msword')) {
            return 'doc';
        }

        return '';
    }

    private function extractDocx(string $path): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('This computer is missing the PHP Zip extension needed to read Word files. Enable extension=zip in php.ini and restart Apache/PHP.');
        }

        $zip = new ZipArchive();
        $opened = $zip->open($path);
        if ($opened !== true) {
            throw new RuntimeException('The Word file could not be opened. Save it again as .docx and try once more.');
        }

        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if ($xml === false || $xml === '') {
            throw new RuntimeException('The Word file does not contain readable text.');
        }

        $xml = preg_replace('/<\/w:p>/', "\n", $xml) ?? $xml;
        $xml = preg_replace('/<w:tab[^\/]*\/>/', ' ', $xml) ?? $xml;
        $xml = preg_replace('/<w:br[^\/]*\/>/', "\n", $xml) ?? $xml;

        return html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private function extractPdf(string $path): string
    {
        $raw = @file_get_contents($path);
        if ($raw === false || $raw === '') {
            throw new RuntimeException('The PDF could not be opened.');
        }

        $text = $this->extractPdfWithPdftotext($path);
        if ($text !== '') {
            return $text;
        }

        $text = $this->extractPdfLiterals($raw);
        if ($text !== '') {
            return $text;
        }

        throw new RuntimeException('This PDF has no selectable text the system can read. Export or print it again as a text PDF, or paste the content into a Word (.docx) file.');
    }

    private function extractPdfWithPdftotext(string $path): string
    {
        if (! function_exists('shell_exec')) {
            return '';
        }

        $binary = $this->findPdftotextBinary();
        if (! $binary) {
            return '';
        }

        $temp = tempnam(sys_get_temp_dir(), 'rvpdf');
        if ($temp === false) {
            return '';
        }
        @unlink($temp);
        $out = $temp.'.txt';
        $cmd = '"'.$binary.'" -enc UTF-8 -q '.escapeshellarg($path).' '.escapeshellarg($out).' 2>NUL';
        @shell_exec($cmd);
        $text = is_file($out) ? (string) @file_get_contents($out) : '';
        @unlink($out);

        return $text;
    }

    private function findPdftotextBinary(): ?string
    {
        $which = trim((string) @shell_exec('where pdftotext 2>NUL'));
        if ($which === '') {
            $which = trim((string) @shell_exec('which pdftotext 2>/dev/null'));
        }
        if ($which !== '') {
            return strtok($which, "\n") ?: null;
        }

        foreach ([
            'C:\\xampp\\poppler\\Library\\bin\\pdftotext.exe',
            '/usr/bin/pdftotext',
            '/usr/local/bin/pdftotext',
        ] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function extractPdfLiterals(string $raw): string
    {
        $chunks = [];
        if (preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $raw, $matches)) {
            foreach ($matches[1] as $stream) {
                $decoded = @gzuncompress($stream);
                if ($decoded === false) {
                    $decoded = @gzinflate($stream);
                }
                if ($decoded === false && function_exists('gzdecode')) {
                    $decoded = @gzdecode($stream);
                }
                $chunks[] = $decoded !== false ? $decoded : $stream;
            }
        }
        $chunks[] = $raw;

        $parts = [];
        foreach ($chunks as $chunk) {
            // (... ) Tj  or  [(...)] TJ
            if (preg_match_all('/\\(((?:\\\\.|[^\\\\)])*)\\)/s', $chunk, $strings)) {
                foreach ($strings[1] as $literal) {
                    $value = $this->decodePdfLiteral($literal);
                    if ($this->looksLikeText($value)) {
                        $parts[] = $value;
                    }
                }
            }
            if (preg_match_all('/<([0-9A-Fa-f\\s]+)>\\s*Tj/s', $chunk, $hexes)) {
                foreach ($hexes[1] as $hex) {
                    $value = $this->decodePdfHex($hex);
                    if ($this->looksLikeText($value)) {
                        $parts[] = $value;
                    }
                }
            }
        }

        return implode(' ', $parts);
    }

    private function decodePdfLiteral(string $literal): string
    {
        $value = stripcslashes($literal);
        // UTF-16BE with BOM
        if (str_starts_with($value, "\xFE\xFF")) {
            $converted = @mb_convert_encoding(substr($value, 2), 'UTF-8', 'UTF-16BE');
            if (is_string($converted) && $converted !== '') {
                return $converted;
            }
        }

        return $value;
    }

    private function decodePdfHex(string $hex): string
    {
        $clean = preg_replace('/\s+/', '', $hex) ?? '';
        if ($clean === '' || strlen($clean) % 2 === 1) {
            return '';
        }
        $bin = @hex2bin($clean);
        if ($bin === false) {
            return '';
        }
        if (str_starts_with($bin, "\xFE\xFF")) {
            $converted = @mb_convert_encoding(substr($bin, 2), 'UTF-8', 'UTF-16BE');

            return is_string($converted) ? $converted : '';
        }
        $converted = @mb_convert_encoding($bin, 'UTF-8', 'UTF-16BE');

        return is_string($converted) && $this->looksLikeText($converted) ? $converted : $bin;
    }

    private function looksLikeText(string $value): bool
    {
        $value = trim($value);
        if ($value === '') {
            return false;
        }

        return (bool) preg_match('/[\p{L}\p{N}]{2,}/u', $value);
    }

    private function normalizeText(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[^\P{C}\n\t]+/u', ' ', $text) ?? $text;

        return trim(preg_replace('/[ \t]+/u', ' ', preg_replace('/\s*\n\s*/u', "\n", $text) ?? $text) ?? $text);
    }
}
