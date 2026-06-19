<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

abstract class Controller
{
    protected function getJsonBody(Request $request): array
    {
        return $request->json()->all() ?? [];
    }
}
