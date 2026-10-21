<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use App\Models\Checklist;
use App\Models\Report;
use App\Models\Reputation;

class ModerationController
{
    // Report a checklist
    public function report(Request $request, array $params): void
    {
        $checklistId = (int) $params['id'];
        $reason = $request->body['reason'] ?? '';
        $message = $request->body['message'] ?? null;

        $validReasons = ['spam', 'incorrect', 'incomplete', 'duplicate', 'offensive'];
        if (!in_array($reason, $validReasons)) {
            Response::error('Invalid reason. Must be: ' . implode(', ', $validReasons));
        }

        $checklist = Checklist::findById($checklistId);
        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        if ($checklist['author_id'] === $request->userId) {
            Response::error('Cannot report your own checklist');
        }

        if (Report::hasReported($request->userId, $checklistId)) {
            Response::error('Already reported');
        }

        Report::create($request->userId, $checklistId, $reason, $message);
        Response::success('Report submitted');
    }

    // Get pending reviews (moderators only)
    public function pending(Request $request, array $params): void
    {
        $this->requireModerator($request->userId);

        $page = max(1, (int) ($request->query['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;

        // Pending checklists (submitted for review)
        $checklists = Database::query(
            "SELECT c.*, u.username as author_name, g.name as game_name
             FROM checklists c
             JOIN users u ON u.id = c.author_id
             JOIN games g ON g.id = c.game_id
             WHERE c.status = 'pending'
             ORDER BY c.updated_at ASC
             LIMIT ? OFFSET ?",
            [$limit, $offset]
        )->fetchAll();

        // Pending reports
        $reports = Report::getPending($limit, $offset);

        Response::json([
            'checklists' => $checklists,
            'reports' => $reports,
        ]);
    }

    // Approve a checklist
    public function approve(Request $request, array $params): void
    {
        $this->requireModerator($request->userId);

        $id = (int) $params['id'];
        $checklist = Checklist::findById($id);

        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        Database::query(
            "UPDATE checklists SET status = 'approved', updated_at = NOW() WHERE id = ?",
            [$id]
        );

        // Reward author
        Reputation::award(
            (int) $checklist['author_id'],
            Reputation::CHECKLIST_APPROVED,
            'checklist_approved',
            $id
        );

        Response::success('Checklist approved');
    }

    // Reject a checklist
    public function reject(Request $request, array $params): void
    {
        $this->requireModerator($request->userId);

        $id = (int) $params['id'];
        $reason = $request->body['reason'] ?? 'Not specified';
        $checklist = Checklist::findById($id);

        if (!$checklist) {
            Response::error('Checklist not found', 404);
        }

        Database::query(
            "UPDATE checklists SET status = 'rejected', updated_at = NOW() WHERE id = ?",
            [$id]
        );

        // Penalize author
        Reputation::award(
            (int) $checklist['author_id'],
            Reputation::CHECKLIST_REJECTED,
            'checklist_rejected',
            $id
        );

        Response::success('Checklist rejected');
    }

    // Resolve a report
    public function resolveReport(Request $request, array $params): void
    {
        $this->requireModerator($request->userId);

        $reportId = (int) $params['id'];
        $action = $request->body['action'] ?? ''; // 'confirm' or 'dismiss'

        if (!in_array($action, ['confirm', 'dismiss'])) {
            Response::error('Action must be confirm or dismiss');
        }

        $status = $action === 'confirm' ? 'confirmed' : 'dismissed';
        Report::resolve($reportId, $request->userId, $status);

        // Reward reporter if confirmed
        if ($action === 'confirm') {
            $stmt = Database::query('SELECT reporter_id FROM reports WHERE id = ?', [$reportId]);
            $report = $stmt->fetch();
            if ($report) {
                Reputation::award(
                    (int) $report['reporter_id'],
                    Reputation::REPORT_CONFIRMED,
                    'report_confirmed',
                    $reportId
                );
            }
        }

        Response::success("Report {$status}");
    }

    // Get user reputation info
    public function reputation(Request $request, array $params): void
    {
        $userId = $request->userId;
        $score = Reputation::getScore($userId);
        $tier = Reputation::getTier($userId);
        $history = Reputation::getHistory($userId);

        Response::json([
            'score' => $score,
            'tier' => $tier,
            'history' => $history,
        ]);
    }

    private function requireModerator(int $userId): void
    {
        $stmt = Database::query('SELECT role, reputation FROM users WHERE id = ?', [$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('User not found', 404);
        }

        $isModByRole = in_array($user['role'], ['moderator', 'admin']);
        $isModByRep = (int) $user['reputation'] >= Reputation::TIER_MODERATOR;

        if (!$isModByRole && !$isModByRep) {
            Response::error('Moderator access required', 403);
        }
    }
}
