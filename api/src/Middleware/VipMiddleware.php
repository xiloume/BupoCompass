<?php

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Models\Subscription;

class VipMiddleware
{
    public static function handle(Request $request): void
    {
        if (!$request->userId) {
            Response::error('Authentication required', 401);
        }

        if (!Subscription::isVip($request->userId)) {
            Response::error('VIP subscription required', 403);
        }
    }
}
