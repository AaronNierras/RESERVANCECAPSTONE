<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = $request->user();
        if (! $user || ! $user->role) {
            throw new AccessDeniedHttpException('Unauthorized.');
        }

        if ($user->status === 'inactive') {
            throw new AccessDeniedHttpException('Account is inactive.');
        }

        if (! in_array($user->role->name, $roles, true)) {
            throw new AccessDeniedHttpException('Insufficient role.');
        }

        return $next($request);
    }
}
