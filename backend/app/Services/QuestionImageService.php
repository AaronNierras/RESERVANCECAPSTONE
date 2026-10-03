<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class QuestionImageService
{
    private const MAX_WIDTH = 1280;

    private const MAX_HEIGHT = 1280;

    private const WEBP_QUALITY = 82;

    private const JPEG_QUALITY = 85;

    public function storeOptimized(UploadedFile $file): array
    {
        if (! extension_loaded('gd')) {
            throw new RuntimeException('Image processing is unavailable. Enable the PHP GD extension on the server.');
        }

        $originalBytes = $file->getSize();
        $mime = strtolower((string) $file->getMimeType());
        $source = $this->loadImage($file->getRealPath(), $mime);

        if ($source === false) {
            throw new RuntimeException('The uploaded file could not be processed as an image.');
        }

        $image = $this->resize($source);
        $filename = Str::uuid()->toString();
        $relativePath = 'question-images/'.$filename;
        $format = 'webp';
        $fullPath = Storage::disk('public')->path($relativePath.'.webp');

        if (! is_dir(dirname($fullPath))) {
            mkdir(dirname($fullPath), 0755, true);
        }

        if (function_exists('imagewebp') && imagewebp($image, $fullPath, self::WEBP_QUALITY)) {
            $relativePath .= '.webp';
        } else {
            $format = 'jpeg';
            $fullPath = Storage::disk('public')->path($relativePath.'.jpg');
            imagejpeg($image, $fullPath, self::JPEG_QUALITY);
            $relativePath .= '.jpg';
        }

        imagedestroy($image);

        $optimizedBytes = Storage::disk('public')->size($relativePath);

        return [
            'path' => $relativePath,
            'url' => asset('storage/'.$relativePath),
            'format' => $format,
            'original_bytes' => $originalBytes,
            'optimized_bytes' => $optimizedBytes,
            'saved_percent' => $originalBytes > 0
                ? round((1 - ($optimizedBytes / $originalBytes)) * 100, 1)
                : 0,
        ];
    }

    private function loadImage(string $path, string $mime): \GdImage|false
    {
        return match ($mime) {
            'image/jpeg', 'image/jpg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/gif' => @imagecreatefromgif($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            default => @imagecreatefromstring((string) file_get_contents($path)),
        };
    }

    private function resize(\GdImage $source): \GdImage
    {
        $width = imagesx($source);
        $height = imagesy($source);
        $scale = min(self::MAX_WIDTH / max(1, $width), self::MAX_HEIGHT / max(1, $height), 1);

        if ($scale >= 1) {
            return $source;
        }

        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));
        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        $this->prepareCanvas($canvas);
        imagecopyresampled(
            $canvas,
            $source,
            0,
            0,
            0,
            0,
            $targetWidth,
            $targetHeight,
            $width,
            $height
        );
        imagedestroy($source);

        return $canvas;
    }

    private function prepareCanvas(\GdImage $canvas): void
    {
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefilledrectangle($canvas, 0, 0, imagesx($canvas), imagesy($canvas), $transparent);
        imagealphablending($canvas, true);
    }
}
