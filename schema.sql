-- ============================================
-- bidernet · מערכת משימות ועדכונים
-- schema v1.0.3
-- ============================================
-- ⚠️ בייבוא ב-phpMyAdmin: בתיבה "Character set of the file"
--    חייב להיות utf-8 — אחרת העברית תיהפך ל-??????
--
-- תואם MySQL 5.7+ וגם MariaDB. אין ALTER TABLE:
-- כל הטבלאות נוצרות שלמות, כדי שהייבוא לא ייקטע באמצע.
-- ============================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS `users` (
  `id`           VARCHAR(50) PRIMARY KEY,
  `username`     VARCHAR(100) UNIQUE NOT NULL,
  `password`     VARCHAR(255) NOT NULL,
  `name`         VARCHAR(200) NOT NULL,
  `email`        VARCHAR(200) NULL,
  `phone`        VARCHAR(30)  NULL,
  `role`         ENUM('admin','client') NOT NULL DEFAULT 'admin',
  `jobTitle`     VARCHAR(100) NULL,
  `color`        VARCHAR(20)  DEFAULT '#013d19',
  `businessName` VARCHAR(200) NULL,
  `active`       TINYINT(1)   DEFAULT 1,
  `createdAt`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clients` (
  `id`        VARCHAR(50) PRIMARY KEY,
  `name`      VARCHAR(191) UNIQUE NOT NULL,
  `color`     VARCHAR(20)  DEFAULT '#013d19',
  `contact`   VARCHAR(200) NULL,
  `phone`     VARCHAR(30)  NULL,
  `waGroupId` VARCHAR(100) NULL,
  `logoPath`  VARCHAR(500) NULL,
  `active`    TINYINT(1)   DEFAULT 1,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id`              VARCHAR(50) PRIMARY KEY,
  `title`           VARCHAR(500) NOT NULL,
  `description`     LONGTEXT NULL,
  `clientName`      VARCHAR(200) NULL,
  `assignedTo`      VARCHAR(100) NULL,
  `status`          VARCHAR(30) NOT NULL DEFAULT 'todo',
  `priority`        VARCHAR(20) NOT NULL DEFAULT 'normal',
  `dueDate`         DATE NULL,
  `position`        INT DEFAULT 0,
  `visibleToClient` TINYINT(1) DEFAULT 0,
  `createdBy`       VARCHAR(100) NULL,
  `createdAt`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tasks_status`   (`status`),
  INDEX `idx_tasks_assigned` (`assignedTo`),
  INDEX `idx_tasks_client`   (`clientName`),
  INDEX `idx_tasks_due`      (`dueDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_comments` (
  `id`             VARCHAR(50) PRIMARY KEY,
  `taskId`         VARCHAR(50) NOT NULL,
  `senderUsername` VARCHAR(100) NULL,
  `senderName`     VARCHAR(200) NULL,
  `message`        TEXT NOT NULL,
  `internal`       TINYINT(1) DEFAULT 1,
  `editedAt`       DATETIME NULL,
  `createdAt`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_comments_task` (`taskId`),
  CONSTRAINT `fk_comments_task` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_activity` (
  `id`        VARCHAR(50) PRIMARY KEY,
  `taskId`    VARCHAR(50) NOT NULL,
  `actorName` VARCHAR(200) NULL,
  `field`     VARCHAR(50)  NULL,
  `oldValue`  VARCHAR(255) NULL,
  `newValue`  VARCHAR(255) NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_activity_task` (`taskId`),
  CONSTRAINT `fk_activity_task` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_files` (
  `id`         VARCHAR(50) PRIMARY KEY,
  `taskId`     VARCHAR(50) NOT NULL,
  `fileName`   VARCHAR(255) NOT NULL,
  `filePath`   VARCHAR(500) NOT NULL,
  `mimeType`   VARCHAR(100) NULL,
  `sizeBytes`  BIGINT NULL,
  `uploadedBy` VARCHAR(200) NULL,
  `createdAt`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_files_task` (`taskId`),
  CONSTRAINT `fk_files_task` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- ============================================
-- נתוני התחלה
-- ============================================

-- מנהל ראשי · admin / bidernet2026 · החלף סיסמה מיד
INSERT INTO `users` (`id`,`username`,`password`,`name`,`role`,`jobTitle`,`color`) VALUES
('u_admin','admin','$2y$10$iAz8gUkusNiAlPbbBQHG1uZUVVoAy7cD8CDvSxxhroh0gIne2KjPW','מנהל ראשי','admin','ניהול','#013d19')
ON DUPLICATE KEY UPDATE `id`=`id`;

INSERT INTO `settings` (`id`,`waProvider`,`waEnabled`,`waTemplate`,`waStaffTemplate`) VALUES
(1,'whapi',0,
 'שלום {client} 👋\nהמשימה "{task}" הושלמה.\n\nצוות בידרנט',
 'שלום {user} 👋\nנכנסה לך משימה חדשה:\n\n📌 {task}\n🏢 לקוח: {client}\n📅 דדליין: {due}\n⚡ עדיפות: {priority}\n\nמערכת המשימות · בידרנט')
ON DUPLICATE KEY UPDATE `id`=`id`;

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
ON DUPLICATE KEY UPDATE `id`=`id`;
