-- ============================================
-- bidernet · תיקון מסד נתונים קיים  (repair v1.0.3)
-- ============================================
-- מיועד למסד שכבר הותקן והייבוא שלו נקטע באמצע.
-- בטוח להרצה חוזרת — לא מוחק משימות, לא מוחק משתמשים.
--
-- ⚠️ הרץ בלשונית SQL של phpMyAdmin (לא Import),
--    כדי שהעברית תיכנס בקידוד נכון.
-- ============================================

SET NAMES utf8mb4;

-- ========== 1. טבלאות שאולי לא נוצרו ==========

CREATE TABLE IF NOT EXISTS `settings` (
  `id`              INT PRIMARY KEY,
  `waProvider`      VARCHAR(30) DEFAULT 'whapi',
  `waBaseUrl`       VARCHAR(255) NULL,
  `waToken`         VARCHAR(255) NULL,
  `waInstanceId`    VARCHAR(100) NULL,
  `waEnabled`       TINYINT(1) DEFAULT 0,
  `waTemplate`      TEXT NULL,
  `waStaffTemplate` TEXT NULL,
  `updatedAt`       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         VARCHAR(50) PRIMARY KEY,
  `taskId`     VARCHAR(50)  NULL,
  `clientName` VARCHAR(200) NULL,
  `target`     VARCHAR(120) NULL,
  `channel`    VARCHAR(20)  NULL,
  `message`    TEXT NULL,
  `status`     VARCHAR(20)  NULL,
  `response`   TEXT NULL,
  `sentBy`     VARCHAR(200) NULL,
  `createdAt`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notif_task` (`taskId`),
  INDEX `idx_notif_date` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `updates_seen` (
  `username` VARCHAR(100) PRIMARY KEY,
  `seenAt`   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `remember_tokens` (
  `id`        VARCHAR(50) PRIMARY KEY,
  `username`  VARCHAR(100) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_remember_user` (`username`),
  INDEX `idx_remember_exp`  (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id`        VARCHAR(50) PRIMARY KEY,
  `username`  VARCHAR(100) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt`    DATETIME NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_reset_user` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== 2. עמודות חסרות — מתווספות רק אם אינן קיימות ==========
-- (עובד גם ב-MySQL וגם ב-MariaDB)

SET @db = DATABASE();

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='phone') > 0,
  'SELECT 1', 'ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(30) NULL'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='clients' AND COLUMN_NAME='phone') > 0,
  'SELECT 1', 'ALTER TABLE `clients` ADD COLUMN `phone` VARCHAR(30) NULL'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='clients' AND COLUMN_NAME='waGroupId') > 0,
  'SELECT 1', 'ALTER TABLE `clients` ADD COLUMN `waGroupId` VARCHAR(100) NULL'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='task_comments' AND COLUMN_NAME='internal') > 0,
  'SELECT 1', 'ALTER TABLE `task_comments` ADD COLUMN `internal` TINYINT(1) DEFAULT 1'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='task_comments' AND COLUMN_NAME='editedAt') > 0,
  'SELECT 1', 'ALTER TABLE `task_comments` ADD COLUMN `editedAt` DATETIME NULL'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='settings' AND COLUMN_NAME='waStaffTemplate') > 0,
  'SELECT 1', 'ALTER TABLE `settings` ADD COLUMN `waStaffTemplate` TEXT NULL'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ========== 3. הגדרות ברירת מחדל ==========

INSERT INTO `settings` (`id`,`waProvider`,`waEnabled`,`waTemplate`,`waStaffTemplate`) VALUES
(1,'whapi',0,
 'שלום {client} 👋\nהמשימה "{task}" הושלמה.\n\nצוות בידרנט',
 'שלום {user} 👋\nנכנסה לך משימה חדשה:\n\n📌 {task}\n🏢 לקוח: {client}\n📅 דדליין: {due}\n⚡ עדיפות: {priority}\n\nמערכת המשימות · בידרנט')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- ========== 4. תיקון העברית השבורה ==========
-- הלקוחות והמשתמשים שנוצרו בייבוא הפגום נשמרו כ-?????? — הטקסט המקורי אבד.
-- כאן הם נכתבים מחדש. משימות קיימות לא נמחקות.

DELETE FROM `clients` WHERE `name` LIKE '%?%';

INSERT INTO `clients` (`id`,`name`,`color`) VALUES
('c_01','אור הובלות',          '#f43f5e'),
('c_02','רשת בולס',            '#3b82f6'),
('c_03','האחוזה סנדרין',       '#10b981'),
('c_04','גולאסו - חולון',      '#84cc16'),
('c_05','בישולים',             '#f59e0b'),
('c_06','הום סטייל',           '#14b8a6'),
('c_07','סוויץ תאורה',         '#ec4899'),
('c_08','מאפיית שילת',         '#8b5cf6'),
('c_09','סנט מוריץ',           '#0ea5e9'),
('c_10','לב פתרונות פיננסים',  '#64748b'),
('c_11','עו״ד מיכאל בן שטרית', '#78716c')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `color`=VALUES(`color`), `active`=1;

-- שם המנהל שנשמר כ-????
UPDATE `users` SET `name`='מנהל ראשי', `jobTitle`='ניהול'
WHERE `username`='admin' AND `name` LIKE '%?%';

-- ========== 5. בדיקה ==========
SELECT 'טבלאות' AS bodek, COUNT(*) AS total
FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()
UNION ALL
SELECT 'לקוחות', COUNT(*) FROM `clients`
UNION ALL
SELECT 'משתמשים', COUNT(*) FROM `users`;
-- צפוי: 11 טבלאות, 11 לקוחות
