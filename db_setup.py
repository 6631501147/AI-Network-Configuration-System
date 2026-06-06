"""
db_setup.py — One-time database initializer for NetConfig AI
Run:  python db_setup.py
"""
import pymysql
import bcrypt

DB_HOST = '127.0.0.1'
DB_PORT = 3306
DB_USER = 'root'
DB_PASS = ''           # XAMPP default — change if you set a root password
DB_NAME = 'netconfig_ai'

def run():
    print("NetConfig AI — Database Setup")
    print("=" * 40)

    # Connect without selecting a DB first
    conn = pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER,
                           password=DB_PASS, charset='utf8mb4')
    cur  = conn.cursor()

    # 1. Create database
    cur.execute(
        f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    )
    cur.execute(f"USE `{DB_NAME}`")
    print(f"[OK] Database '{DB_NAME}' ready.")

    # 2. Create users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS `users` (
          `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
          `firstname`     VARCHAR(100)    NOT NULL,
          `lastname`      VARCHAR(100)    NOT NULL,
          `student_id`    VARCHAR(10)     NOT NULL,
          `email`         VARCHAR(255)    NOT NULL,
          `role`          ENUM('student','ta','instructor','admin')
                          NOT NULL DEFAULT 'student',
          `password_hash` VARCHAR(255)    NOT NULL,
          `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
          `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `last_login`    DATETIME        NULL,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_email`      (`email`),
          UNIQUE KEY `uq_student_id` (`student_id`),
          INDEX `idx_role`           (`role`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    print("[OK] Table 'users' ready.")

    # 3. Seed demo accounts
    demo_accounts = [
        ('System', 'Admin', '0000000001',
         'admin@lamduan.mfu.ac.th', 'admin', b'Admin@1234'),
        ('Demo', 'Student', '6631501001',
         '6631501001@lamduan.mfu.ac.th', 'student', b'Student@123'),
    ]
    for fn, ln, sid, email, role, pw in demo_accounts:
        pw_hash = bcrypt.hashpw(pw, bcrypt.gensalt(12)).decode()
        cur.execute(
            "INSERT IGNORE INTO `users` "
            "(firstname, lastname, student_id, email, role, password_hash) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (fn, ln, sid, email, role, pw_hash)
        )
        if cur.rowcount:
            print(f"[OK] Seeded: {email} (password: {pw.decode()})")
        else:
            print(f"[--] Already exists: {email}")

    conn.commit()

    # 4. Show final user list
    cur.execute("SELECT id, email, role FROM `users` ORDER BY id")
    rows = cur.fetchall()
    print(f"\nUsers in database ({len(rows)} total):")
    for r in rows:
        print(f"  id={r[0]}  role={r[2]}  email={r[1]}")

    conn.close()
    print("\nSetup complete! Now restart start_dashboard.py")

if __name__ == '__main__':
    try:
        run()
    except pymysql.MySQLError as e:
        print(f"\n[ERROR] MySQL: {e}")
        print("Make sure MySQL is running in XAMPP Control Panel.")
    except Exception as e:
        print(f"\n[ERROR] {e}")
