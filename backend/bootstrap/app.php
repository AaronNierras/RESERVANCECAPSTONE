<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Validation\ValidationException;
use App\Models\SystemError;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->reportable(function (Throwable $e) {
            if ($e instanceof ValidationException || $e instanceof AuthenticationException) {
                return;
            }
            if ($e instanceof HttpExceptionInterface && $e->getStatusCode() < 500) {
                return;
            }

            try {
                $request = request();
                SystemError::query()->create([
                    'user_id' => $request?->user()?->id,
                    'source' => 'api',
                    'message' => mb_substr($e->getMessage() !== '' ? $e->getMessage() : class_basename($e), 0, 500),
                    'location' => mb_substr(trim(($request?->method() ?? '').' '.($request?->path() ?? '')), 0, 255),
                ]);
            } catch (Throwable) {
                // Recording a failure must not replace the original error.
            }
        });
    })->create();
