<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;

class StatsController
{
    public function overview(Request $request, array $params): void
    {
        $userId = $request->userId;

        // Global progress
        $globalStmt = Database::query(
            'SELECT
                COUNT(DISTINCT ci.id) as total_items,
                SUM(ci.total) as total_collectibles,
                COALESCE(SUM(up.current), 0) as collected
             FROM checklists c
             JOIN checklist_zones cz ON cz.checklist_id = c.id
             JOIN checklist_items ci ON ci.zone_id = cz.id
             LEFT JOIN user_progress up ON up.item_id = ci.id AND up.user_id = ?
             WHERE c.author_id = ? OR c.id IN (
                SELECT checklist_id FROM checklist_subscribers WHERE user_id = ?
             )',
            [$userId, $userId, $userId]
        );
        $global = $globalStmt->fetch();

        // Per-game stats
        $gamesStmt = Database::query(
            'SELECT
                g.name as game_name,
                g.slug as game_slug,
                c.id as checklist_id,
                c.title as checklist_title,
                COUNT(ci.id) as item_count,
                SUM(ci.total) as total_collectibles,
                COALESCE(SUM(up.current), 0) as collected
             FROM checklists c
             JOIN games g ON g.id = c.game_id
             JOIN checklist_zones cz ON cz.checklist_id = c.id
             JOIN checklist_items ci ON ci.zone_id = cz.id
             LEFT JOIN user_progress up ON up.item_id = ci.id AND up.user_id = ?
             WHERE c.author_id = ?
             GROUP BY c.id
             ORDER BY g.name, c.title',
            [$userId, $userId]
        );
        $games = $gamesStmt->fetchAll();

        // Per-zone stats for each checklist
        $zoneStatsStmt = Database::query(
            'SELECT
                cz.checklist_id,
                cz.name as zone_name,
                COUNT(ci.id) as item_count,
                SUM(ci.total) as total_collectibles,
                COALESCE(SUM(up.current), 0) as collected
             FROM checklist_zones cz
             JOIN checklist_items ci ON ci.zone_id = cz.id
             LEFT JOIN user_progress up ON up.item_id = ci.id AND up.user_id = ?
             WHERE cz.checklist_id IN (
                SELECT id FROM checklists WHERE author_id = ?
             )
             GROUP BY cz.id
             ORDER BY cz.sort_order',
            [$userId, $userId]
        );
        $zoneStats = $zoneStatsStmt->fetchAll();

        // Group zones by checklist
        $zonesByChecklist = [];
        foreach ($zoneStats as $zone) {
            $zonesByChecklist[$zone['checklist_id']][] = $zone;
        }

        // Activity timeline (last 30 days)
        $activityStmt = Database::query(
            'SELECT DATE(updated_at) as date, COUNT(*) as actions, SUM(current) as progress_gained
             FROM user_progress
             WHERE user_id = ? AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(updated_at)
             ORDER BY date ASC',
            [$userId]
        );
        $activity = $activityStmt->fetchAll();

        // Completion streaks
        $completedZones = 0;
        $totalZones = count($zoneStats);
        foreach ($zoneStats as $zone) {
            if ((int) $zone['total_collectibles'] > 0 && (int) $zone['collected'] >= (int) $zone['total_collectibles']) {
                $completedZones++;
            }
        }

        Response::json([
            'global' => [
                'total_items' => (int) $global['total_items'],
                'total_collectibles' => (int) $global['total_collectibles'],
                'collected' => (int) $global['collected'],
                'percentage' => $global['total_collectibles'] > 0
                    ? round(($global['collected'] / $global['total_collectibles']) * 100, 1)
                    : 0,
            ],
            'games' => $games,
            'zones_by_checklist' => $zonesByChecklist,
            'activity' => $activity,
            'summary' => [
                'completed_zones' => $completedZones,
                'total_zones' => $totalZones,
                'active_days_30' => count($activity),
            ],
        ]);
    }
}
