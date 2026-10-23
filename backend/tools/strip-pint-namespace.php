<?php

/**
 * Laravel Pint is installed as a tool, but its package manifest also
 * claims the App, Database\Factories, and Database\Seeders namespaces.
 * Those folders are not in the Pint package. Leave them claimed and the
 * editor treats every App class as missing.
 */
$pintManifest = dirname(__DIR__) . '/vendor/laravel/pint/composer.json';

if (is_file($pintManifest)) {
    $manifest = json_decode(file_get_contents($pintManifest), true);
    $changed = false;

    foreach (['App\\', 'Database\\Factories\\', 'Database\\Seeders\\'] as $prefix) {
        if (isset($manifest['autoload']['psr-4'][$prefix])) {
            unset($manifest['autoload']['psr-4'][$prefix]);
            $changed = true;
        }
    }

    if ($changed) {
        file_put_contents(
            $pintManifest,
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL
        );
    }
}

$replacements = [
    ", \$vendorDir . '/laravel/pint/app'" => '',
    ", \$vendorDir . '/laravel/pint/database/factories'" => '',
    ", \$vendorDir . '/laravel/pint/database/seeders'" => '',
    "            1 => __DIR__ . '/..' . '/laravel/pint/app',\n" => '',
    "            1 => __DIR__ . '/..' . '/laravel/pint/database/factories',\n" => '',
    "            1 => __DIR__ . '/..' . '/laravel/pint/database/seeders',\n" => '',
];

foreach (['autoload_psr4.php', 'autoload_static.php'] as $file) {
    $path = dirname(__DIR__) . '/vendor/composer/' . $file;
    if (!is_file($path)) {
        continue;
    }

    $contents = file_get_contents($path);
    $updated = str_replace(array_keys($replacements), array_values($replacements), $contents);
    if ($updated !== $contents) {
        file_put_contents($path, $updated);
    }
}
