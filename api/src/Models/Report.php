<?php

namespace App\Models;

use App\Core\Database;

class Report
{
    public static function create(int $reporterId, int $checklistId, string $reason, ?string $message): int
    {
        Database::query(
            'INSERT INTO reports (reporter_id, checklist_id, reason, message, created_at) VALUES (?, ?, ?, ?, NOW())',
            [$reporterId, $checklistId, $reason, $message]
        );

        $reportId = (int) Database::get()->lastInsertId();

        // Update report count on checklist
        Database::query(
            'UPDATE checklists SET report_count = report_count + 1 WHERE id = ?',
            [$checklistId]
        );

        // Auto-hide at 3 reports
        $stmt = Database::query(
            'SELECT report_count FROM checklists WHERE id = ?',
            [$checklistId]
        );
        $row = $stmt->fetch();
        if ($row && (int) $row['report_count'] >= 3) {
            Database::query(
                "UPDATE checklists SET status = 'pending' WHERE id = ? AND status = 'approved'",
                [$checklistId]
            );
        }

        return $reportId;
    }

    public static function hasReported(int $userId, int $checklistId): bool
    {
        $stmt = Database::query(
            'SELECT 1 FROM reports WHERE reporter_id = ? AND checklist_id = ? LIMIT 1',
            [$userId, $checklistId]
        );
        return (bool) $stmt->fetch();
    }

    public static function getPending(int $limit = 20, int $offset = 0): array
    {
        $stmt = Database::query(
            "SELECT r.*, c.title as checklist_title, u.username as reporter_name
             FROM reports r
             JOIN checklists c ON c.id = r.checklist_id
             JOIN users u ON u.id = r.reporter_id
             WHERE r.status = 'pending'
             ORDER BY r.created_at ASC
             LIMIT ? OFFSET ?",
            [$limit, $offset]
        );
        return $stmt->fetchAll();
    }

    public static function resolve(int $reportId, int $moderatorId, string $status): void
    {
        Database::query(
            'UPDATE reports SET status = ?, reviewed_by = ?, resolved_at = NOW() WHERE id = ?',
            [$status, $moderatorId, $reportId]
        );
    }
}
