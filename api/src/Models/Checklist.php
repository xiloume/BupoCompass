<?php

namespace App\Models;

use App\Core\Database;

class Checklist
{
    public static function findById(int $id): ?array
    {
        $stmt = Database::query('SELECT * FROM checklists WHERE id = ?', [$id]);
        return $stmt->fetch() ?: null;
    }

    public static function findByUser(int $userId): array
    {
        $stmt = Database::query(
            'SELECT c.*, g.name as game_name, g.slug as game_slug
             FROM checklists c
             JOIN games g ON g.id = c.game_id
             WHERE c.author_id = ?
             ORDER BY c.updated_at DESC',
            [$userId]
        );
        return $stmt->fetchAll();
    }

    public static function findByGameSlug(string $slug): array
    {
        $stmt = Database::query(
            'SELECT c.*, u.username as author_name
             FROM checklists c
             JOIN games g ON g.id = c.game_id
             JOIN users u ON u.id = c.author_id
             WHERE g.slug = ? AND c.status = "approved"
             ORDER BY c.updated_at DESC',
            [$slug]
        );
        return $stmt->fetchAll();
    }

    public static function create(int $gameId, int $authorId, string $title): int
    {
        Database::query(
            'INSERT INTO checklists (game_id, author_id, title, version, status, created_at, updated_at)
             VALUES (?, ?, ?, 1, "draft", NOW(), NOW())',
            [$gameId, $authorId, $title]
        );
        return (int) Database::get()->lastInsertId();
    }

    public static function update(int $id, string $title): void
    {
        Database::query(
            'UPDATE checklists SET title = ?, updated_at = NOW() WHERE id = ?',
            [$title, $id]
        );
    }

    public static function delete(int $id): void
    {
        Database::query('DELETE FROM checklist_items WHERE zone_id IN (SELECT id FROM checklist_zones WHERE checklist_id = ?)', [$id]);
        Database::query('DELETE FROM checklist_zones WHERE checklist_id = ?', [$id]);
        Database::query('DELETE FROM checklists WHERE id = ?', [$id]);
    }

    public static function getFullData(int $id): ?array
    {
        $checklist = self::findById($id);
        if (!$checklist) return null;

        $zones = Database::query(
            'SELECT * FROM checklist_zones WHERE checklist_id = ? ORDER BY sort_order',
            [$id]
        )->fetchAll();

        foreach ($zones as &$zone) {
            $zone['items'] = Database::query(
                'SELECT * FROM checklist_items WHERE zone_id = ? ORDER BY sort_order',
                [$zone['id']]
            )->fetchAll();
        }

        $checklist['zones'] = $zones;
        return $checklist;
    }
}
