<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use App\Models\Checklist;
use App\Models\Version;
use App\Models\Notification;

class VersionController
{
    // Publish a new version of a checklist
    public function publish(Request $request, array $params): void
    {
        $checklistId = (int) $params['id'];
        $checklist = Checklist::findById($checklistId);

        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        if ((int) $checklist['author_id'] !== $request->userId) {
            Response::error('Forbidden', 403);
        }

        $changelog = trim($request->body['changelog'] ?? '');
        $zones = $request->body['zones'] ?? [];

        if (empty($zones)) {
            Response::error('Zones data required for new version');
        }

        // Build diff (simplified: store new state as diff)
        $diff = [
            'zones_added' => [],
            'zones_removed' => [],
            'items_added' => [],
            'items_removed' => [],
            'snapshot' => $zones,
        ];

        // Delete old data and recreate
        Database::query('DELETE FROM checklist_items WHERE zone_id IN (SELECT id FROM checklist_zones WHERE checklist_id = ?)', [$checklistId]);
        Database::query('DELETE FROM checklist_zones WHERE checklist_id = ?', [$checklistId]);

        // Re-insert zones and items
        $sortOrder = 0;
        foreach ($zones as $zone) {
            $sortOrder++;
            Database::query(
                'INSERT INTO checklist_zones (checklist_id, name, sort_order) VALUES (?, ?, ?)',
                [$checklistId, $zone['name'], $sortOrder]
            );
            $zoneId = (int) Database::get()->lastInsertId();

            $itemSort = 0;
            foreach ($zone['items'] ?? [] as $item) {
                $itemSort++;
                Database::query(
                    'INSERT INTO checklist_items (zone_id, name, total, category, sort_order) VALUES (?, ?, ?, ?, ?)',
                    [$zoneId, $item['name'], $item['total'] ?? 1, $item['category'] ?? null, $itemSort]
                );
            }
        }

        // Create version entry
        $versionId = Version::create($checklistId, $request->userId, $diff, $changelog ?: null);

        // Notify subscribers
        $newVersion = (int) $checklist['version'] + 1;
        Notification::notifySubscribers(
            $checklistId,
            'checklist_updated',
            "{$checklist['title']} mis à jour (v{$newVersion})",
            $changelog ?: null
        );

        Response::json([
            'message' => 'Version published',
            'version' => $newVersion,
            'version_id' => $versionId,
        ], 201);
    }

    // Get version history
    public function history(Request $request, array $params): void
    {
        $checklistId = (int) $params['id'];
        $checklist = Checklist::findById($checklistId);

        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        $versions = Version::getHistory($checklistId);

        Response::json([
            'checklist_id' => $checklistId,
            'current_version' => (int) $checklist['version'],
            'versions' => $versions,
        ]);
    }

    // Get specific version details
    public function show(Request $request, array $params): void
    {
        $checklistId = (int) $params['id'];
        $versionNumber = (int) $params['version'];

        $version = Version::getVersion($checklistId, $versionNumber);

        if (!$version) {
            Response::error('Version not found', 404);
        }

        $version['diff_json'] = json_decode($version['diff_json'], true);

        Response::json(['version' => $version]);
    }
}
