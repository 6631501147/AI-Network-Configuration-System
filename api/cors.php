<?php
/* =========================================================
   api/cors.php  — CORS + JSON headers helper
   ========================================================= */

function setCorsHeaders(): void {
    // Allow requests from the Python dev server and XAMPP
    $allowed = ['http://localhost:8000', 'http://localhost', 'http://127.0.0.1:8000', 'http://127.0.0.1'];
    $origin   = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: $origin");
    } else {
        header('Access-Control-Allow-Origin: *');
    }
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');
}

function handleOptions(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        setCorsHeaders();
        http_response_code(204);
        exit;
    }
}

function jsonOut(int $code, array $payload): never {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}
