<?php

namespace App\Models;

use App\Core\Database;

class Version
{
    public static function create(int $checklistId, int $authorId, array $diff, ?string $changelog): int
    {
        // Get next version number
        $stmt = Database::query(
            'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM checklist_versions WHERE checklist_id = ?',
            [$checklistId]
        );
        $nextVersion = (int) $stmt->fetch()['next_version'];

        Database::query(
            'INSERT INTO checklist_versions (checklist_id, version_number, diff_json, author_id, changelog, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [$checklistId, $nextVersion, json_encode($diff), $authorId, $changelog]
        );

        // Update version on checklist
        Database::query(
            'UPDATE checklists SET version = ?, updated_at = NOW() WHERE id = ?',
            [$nextVersion, $checklistId]
        );

        return (int) Database::get()->lastInsertId();
    }

    public static function getHistory(int $checklistId): array
    {
        $stmt = Database::query(
            'SELECT v.*, u.username as author_name
             FROM checklist_versions v
             JOIN users u ON u.id = v.author_id
             WHERE v.checklist_id = ?
             ORDER BY v.version_number DESC',
            [$checklistId]
        );
        return $stmt->fetchAll();
    }

    public static function getVersion(int $checklistId, int $versionNumber): ?array
    {
        $stmt = Database::query(
            'SELECT v.*, u.username as author_name
             FROM checklist_versions v
             JOIN users u ON u.id = v.author_id
             WHERE v.checklist_id = ? AND v.version_number = ?',
            [$checklistId, $versionNumber]
        );
        return $stmt->fetch() ?: null;
    }
}
