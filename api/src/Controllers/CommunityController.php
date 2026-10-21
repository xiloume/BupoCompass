<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use App\Models\Checklist;
use App\Models\Vote;

class CommunityController
{
    // Publish a checklist (set status to pending)
    public function publish(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $checklist = Checklist::findById($id);

        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        if ($checklist['author_id'] !== $request->userId) {
            Response::error('Forbidden', 403);
        }

        if ($checklist['status'] !== 'draft') {
            Response::error('Checklist already published or pending');
        }

        Database::query(
            'UPDATE checklists SET status = "pending", updated_at = NOW() WHERE id = ?',
            [$id]
        );

        Response::success('Checklist submitted for review');
    }

    // Vote on a checklist (+1 or -1)
    public function vote(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $value = (int) ($request->body['value'] ?? 0);

        if ($value !== 1 && $value !== -1) {
            Response::error('Value must be 1 or -1');
        }

        $checklist = Checklist::findById($id);
        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        if ($checklist['author_id'] === $request->userId) {
            Response::error('Cannot vote on your own checklist');
        }

        Vote::cast($request->userId, $id, $value);

        // Get updated score
        $updated = Checklist::findById($id);
        Response::json([
            'vote_score' => (int) $updated['vote_score'],
            'user_vote' => Vote::getUserVote($request->userId, $id),
        ]);
    }

    // Browse public checklists with sorting
    public function browse(Request $request, array $params): void
    {
        $sort = $request->query['sort'] ?? 'popular'; // popular, recent, score
        $page = max(1, (int) ($request->query['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;

        $orderBy = match ($sort) {
            'recent' => 'c.updated_at DESC',
            'score' => 'c.vote_score DESC',
            default => 'c.vote_score DESC, c.fork_count DESC',
        };

        $stmt = Database::query(
            "SELECT c.*, g.name as game_name, g.slug as game_slug, u.username as author_name
             FROM checklists c
             JOIN games g ON g.id = c.game_id
             JOIN users u ON u.id = c.author_id
             WHERE c.status = 'approved'
             ORDER BY {$orderBy}
             LIMIT ? OFFSET ?",
            [$limit, $offset]
        );

        $checklists = $stmt->fetchAll();

        // Get user votes if authenticated
        $userVotes = [];
        if ($request->userId) {
            $ids = array_map(fn($c) => (int) $c['id'], $checklists);
            $userVotes = Vote::getVotesForChecklists($request->userId, $ids);
        }

        // Attach user vote to each checklist
        foreach ($checklists as &$cl) {
            $cl['user_vote'] = $userVotes[(int) $cl['id']] ?? null;
        }

        // Total count for pagination
        $countStmt = Database::query(
            "SELECT COUNT(*) as total FROM checklists WHERE status = 'approved'"
        );
        $total = (int) $countStmt->fetch()['total'];

        Response::json([
            'checklists' => $checklists,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit),
            ],
        ]);
    }
}
