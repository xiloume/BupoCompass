<?php

namespace App\Models;

use App\Core\Database;

class User
{
    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::query('SELECT * FROM users WHERE email = ?', [$email]);
        return $stmt->fetch() ?: null;
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::query('SELECT id, email, username, created_at FROM users WHERE id = ?', [$id]);
        return $stmt->fetch() ?: null;
    }

    public static function create(string $email, string $username, string $password): int
    {
        $hash = password_hash($password, PASSWORD_ARGON2ID);
        Database::query(
            'INSERT INTO users (email, username, password_hash, created_at) VALUES (?, ?, ?, NOW())',
            [$email, $username, $hash]
        );
        return (int) Database::get()->lastInsertId();
    }

    public static function verifyPassword(array $user, string $password): bool
    {
        return password_verify($password, $user['password_hash']);
    }
}
