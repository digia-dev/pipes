<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\AuthToken;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $data['username'])->first();

        if (!$user || !password_verify($data['password'], $user->password_hash)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $token = Str::random(64);
        AuthToken::create(['user_id' => $user->id, 'token' => $token]);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'display_name' => $user->display_name,
                'email' => $user->email,
                'role' => $user->role,
                'avatar_color' => $user->avatar_color,
            ],
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->attributes->get('user');
        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'display_name' => $user->display_name,
            'email' => $user->email,
            'role' => $user->role,
            'avatar_color' => $user->avatar_color,
        ]);
    }

    public function logout(Request $request)
    {
        $token = $this->getBearerToken($request);
        if ($token) {
            AuthToken::where('token', $token)->delete();
        }
        return response()->json(['message' => 'Logged out']);
    }

    public function getUsers()
    {
        $users = User::select('id', 'username', 'display_name', 'email', 'role', 'avatar_color')
            ->orderBy('display_name')
            ->get();
        return response()->json($users);
    }

    private function getBearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization');
        if ($header && str_starts_with($header, 'Bearer ')) {
            return substr($header, 7);
        }
        return null;
    }
}
