<?php

namespace App\Models;

use App\Core\Database;

class Marker
{
    const AVAILABLE_ICONS = [
        'star', 'heart', 'flag', 'pin', 'diamond', 'crown',
        'fire', 'bolt', 'check', 'skull', 'gem', 'trophy',
        'target', 'eye', 'key', 'shield', 'sword', 'potion',
    ];

    public static function set(int $userId, int $itemId, ?string $icon, ?string $color, ?string $note): void
    {
        $existing = self::get($userId, $itemId);

        if ($existing) {
            Database::query(
                'UPDATE item_markers SET icon = ?, color = ?, note = ?, updated_at = NOW() WHERE user_id = ? AND item_id = ?',
                [$icon, $color, $note, $userId, $itemId]
            );
        } else {
            Database::query(
                'INSERT INTO item_markers (user_id, item_id, icon, color, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                [$userId, $itemId, $icon, $color, $note]
            );
        }
    }

    public static function get(int $userId, int $itemId): ?array
    {
        $stmt = Database::query(
            'SELECT * FROM item_markers WHERE user_id = ? AND item_id = ?',
            [$userId, $itemId]
        );
        return $stmt->fetch() ?: null;
    }

    public static function getForChecklist(int $userId, int $checklistId): array
    {
        $stmt = Database::query(
            'SELECT m.* FROM item_markers m
             JOIN checklist_items ci ON ci.id = m.item_id
             JOIN checklist_zones cz ON cz.id = ci.zone_id
             WHERE m.user_id = ? AND cz.checklist_id = ?',
            [$userId, $checklistId]
        );
        return $stmt->fetchAll();
    }

    public static function delete(int $userId, int $itemId): void
    {
        Database::query(
            'DELETE FROM item_markers WHERE user_id = ? AND item_id = ?',
            [$userId, $itemId]
        );
    }
}
