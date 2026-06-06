<?php
/* =========================================================
   api/register.php  — Create a new user account
   POST body (JSON): firstname, lastname, studentId, email,
                     role, password, confirmPassword
   ========================================================= */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';

setCorsHeaders();
handleOptions();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(405, ['ok' => false, 'error' => 'Method not allowed']);
}

/* --- Parse body --- */
$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    jsonOut(400, ['ok' => false, 'error' => 'Invalid JSON body']);
}

$firstname   = trim($body['firstname']   ?? '');
$lastname    = trim($body['lastname']    ?? '');
$studentId   = trim($body['studentId']   ?? '');
$email       = trim($body['email']       ?? '');
$role        = trim($body['role']        ?? '');
$password    = $body['password']         ?? '';
$confirm     = $body['confirmPassword']  ?? '';

/* --- Validation --- */
if (!$firstname || !$lastname || !$studentId || !$email || !$role || !$password || !$confirm) {
    jsonOut(400, ['ok' => false, 'error' => 'All fields are required.']);
}
if (!preg_match('/^\d{10}$/', $studentId)) {
    jsonOut(400, ['ok' => false, 'error' => 'Student ID must be exactly 10 digits.']);
}
if (!str_ends_with($email, '@lamduan.mfu.ac.th')) {
    jsonOut(400, ['ok' => false, 'error' => 'Email must be your official @lamduan.mfu.ac.th address.']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonOut(400, ['ok' => false, 'error' => 'Invalid email format.']);
}
if (strlen($password) < 8) {
    jsonOut(400, ['ok' => false, 'error' => 'Password must be at least 8 characters.']);
}
if ($password !== $confirm) {
    jsonOut(400, ['ok' => false, 'error' => 'Passwords do not match.']);
}
$allowedRoles = ['student', 'ta', 'instructor', 'admin'];
if (!in_array($role, $allowedRoles, true)) {
    jsonOut(400, ['ok' => false, 'error' => 'Invalid role selected.']);
}

/* --- Database checks --- */
$db = getDB();

// Check duplicate email
$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonOut(409, ['ok' => false, 'error' => 'An account with this email already exists.']);
}

// Check duplicate student ID
$stmt = $db->prepare('SELECT id FROM users WHERE student_id = ?');
$stmt->execute([$studentId]);
if ($stmt->fetch()) {
    jsonOut(409, ['ok' => false, 'error' => 'An account with this student ID already exists.']);
}

/* --- Create user --- */
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$stmt = $db->prepare(
    'INSERT INTO users (firstname, lastname, student_id, email, role, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())'
);
$stmt->execute([$firstname, $lastname, $studentId, $email, $role, $hash]);
$newId = (int) $db->lastInsertId();

jsonOut(201, [
    'ok'      => true,
    'message' => 'Account created successfully.',
    'userId'  => $newId,
]);
