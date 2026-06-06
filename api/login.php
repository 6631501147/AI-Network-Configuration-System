<?php
/* =========================================================
   api/login.php  — Authenticate user and start session
   POST body (JSON): email (or studentId), password, remember
   ========================================================= */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';

setCorsHeaders();
handleOptions();

/* --- Session setup --- */
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,   // set true if using HTTPS
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(405, ['ok' => false, 'error' => 'Method not allowed']);
}

/* --- Parse body --- */
$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    jsonOut(400, ['ok' => false, 'error' => 'Invalid JSON body']);
}

$identifier = trim($body['email']    ?? '');   // email or 10-digit student ID
$password   = $body['password']      ?? '';
$remember   = (bool)($body['remember'] ?? false);

if (!$identifier || !$password) {
    jsonOut(400, ['ok' => false, 'error' => 'Email / student ID and password are required.']);
}

/* --- Look up user --- */
$db = getDB();

// Match by email OR student_id
if (preg_match('/^\d{10}$/', $identifier)) {
    $stmt = $db->prepare('SELECT * FROM users WHERE student_id = ? LIMIT 1');
} else {
    $stmt = $db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
}
$stmt->execute([$identifier]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    // Generic message — don't reveal which field was wrong
    jsonOut(401, ['ok' => false, 'error' => 'Invalid credentials. Please try again.']);
}

/* --- Build session --- */
session_regenerate_id(true);
$_SESSION['user_id']    = $user['id'];
$_SESSION['email']      = $user['email'];
$_SESSION['role']       = $user['role'];
$_SESSION['firstname']  = $user['firstname'];
$_SESSION['lastname']   = $user['lastname'];
$_SESSION['student_id'] = $user['student_id'];
$_SESSION['logged_in']  = true;

/* --- Remember-me (30-day persistent cookie) --- */
if ($remember) {
    // Persist session cookie for 30 days
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        session_id(),
        time() + (30 * 24 * 60 * 60),
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

/* --- Update last_login timestamp --- */
$db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
   ->execute([$user['id']]);

jsonOut(200, [
    'ok'      => true,
    'message' => 'Sign in successful.',
    'user'    => [
        'id'        => $user['id'],
        'firstname' => $user['firstname'],
        'lastname'  => $user['lastname'],
        'email'     => $user['email'],
        'studentId' => $user['student_id'],
        'role'      => $user['role'],
    ],
]);
