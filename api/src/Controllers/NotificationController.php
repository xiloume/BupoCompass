<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use App\Models\Notification;

class NotificationController
{
    public function index(Request $request, array $params): void
    {
        $unreadOnly = ($request->query['unread'] ?? '') === '1';
        $notifications = Notification::getForUser($request->userId, 30, $unreadOnly);
        $unreadCount = Notification::getUnreadCount($request->userId);

        Response::json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markRead(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        Notification::markRead($id, $request->userId);
        Response::success('Notification marked as read');
    }

    public function markAllRead(Request $request, array $params): void
    {
        Notification::markAllRead($request->userId);
        Response::success('All notifications marked as read');
    }

    // Subscribe to checklist updates
    public function subscribe(Request $request, array $params): void
    {
        $checklistId = (int) $params['id'];

        // Check if already subscribed
        $stmt = Database::query(
            'SELECT 1 FROM checklist_subscribers WHERE user_id = ? AND checklist_id = ?',
            [$request->userId, $checklistId]
        );

        if ($stmt->fetch()) {
            Response::success('Already subscribed');
            return;
        }

        Database::query(
            'INSERT INTO checklist_subscribers (user_id, checklist_id, subscribed_at) VALUES (?, ?, NOW())',
            [$request->userId, $checklistId]
        );

        Response::success('Subscribed to updates');
    }

    // Unsubscribe from checklist updates
    public function unsubscribe(Request $request, array $params): void
    {
        $checklistId = (int) $params['id'];

        Database::query(
            'DELETE FROM checklist_subscribers WHERE user_id = ? AND checklist_id = ?',
            [$request->userId, $checklistId]
        );

        Response::success('Unsubscribed');
    }
}
