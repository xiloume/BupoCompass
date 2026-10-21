<?php

namespace App\Models;

use App\Core\Database;

class Subscription
{
    const PLANS = [
        'monthly' => ['price' => 499, 'label' => '4,99€/mois', 'duration_days' => 30],
        'yearly' => ['price' => 3999, 'label' => '39,99€/an', 'duration_days' => 365],
        'lifetime' => ['price' => 9999, 'label' => '99,99€ à vie', 'duration_days' => null],
    ];

    public static function getActive(int $userId): ?array
    {
        $stmt = Database::query(
            "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY expires_at DESC LIMIT 1",
            [$userId]
        );
        return $stmt->fetch() ?: null;
    }

    public static function isVip(int $userId): bool
    {
        $stmt = Database::query(
            'SELECT is_vip, vip_expires_at FROM users WHERE id = ?',
            [$userId]
        );
        $user = $stmt->fetch();
        if (!$user || !$user['is_vip']) return false;

        // Check expiry (null = lifetime)
        if ($user['vip_expires_at'] === null) return true;
        return strtotime($user['vip_expires_at']) > time();
    }

    public static function create(int $userId, string $plan, string $provider, string $paymentId, int $amountCents): int
    {
        $planConfig = self::PLANS[$plan] ?? null;
        if (!$planConfig) throw new \Exception("Invalid plan: $plan");

        $startsAt = date('Y-m-d H:i:s');
        $expiresAt = $planConfig['duration_days']
            ? date('Y-m-d H:i:s', time() + ($planConfig['duration_days'] * 86400))
            : null;

        Database::query(
            'INSERT INTO subscriptions (user_id, plan, status, payment_provider, payment_id, amount_cents, starts_at, expires_at, created_at)
             VALUES (?, ?, "active", ?, ?, ?, ?, ?, NOW())',
            [$userId, $plan, $provider, $paymentId, $amountCents, $startsAt, $expiresAt]
        );

        $subId = (int) Database::get()->lastInsertId();

        // Update user VIP status
        Database::query(
            'UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE id = ?',
            [$expiresAt, $userId]
        );

        return $subId;
    }

    public static function cancel(int $subscriptionId, int $userId): void
    {
        Database::query(
            "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = ? AND user_id = ?",
            [$subscriptionId, $userId]
        );

        // Check if user has other active subs
        $other = self::getActive($userId);
        if (!$other) {
            Database::query(
                'UPDATE users SET is_vip = 0, vip_expires_at = NULL WHERE id = ?',
                [$userId]
            );
        }
    }

    public static function getHistory(int $userId): array
    {
        $stmt = Database::query(
            'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC',
            [$userId]
        );
        return $stmt->fetchAll();
    }

    public static function logPayment(int $userId, ?int $subId, string $event, string $provider, ?string $eventId, ?int $amount, ?array $metadata): void
    {
        Database::query(
            'INSERT INTO payment_logs (user_id, subscription_id, event, provider, provider_event_id, amount_cents, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [$userId, $subId, $event, $provider, $eventId, $amount, $metadata ? json_encode($metadata) : null]
        );
    }
}
