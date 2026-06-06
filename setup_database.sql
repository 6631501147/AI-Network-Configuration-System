-- ==========================================================
--  NetConfig AI · MFU IAM — Database Setup
--  Run this in phpMyAdmin SQL tab, or via MySQL CLI:
--    mysql -u root -p < setup_database.sql
-- ==========================================================

-- 1. Create database
CREATE DATABASE IF NOT EXISTS `netconfig_ai`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `netconfig_ai`;

-- 2. Users table
CREATE TABLE IF NOT EXISTS `users` (
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
  INDEX  `idx_role`          (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. (Optional) Seed an admin account
--    Password: Admin@1234  (bcrypt hash generated with cost=12)
INSERT IGNORE INTO `users`
  (firstname, lastname, student_id, email, role, password_hash, created_at)
VALUES (
  'System',
  'Admin',
  '0000000001',
  'admin@lamduan.mfu.ac.th',
  'admin',
  '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: Admin@1234
  NOW()
);

-- 4. (Optional) Seed a demo student account
--    Password: Student@123
INSERT IGNORE INTO `users`
  (firstname, lastname, student_id, email, role, password_hash, created_at)
VALUES (
  'Demo',
  'Student',
  '6631501001',
  '6631501001@lamduan.mfu.ac.th',
  'student',
  '$2y$12$e.o./S7Xt./Ln8X9z9Vb8enbHNP6J7b8XxzW5zS7k0JX3XNkQ4QwO', -- password: Student@123
  NOW()
);
