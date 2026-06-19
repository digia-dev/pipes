<?php

namespace App\Http\Middleware;

use App\Models\AuthToken;
use Closure;
use Illuminate\Http\Request;

class TokenAuth
{
    public function handle(Request $request, Closure $next)
    {
        $tokenStr = $request->query('token');
        if (!$tokenStr) {
            $header = $request->header('Authorization');
            if (!$header || !str_starts_with($header, 'Bearer ')) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }
            $tokenStr = substr($header, 7);
        }
        $token = AuthToken::with('user')->where('token', $tokenStr)->first();

        if (!$token || !$token->user) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        $request->attributes->set('user', $token->user);
        $request->attributes->set('auth_token', $tokenStr);

        return $next($request);
    }
}
