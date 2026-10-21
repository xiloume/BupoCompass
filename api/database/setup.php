<?php
/**
 * Database setup script - Creates database and runs all migrations
 * Usage: php api/database/setup.php
 */

$envFile = __DIR__ . '/../.env';
if (!file_exists($envFile)) {
    die("ERROR: .env file not found at $envFile\n");
}

// Parse .env
$env = [];
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#')) continue;
    if (!str_contains($line, '=')) continue;
    [$key, $value] = explode('=', $line, 2);
    $env[trim($key)] = trim($value);
}

$host = $env['DB_HOST'] ?? 'localhost';
$port = $env['DB_PORT'] ?? '3306';
$dbName = $env['DB_NAME'] ?? 'bupocompass';
$user = $env['DB_USER'] ?? 'root';
$pass = $env['DB_PASSWORD'] ?? '';

echo "=== BupoCompass Database Setup ===\n\n";

// Step 1: Connect without database to create it
try {
    $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "[OK] Connected to MySQL at $host:$port\n";
} catch (PDOException $e) {
    die("[FAIL] Cannot connect: " . $e->getMessage() . "\n");
}

// Step 2: Create database
try {
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "[OK] Database '$dbName' created/exists\n";
} catch (PDOException $e) {
    die("[FAIL] Cannot create database: " . $e->getMessage() . "\n");
}

// Step 3: Use database
$pdo->exec("USE `$dbName`");

// Step 4: Run migrations in order
$migrationsDir = __DIR__ . '/migrations';
$files = glob($migrationsDir . '/*.sql');
sort($files);

if (empty($files)) {
    echo "[WARN] No migration files found in $migrationsDir\n";
    exit(0);
}

echo "\n--- Running Migrations ---\n";

foreach ($files as $file) {
    $filename = basename($file);
    echo "  > $filename ... ";

    $sql = file_get_contents($file);

    // Split by semicolons (handle multi-statement)
    $statements = array_filter(array_map('trim', explode(';', $sql)));

    $errors = 0;
    foreach ($statements as $stmt) {
        if (empty($stmt) || str_starts_with($stmt, '--')) continue;
        try {
            $pdo->exec($stmt);
        } catch (PDOException $e) {
            // Ignore "already exists" errors for idempotency
            if (!str_contains($e->getMessage(), 'already exists')
                && !str_contains($e->getMessage(), 'Duplicate column')
                && !str_contains($e->getMessage(), 'Duplicate key')) {
                echo "\n    [WARN] " . $e->getMessage() . "\n    ";
                $errors++;
            }
        }
    }

    echo $errors ? "done (with $errors warnings)\n" : "OK\n";
}

echo "\n=== Setup complete! ===\n";
echo "Database: $dbName @ $host:$port\n";
