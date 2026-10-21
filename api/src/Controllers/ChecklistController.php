<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use App\Models\Checklist;
use App\Models\Game;
use App\Models\Subscription;

class ChecklistController
{
    public function index(Request $request, array $params): void
    {
        $checklists = Checklist::findByUser($request->userId);
        Response::json(['checklists' => $checklists]);
    }

    public function show(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $data = Checklist::getFullData($id);

        if (!$data) {
            Response::error('Checklist not found', 404);
        }

        Response::json(['checklist' => $data]);
    }

    public function store(Request $request, array $params): void
    {
        $title = trim($request->body['title'] ?? '');
        $gameName = trim($request->body['game_name'] ?? '');
        $zones = $request->body['zones'] ?? [];

        if (!$title || !$gameName) {
            Response::error('Title and game_name are required');
        }

        // Free users limited to 5 checklists
        if (!Subscription::isVip($request->userId)) {
            $existing = Checklist::findByUser($request->userId);
            if (count($existing) >= 5) {
                Response::error('Free users are limited to 5 checklists. Upgrade to VIP for unlimited.', 403);
            }
        }

        $gameId = Game::findOrCreate($gameName);
        $checklistId = Checklist::create($gameId, $request->userId, $title);

        // Insert zones and items
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

        $data = Checklist::getFullData($checklistId);
        Response::json(['checklist' => $data], 201);
    }

    public function update(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $checklist = Checklist::findById($id);

        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        if ($checklist['author_id'] !== $request->userId) {
            Response::error('Forbidden', 403);
        }

        $title = trim($request->body['title'] ?? $checklist['title']);
        Checklist::update($id, $title);

        Response::success('Checklist updated');
    }

    public function destroy(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $checklist = Checklist::findById($id);

        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        if ($checklist['author_id'] !== $request->userId) {
            Response::error('Forbidden', 403);
        }

        Checklist::delete($id);
        Response::success('Checklist deleted');
    }

    public function fork(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $original = Checklist::getFullData($id);

        if (!$original) {
            Response::error('Checklist not found', 404);
        }

        $newId = Checklist::create(
            (int) $original['game_id'],
            $request->userId,
            $original['title'] . ' (copie)'
        );

        // Duplicate zones and items
        $sortOrder = 0;
        foreach ($original['zones'] as $zone) {
            $sortOrder++;
            Database::query(
                'INSERT INTO checklist_zones (checklist_id, name, sort_order) VALUES (?, ?, ?)',
                [$newId, $zone['name'], $sortOrder]
            );
            $newZoneId = (int) Database::get()->lastInsertId();

            $itemSort = 0;
            foreach ($zone['items'] as $item) {
                $itemSort++;
                Database::query(
                    'INSERT INTO checklist_items (zone_id, name, total, category, sort_order) VALUES (?, ?, ?, ?, ?)',
                    [$newZoneId, $item['name'], $item['total'], $item['category'] ?? null, $itemSort]
                );
            }
        }

        // Increment fork count on original
        Database::query('UPDATE checklists SET fork_count = fork_count + 1 WHERE id = ?', [$id]);

        // Auto-subscribe to original for update notifications
        Database::query(
            'INSERT IGNORE INTO checklist_subscribers (user_id, checklist_id, subscribed_at) VALUES (?, ?, NOW())',
            [$request->userId, $id]
        );

        $data = Checklist::getFullData($newId);
        Response::json(['checklist' => $data], 201);
    }
}
