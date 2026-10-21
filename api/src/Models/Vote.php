<?php

namespace App\Models;

use App\Core\Database;

class Vote
{
    public static function getUserVote(int $userId, int $checklistId): ?int
    {
        $stmt = Database::query(
            'SELECT value FROM checklist_votes WHERE user_id = ? AND checklist_id = ?',
            [$userId, $checklistId]
        );
        $row = $stmt->fetch();
        return $row ? (int) $row['value'] : null;
    }

    public static function cast(int $userId, int $checklistId, int $value): void
    {
        $existing = self::getUserVote($userId, $checklistId);

        if ($existing === null) {
            // New vote
            Database::query(
                'INSERT INTO checklist_votes (user_id, checklist_id, value, created_at) VALUES (?, ?, ?, NOW())',
                [$userId, $checklistId, $value]
            );
        } elseif ($existing === $value) {
            // Remove vote (toggle off)
            Database::query(
                'DELETE FROM checklist_votes WHERE user_id = ? AND checklist_id = ?',
                [$userId, $checklistId]
            );
            $value = 0;
        } else {
            // Change vote
            Database::query(
                'UPDATE checklist_votes SET value = ?, created_at = NOW() WHERE user_id = ? AND checklist_id = ?',
                [$value, $userId, $checklistId]
            );
        }

        // Update cached score on checklist
        self::updateCachedScore($checklistId);
    }

    public static function updateCachedScore(int $checklistId): void
    {
        $stmt = Database::query(
            'SELECT COALESCE(SUM(value), 0) as score, COUNT(*) as count FROM checklist_votes WHERE checklist_id = ?',
            [$checklistId]
        );
        $row = $stmt->fetch();

        Database::query(
            'UPDATE checklists SET vote_score = ?, vote_count = ? WHERE id = ?',
            [(int) $row['score'], (int) $row['count'], $checklistId]
        );
    }

    public static function getVotesForChecklists(int $userId, array $checklistIds): array
    {
        if (empty($checklistIds)) return [];

        $placeholders = implode(',', array_fill(0, count($checklistIds), '?'));
        $params = array_merge([$userId], $checklistIds);

        $stmt = Database::query(
            "SELECT checklist_id, value FROM checklist_votes WHERE user_id = ? AND checklist_id IN ({$placeholders})",
            $params
        );

        $votes = [];
        foreach ($stmt->fetchAll() as $row) {
            $votes[(int) $row['checklist_id']] = (int) $row['value'];
        }
        return $votes;
    }
}
