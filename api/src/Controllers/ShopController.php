<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Subscription;

class ShopController
{
    // Get available plans and user's current subscription
    public function plans(Request $request, array $params): void
    {
        $activeSub = Subscription::getActive($request->userId);
        $isVip = Subscription::isVip($request->userId);

        $plans = [];
        foreach (Subscription::PLANS as $id => $plan) {
            $plans[] = [
                'id' => $id,
                'label' => $plan['label'],
                'price_cents' => $plan['price'],
                'duration_days' => $plan['duration_days'],
            ];
        }

        Response::json([
            'plans' => $plans,
            'is_vip' => $isVip,
            'active_subscription' => $activeSub,
        ]);
    }

    // Create a checkout session (Stripe-ready)
    public function checkout(Request $request, array $params): void
    {
        $plan = $request->body['plan'] ?? '';

        if (!isset(Subscription::PLANS[$plan])) {
            Response::error('Invalid plan. Choose: monthly, yearly, or lifetime');
        }

        $planConfig = Subscription::PLANS[$plan];

        // In production, this would create a Stripe/PayPal session
        // For now, simulate with a checkout URL
        $checkoutId = bin2hex(random_bytes(16));

        // Store pending checkout in session/cache (simplified: in payment_logs)
        Subscription::logPayment(
            $request->userId,
            null,
            'checkout_created',
            'stripe',
            $checkoutId,
            $planConfig['price'],
            ['plan' => $plan]
        );

        Response::json([
            'checkout_id' => $checkoutId,
            'checkout_url' => $_ENV['APP_URL'] . "/checkout/confirm?id={$checkoutId}&plan={$plan}",
            'plan' => $plan,
            'amount_cents' => $planConfig['price'],
        ]);
    }

    // Confirm payment (webhook or redirect callback)
    public function confirm(Request $request, array $params): void
    {
        $checkoutId = $request->body['checkout_id'] ?? '';
        $plan = $request->body['plan'] ?? '';
        $provider = $request->body['provider'] ?? 'stripe';

        if (!$checkoutId || !isset(Subscription::PLANS[$plan])) {
            Response::error('Invalid confirmation data');
        }

        $planConfig = Subscription::PLANS[$plan];

        // Create subscription
        $subId = Subscription::create(
            $request->userId,
            $plan,
            $provider,
            $checkoutId,
            $planConfig['price']
        );

        // Log successful payment
        Subscription::logPayment(
            $request->userId,
            $subId,
            'payment_confirmed',
            $provider,
            $checkoutId,
            $planConfig['price'],
            ['plan' => $plan]
        );

        Response::json([
            'message' => 'VIP activated!',
            'subscription_id' => $subId,
            'is_vip' => true,
        ], 201);
    }

    // Cancel subscription
    public function cancel(Request $request, array $params): void
    {
        $activeSub = Subscription::getActive($request->userId);

        if (!$activeSub) {
            Response::error('No active subscription to cancel');
        }

        Subscription::cancel((int) $activeSub['id'], $request->userId);

        Subscription::logPayment(
            $request->userId,
            (int) $activeSub['id'],
            'subscription_cancelled',
            $activeSub['payment_provider'] ?? 'manual',
            null,
            null,
            null
        );

        Response::success('Subscription cancelled');
    }

    // Get subscription history
    public function history(Request $request, array $params): void
    {
        $history = Subscription::getHistory($request->userId);
        $isVip = Subscription::isVip($request->userId);

        Response::json([
            'is_vip' => $isVip,
            'subscriptions' => $history,
        ]);
    }

    // Webhook endpoint for payment provider (Stripe/PayPal)
    public function webhook(Request $request, array $params): void
    {
        // In production: verify signature, process event
        $event = $request->body['type'] ?? '';
        $data = $request->body['data'] ?? [];

        // Placeholder for Stripe webhook handling
        switch ($event) {
            case 'checkout.session.completed':
                // Activate subscription
                break;
            case 'invoice.payment_failed':
                // Mark subscription as expired
                break;
            case 'customer.subscription.deleted':
                // Cancel subscription
                break;
        }

        Response::json(['received' => true]);
    }
}
