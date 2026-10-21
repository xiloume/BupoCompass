<?php

namespace App\Models;

use App\Core\Database;

class Game
{
    public static function all(): array
    {
        $stmt = Database::query('SELECT * FROM games ORDER BY name');
        return $stmt->fetchAll();
    }

    public static function findBySlug(string $slug): ?array
    {
        $stmt = Database::query('SELECT * FROM games WHERE slug = ?', [$slug]);
        return $stmt->fetch() ?: null;
    }

    public static function findOrCreate(string $name): int
    {
        $slug = self::slugify($name);
        $existing = self::findBySlug($slug);
        if ($existing) return (int) $existing['id'];

        Database::query(
            'INSERT INTO games (name, slug, created_at) VALUES (?, ?, NOW())',
            [$name, $slug]
        );
        return (int) Database::get()->lastInsertId();
    }

    private static function slugify(string $text): string
    {
        $text = transliterator_transliterate('Any-Latin; Latin-ASCII', $text);
        $text = strtolower(trim($text));
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}
