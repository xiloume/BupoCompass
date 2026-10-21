<?php

namespace App\Core;

class Router
{
    private array $routes = [];

    public function get(string $path, string $handler, array $middleware = []): void
    {
        $this->addRoute('GET', $path, $handler, $middleware);
    }

    public function post(string $path, string $handler, array $middleware = []): void
    {
        $this->addRoute('POST', $path, $handler, $middleware);
    }

    public function put(string $path, string $handler, array $middleware = []): void
    {
        $this->addRoute('PUT', $path, $handler, $middleware);
    }

    public function patch(string $path, string $handler, array $middleware = []): void
    {
        $this->addRoute('PATCH', $path, $handler, $middleware);
    }

    public function delete(string $path, string $handler, array $middleware = []): void
    {
        $this->addRoute('DELETE', $path, $handler, $middleware);
    }

    private function addRoute(string $method, string $path, string $handler, array $middleware): void
    {
        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'handler' => $handler,
            'middleware' => $middleware,
        ];
    }

    public function dispatch(Request $request): void
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method) continue;

            $params = $this->matchRoute($route['path'], $request->uri);
            if ($params === false) continue;

            // Run middleware
            foreach ($route['middleware'] as $middlewareClass) {
                $middlewareClass::handle($request);
            }

            // Parse handler
            [$controllerName, $method] = explode('@', $route['handler']);
            $controllerClass = "App\\Controllers\\{$controllerName}";

            if (!class_exists($controllerClass)) {
                Response::error("Controller {$controllerName} not found", 500);
            }

            $controller = new $controllerClass();
            $controller->$method($request, $params);
            return;
        }

        Response::error('Route not found', 404);
    }

    private function matchRoute(string $routePath, string $requestUri): array|false
    {
        $routeParts = explode('/', trim($routePath, '/'));
        $uriParts = explode('/', trim($requestUri, '/'));

        if (count($routeParts) !== count($uriParts)) return false;

        $params = [];
        foreach ($routeParts as $i => $part) {
            if (str_starts_with($part, '{') && str_ends_with($part, '}')) {
                $paramName = trim($part, '{}');
                $params[$paramName] = $uriParts[$i];
            } elseif ($part !== $uriParts[$i]) {
                return false;
            }
        }

        return $params;
    }
}
