<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;

class ProgressController
{
    public function sync(Request $request, array $params): void
    {
        $changes = $request->body['changes'] ?? [];

        if (empty($changes)) {
            Response::error('No changes provided');
        }

        $userId = $request->userId;

        foreach ($changes as $change) {
            $itemId = (int) ($change['item_id'] ?? 0);
            $current = (int) ($change['current'] ?? 0);
            $updatedAt = $change['updated_at'] ?? date('Y-m-d H:i:s');

            if ($itemId <= 0) continue;

            // Upsert: insert or update if newer
            Database::query(
                'INSERT INTO user_progress (user_id, item_id, current, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    current = IF(VALUES(updated_at) > updated_at, VALUES(current), current),
                    updated_at = IF(VALUES(updated_at) > updated_at, VALUES(updated_at), updated_at)',
                [$userId, $itemId, $current, $updatedAt]
            );
        }

        Response::success('Progress synced', ['synced' => count($changes)]);
    }

    public function pull(Request $request, array $params): void
    {
        $userId = $request->userId;
        $since = $request->query['since'] ?? '1970-01-01 00:00:00';

        $stmt = Database::query(
            'SELECT item_id, current, updated_at
             FROM user_progress
             WHERE user_id = ? AND updated_at > ?
             ORDER BY updated_at ASC',
            [$userId, $since]
        );

        $changes = $stmt->fetchAll();

        Response::json([
            'changes' => $changes,
            'sync_token' => date('Y-m-d H:i:s'),
        ]);
    }
}
