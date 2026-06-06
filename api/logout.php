<?php
/* =========================================================
   api/logout.php  — Destroy session
   POST (no body needed)
   ========================================================= */

require_once __DIR__ . '/cors.php';

setCorsHeaders();
handleOptions();

session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();
$_SESSION = [];

// Delete session cookie
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

jsonOut(200, ['ok' => true, 'message' => 'Logged out.']);
