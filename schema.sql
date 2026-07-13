-- ============================================
-- bidernet · מערכת משימות ועדכונים (v1.0-php)
-- tasks.bidernet.co.il
-- ============================================
-- הרץ פעם אחת ב-phpMyAdmin של השרת החדש
-- ============================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ========== USERS (עובדים + לקוחות) ==========
CREATE TABLE IF NOT EXISTS `users` (
  `id`           VARCHAR(50) PRIMARY KEY,
  `username`     VARCHAR(100) UNIQUE NOT NULL,
  `password`     VARCHAR(255) NOT NULL COMMENT 'password_hash — לא טקסט גלוי',
  `name`         VARCHAR(200) NOT NULL,
  `email`        VARCHAR(200),
  `phone`        VARCHAR(50),
  `role`         ENUM('admin','client') NOT NULL DEFAULT 'admin',
  `jobTitle`     VARCHAR(100) COMMENT 'תפקיד — רשימה פתוחה: קופי / גרפיקה / מדיה...',
  `color`        VARCHAR(20) DEFAULT '#013d19' COMMENT 'צבע אווטאר בלוח',
  `businessName` VARCHAR(200) COMMENT 'ללקוחות — שם העסק שלהם',
  `active`       TINYINT(1) DEFAULT 1,
  `createdAt`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== CLIENTS (לקוחות המשרד) ==========
CREATE TABLE IF NOT EXISTS `clients` (
  `id`        VARCHAR(50) PRIMARY KEY,
  `name`      VARCHAR(200) UNIQUE NOT NULL,
  `color`     VARCHAR(20) DEFAULT '#013d19',
  `contact`   VARCHAR(200),
  `active`    TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== TASKS ==========
CREATE TABLE IF NOT EXISTS `tasks` (
  `id`              VARCHAR(50) PRIMARY KEY,
  `title`           VARCHAR(500) NOT NULL,
  `description`     LONGTEXT,
  `clientName`      VARCHAR(200) COMMENT 'clients.name',
  `assignedTo`      VARCHAR(100) COMMENT 'users.username',
  `status`          VARCHAR(30) NOT NULL DEFAULT 'todo' COMMENT 'todo|in_progress|review|done',
  `priority`        VARCHAR(20) NOT NULL DEFAULT 'normal' COMMENT 'low|normal|high|urgent',
  `dueDate`         DATE NULL,
  `position`        INT DEFAULT 0,
  `visibleToClient` TINYINT(1) DEFAULT 0 COMMENT 'האם הלקוח רואה את המשימה',
  `createdBy`       VARCHAR(100),
  `createdAt`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_assignedTo` (`assignedTo`),
  INDEX `idx_clientName` (`clientName`),
  INDEX `idx_dueDate` (`dueDate`),
  INDEX `idx_updatedAt` (`updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== TASK COMMENTS (עדכונים) ==========
CREATE TABLE IF NOT EXISTS `task_comments` (
  `id`             VARCHAR(50) PRIMARY KEY,
  `taskId`         VARCHAR(50) NOT NULL,
  `senderUsername` VARCHAR(100),
  `senderName`     VARCHAR(200),
  `message`        TEXT NOT NULL,
  `createdAt`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_taskId` (`taskId`),
  CONSTRAINT `fk_comments_task` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== TASK ACTIVITY (יומן אוטומטי) ==========
CREATE TABLE IF NOT EXISTS `task_activity` (
  `id`         VARCHAR(50) PRIMARY KEY,
  `taskId`     VARCHAR(50) NOT NULL,
  `actorName`  VARCHAR(200),
  `field`      VARCHAR(50),
  `oldValue`   VARCHAR(255),
  `newValue`   VARCHAR(255),
  `createdAt`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_taskId` (`taskId`),
  CONSTRAINT `fk_activity_task` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== TASK FILES ==========
CREATE TABLE IF NOT EXISTS `task_files` (
  `id`         VARCHAR(50) PRIMARY KEY,
  `taskId`     VARCHAR(50) NOT NULL,
  `fileName`   VARCHAR(255) NOT NULL,
  `filePath`   VARCHAR(500) NOT NULL COMMENT 'נתיב יחסי ב-uploads/ — לא base64',
  `mimeType`   VARCHAR(100),
  `sizeBytes`  BIGINT,
  `uploadedBy` VARCHAR(200),
  `createdAt`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_taskId` (`taskId`),
  CONSTRAINT `fk_files_task` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- נתוני התחלה
-- ============================================

-- מנהל ראשי · שם משתמש: admin · סיסמה: bidernet2026
-- ⚠️ החלף סיסמה מיד אחרי ההתחברות הראשונה (מסך "צוות")
INSERT INTO `users` (`id`,`username`,`password`,`name`,`role`,`jobTitle`,`color`) VALUES
('u_admin','admin','$2y$10$iAz8gUkusNiAlPbbBQHG1uZUVVoAy7cD8CDvSxxhroh0gIne2KjPW','מנהל ראשי','admin','ניהול','#013d19')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- לקוחות המשרד (הוסף/ערוך מהממשק — מסך "לקוחות")
INSERT INTO `clients` (`id`,`name`,`color`) VALUES
('c_01','אור הובלות',            '#f43f5e'),
('c_02','רשת בולס',              '#3b82f6'),
('c_03','האחוזה סנדרין',         '#10b981'),
('c_04','גולאסו - חולון',        '#84cc16'),
('c_05','בישולים',               '#f59e0b'),
('c_06','הום סטייל',             '#14b8a6'),
('c_07','סוויץ תאורה',           '#ec4899'),
('c_08','מאפיית שילת',           '#8b5cf6'),
('c_09','סנט מוריץ',             '#0ea5e9'),
('c_10','לב פתרונות פיננסים',    '#64748b'),
('c_11','עו״ד מיכאל בן שטרית',   '#78716c')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- ============================================
-- WHATSAPP (v1.1)
-- ============================================

-- הגדרות מערכת (שורה אחת)
CREATE TABLE IF NOT EXISTS `settings` (
  `id`            INT PRIMARY KEY DEFAULT 1,
  `waProvider`    VARCHAR(30) DEFAULT 'whapi' COMMENT 'whapi | greenapi',
  `waBaseUrl`     VARCHAR(255) COMMENT 'https://gate.whapi.cloud',
  `waToken`       VARCHAR(255),
  `waInstanceId`  VARCHAR(100) COMMENT 'Green API בלבד',
  `waEnabled`     TINYINT(1) DEFAULT 0,
  `waTemplate`    TEXT COMMENT 'תבנית ההודעה. משתנים: {task} {client} {status} {user}',
  `updatedAt`     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`id`,`waProvider`,`waEnabled`,`waTemplate`)
VALUES (1,'whapi',0,'שלום {client} 👋\nהמשימה "{task}" הושלמה.\n\nצוות בידרנט')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- שדות וואטסאפ ללקוח
ALTER TABLE `clients` ADD COLUMN IF NOT EXISTS `phone`      VARCHAR(30)  NULL COMMENT 'פורמט בינלאומי: 9725...';
ALTER TABLE `clients` ADD COLUMN IF NOT EXISTS `waGroupId`  VARCHAR(100) NULL COMMENT 'מזהה קבוצה: 12036...@g.us';

-- יומן שליחות
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         VARCHAR(50) PRIMARY KEY,
  `taskId`     VARCHAR(50),
  `clientName` VARCHAR(200),
  `target`     VARCHAR(120) COMMENT 'המספר או מזהה הקבוצה',
  `channel`    VARCHAR(20)  COMMENT 'group | phone',
  `message`    TEXT,
  `status`     VARCHAR(20)  COMMENT 'sent | failed',
  `response`   TEXT,
  `sentBy`     VARCHAR(200),
  `createdAt`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_taskId` (`taskId`),
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- UPDATES / התראות (v1.2)
-- ============================================

-- תגובה פנימית (ברירת מחדל) מול תגובה שהלקוח רואה
ALTER TABLE `task_comments` ADD COLUMN IF NOT EXISTS `internal` TINYINT(1) DEFAULT 1
  COMMENT '1 = פנימי לצוות · 0 = גלוי גם ללקוח';

-- מתי כל משתמש ראה לאחרונה את פיד העדכונים
CREATE TABLE IF NOT EXISTS `updates_seen` (
  `username` VARCHAR(100) PRIMARY KEY,
  `seenAt`   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- עריכת תגובות (v1.3)
ALTER TABLE `task_comments` ADD COLUMN IF NOT EXISTS `editedAt` DATETIME NULL;

-- התראות לעובדים בוואטסאפ (v1.4)
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `waStaffTemplate` TEXT
  COMMENT 'תבנית ההתראה לעובד. משתנים: {task} {client} {status} {user} {due} {priority}';

UPDATE `settings` SET `waStaffTemplate` =
'שלום {user} 👋\nנכנסה לך משימה חדשה:\n\n📌 {task}\n🏢 לקוח: {client}\n📅 דדליין: {due}\n⚡ עדיפות: {priority}\n\nמערכת המשימות · בידרנט'
WHERE `id` = 1 AND (`waStaffTemplate` IS NULL OR `waStaffTemplate` = '');

-- ============================================
-- זכור אותי + שחזור סיסמה (v1.5)
-- ============================================

-- "זכור אותי" — טוקן מאוחסן כ-hash, לא כטקסט
CREATE TABLE IF NOT EXISTS `remember_tokens` (
  `id`        VARCHAR(50) PRIMARY KEY,
  `username`  VARCHAR(100) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`),
  INDEX `idx_expiresAt` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- שחזור סיסמה — טוקן חד-פעמי לשעה
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id`        VARCHAR(50) PRIMARY KEY,
  `username`  VARCHAR(100) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt`    DATETIME NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
