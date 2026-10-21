<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\User;
use Firebase\JWT\JWT;

class AuthController
{
    public function register(Request $request, array $params): void
    {
        $email = trim($request->body['email'] ?? '');
        $username = trim($request->body['username'] ?? '');
        $password = $request->body['password'] ?? '';

        if (!$email || !$username || !$password) {
            Response::error('Email, username and password are required');
        }

        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email format');
        }

        if (User::findByEmail($email)) {
            Response::error('Email already registered', 409);
        }

        $userId = User::create($email, $username, $password);
        $tokens = $this->generateTokens($userId);

        Response::json([
            'message' => 'Account created',
            'user' => ['id' => $userId, 'email' => $email, 'username' => $username],
            'access_token' => $tokens['access'],
            'refresh_token' => $tokens['refresh'],
        ], 201);
    }

    public function login(Request $request, array $params): void
    {
        $email = trim($request->body['email'] ?? '');
        $password = $request->body['password'] ?? '';

        if (!$email || !$password) {
            Response::error('Email and password are required');
        }

        $user = User::findByEmail($email);
        if (!$user || !User::verifyPassword($user, $password)) {
            Response::error('Invalid credentials', 401);
        }

        $tokens = $this->generateTokens($user['id']);

        Response::json([
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'username' => $user['username'],
                'is_vip' => (bool) ($user['is_vip'] ?? false),
            ],
            'access_token' => $tokens['access'],
            'refresh_token' => $tokens['refresh'],
        ]);
    }

    public function refresh(Request $request, array $params): void
    {
        $refreshToken = $request->body['refresh_token'] ?? '';

        if (!$refreshToken) {
            Response::error('Refresh token required');
        }

        try {
            $decoded = JWT::decode($refreshToken, new \Firebase\JWT\Key($_ENV['JWT_SECRET'], 'HS256'));
            if (($decoded->type ?? '') !== 'refresh') {
                throw new \Exception('Invalid token type');
            }

            $tokens = $this->generateTokens((int) $decoded->sub);
            Response::json([
                'access_token' => $tokens['access'],
                'refresh_token' => $tokens['refresh'],
            ]);
        } catch (\Exception $e) {
            Response::error('Invalid refresh token', 401);
        }
    }

    private function generateTokens(int $userId): array
    {
        $now = time();

        $access = JWT::encode([
            'sub' => $userId,
            'iat' => $now,
            'exp' => $now + (int) $_ENV['JWT_EXPIRY'],
            'type' => 'access',
        ], $_ENV['JWT_SECRET'], 'HS256');

        $refresh = JWT::encode([
            'sub' => $userId,
            'iat' => $now,
            'exp' => $now + (int) $_ENV['JWT_REFRESH_EXPIRY'],
            'type' => 'refresh',
        ], $_ENV['JWT_SECRET'], 'HS256');

        return ['access' => $access, 'refresh' => $refresh];
    }
}
