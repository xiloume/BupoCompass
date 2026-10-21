<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use Firebase\JWT\JWT;

class PairingController
{
    // Generate a short-lived pairing token for QR code
    public function createToken(Request $request, array $params): void
    {
        $userId = $request->userId;

        // Generate a short-lived token (5 minutes) specifically for pairing
        $pairingToken = JWT::encode([
            'sub' => $userId,
            'iat' => time(),
            'exp' => time() + 300, // 5 min
            'type' => 'pairing',
        ], $_ENV['JWT_SECRET'], 'HS256');

        Response::json([
            'pairing_token' => $pairingToken,
            'expires_in' => 300,
        ]);
    }

    // Validate a pairing token and return full auth tokens
    public function validateToken(Request $request, array $params): void
    {
        $pairingToken = $request->body['pairing_token'] ?? '';

        if (!$pairingToken) {
            Response::error('Pairing token required');
        }

        try {
            $decoded = JWT::decode($pairingToken, new \Firebase\JWT\Key($_ENV['JWT_SECRET'], 'HS256'));

            if (($decoded->type ?? '') !== 'pairing') {
                throw new \Exception('Invalid token type');
            }

            $userId = (int) $decoded->sub;

            // Generate full auth tokens for the mobile device
            $now = time();
            $accessToken = JWT::encode([
                'sub' => $userId,
                'iat' => $now,
                'exp' => $now + (int) $_ENV['JWT_EXPIRY'],
                'type' => 'access',
            ], $_ENV['JWT_SECRET'], 'HS256');

            $refreshToken = JWT::encode([
                'sub' => $userId,
                'iat' => $now,
                'exp' => $now + (int) $_ENV['JWT_REFRESH_EXPIRY'],
                'type' => 'refresh',
            ], $_ENV['JWT_SECRET'], 'HS256');

            // Get user info
            $stmt = Database::query(
                'SELECT id, email, username FROM users WHERE id = ?',
                [$userId]
            );
            $user = $stmt->fetch();

            Response::json([
                'user' => $user,
                'access_token' => $accessToken,
                'refresh_token' => $refreshToken,
            ]);
        } catch (\Exception $e) {
            Response::error('Invalid or expired pairing token', 401);
        }
    }
}
