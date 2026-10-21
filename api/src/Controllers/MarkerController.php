<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Marker;
use App\Models\Subscription;

class MarkerController
{
    // Set a marker on an item (VIP only)
    public function set(Request $request, array $params): void
    {
        if (!Subscription::isVip($request->userId)) {
            Response::error('VIP subscription required for custom markers', 403);
        }

        $itemId = (int) $params['id'];
        $icon = $request->body['icon'] ?? null;
        $color = $request->body['color'] ?? null;
        $note = $request->body['note'] ?? null;

        // Validate icon
        if ($icon && !in_array($icon, Marker::AVAILABLE_ICONS)) {
            Response::error('Invalid icon. Available: ' . implode(', ', Marker::AVAILABLE_ICONS));
        }

        // Validate color (hex)
        if ($color && !preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            Response::error('Invalid color format. Use hex like #ff0000');
        }

        Marker::set($request->userId, $itemId, $icon, $color, $note);
        Response::success('Marker updated');
    }

    // Get markers for a checklist
    public function forChecklist(Request $request, array $params): void
    {
        $checklistId = (int) $params['id'];
        $markers = Marker::getForChecklist($request->userId, $checklistId);
        Response::json(['markers' => $markers]);
    }

    // Delete a marker
    public function delete(Request $request, array $params): void
    {
        $itemId = (int) $params['id'];
        Marker::delete($request->userId, $itemId);
        Response::success('Marker removed');
    }

    // Get available icons
    public function icons(Request $request, array $params): void
    {
        Response::json(['icons' => Marker::AVAILABLE_ICONS]);
    }
}
