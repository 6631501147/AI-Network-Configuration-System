<?php
/* ================================================================
   setup.php  — One-click database installer for NetConfig AI
   Access via: http://localhost/AI-Network-Configuration-System/setup.php
   DELETE this file after setup is complete!
   ================================================================ */

// ── DB connection settings — change if needed ──────────────────
$DB_HOST = '127.0.0.1';
$DB_PORT = '3306';
$DB_USER = 'root';
$DB_PASS = '';           // XAMPP default is empty password
$DB_NAME = 'netconfig_ai';

$steps   = [];
$success = true;

function step(string $label, bool $ok, string $detail = ''): array {
    return ['label' => $label, 'ok' => $ok, 'detail' => $detail];
}

// ── Only run on POST (button click) ────────────────────────────
$ran = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['run_setup'])) {
    $ran = true;

    // 1. Connect without selecting a database first
    try {
        $dsn = "mysql:host=$DB_HOST;port=$DB_PORT;charset=utf8mb4";
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $steps[] = step('Connect to MySQL', true, "Connected as '$DB_USER' on $DB_HOST:$DB_PORT");
    } catch (PDOException $e) {
        $steps[] = step('Connect to MySQL', false, $e->getMessage());
        $success = false;
        goto render;
    }

    // 2. Create database
    try {
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$DB_NAME`
                    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$DB_NAME`");
        $steps[] = step("Create database '$DB_NAME'", true);
    } catch (PDOException $e) {
        $steps[] = step("Create database '$DB_NAME'", false, $e->getMessage());
        $success = false;
        goto render;
    }

    // 3. Create users table
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
          `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
          `firstname`     VARCHAR(100)    NOT NULL,
          `lastname`      VARCHAR(100)    NOT NULL,
          `student_id`    VARCHAR(10)     NOT NULL,
          `email`         VARCHAR(255)    NOT NULL,
          `role`          ENUM('student','ta','instructor','admin') NOT NULL DEFAULT 'student',
          `password_hash` VARCHAR(255)    NOT NULL,
          `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
          `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `last_login`    DATETIME        NULL,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_email`      (`email`),
          UNIQUE KEY `uq_student_id` (`student_id`),
          INDEX `idx_role`           (`role`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $steps[] = step('Create `users` table', true);
    } catch (PDOException $e) {
        $steps[] = step('Create `users` table', false, $e->getMessage());
        $success = false;
        goto render;
    }

    // 4. Seed admin account (password: Admin@1234)
    try {
        $adminHash = password_hash('Admin@1234', PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $pdo->prepare(
            "INSERT IGNORE INTO `users`
             (firstname, lastname, student_id, email, role, password_hash)
             VALUES ('System', 'Admin', '0000000001', 'admin@lamduan.mfu.ac.th', 'admin', ?)"
        );
        $stmt->execute([$adminHash]);
        $inserted = $stmt->rowCount();
        $steps[] = step(
            'Seed admin account (admin@lamduan.mfu.ac.th / Admin@1234)',
            true,
            $inserted ? 'Created.' : 'Already exists — skipped.'
        );
    } catch (PDOException $e) {
        $steps[] = step('Seed admin account', false, $e->getMessage());
    }

    // 5. Seed demo student account (password: Student@123)
    try {
        $stuHash = password_hash('Student@123', PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $pdo->prepare(
            "INSERT IGNORE INTO `users`
             (firstname, lastname, student_id, email, role, password_hash)
             VALUES ('Demo', 'Student', '6631501001', '6631501001@lamduan.mfu.ac.th', 'student', ?)"
        );
        $stmt->execute([$stuHash]);
        $inserted = $stmt->rowCount();
        $steps[] = step(
            'Seed demo student (6631501001@lamduan.mfu.ac.th / Student@123)',
            true,
            $inserted ? 'Created.' : 'Already exists — skipped.'
        );
    } catch (PDOException $e) {
        $steps[] = step('Seed demo student', false, $e->getMessage());
    }

    // 6. Update api/db.php with the credentials used here
    try {
        $dbFile = __DIR__ . '/api/db.php';
        $content = file_get_contents($dbFile);
        $content = preg_replace("/define\('DB_PASS',\s*'.*?'\)/", "define('DB_PASS', " . var_export($DB_PASS, true) . ")", $content);
        file_put_contents($dbFile, $content);
        $steps[] = step('Update api/db.php with credentials', true);
    } catch (Throwable $e) {
        $steps[] = step('Update api/db.php', false, $e->getMessage());
    }
}

render:
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Setup — NetConfig AI</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #0b0f1a;
      --card:    #111827;
      --border:  #1f2937;
      --gold:    #c6a060;
      --red:     #a01a2e;
      --green:   #22c55e;
      --danger:  #ef4444;
      --text:    #e2e8f0;
      --muted:   #64748b;
      --mono:    'JetBrains Mono', monospace;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 680px;
      box-shadow: 0 0 60px rgba(198,160,96,.08);
    }
    .logo { display: flex; align-items: center; gap: .75rem; margin-bottom: 2rem; }
    .logo-icon {
      width: 44px; height: 44px; border-radius: 10px;
      background: linear-gradient(135deg, var(--gold), var(--red));
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    h1 { font-size: 1.5rem; font-weight: 800; }
    h1 span { color: var(--gold); }
    .subtitle { color: var(--muted); font-size: .85rem; margin-top: .2rem; }

    .config-box {
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    .config-box h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: .8rem; }
    .config-row { display: flex; gap: 1rem; align-items: center; margin-bottom: .5rem; font-size: .88rem; }
    .config-row label { color: var(--muted); width: 120px; flex-shrink: 0; font-family: var(--mono); }
    .config-row input {
      flex: 1;
      background: #161d2b;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: .45rem .75rem;
      color: var(--text);
      font-family: var(--mono);
      font-size: .85rem;
    }
    .config-row input:focus { outline: none; border-color: var(--gold); }

    .btn {
      width: 100%;
      padding: .9rem 1.5rem;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      background: linear-gradient(135deg, var(--gold), #b8934e);
      color: #0b0f1a;
      transition: opacity .2s;
    }
    .btn:hover { opacity: .9; }

    .steps { margin-top: 1.5rem; display: flex; flex-direction: column; gap: .6rem; }
    .step-item {
      display: flex; align-items: flex-start; gap: .75rem;
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: .75rem 1rem;
      font-size: .88rem;
    }
    .step-icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
    .step-label { font-weight: 600; }
    .step-detail { color: var(--muted); font-size: .8rem; margin-top: .2rem; font-family: var(--mono); }

    .result-banner {
      margin-top: 1.5rem;
      padding: 1rem 1.25rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: .95rem;
      display: flex; align-items: center; gap: .6rem;
    }
    .result-banner.ok   { background: rgba(34,197,94,.12);  border: 1px solid rgba(34,197,94,.3);  color: #4ade80; }
    .result-banner.fail { background: rgba(239,68,68,.12);  border: 1px solid rgba(239,68,68,.3);  color: #f87171; }

    .creds-box {
      margin-top: 1.5rem;
      background: rgba(198,160,96,.07);
      border: 1px solid rgba(198,160,96,.25);
      border-radius: 10px;
      padding: 1rem 1.25rem;
    }
    .creds-box h4 { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em; color: var(--gold); margin-bottom: .75rem; }
    .cred-row { display: flex; justify-content: space-between; font-size: .85rem; margin-bottom: .4rem; }
    .cred-row span:first-child { color: var(--muted); }
    .cred-val { font-family: var(--mono); color: var(--text); }

    .warn {
      margin-top: 1.25rem;
      padding: .8rem 1rem;
      border-radius: 8px;
      background: rgba(239,68,68,.1);
      border: 1px solid rgba(239,68,68,.25);
      color: #fca5a5;
      font-size: .82rem;
      line-height: 1.5;
    }
    .next-step {
      margin-top: 1.25rem;
      padding: .8rem 1rem;
      border-radius: 8px;
      background: rgba(56,189,248,.08);
      border: 1px solid rgba(56,189,248,.2);
      color: #7dd3fc;
      font-size: .85rem;
    }
    .next-step a { color: #38bdf8; }
  </style>
</head>
<body>
<div class="card">

  <div class="logo">
    <div class="logo-icon">🔧</div>
    <div>
      <h1>NetConfig AI — <span>DB Setup</span></h1>
      <p class="subtitle">One-click database installer for phpMyAdmin / XAMPP</p>
    </div>
  </div>

  <form method="POST">
    <div class="config-box">
      <h3>⚙️ Database Connection Settings</h3>
      <div class="config-row">
        <label>Host</label>
        <input type="text" name="db_host" value="<?= htmlspecialchars($DB_HOST) ?>">
      </div>
      <div class="config-row">
        <label>Port</label>
        <input type="text" name="db_port" value="<?= htmlspecialchars($DB_PORT) ?>">
      </div>
      <div class="config-row">
        <label>Username</label>
        <input type="text" name="db_user" value="<?= htmlspecialchars($DB_USER) ?>">
      </div>
      <div class="config-row">
        <label>Password</label>
        <input type="password" name="db_pass" placeholder="Leave empty for XAMPP default">
      </div>
      <div class="config-row">
        <label>Database</label>
        <input type="text" name="db_name" value="<?= htmlspecialchars($DB_NAME) ?>">
      </div>
    </div>

    <button type="submit" name="run_setup" value="1" class="btn">
      🚀 Run Database Setup
    </button>
  </form>

  <?php if ($ran): ?>
    <div class="steps">
      <?php foreach ($steps as $s): ?>
        <div class="step-item">
          <span class="step-icon"><?= $s['ok'] ? '✅' : '❌' ?></span>
          <div>
            <div class="step-label"><?= htmlspecialchars($s['label']) ?></div>
            <?php if ($s['detail']): ?>
              <div class="step-detail"><?= htmlspecialchars($s['detail']) ?></div>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <?php if ($success): ?>
      <div class="result-banner ok">✅ Database setup complete!</div>

      <div class="creds-box">
        <h4>🔑 Demo Accounts</h4>
        <div class="cred-row">
          <span>Admin email</span>
          <span class="cred-val">admin@lamduan.mfu.ac.th</span>
        </div>
        <div class="cred-row">
          <span>Admin password</span>
          <span class="cred-val">Admin@1234</span>
        </div>
        <div class="cred-row" style="margin-top:.6rem">
          <span>Student email</span>
          <span class="cred-val">6631501001@lamduan.mfu.ac.th</span>
        </div>
        <div class="cred-row">
          <span>Student password</span>
          <span class="cred-val">Student@123</span>
        </div>
      </div>

      <div class="next-step">
        ➡️ <strong>Go to login page:</strong>
        <a href="login.html">http://localhost/AI-Network-Configuration-System/login.html</a>
      </div>

      <div class="warn">
        ⚠️ <strong>Security:</strong> Delete <code>setup.php</code> from your server after setup is complete!
      </div>

    <?php else: ?>
      <div class="result-banner fail">❌ Setup failed — see errors above.</div>
      <div class="next-step">
        💡 If connection failed, check that <strong>MySQL is started in XAMPP Control Panel</strong>,
        and verify your username/password above.
      </div>
    <?php endif; ?>
  <?php endif; ?>

</div>
</body>
</html>
