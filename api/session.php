<?php
/* =========================================================
   api/session.php  — Return current session info (GET)
   Used by dashboard.html to verify the user is logged in.
   ========================================================= */

require_once __DIR__ . '/cors.php';

setCorsHeaders();
handleOptions();

session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();

if (!empty($_SESSION['logged_in'])) {
    jsonOut(200, [
        'ok'        => true,
        'loggedIn'  => true,
        'user'      => [
            'id'        => $_SESSION['user_id'],
            'firstname' => $_SESSION['firstname'],
            'lastname'  => $_SESSION['lastname'],
            'email'     => $_SESSION['email'],
            'studentId' => $_SESSION['student_id'],
            'role'      => $_SESSION['role'],
        ],
    ]);
} else {
    jsonOut(200, ['ok' => true, 'loggedIn' => false]);
}
