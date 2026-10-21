<?php

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthMiddleware
{
    public static function handle(Request $request): void
    {
        $token = $request->getBearer();

        if (!$token) {
            Response::error('Token required', 401);
        }

        try {
            $decoded = JWT::decode($token, new Key($_ENV['JWT_SECRET'], 'HS256'));
            $request->userId = (int) $decoded->sub;
        } catch (\Exception $e) {
            Response::error('Invalid or expired token', 401);
        }
    }
}
