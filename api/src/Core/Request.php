<?php

namespace App\Core;

class Request
{
    public string $method;
    public string $uri;
    public array $body;
    public array $query;
    public array $headers;
    public ?int $userId = null;

    public function __construct(string $method, string $uri, array $body, array $query, array $headers)
    {
        $this->method = strtoupper($method);
        $this->uri = $uri;
        $this->body = $body;
        $this->query = $query;
        $this->headers = $headers;
    }

    public static function fromGlobals(): self
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $uri = rtrim($uri, '/') ?: '/';

        // Remove base path if API is in subdirectory
        $basePath = dirname($_SERVER['SCRIPT_NAME']);
        if ($basePath !== '/' && str_starts_with($uri, $basePath)) {
            $uri = substr($uri, strlen($basePath)) ?: '/';
        }

        $body = [];
        $input = file_get_contents('php://input');
        if ($input) {
            $body = json_decode($input, true) ?? [];
        }

        $query = $_GET;

        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $header = str_replace('_', '-', strtolower(substr($key, 5)));
                $headers[$header] = $value;
            }
        }

        return new self($method, $uri, $body, $query, $headers);
    }

    public function getBearer(): ?string
    {
        $auth = $this->headers['authorization'] ?? '';
        if (str_starts_with($auth, 'Bearer ')) {
            return substr($auth, 7);
        }
        return null;
    }
}
