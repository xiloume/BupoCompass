<?php

namespace App\Core;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $instance = null;

    public static function init(): void
    {
        if (self::$instance !== null) return;

        $driver = strtolower($_ENV['DB_DRIVER'] ?? 'mysql');

        try {
            if ($driver === 'sqlite') {
                // SQLite mode for local dev: zero-config single file DB
                $dbPath = $_ENV['DB_PATH'] ?? (__DIR__ . '/../../database/local.sqlite');
                $dir = dirname($dbPath);
                if (!is_dir($dir)) @mkdir($dir, 0777, true);
                self::$instance = new PDO('sqlite:' . $dbPath, null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]);
                self::$instance->exec('PRAGMA foreign_keys = ON');
            } else {
                $dsn = sprintf(
                    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                    $_ENV['DB_HOST'] ?? 'localhost',
                    $_ENV['DB_PORT'] ?? '3306',
                    $_ENV['DB_NAME'] ?? 'bupocompass'
                );

                self::$instance = new PDO(
                    $dsn,
                    $_ENV['DB_USER'] ?? 'root',
                    $_ENV['DB_PASS'] ?? '',
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                    ]
                );
            }
        } catch (PDOException $e) {
            Response::json([
                'error' => 'Database connection failed',
                'detail' => $_ENV['APP_ENV'] === 'development' ? $e->getMessage() : null,
            ], 500);
            exit;
        }
    }

    public static function get(): PDO
    {
        return self::$instance;
    }

    public static function query(string $sql, array $params = []): \PDOStatement
    {
        $stmt = self::$instance->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
}
