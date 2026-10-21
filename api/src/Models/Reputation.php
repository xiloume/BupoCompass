<?php

namespace App\Models;

use App\Core\Database;

class Reputation
{
    // Points config
    const CHECKLIST_APPROVED = 10;
    const CHECKLIST_REJECTED = -2;
    const VOTE_RECEIVED = 1;
    const REPORT_CONFIRMED = 5;
    const REPORT_FALSE = -3;

    // Thresholds
    const TIER_CONFIRMED = 50;    // Skip light review
    const TIER_MODERATOR = 200;   // Can moderate

    public static function award(int $userId, int $points, string $reason, ?int $referenceId = null): void
    {
        Database::query(
            'INSERT INTO reputation_log (user_id, points, reason, reference_id, created_at) VALUES (?, ?, ?, ?, NOW())',
            [$userId, $points, $reason, $referenceId]
        );

        Database::query(
            'UPDATE users SET reputation = reputation + ? WHERE id = ?',
            [$points, $userId]
        );
    }

    public static function getScore(int $userId): int
    {
        $stmt = Database::query('SELECT reputation FROM users WHERE id = ?', [$userId]);
        $row = $stmt->fetch();
        return $row ? (int) $row['reputation'] : 0;
    }

    public static function getTier(int $userId): string
    {
        $score = self::getScore($userId);
        if ($score >= self::TIER_MODERATOR) return 'moderator';
        if ($score >= self::TIER_CONFIRMED) return 'confirmed';
        return 'newcomer';
    }

    public static function getHistory(int $userId, int $limit = 20): array
    {
        $stmt = Database::query(
            'SELECT * FROM reputation_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [$userId, $limit]
        );
        return $stmt->fetchAll();
    }
}
