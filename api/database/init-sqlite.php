<?php
/**
 * SQLite database init for local dev.
 * Converts MySQL migrations on-the-fly and runs them on a local SQLite file.
 * Usage: php api/database/init-sqlite.php
 */

$envFile = __DIR__ . '/../.env';
if (!file_exists($envFile)) {
    die("ERROR: .env not found at $envFile\nCopie .env.local.example -> .env\n");
}

$env = [];
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#')) continue;
    if (!str_contains($line, '=')) continue;
    [$key, $value] = explode('=', $line, 2);
    $env[trim($key)] = trim($value);
}

$dbPath = $env['DB_PATH'] ?? __DIR__ . '/local.sqlite';

@mkdir(dirname($dbPath), 0777, true);

try {
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    echo "[OK] SQLite opened: $dbPath\n\n";
} catch (PDOException $e) {
    die("[FAIL] " . $e->getMessage() . "\n");
}

function mysqlToSqlite(string $sql): string {
    // Remove MySQL-only directives
    $sql = preg_replace('/SET FOREIGN_KEY_CHECKS=[01];?\s*/i', '', $sql);
    $sql = preg_replace('/ENGINE=InnoDB\b[^;]*/i', '', $sql);
    $sql = preg_replace('/DEFAULT\s+CHARSET=[^ ]+/i', '', $sql);
    $sql = preg_replace('/COLLATE=[^ ]+/i', '', $sql);

    // Data types
    $sql = preg_replace('/\bINT UNSIGNED AUTO_INCREMENT\b/i', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
    $sql = preg_replace('/\bINT UNSIGNED\b/i', 'INTEGER', $sql);
    $sql = preg_replace('/\bINT\b/i', 'INTEGER', $sql);
    $sql = preg_replace('/\bTINYINT\([^)]*\)\b/i', 'INTEGER', $sql);
    $sql = preg_replace('/\bTEXT NULL\b/i', 'TEXT', $sql);
    $sql = preg_replace('/\bVARCHAR\(\d+\) NOT NULL\b/i', 'TEXT NOT NULL', $sql);
    $sql = preg_replace('/\bVARCHAR\(\d+\)\b/i', 'TEXT', $sql);
    $sql = preg_replace('/\bENUM\([^)]+\)\b/i', 'TEXT', $sql);
    $sql = preg_replace('/\bDATETIME\b/i', 'TEXT', $sql);

    // MySQL INDEX/KEY/UNIQUE KEY with inline length (token(191))
    $sql = preg_replace('/INDEX\s+\w+\s*\([^)]+\)/i', '', $sql);
    $sql = preg_replace('/UNIQUE\s+KEY\s+\w+\s*\([^)]+\)/i', 'UNIQUE', $sql);

    // Remove named FK constraints (SQLite supports them but we keep it simple)
    $sql = preg_replace('/\bCONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+\w+\s*\([^)]*\)\s+(ON\s+\w+\s+\w+)?\s*(ON\s+\w+\s+\w+)?/i', '', $sql);

    // Clean up double spaces and trailing artifacts
    $sql = preg_replace('/,\s*,/', ',', $sql);
    $sql = preg_replace('/\(\s*,/', '(', $sql);
    $sql = preg_replace('/,\s*\)/', ')', $sql);
    return $sql;
}

$migrationsDir = __DIR__ . '/migrations';
$files = glob($migrationsDir . '/*.sql');
sort($files);

echo "--- Running migrations ---\n";

foreach ($files as $file) {
    $filename = basename($file);
    echo "  > $filename ... ";

    $raw = file_get_contents($file);
    $sql = mysqlToSqlite($raw);

    $statements = array_filter(array_map('trim', explode(';', $sql)));
    $errors = 0;

    foreach ($statements as $stmt) {
        if (empty($stmt) || str_starts_with($stmt, '--')) continue;
        // SQLite doesn't like empty CREATE TABLE () so skip if body became empty
        if (preg_match('/^CREATE\s+TABLE\s+if\s+not\s+exists\s+\w+\s*\(\s*\)/i', $stmt)) continue;
        try {
            $pdo->exec($stmt);
        } catch (PDOException $e) {
            if (!str_contains($e->getMessage(), 'already exists')
                && !str_contains($e->getMessage(), 'duplicate column')) {
                echo "\n    [WARN] " . $e->getMessage() . "\n    ";
                $errors++;
            }
        }
    }

    echo $errors ? "done (with $errors warnings)\n" : "OK\n";
}

echo "\n=== SQLite init complete! ===\n";
