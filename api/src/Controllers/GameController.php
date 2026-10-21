<?php

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Game;
use App\Models\Checklist;

class GameController
{
    public function index(Request $request, array $params): void
    {
        $games = Game::all();
        Response::json(['games' => $games]);
    }

    public function checklists(Request $request, array $params): void
    {
        $slug = $params['slug'];
        $game = Game::findBySlug($slug);

        if (!$game) {
            Response::error('Game not found', 404);
        }

        $checklists = Checklist::findByGameSlug($slug);
        Response::json([
            'game' => $game,
            'checklists' => $checklists,
        ]);
    }
}
