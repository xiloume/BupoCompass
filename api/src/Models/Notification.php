<?php

namespace App\Models;

use App\Core\Database;

class Notification
{
    public static function create(int $userId, string $type, string $title, ?string $message = null, ?string $refType = null, ?int $refId = null): void
    {
        Database::query(
            'INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [$userId, $type, $title, $message, $refType, $refId]
        );
    }

    public static function notifySubscribers(int $checklistId, string $type, string $title, ?string $message = null): void
    {
        $stmt = Database::query(
            'SELECT user_id FROM checklist_subscribers WHERE checklist_id = ?',
            [$checklistId]
        );

        foreach ($stmt->fetchAll() as $row) {
            self::create(
                (int) $row['user_id'],
                $type,
                $title,
                $message,
                'checklist',
                $checklistId
            );
        }
    }

    public static function getForUser(int $userId, int $limit = 30, bool $unreadOnly = false): array
    {
        $where = $unreadOnly ? 'AND is_read = 0' : '';
        $stmt = Database::query(
            "SELECT * FROM notifications WHERE user_id = ? {$where} ORDER BY created_at DESC LIMIT ?",
            [$userId, $limit]
        );
        return $stmt->fetchAll();
    }

    public static function markRead(int $notificationId, int $userId): void
    {
        Database::query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [$notificationId, $userId]
        );
    }

    public static function markAllRead(int $userId): void
    {
        Database::query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [$userId]
        );
    }

    public static function getUnreadCount(int $userId): int
    {
        $stmt = Database::query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [$userId]
        );
        return (int) $stmt->fetch()['count'];
    }
}
