<?php

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use App\Core\Router;
use App\Core\Request;
use App\Core\Response;
use App\Core\Database;
use App\Middleware\CorsMiddleware;
use App\Middleware\AuthMiddleware;
use Dotenv\Dotenv;

// Load environment
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Initialize database
Database::init();

// CORS
CorsMiddleware::handle();

// Router
$router = new Router();

// Public routes
$router->post('/auth/register', 'AuthController@register');
$router->post('/auth/login', 'AuthController@login');
$router->post('/auth/refresh', 'AuthController@refresh');

// Protected routes
$router->get('/checklists', 'ChecklistController@index', [AuthMiddleware::class]);
$router->get('/checklists/{id}', 'ChecklistController@show', [AuthMiddleware::class]);
$router->post('/checklists', 'ChecklistController@store', [AuthMiddleware::class]);
$router->put('/checklists/{id}', 'ChecklistController@update', [AuthMiddleware::class]);
$router->delete('/checklists/{id}', 'ChecklistController@destroy', [AuthMiddleware::class]);
$router->post('/checklists/{id}/fork', 'ChecklistController@fork', [AuthMiddleware::class]);

// Public browsing
$router->get('/games', 'GameController@index');
$router->get('/games/{slug}/checklists', 'GameController@checklists');

// Community
$router->post('/checklists/{id}/publish', 'CommunityController@publish', [AuthMiddleware::class]);
$router->post('/checklists/{id}/vote', 'CommunityController@vote', [AuthMiddleware::class]);
$router->get('/community/browse', 'CommunityController@browse', [AuthMiddleware::class]);

// Moderation
$router->post('/checklists/{id}/report', 'ModerationController@report', [AuthMiddleware::class]);
$router->get('/moderation/pending', 'ModerationController@pending', [AuthMiddleware::class]);
$router->post('/moderation/checklists/{id}/approve', 'ModerationController@approve', [AuthMiddleware::class]);
$router->post('/moderation/checklists/{id}/reject', 'ModerationController@reject', [AuthMiddleware::class]);
$router->post('/moderation/reports/{id}/resolve', 'ModerationController@resolveReport', [AuthMiddleware::class]);
$router->get('/reputation', 'ModerationController@reputation', [AuthMiddleware::class]);

// Versioning
$router->post('/checklists/{id}/versions', 'VersionController@publish', [AuthMiddleware::class]);
$router->get('/checklists/{id}/versions', 'VersionController@history', [AuthMiddleware::class]);
$router->get('/checklists/{id}/versions/{version}', 'VersionController@show', [AuthMiddleware::class]);

// Notifications
$router->get('/notifications', 'NotificationController@index', [AuthMiddleware::class]);
$router->post('/notifications/{id}/read', 'NotificationController@markRead', [AuthMiddleware::class]);
$router->post('/notifications/read-all', 'NotificationController@markAllRead', [AuthMiddleware::class]);
$router->post('/checklists/{id}/subscribe', 'NotificationController@subscribe', [AuthMiddleware::class]);
$router->delete('/checklists/{id}/subscribe', 'NotificationController@unsubscribe', [AuthMiddleware::class]);

// Stats
$router->get('/stats', 'StatsController@overview', [AuthMiddleware::class]);

// Shop / VIP
$router->get('/shop/plans', 'ShopController@plans', [AuthMiddleware::class]);
$router->post('/shop/checkout', 'ShopController@checkout', [AuthMiddleware::class]);
$router->post('/shop/confirm', 'ShopController@confirm', [AuthMiddleware::class]);
$router->post('/shop/cancel', 'ShopController@cancel', [AuthMiddleware::class]);
$router->get('/shop/history', 'ShopController@history', [AuthMiddleware::class]);
$router->post('/shop/webhook', 'ShopController@webhook');

// Markers (VIP)
$router->post('/items/{id}/marker', 'MarkerController@set', [AuthMiddleware::class]);
$router->delete('/items/{id}/marker', 'MarkerController@delete', [AuthMiddleware::class]);
$router->get('/checklists/{id}/markers', 'MarkerController@forChecklist', [AuthMiddleware::class]);
$router->get('/markers/icons', 'MarkerController@icons', [AuthMiddleware::class]);

// Pairing
$router->post('/pairing/create', 'PairingController@createToken', [AuthMiddleware::class]);
$router->post('/pairing/validate', 'PairingController@validateToken');

// Progress sync
$router->patch('/progress', 'ProgressController@sync', [AuthMiddleware::class]);
$router->get('/progress/sync', 'ProgressController@pull', [AuthMiddleware::class]);

// Dispatch
$request = Request::fromGlobals();
$router->dispatch($request);
