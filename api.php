<?php
/**
 * ============================================
 * bidernet · Tasks API (v1.0.0-php)
 * tasks.bidernet.co.il
 * ============================================
 * PDO + MySQL, single-file API.
 * Routing:  api.php?action=<resource>
 * Auth:     PHP session (login / me / logout)
 * ============================================
 */

// ----- כתובת המערכת (לשימוש בקישור שחזור הסיסמה) -----
$APP_URL   = 'https://tasks.bidernet.co.il';
$MAIL_FROM = 'no-reply@bidernet.co.il';

// עוגיית הסשן: קיימת רק בשרת, לא נגישה ל-JS
define('APP_VERSION', '1.3.1');
date_default_timezone_set('Asia/Jerusalem');
require_once __DIR__ . '/lib_wa.php';

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'secure'   => !empty($_SERVER['HTTPS']),
    'samesite' => 'Lax',
]);
session_start();

// ----- "זכור אותי": שחזור סשן מעוגייה קבועה -----
function rememberCookieLogin($pdo) {
    if (!empty($_SESSION['user']) || empty($_COOKIE['bidernet_remember'])) return;

    [$id, $secret] = array_pad(explode(':', $_COOKIE['bidernet_remember'], 2), 2, '');
    if (!$id || !$secret) return;

    $q = $pdo->prepare("SELECT * FROM remember_tokens WHERE id = ? AND expiresAt > NOW()");
    $q->execute([$id]);
    $row = $q->fetch();
    if (!$row || !password_verify($secret, $row['tokenHash'])) return;

    $u = $pdo->prepare("SELECT * FROM users WHERE username = ? AND active = 1");
    $u->execute([$row['username']]);
    $user = $u->fetch();
    if (!$user) return;

    unset($user['password']);
    $_SESSION['user'] = $user;
}

// ----- CORS: דומיין המשימות בלבד -----
$ALLOWED_ORIGINS = [
    'https://tasks.bidernet.co.il',
    'http://tasks.bidernet.co.il',
    'http://localhost:5173',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ALLOWED_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ----- DB -----
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'חסר קובץ config.php עם פרטי מסד הנתונים']);
    exit;
}
require_once $configFile;

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER, $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'החיבור למסד הנתונים נכשל', 'detail' => $e->getMessage()]);
    exit;
}

/**
 * מיגרציה אוטומטית: משלימה עמודות שנוספו בגרסאות חדשות.
 * רצה פעם אחת בלבד (מסומן בסשן), ולא דורשת הרצת SQL ידנית בכל עדכון.
 */
function autoMigrate($pdo) {
    if (!empty($_SESSION['schema_ok'])) return;

    $needed = [
        'users'         => ['phone' => 'VARCHAR(30) NULL'],
        'clients'       => ['phone' => 'VARCHAR(30) NULL',
                            'waGroupId' => 'VARCHAR(100) NULL',
                            'logoPath' => 'VARCHAR(500) NULL',
                            'metaPageId' => 'VARCHAR(50) NULL',
                            'metaPageName' => 'VARCHAR(200) NULL',
                            'metaAdAccount' => 'VARCHAR(50) NULL',
                            'metaToken' => 'TEXT NULL',
                            'metaTokenExp' => 'DATETIME NULL',
                            'metaConnectedAt' => 'DATETIME NULL'],
        'task_comments' => ['internal' => 'TINYINT(1) DEFAULT 1',
                            'editedAt' => 'DATETIME NULL'],
        'settings'      => ['waStaffTemplate' => 'TEXT NULL'],
    ];
    foreach ($needed as $table => $cols) {
        $exists = $pdo->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $exists->execute([$table]);
        if (!$exists->fetchColumn()) continue;

        foreach ($cols as $col => $def) {
            $q = $pdo->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            $q->execute([$table, $col]);
            if (!$q->fetchColumn()) {
                try { $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$col` $def"); }
                catch (Throwable $e) { error_log("[bidernet] migrate $table.$col: " . $e->getMessage()); }
            }
        }
    }
    // טבלאות שנוספו בגרסאות חדשות
    $pdo->exec("CREATE TABLE IF NOT EXISTS `reminders` (
      `id`          VARCHAR(50) PRIMARY KEY,
      `taskId`      VARCHAR(50) NOT NULL,
      `target`      VARCHAR(20) NOT NULL DEFAULT 'staff',
      `message`     TEXT NULL,
      `nextRunAt`   DATETIME NOT NULL,
      `repeatEvery` INT DEFAULT 0,
      `repeatTimes` INT DEFAULT 1,
      `sentCount`   INT DEFAULT 0,
      `lastSentAt`  DATETIME NULL,
      `active`      TINYINT(1) DEFAULT 1,
      `createdBy`   VARCHAR(200) NULL,
      `createdAt`   DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX `idx_rem_task` (`taskId`),
      INDEX `idx_rem_next` (`nextRunAt`, `active`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `timeline` (
      `id` VARCHAR(50) PRIMARY KEY, `clientName` VARCHAR(200) NOT NULL,
      `type` VARCHAR(30) NOT NULL, `title` VARCHAR(500) NOT NULL, `body` LONGTEXT NULL,
      `eventDate` DATE NOT NULL, `metricLeads` INT NULL, `metricReach` INT NULL,
      `metricClicks` INT NULL, `metricSpend` DECIMAL(10,2) NULL, `platform` VARCHAR(50) NULL,
      `linkUrl` VARCHAR(1000) NULL, `mediaPath` VARCHAR(500) NULL,
      `source` VARCHAR(20) DEFAULT 'manual', `refId` VARCHAR(100) NULL,
      `visible` TINYINT(1) DEFAULT 1, `createdBy` VARCHAR(200) NULL,
      `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
      `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX `idx_tl_client` (`clientName`, `eventDate`), INDEX `idx_tl_type` (`type`),
      UNIQUE KEY `uq_tl_ref` (`refId`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $_SESSION['schema_ok'] = true;
}
autoMigrate($pdo);

rememberCookieLogin($pdo);

// ----- Helpers -----
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail($msg, $code = 400) { respond(['error' => $msg], $code); }

function me() { return $_SESSION['user'] ?? null; }
function requireLogin() {
    $u = me();
    if (!$u) fail('נדרשת התחברות', 401);
    return $u;
}
function requireAdmin() {
    $u = requireLogin();
    if ($u['role'] !== 'admin') fail('אין הרשאה לפעולה הזו', 403);
    return $u;
}
function nid($p) { return $p . bin2hex(random_bytes(6)); }

/**
 * נרמול מספר טלפון לפורמט בינלאומי.
 * מקבל: 052-660-4361 · 0526604361 · +972526604361 · 972526604361
 * מחזיר: 972526604361
 */
function normalizePhone($raw, $cc = '972') {
    $d = preg_replace('/\D/', '', (string)$raw);   // רק ספרות
    if ($d === '') return '';
    if (str_starts_with($d, '00'))  $d = substr($d, 2);          // 00972... → 972...
    if (str_starts_with($d, '0'))   $d = $cc . substr($d, 1);    // 052...   → 97252...
    elseif (!str_starts_with($d, $cc) && strlen($d) <= 9) $d = $cc . $d;  // 52...  → 97252...
    return $d;
}

function timelineAuto($pdo, $clientName, $type, $title, $eventDate, $refId, $body = null) {
    if (!$clientName) return;   // בלי לקוח אין טיימליין
    try {
        $pdo->prepare("INSERT INTO timeline (id, clientName, type, title, body, eventDate, source, refId, visible, createdBy)
                       VALUES (?,?,?,?,?,?, 'auto', ?, 1, 'מערכת')
                       ON DUPLICATE KEY UPDATE title=VALUES(title), eventDate=VALUES(eventDate)")
            ->execute(['tl_' . bin2hex(random_bytes(6)), $clientName, $type, $title, $body,
                       $eventDate, $refId]);
    } catch (Throwable $e) { error_log('[timeline] ' . $e->getMessage()); }
}

function logActivity($pdo, $taskId, $actorName, $field, $old, $new) {
    $pdo->prepare("INSERT INTO task_activity (id, taskId, actorName, field, oldValue, newValue)
                   VALUES (?,?,?,?,?,?)")
        ->execute([nid('a_'), $taskId, $actorName, $field, (string)$old, (string)$new]);
}

// ============================================
// ROUTES
// ============================================
try {
    switch ($action) {

    // ---------- בדיקת חיים ----------
    case 'ping':
        $charset = $pdo->query("SELECT @@character_set_database AS db, @@collation_database AS coll")->fetch();
        $sample  = $pdo->query("SELECT name FROM users WHERE username = 'admin'")->fetchColumn();
        respond([
            'ok'      => true,
            'version' => APP_VERSION,
            'time'    => date('c'),
            'db'      => $charset,             // חייב להיות utf8mb4
            'hebrew'  => 'בדיקת עברית תקינה',  // אם זה מגיע שבור — הבעיה בשרת
            'admin'   => $sample,              // אם זה ???? — הנתון עצמו פגום במסד
        ]);

    // ---------- התחברות ----------
    case 'login':
        if ($method !== 'POST') fail('Method not allowed', 405);
        $username = trim($input['username'] ?? '');
        $password = (string)($input['password'] ?? '');
        if (!$username || !$password) fail('חסרים שם משתמש או סיסמה');

        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND active = 1");
        $stmt->execute([$username]);
        $u = $stmt->fetch();
        if (!$u) fail('שם משתמש או סיסמה שגויים', 401);

        $stored = $u['password'];
        $ok = (strlen($stored) > 20 && $stored[0] === '$')
            ? password_verify($password, $stored)
            : hash_equals($stored, $password);           // מעבר הדרגתי מסיסמאות ישנות
        if (!$ok) fail('שם משתמש או סיסמה שגויים', 401);

        // שדרוג שקוף של סיסמה ישנה ל-hash
        if ($stored[0] !== '$') {
            $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")
                ->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
        }
        unset($u['password']);
        session_regenerate_id(true);
        $_SESSION['user'] = $u;

        // "זכור אותי" — 30 יום
        if (!empty($input['remember'])) {
            $id     = nid('r_');
            $secret = bin2hex(random_bytes(32));
            $pdo->prepare("INSERT INTO remember_tokens (id, username, tokenHash, expiresAt)
                           VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 30 DAY))")
                ->execute([$id, $u['username'], password_hash($secret, PASSWORD_DEFAULT)]);
            setcookie('bidernet_remember', "$id:$secret", [
                'expires'  => time() + 60 * 60 * 24 * 30,
                'path'     => '/',
                'httponly' => true,
                'secure'   => !empty($_SERVER['HTTPS']),
                'samesite' => 'Lax',
            ]);
            $pdo->exec("DELETE FROM remember_tokens WHERE expiresAt < NOW()");
        }
        respond($u);

    case 'me':
        $cur = me();
        if (!$cur) respond(['guest' => true]);
        // רענון מהמסד — כדי שעדכון שם/צבע/טלפון ישתקף מיד, בלי התנתקות
        $q = $pdo->prepare("SELECT * FROM users WHERE id = ? AND active = 1");
        $q->execute([$cur['id']]);
        $fresh = $q->fetch();
        if (!$fresh) { $_SESSION = []; session_destroy(); respond(['guest' => true]); }
        unset($fresh['password']);
        $_SESSION['user'] = $fresh;
        respond($fresh);

    case 'logout':
        if (!empty($_COOKIE['bidernet_remember'])) {
            [$rid] = explode(':', $_COOKIE['bidernet_remember'], 2);
            $pdo->prepare("DELETE FROM remember_tokens WHERE id = ?")->execute([$rid]);
            setcookie('bidernet_remember', '', ['expires' => time() - 3600, 'path' => '/']);
        }
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true]);

    // ---------- שכחתי סיסמה ----------
    case 'forgot':
        if ($method !== 'POST') fail('Method not allowed', 405);
        $email = trim($input['email'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('כתובת אימייל לא תקינה');

        $q = $pdo->prepare("SELECT username, name FROM users WHERE email = ? AND active = 1");
        $q->execute([$email]);
        $user = $q->fetch();

        // תשובה זהה תמיד — כדי לא לחשוף אילו כתובות רשומות במערכת
        if ($user) {
            $id     = nid('p_');
            $secret = bin2hex(random_bytes(32));
            $pdo->prepare("INSERT INTO password_resets (id, username, tokenHash, expiresAt)
                           VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 1 HOUR))")
                ->execute([$id, $user['username'], password_hash($secret, PASSWORD_DEFAULT)]);

            $link = $APP_URL . '/?reset=' . urlencode("$id:$secret");
            $body = "שלום {$user['name']},\n\n"
                  . "התקבלה בקשה לאיפוס הסיסמה שלך במערכת המשימות של בידרנט.\n"
                  . "לחץ על הקישור כדי לבחור סיסמה חדשה (תקף לשעה אחת):\n\n"
                  . $link . "\n\n"
                  . "אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהמייל הזה — הסיסמה הקיימת נשארת בתוקף.\n\n"
                  . "בידרנט";
            $fromName = '=?UTF-8?B?' . base64_encode('בידרנט') . '?=';
            $headers = "From: {$fromName} <{$MAIL_FROM}>\r\n"
                     . "Content-Type: text/plain; charset=UTF-8\r\n"
                     . "MIME-Version: 1.0\r\n";
            @mail($email, '=?UTF-8?B?' . base64_encode('איפוס סיסמה · מערכת המשימות') . '?=', $body, $headers);
        }
        respond(['ok' => true]);

    // ---------- קביעת סיסמה חדשה ----------
    case 'reset_password':
        if ($method !== 'POST') fail('Method not allowed', 405);
        $token    = $input['token'] ?? '';
        $password = (string)($input['password'] ?? '');
        if (strlen($password) < 6) fail('הסיסמה חייבת להכיל לפחות 6 תווים');

        [$id, $secret] = array_pad(explode(':', $token, 2), 2, '');
        if (!$id || !$secret) fail('קישור לא תקין');

        $q = $pdo->prepare("SELECT * FROM password_resets
                            WHERE id = ? AND usedAt IS NULL AND expiresAt > NOW()");
        $q->execute([$id]);
        $row = $q->fetch();
        if (!$row || !password_verify($secret, $row['tokenHash'])) {
            fail('הקישור פג תוקף או כבר נוצל. בקש קישור חדש.', 400);
        }

        $pdo->prepare("UPDATE users SET password = ? WHERE username = ?")
            ->execute([password_hash($password, PASSWORD_DEFAULT), $row['username']]);
        $pdo->prepare("UPDATE password_resets SET usedAt = NOW() WHERE id = ?")->execute([$id]);
        // ביטול כל ה"זכור אותי" הקיימים — סיסמה חדשה מנתקת מכשירים ישנים
        $pdo->prepare("DELETE FROM remember_tokens WHERE username = ?")->execute([$row['username']]);
        respond(['ok' => true, 'username' => $row['username']]);

    // ---------- צוות ולקוחות-משתמשים ----------
    case 'users':
        $u = requireLogin();

        if ($method === 'GET') {
            $rows = $pdo->query("SELECT id, username, name, email, phone, role, jobTitle,
                                        color, businessName, active, createdAt
                                 FROM users WHERE active = 1 ORDER BY role, name")->fetchAll();
            respond($rows);
        }

        if ($method === 'POST') {
            requireAdmin();
            $id = $input['id'] ?? nid('u_');
            $username = trim($input['username'] ?? '');
            if (!$username) fail('חסר שם משתמש');

            $exists = $pdo->prepare("SELECT password FROM users WHERE id = ?");
            $exists->execute([$id]);
            $prev = $exists->fetch();

            $pw = $input['password'] ?? '';
            $hash = $pw !== ''
                ? password_hash($pw, PASSWORD_DEFAULT)
                : ($prev['password'] ?? null);
            if (!$hash) fail('חסרה סיסמה למשתמש חדש');

            $pdo->prepare("
                INSERT INTO users (id, username, password, name, email, phone, role, jobTitle, color, businessName, active)
                VALUES (?,?,?,?,?,?,?,?,?,?,1)
                ON DUPLICATE KEY UPDATE
                  username=VALUES(username), password=VALUES(password), name=VALUES(name),
                  email=VALUES(email), phone=VALUES(phone), role=VALUES(role),
                  jobTitle=VALUES(jobTitle), color=VALUES(color), businessName=VALUES(businessName)
            ")->execute([
                $id, $username, $hash,
                $input['name'] ?? $username,
                $input['email'] ?? null,
                $input['phone'] ?? null,
                $input['role'] ?? 'admin',
                $input['jobTitle'] ?? null,
                $input['color'] ?? '#013d19',
                $input['businessName'] ?? null,
            ]);

            // אם המשתמש עדכן את עצמו — לרענן את הסשן, אחרת הברכה תישאר ישנה
            if ($id === ($u['id'] ?? '')) {
                $q = $pdo->prepare("SELECT * FROM users WHERE id = ?");
                $q->execute([$id]);
                $fresh = $q->fetch();
                unset($fresh['password']);
                $_SESSION['user'] = $fresh;
            }
            respond(['ok' => true, 'id' => $id]);
        }

        if ($method === 'DELETE') {
            requireAdmin();
            $id = $_GET['id'] ?? '';
            if (!$id) fail('חסר מזהה');
            if ($id === ($u['id'] ?? '')) fail('אי אפשר למחוק את המשתמש שאיתו אתה מחובר');
            $pdo->prepare("UPDATE users SET active = 0 WHERE id = ?")->execute([$id]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- לקוחות ----------
    case 'clients':
        requireLogin();

        if ($method === 'GET') {
            respond($pdo->query("SELECT id, name, color, contact, phone, waGroupId, logoPath, metaPageId, metaPageName, metaAdAccount, metaConnectedAt, active, createdAt FROM clients WHERE active = 1 ORDER BY name")->fetchAll());
        }
        if ($method === 'POST') {
            requireAdmin();
            $id = $input['id'] ?? nid('c_');
            $name = trim($input['name'] ?? '');
            if (!$name) fail('חסר שם לקוח');
            $pdo->prepare("
                INSERT INTO clients (id, name, color, contact, phone, waGroupId, logoPath, active)
                VALUES (?,?,?,?,?,?,?,1)
                ON DUPLICATE KEY UPDATE name=VALUES(name), color=VALUES(color), contact=VALUES(contact),
                                        phone=VALUES(phone), waGroupId=VALUES(waGroupId),
                                        logoPath=VALUES(logoPath)
            ")->execute([$id, $name, $input['color'] ?? '#013d19', $input['contact'] ?? null,
                         ($input['phone'] ?? '') ?: null, ($input['waGroupId'] ?? '') ?: null,
                         ($input['logoPath'] ?? '') ?: null]);
            respond(['ok' => true, 'id' => $id]);
        }
        if ($method === 'DELETE') {
            requireAdmin();
            $id = $_GET['id'] ?? '';
            if (!$id) fail('חסר מזהה');
            $pdo->prepare("UPDATE clients SET active = 0 WHERE id = ?")->execute([$id]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- לוגו של לקוח ----------
    case 'client_logo':
        requireAdmin();
        if ($method !== 'POST') fail('Method not allowed', 405);
        if (empty($_FILES['file'])) fail('לא התקבל קובץ');

        $f = $_FILES['file'];
        if ($f['error'] !== UPLOAD_ERR_OK) fail('ההעלאה נכשלה (קוד ' . $f['error'] . ')');
        if ($f['size'] > 3 * 1024 * 1024)  fail('הלוגו גדול מ-3MB');

        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','webp','svg','gif'], true)) {
            fail('פורמט לא נתמך. השתמש ב-PNG, JPG, WEBP או SVG');
        }
        $info = @getimagesize($f['tmp_name']);
        if ($ext !== 'svg' && !$info) fail('הקובץ אינו תמונה תקינה');

        $dir = __DIR__ . '/uploads/clients';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail('לא ניתן ליצור תיקיית העלאה');

        $safe = bin2hex(random_bytes(6)) . '.' . $ext;
        $rel  = 'uploads/clients/' . $safe;
        if (!move_uploaded_file($f['tmp_name'], __DIR__ . '/' . $rel)) fail('שמירת הקובץ נכשלה');

        // מחיקת הלוגו הקודם, אם יש
        $old = $_POST['oldPath'] ?? '';
        if ($old && str_starts_with($old, 'uploads/clients/') && is_file(__DIR__ . '/' . $old)) {
            @unlink(__DIR__ . '/' . $old);
        }
        respond(['ok' => true, 'logoPath' => $rel]);

    // ---------- משימות ----------
    case 'tasks':
        $u = requireLogin();

        if ($method === 'GET') {
            // לקוח רואה רק משימות שלו שסומנו "הצג ללקוח"
            if ($u['role'] === 'client') {
                $stmt = $pdo->prepare("SELECT * FROM tasks
                                       WHERE clientName = ? AND visibleToClient = 1
                                       ORDER BY position, createdAt DESC");
                $stmt->execute([$u['businessName']]);
                respond($stmt->fetchAll());
            }
            respond($pdo->query("SELECT * FROM tasks ORDER BY position, createdAt DESC")->fetchAll());
        }

        if ($method === 'POST') {
            requireAdmin();   // רק הצוות יוצר/משנה משימות
            $id = $input['id'] ?? null;
            $fields = [
                'title'           => trim($input['title'] ?? ''),
                'description'     => $input['description'] ?? '',
                'clientName'      => ($input['clientName'] ?? '') ?: null,
                'assignedTo'      => ($input['assignedTo'] ?? '') ?: null,
                'status'          => $input['status'] ?? 'todo',
                'priority'        => $input['priority'] ?? 'normal',
                'dueDate'         => ($input['dueDate'] ?? '') ?: null,
                'visibleToClient' => !empty($input['visibleToClient']) ? 1 : 0,
            ];
            if ($fields['title'] === '') fail('חסרה כותרת למשימה');
            if (!in_array($fields['status'], ['todo','in_progress','review','done'], true))   fail('סטטוס לא תקין');
            if (!in_array($fields['priority'], ['low','normal','high','urgent'], true))       fail('עדיפות לא תקינה');

            if ($id) {
                $old = $pdo->prepare("SELECT * FROM tasks WHERE id = ?");
                $old->execute([$id]);
                $before = $old->fetch();
                if (!$before) fail('המשימה לא נמצאה', 404);

                $pdo->prepare("UPDATE tasks SET title=?, description=?, clientName=?, assignedTo=?,
                               status=?, priority=?, dueDate=?, visibleToClient=? WHERE id=?")
                    ->execute([...array_values($fields), $id]);

                foreach (['status','assignedTo','priority','dueDate'] as $f) {
                    if ((string)$before[$f] !== (string)$fields[$f]) {
                        logActivity($pdo, $id, $u['name'], $f, $before[$f], $fields[$f]);
                    }
                }
                // משימה שהושלמה → אירוע בטיימליין הלקוח
                if ($before['status'] !== 'done' && $fields['status'] === 'done') {
                    timelineAuto($pdo, $fields['clientName'], 'task',
                        $fields['title'], date('Y-m-d'), 'task_' . $id);
                }
                respond(['ok' => true, 'id' => $id]);
            }

            $id = nid('t_');
            $pdo->prepare("INSERT INTO tasks (id, title, description, clientName, assignedTo,
                           status, priority, dueDate, visibleToClient, createdBy)
                           VALUES (?,?,?,?,?,?,?,?,?,?)")
                ->execute([$id, ...array_values($fields), $u['username']]);
            logActivity($pdo, $id, $u['name'], 'created', '', $fields['status']);
            respond(['ok' => true, 'id' => $id]);
        }

        if ($method === 'DELETE') {
            requireAdmin();
            $id = $_GET['id'] ?? '';
            if (!$id) fail('חסר מזהה');
            // מחיקת הקבצים מהדיסק לפני מחיקת המשימה
            $q = $pdo->prepare("SELECT filePath FROM task_files WHERE taskId = ?");
            $q->execute([$id]);
            foreach ($q->fetchAll() as $f) {
                $p = __DIR__ . '/' . $f['filePath'];
                if (is_file($p)) @unlink($p);
            }
            $pdo->prepare("DELETE FROM tasks WHERE id = ?")->execute([$id]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- שינוי סטטוס מהיר (גרירה בלוח) ----------
    case 'task_status':
        $u = requireAdmin();
        if ($method !== 'POST') fail('Method not allowed', 405);
        $id = $input['id'] ?? '';
        $status = $input['status'] ?? '';
        if (!$id || !in_array($status, ['todo','in_progress','review','done'], true)) fail('נתונים חסרים');

        $q = $pdo->prepare("SELECT status FROM tasks WHERE id = ?");
        $q->execute([$id]);
        $before = $q->fetchColumn();
        if ($before === false) fail('המשימה לא נמצאה', 404);
        if ($before !== $status) {
            $pdo->prepare("UPDATE tasks SET status = ? WHERE id = ?")->execute([$status, $id]);
            logActivity($pdo, $id, $u['name'], 'status', $before, $status);
            if ($status === 'done') {
                $t = $pdo->prepare("SELECT title, clientName FROM tasks WHERE id = ?");
                $t->execute([$id]);
                $row = $t->fetch();
                timelineAuto($pdo, $row['clientName'], 'task', $row['title'], date('Y-m-d'), 'task_' . $id);
            }
        }
        respond(['ok' => true]);

    // ---------- תגובות ----------
    case 'task_comments':
        $u = requireLogin();

        if ($method === 'GET') {
            $taskId = $_GET['taskId'] ?? '';
            // הלקוח רואה רק תגובות שסומנו במפורש כגלויות לו
            $sql = $u['role'] === 'client'
                ? "SELECT * FROM task_comments WHERE taskId = ? AND internal = 0 ORDER BY createdAt"
                : "SELECT * FROM task_comments WHERE taskId = ? ORDER BY createdAt";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$taskId]);
            respond($stmt->fetchAll());
        }
        if ($method === 'POST') {
            $taskId  = $input['taskId'] ?? '';
            $message = trim($input['message'] ?? '');
            if (!$taskId || $message === '') fail('חסר תוכן לעדכון');

            // לקוח יכול להגיב רק על משימה שמוצגת לו
            if ($u['role'] === 'client') {
                $c = $pdo->prepare("SELECT 1 FROM tasks
                                    WHERE id=? AND clientName=? AND visibleToClient=1");
                $c->execute([$taskId, $u['businessName']]);
                if (!$c->fetch()) fail('אין הרשאה למשימה הזו', 403);
            }
            // ----- עריכת תגובה קיימת -----
            if (!empty($input['id'])) {
                $q = $pdo->prepare("SELECT senderUsername FROM task_comments WHERE id = ?");
                $q->execute([$input['id']]);
                $author = $q->fetchColumn();
                if ($author === false) fail('התגובה לא נמצאה', 404);
                if ($author !== $u['username']) fail('אפשר לערוך רק תגובות שכתבת', 403);

                $pdo->prepare("UPDATE task_comments SET message = ?, editedAt = NOW() WHERE id = ?")
                    ->execute([$message, $input['id']]);
                respond(['ok' => true, 'id' => $input['id']]);
            }

            // עובד כותב פנימי כברירת מחדל; לקוח תמיד כותב גלוי
            $internal = $u['role'] === 'client' ? 0 : (!empty($input['internal']) ? 1 : 0);
            $id = nid('m_');
            $pdo->prepare("INSERT INTO task_comments (id, taskId, senderUsername, senderName, message, internal)
                           VALUES (?,?,?,?,?,?)")
                ->execute([$id, $taskId, $u['username'], $u['name'], $message, $internal]);
            // עדכון גלוי ללקוח → טיימליין
            if ($internal == 0) {
                $t = $pdo->prepare("SELECT clientName FROM tasks WHERE id = ?");
                $t->execute([$taskId]);
                $cn = $t->fetchColumn();
                timelineAuto($pdo, $cn, 'update', mb_substr($message, 0, 200),
                    date('Y-m-d'), 'comment_' . $id);
            }
            $pdo->prepare("UPDATE tasks SET updatedAt = NOW() WHERE id = ?")->execute([$taskId]);
            respond(['ok' => true, 'id' => $id]);
        }
        if ($method === 'DELETE') {
            $id = $_GET['id'] ?? '';
            if (!$id) fail('חסר מזהה');
            $q = $pdo->prepare("SELECT senderUsername FROM task_comments WHERE id = ?");
            $q->execute([$id]);
            $author = $q->fetchColumn();
            if ($author === false) fail('התגובה לא נמצאה', 404);
            // הכותב מוחק את שלו; מנהל יכול למחוק כל תגובה
            if ($author !== $u['username'] && $u['role'] !== 'admin') {
                fail('אפשר למחוק רק תגובות שכתבת', 403);
            }
            $pdo->prepare("DELETE FROM task_comments WHERE id = ?")->execute([$id]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- יומן פעילות ----------
    case 'task_activity':
        requireLogin();
        $taskId = $_GET['taskId'] ?? '';
        $stmt = $pdo->prepare("SELECT * FROM task_activity WHERE taskId = ? ORDER BY createdAt DESC LIMIT 30");
        $stmt->execute([$taskId]);
        respond($stmt->fetchAll());

    // ---------- קבצים ----------
    case 'task_files':
        $u = requireLogin();

        if ($method === 'GET') {
            $taskId = $_GET['taskId'] ?? '';
            $stmt = $pdo->prepare("SELECT * FROM task_files WHERE taskId = ? ORDER BY createdAt");
            $stmt->execute([$taskId]);
            respond($stmt->fetchAll());
        }

        if ($method === 'POST') {                 // multipart/form-data
            requireAdmin();
            $taskId = $_POST['taskId'] ?? '';
            if (!$taskId || empty($_FILES['file'])) fail('לא התקבל קובץ');
            $f = $_FILES['file'];
            if ($f['error'] !== UPLOAD_ERR_OK) fail('ההעלאה נכשלה (קוד ' . $f['error'] . ')');
            if ($f['size'] > 50 * 1024 * 1024)  fail('הקובץ גדול מ-50MB');

            $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg','jpeg','png','gif','webp','svg','pdf','doc','docx','xls','xlsx',
                        'ppt','pptx','txt','csv','zip','mp4','mov','ai','psd','eps'];
            if (!in_array($ext, $allowed, true)) fail('סוג קובץ לא נתמך: ' . $ext);

            $dir = __DIR__ . '/uploads/' . $taskId;
            if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail('לא ניתן ליצור תיקיית העלאה');

            $safe = bin2hex(random_bytes(5)) . '.' . $ext;      // שם אקראי — לא סומכים על שם הקובץ
            $rel  = 'uploads/' . $taskId . '/' . $safe;
            if (!move_uploaded_file($f['tmp_name'], __DIR__ . '/' . $rel)) fail('שמירת הקובץ נכשלה');

            $id = nid('f_');
            $pdo->prepare("INSERT INTO task_files (id, taskId, fileName, filePath, mimeType, sizeBytes, uploadedBy)
                           VALUES (?,?,?,?,?,?,?)")
                ->execute([$id, $taskId, $f['name'], $rel, $f['type'], $f['size'], $u['name']]);
            respond(['ok' => true, 'id' => $id, 'filePath' => $rel]);
        }

        if ($method === 'DELETE') {
            requireAdmin();
            $id = $_GET['id'] ?? '';
            $q = $pdo->prepare("SELECT filePath FROM task_files WHERE id = ?");
            $q->execute([$id]);
            if ($row = $q->fetch()) {
                $p = __DIR__ . '/' . $row['filePath'];
                if (is_file($p)) @unlink($p);
            }
            $pdo->prepare("DELETE FROM task_files WHERE id = ?")->execute([$id]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- Polling: כל הלוח בקריאה אחת ----------
    case 'board':
        $u = requireLogin();
        $isClient = $u['role'] === 'client';

        if ($isClient) {
            $t = $pdo->prepare("SELECT * FROM tasks WHERE clientName = ? AND visibleToClient = 1
                                ORDER BY position, createdAt DESC");
            $t->execute([$u['businessName']]);
            $tasks = $t->fetchAll();
        } else {
            $tasks = $pdo->query("SELECT * FROM tasks ORDER BY position, createdAt DESC")->fetchAll();
        }

        $ids = array_column($tasks, 'id');
        $counts = ['comments' => [], 'files' => []];
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $c1 = $pdo->prepare("SELECT taskId, COUNT(*) c FROM task_comments WHERE taskId IN ($in) GROUP BY taskId");
            $c1->execute($ids);
            foreach ($c1->fetchAll() as $r) $counts['comments'][$r['taskId']] = (int)$r['c'];
            $c2 = $pdo->prepare("SELECT taskId, COUNT(*) c FROM task_files WHERE taskId IN ($in) GROUP BY taskId");
            $c2->execute($ids);
            foreach ($c2->fetchAll() as $r) $counts['files'][$r['taskId']] = (int)$r['c'];
        }

        respond([
            'tasks'   => $tasks,
            'counts'  => $counts,
            'clients' => $pdo->query("SELECT id, name, color, contact, phone, waGroupId, logoPath, metaPageId, metaPageName, metaAdAccount, metaConnectedAt, active, createdAt FROM clients WHERE active = 1 ORDER BY name")->fetchAll(),
            'users'   => $pdo->query("SELECT id, username, name, email, phone, role, jobTitle, color, businessName
                                      FROM users WHERE active = 1 ORDER BY name")->fetchAll(),
            'stamp'   => date('c'),
        ]);

    // ---------- הגדרות (כולל וואטסאפ) ----------
    case 'settings':
        $u = requireAdmin();

        if ($method === 'GET') {
            $s = $pdo->query("SELECT * FROM settings WHERE id = 1")->fetch() ?: [];
            $s['waTokenSet'] = !empty($s['waToken']);   // לא מחזירים את הטוקן עצמו לדפדפן
            unset($s['waToken']);
            respond($s);
        }
        if ($method === 'POST') {
            $cur = $pdo->query("SELECT waToken FROM settings WHERE id = 1")->fetch();
            $token = ($input['waToken'] ?? '') !== '' ? $input['waToken'] : ($cur['waToken'] ?? null);
            $pdo->prepare("
                INSERT INTO settings (id, waProvider, waBaseUrl, waToken, waInstanceId, waEnabled, waTemplate, waStaffTemplate)
                VALUES (1,?,?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE
                  waProvider=VALUES(waProvider), waBaseUrl=VALUES(waBaseUrl), waToken=VALUES(waToken),
                  waInstanceId=VALUES(waInstanceId), waEnabled=VALUES(waEnabled),
                  waTemplate=VALUES(waTemplate), waStaffTemplate=VALUES(waStaffTemplate)
            ")->execute([
                $input['waProvider']   ?? 'whapi',
                rtrim($input['waBaseUrl'] ?? '', '/'),
                $token,
                $input['waInstanceId'] ?? null,
                !empty($input['waEnabled']) ? 1 : 0,
                $input['waTemplate']      ?? '',
                $input['waStaffTemplate'] ?? '',
            ]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- שליחת וואטסאפ (ידנית בלבד) ----------
    case 'whatsapp_send':
        $u = requireAdmin();
        if ($method !== 'POST') fail('Method not allowed', 405);

        $taskId  = $input['taskId'] ?? '';
        $channel = $input['channel'] ?? 'group';        // group | phone | staff
        $message = trim($input['message'] ?? '');
        if ($message === '') fail('ההודעה ריקה');

        $t = $pdo->prepare("SELECT * FROM tasks WHERE id = ?");
        $t->execute([$taskId]);
        $task = $t->fetch();
        if (!$task) fail('המשימה לא נמצאה', 404);

        $client = null;
        if ($channel === 'staff') {
            // התראה לעובד האחראי — לא ללקוח
            if (empty($task['assignedTo'])) fail('למשימה לא משויך עובד');
            $e = $pdo->prepare("SELECT name, phone FROM users WHERE username = ? AND active = 1");
            $e->execute([$task['assignedTo']]);
            $staff = $e->fetch();
            if (!$staff)            fail('העובד לא נמצא', 404);
            if (empty($staff['phone'])) fail('לא הוגדר מספר טלפון לעובד ' . $staff['name'] . ' — הוסף אותו במסך "צוות"');
            $to = $staff['phone'];
        } else {
            $c = $pdo->prepare("SELECT * FROM clients WHERE name = ?");
            $c->execute([$task['clientName']]);
            $client = $c->fetch();
            if (!$client) fail('למשימה לא משויך לקוח');

            $to = $channel === 'group' ? ($client['waGroupId'] ?? '') : ($client['phone'] ?? '');
            if (!$to) fail($channel === 'group'
                ? 'לא הוגדר מזהה קבוצה ללקוח הזה'
                : 'לא הוגדר מספר טלפון ללקוח הזה');
        }

        $s = $pdo->query("SELECT * FROM settings WHERE id = 1")->fetch();

        // Green API דורש chatId עם סיומת: 9725...@c.us למספר, ...@g.us לקבוצה
        $isDirect = in_array($channel, ['phone', 'staff'], true);
        if ($isDirect && !str_contains($to, '@')) {
            $to = normalizePhone($to);
            if (strlen($to) < 11) fail('מספר הטלפון לא תקין: ' . $to);
            if (($s['waProvider'] ?? '') === 'greenapi') $to .= '@c.us';
        }
        if (empty($s['waEnabled']) || empty($s['waToken']) || empty($s['waBaseUrl'])) {
            fail('חיבור הוואטסאפ לא מוגדר — עבור למסך הגדרות');
        }

        // ----- Adapter: החלפת ספק = שינוי הגדרה בלבד -----
        $base = rtrim($s['waBaseUrl'], '/');
        if ($s['waProvider'] === 'greenapi') {
            $url  = "$base/waInstance{$s['waInstanceId']}/sendMessage/{$s['waToken']}";
            $body = ['chatId' => $to, 'message' => $message];
            $headers = ['Content-Type: application/json'];
        } else {                                        // whapi (ברירת מחדל)
            $url  = "$base/messages/text";
            $body = ['to' => $to, 'body' => $message];
            $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $s['waToken']];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cErr = curl_error($ch);
        curl_close($ch);

        $ok = !$cErr && $code >= 200 && $code < 300;

        // הסבר קריא מתוך גוף התשובה של הספק, במקום "HTTP 466" סתום
        $detail = $cErr ?: (string)$res;
        $parsed = json_decode((string)$res, true);
        if (is_array($parsed)) {
            $desc = $parsed['invokeStatus']['description']
                 ?? $parsed['correspondentsStatus']['description']
                 ?? $parsed['message']
                 ?? $parsed['error']
                 ?? null;
            if ($desc) $detail = $desc;
        }

        $pdo->prepare("INSERT INTO notifications (id, taskId, clientName, target, channel, message, status, response, sentBy)
                       VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([nid('n_'), $taskId, $task['clientName'], $to, $channel, $message,
                       $ok ? 'sent' : 'failed',
                       mb_substr(($ok ? '' : "HTTP $code · ") . $detail, 0, 1500), $u['name']]);

        if (!$ok) {
            $hint = '';
            if ($code === 466) $hint = ' — מגבלת תוכנית ב-Green API. בדוק בקונסול שהאינסטנס הזה משויך לתוכנית בתשלום.';
            if ($code === 401 || $code === 403) $hint = ' — הטוקן או ה-Instance ID שגויים, או שהאינסטנס נותק.';
            if ($code === 400) $hint = ' — היעד לא תקין (מספר או מזהה קבוצה).';
            fail("השליחה נכשלה (HTTP $code): " . mb_substr($detail, 0, 400) . $hint, 502);
        }

        $label = $channel === 'group' ? 'נשלח לקבוצת הלקוח'
               : ($channel === 'staff' ? 'נשלחה התראה לעובד' : 'נשלח ללקוח');
        logActivity($pdo, $taskId, $u['name'], 'whatsapp', '', $label);
        respond(['ok' => true]);

    // ---------- פיד עדכונים (פעמון) ----------
    case 'updates':
        $u = requireLogin();

        if ($method === 'POST') {                 // סימון "ראיתי הכול"
            $pdo->prepare("INSERT INTO updates_seen (username, seenAt) VALUES (?, NOW())
                           ON DUPLICATE KEY UPDATE seenAt = NOW()")
                ->execute([$u['username']]);
            respond(['ok' => true]);
        }

        $seen = $pdo->prepare("SELECT seenAt FROM updates_seen WHERE username = ?");
        $seen->execute([$u['username']]);
        $seenAt = $seen->fetchColumn() ?: '2000-01-01 00:00:00';

        $where = $u['role'] === 'client'
            ? "WHERE c.internal = 0 AND t.clientName = ? AND t.visibleToClient = 1"
            : "WHERE 1=1";
        $params = $u['role'] === 'client' ? [$u['businessName']] : [];

        $q = $pdo->prepare("
            SELECT c.id, c.taskId, c.senderUsername, c.senderName, c.message, c.internal, c.createdAt,
                   t.title AS taskTitle, t.clientName
            FROM task_comments c
            JOIN tasks t ON t.id = c.taskId
            $where
            ORDER BY c.createdAt DESC
            LIMIT 25
        ");
        $q->execute($params);
        $rows = $q->fetchAll();

        // "חדש" = נכתב אחרי הצפייה האחרונה, ולא על ידי המשתמש עצמו
        $unread = 0;
        foreach ($rows as &$r) {
            $r['isNew'] = ($r['createdAt'] > $seenAt && $r['senderUsername'] !== $u['username']) ? 1 : 0;
            $unread += $r['isNew'];
        }
        respond(['updates' => $rows, 'unread' => $unread, 'seenAt' => $seenAt]);

    // ---------- בדיקת חיבור + משיכת קבוצות ----------
    case 'whatsapp_groups':
    case 'whatsapp_status':
        requireAdmin();
        $s = $pdo->query("SELECT * FROM settings WHERE id = 1")->fetch();
        if (empty($s['waToken']) || empty($s['waBaseUrl'])) fail('חיבור הוואטסאפ לא מוגדר');

        $base = rtrim($s['waBaseUrl'], '/');
        $isGreen = ($s['waProvider'] ?? '') === 'greenapi';

        if ($action === 'whatsapp_status') {
            $url = $isGreen
                ? "$base/waInstance{$s['waInstanceId']}/getStateInstance/{$s['waToken']}"
                : "$base/health";
            $headers = $isGreen ? [] : ['Authorization: Bearer ' . $s['waToken']];
        } else {
            $url = $isGreen
                ? "$base/waInstance{$s['waInstanceId']}/getContacts/{$s['waToken']}"
                : "$base/groups";
            $headers = $isGreen ? [] : ['Authorization: Bearer ' . $s['waToken']];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 25,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cErr = curl_error($ch);
        curl_close($ch);

        if ($cErr || $code < 200 || $code >= 300) {
            fail('החיבור נכשל: ' . ($cErr ?: "HTTP $code"), 502);
        }
        $data = json_decode($res, true);

        if ($action === 'whatsapp_status') {
            // Green: {"stateInstance":"authorized"} · Whapi: {"status":{"text":"AUTH"}}
            $state = $data['stateInstance'] ?? ($data['status']['text'] ?? 'unknown');
            respond(['ok' => true, 'state' => $state,
                     'connected' => in_array(strtolower((string)$state), ['authorized','auth','connected'], true)]);
        }

        // רשימת קבוצות בפורמט אחיד
        $groups = [];
        if ($isGreen) {
            foreach (($data ?: []) as $row) {
                if (($row['type'] ?? '') === 'group' || str_ends_with($row['id'] ?? '', '@g.us')) {
                    $groups[] = ['id' => $row['id'], 'name' => $row['name'] ?? $row['id']];
                }
            }
        } else {
            foreach (($data['groups'] ?? $data ?: []) as $row) {
                $groups[] = ['id' => $row['id'] ?? '', 'name' => $row['name'] ?? ($row['subject'] ?? '')];
            }
        }
        usort($groups, fn($a, $b) => strcmp($a['name'], $b['name']));
        respond(['groups' => $groups]);

    // ---------- Meta: התחלת חיבור (OAuth) ----------
    case 'meta_connect':
        $u = requireAdmin();
        $client = $_GET['clientName'] ?? '';
        if (!$client) fail('חסר שם לקוח');
        // state נושא את הלקוח + חתימה, כדי למנוע זיוף
        $state = base64_encode(json_encode([
            'c' => $client,
            'n' => bin2hex(random_bytes(8)),
            's' => hash_hmac('sha256', $client, $META_APP_SECRET),
        ]));
        $_SESSION['meta_state'] = $state;

        // Login for Business: מעבירים config_id (ההרשאות מוגדרות בתוך ה-Configuration עצמו)
        $params = [
            'client_id'     => $META_APP_ID,
            'redirect_uri'  => $META_REDIRECT,
            'state'         => $state,
            'response_type' => 'code',
        ];
        if (!empty($META_CONFIG_ID)) {
            $params['config_id'] = $META_CONFIG_ID;   // ההרשאות מגיעות מה-Configuration
        } else {
            $params['scope'] = 'pages_show_list,leads_retrieval,ads_read,pages_read_engagement,business_management';
        }
        $url = 'https://www.facebook.com/v21.0/dialog/oauth?' . http_build_query($params);
        respond(['url' => $url]);

    // ---------- Meta: חזרה מפייסבוק ----------
    case 'meta_callback':
        // זה נפתח בדפדפן ישירות מ-Facebook — מחזיר HTML, לא JSON
        header('Content-Type: text/html; charset=utf-8');
        $code  = $_GET['code'] ?? '';
        $state = $_GET['state'] ?? '';
        $err   = $_GET['error_description'] ?? ($_GET['error'] ?? '');

        $close = function ($msg, $ok = false) {
            $color = $ok ? '#10b981' : '#e11d48';
            echo "<!doctype html><html dir=rtl><head><meta charset=utf-8></head>
                  <body style='font-family:sans-serif;text-align:center;padding:40px'>
                  <div style='font-size:48px'>" . ($ok ? '✅' : '⚠️') . "</div>
                  <h2 style='color:$color'>" . htmlspecialchars($msg) . "</h2>
                  <p>אפשר לסגור את החלון ולחזור למערכת.</p>
                  <script>setTimeout(()=>{window.opener&&window.opener.postMessage('meta_done','*');window.close();},1500)</script>
                  </body></html>";
            exit;
        };

        if ($err) $close('החיבור בוטל: ' . $err);
        if (!$code || !$state) $close('חסרים פרטי חיבור מפייסבוק');
        if (($_SESSION['meta_state'] ?? '') !== $state) $close('אימות נכשל — נסה שוב');

        $data = json_decode(base64_decode($state), true);
        $client = $data['c'] ?? '';
        if (hash_hmac('sha256', $client, $META_APP_SECRET) !== ($data['s'] ?? '')) {
            $close('אימות הלקוח נכשל');
        }

        try {
            // 1. code → short token → long-lived token
            $tok = meta_getToken($META_APP_ID, $META_APP_SECRET, $META_REDIRECT, $code);
            if (empty($tok['access_token'])) $close('פייסבוק לא החזירה טוקן');
            $long = meta_extendToken($META_APP_ID, $META_APP_SECRET, $tok['access_token']);
            $userToken = $long['access_token'] ?? $tok['access_token'];
            $expSec    = $long['expires_in'] ?? 5184000;   // ~60 יום

            // 2. שמירת הטוקן זמנית — בחירת הדף תתבצע בצעד הבא
            $_SESSION['meta_pending'] = ['client' => $client, 'userToken' => $userToken,
                                         'exp' => date('Y-m-d H:i:s', time() + $expSec)];
            $close('פייסבוק חובר! חוזרים למערכת לבחירת הדף…', true);
        } catch (Throwable $e) {
            error_log('[meta] ' . $e->getMessage());
            $close('שגיאה בחיבור: ' . $e->getMessage());
        }

    // ---------- Meta: רשימת הדפים הזמינים אחרי החיבור ----------
    case 'meta_pages':
        requireAdmin();
        $p = $_SESSION['meta_pending'] ?? null;
        if (!$p) fail('אין חיבור פעיל — התחל מחדש', 400);
        $pages = meta_getPages($p['userToken']);
        respond(['client' => $p['client'], 'pages' => $pages]);

    // ---------- Meta: שמירת הדף שנבחר ----------
    case 'meta_save_page':
        $u = requireAdmin();
        if ($method !== 'POST') fail('Method not allowed', 405);
        $p = $_SESSION['meta_pending'] ?? null;
        if (!$p) fail('אין חיבור פעיל', 400);

        $pageId   = $input['pageId'] ?? '';
        $pageName = $input['pageName'] ?? '';
        $adAcct   = $input['adAccount'] ?? '';
        $pageToken= $input['pageToken'] ?? '';   // הגיע מרשימת הדפים
        if (!$pageId || !$pageToken) fail('חסר דף');

        $pdo->prepare("UPDATE clients SET metaPageId=?, metaPageName=?, metaAdAccount=?,
                       metaToken=?, metaTokenExp=?, metaConnectedAt=NOW() WHERE name=?")
            ->execute([$pageId, $pageName, $adAcct ?: null, $pageToken, $p['exp'], $p['client']]);

        unset($_SESSION['meta_pending'], $_SESSION['meta_state']);
        respond(['ok' => true]);

    // ---------- Meta: ניתוק ----------
    case 'meta_disconnect':
        requireAdmin();
        if ($method !== 'POST') fail('Method not allowed', 405);
        $client = $input['clientName'] ?? '';
        $pdo->prepare("UPDATE clients SET metaPageId=NULL, metaPageName=NULL, metaAdAccount=NULL,
                       metaToken=NULL, metaTokenExp=NULL, metaConnectedAt=NULL WHERE name=?")
            ->execute([$client]);
        respond(['ok' => true]);

    // ---------- טיימליין לקוח ----------
    case 'timeline':
        $u = requireLogin();

        if ($method === 'GET') {
            // לקוח רואה רק את שלו, ורק אירועים גלויים
            if ($u['role'] === 'client') {
                $client = $u['businessName'];
                $q = $pdo->prepare("SELECT * FROM timeline
                                    WHERE clientName = ? AND visible = 1
                                    ORDER BY eventDate DESC, createdAt DESC");
                $q->execute([$client]);
                $rows = $q->fetchAll();

                // משימות פעילות (לא-בוצעו) שסומנו גלויות ללקוח → כרטיסי "מצב" חיים בטיימליין
                $tq = $pdo->prepare("SELECT id, title, status, dueDate, updatedAt, createdAt
                                     FROM tasks
                                     WHERE clientName = ? AND visibleToClient = 1 AND status <> 'done'
                                     ORDER BY updatedAt DESC");
                $tq->execute([$client]);
                foreach ($tq->fetchAll() as $t) {
                    $rows[] = [
                        'id'        => 'live_' . $t['id'],
                        'clientName'=> $client,
                        'type'      => 'status',
                        'title'     => $t['title'],
                        'body'      => null,
                        'eventDate' => substr($t['updatedAt'] ?: $t['createdAt'], 0, 10),
                        'status'    => $t['status'],      // השדה שהפרונט יציג
                        'dueDate'   => $t['dueDate'],
                        'source'    => 'live', 'visible' => 1,
                        'metricLeads'=>null,'metricReach'=>null,'metricClicks'=>null,'metricSpend'=>null,
                        'platform'=>null,'linkUrl'=>null,'mediaPath'=>null,'body'=>null,
                    ];
                }
                // מיון מחדש אחרי המיזוג
                usort($rows, fn($a, $b) => strcmp($b['eventDate'], $a['eventDate']));

                $summary = [];
                foreach ($rows as $r) {
                    $m = substr($r['eventDate'], 0, 7);
                    if (!isset($summary[$m])) $summary[$m] = ['leads'=>0,'reach'=>0,'clicks'=>0,'spend'=>0,'events'=>0];
                    $summary[$m]['leads']  += (int)($r['metricLeads'] ?? 0);
                    $summary[$m]['reach']  += (int)($r['metricReach'] ?? 0);
                    $summary[$m]['clicks'] += (int)($r['metricClicks'] ?? 0);
                    $summary[$m]['spend']  += (float)($r['metricSpend'] ?? 0);
                    $summary[$m]['events'] += 1;
                }
                respond(['events' => $rows, 'summary' => $summary]);
            }

            // ----- ענף אדמין -----
            $client = $_GET['clientName'] ?? '';
            if ($client) {
                $q = $pdo->prepare("SELECT * FROM timeline WHERE clientName = ?
                                    ORDER BY eventDate DESC, createdAt DESC");
                $q->execute([$client]);
            } else {
                $q = $pdo->query("SELECT * FROM timeline ORDER BY eventDate DESC, createdAt DESC LIMIT 200");
            }
            $rows = $q->fetchAll();

            // סיכום חודשי של נתוני קמפיין
            $summary = [];
            foreach ($rows as $r) {
                $m = substr($r['eventDate'], 0, 7);   // YYYY-MM
                if (!isset($summary[$m])) $summary[$m] = ['leads'=>0,'reach'=>0,'clicks'=>0,'spend'=>0,'events'=>0];
                $summary[$m]['leads']  += (int)$r['metricLeads'];
                $summary[$m]['reach']  += (int)$r['metricReach'];
                $summary[$m]['clicks'] += (int)$r['metricClicks'];
                $summary[$m]['spend']  += (float)$r['metricSpend'];
                $summary[$m]['events'] += 1;
            }
            respond(['events' => $rows, 'summary' => $summary]);
        }

        if ($method === 'POST') {
            requireAdmin();
            $id   = $input['id'] ?? nid('tl_');
            $type = $input['type'] ?? 'note';
            $client = trim($input['clientName'] ?? '');
            $title  = trim($input['title'] ?? '');
            if (!$client) fail('חסר לקוח');
            if ($title === '') fail('חסרה כותרת');
            if (!in_array($type, ['post','campaign','task','update','note'], true)) fail('סוג לא תקין');

            $num = fn($k) => ($input[$k] ?? '') === '' ? null : (int)$input[$k];
            $pdo->prepare("
                INSERT INTO timeline (id, clientName, type, title, body, eventDate,
                    metricLeads, metricReach, metricClicks, metricSpend, platform, linkUrl,
                    source, visible, createdBy)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'manual', ?, ?)
                ON DUPLICATE KEY UPDATE title=VALUES(title), body=VALUES(body), eventDate=VALUES(eventDate),
                    metricLeads=VALUES(metricLeads), metricReach=VALUES(metricReach),
                    metricClicks=VALUES(metricClicks), metricSpend=VALUES(metricSpend),
                    platform=VALUES(platform), linkUrl=VALUES(linkUrl), visible=VALUES(visible)
            ")->execute([
                $id, $client, $type, $title, $input['body'] ?? null,
                $input['eventDate'] ?: date('Y-m-d'),
                $num('metricLeads'), $num('metricReach'), $num('metricClicks'),
                ($input['metricSpend'] ?? '') === '' ? null : (float)$input['metricSpend'],
                $input['platform'] ?: null, $input['linkUrl'] ?: null,
                isset($input['visible']) ? (int)!!$input['visible'] : 1,
                $u['name'],
            ]);
            respond(['ok' => true, 'id' => $id]);
        }

        if ($method === 'DELETE') {
            requireAdmin();
            $id = $_GET['id'] ?? '';
            if (!$id) fail('חסר מזהה');
            $pdo->prepare("DELETE FROM timeline WHERE id = ?")->execute([$id]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- תזכורות מתוזמנות ----------
    case 'reminders':
        $u = requireAdmin();

        if ($method === 'GET') {
            $taskId = $_GET['taskId'] ?? '';
            if ($taskId) {
                $q = $pdo->prepare("SELECT * FROM reminders WHERE taskId = ? ORDER BY nextRunAt");
                $q->execute([$taskId]);
                respond($q->fetchAll());
            }
            respond($pdo->query("
                SELECT r.*, t.title, t.status FROM reminders r
                JOIN tasks t ON t.id = r.taskId
                WHERE r.active = 1 ORDER BY r.nextRunAt LIMIT 100")->fetchAll());
        }

        if ($method === 'POST') {
            $taskId = $input['taskId'] ?? '';
            $when   = $input['nextRunAt'] ?? '';     // 'YYYY-MM-DD HH:MM'
            $target = $input['target'] ?? 'staff';
            if (!$taskId || !$when) fail('חסרים משימה או מועד');
            if (!in_array($target, ['staff','phone','group'], true)) fail('יעד לא תקין');

            $ts = strtotime($when);
            if (!$ts) fail('מועד לא תקין');

            $every = max(0, (int)($input['repeatEvery'] ?? 0));    // שעות
            $times = max(1, (int)($input['repeatTimes'] ?? 1));
            if ($every > 0 && $every < 1) fail('מרווח מינימלי בין תזכורות: שעה');
            if ($times > 20) fail('מקסימום 20 חזרות לתזכורת');

            $id = $input['id'] ?? nid('rm_');
            $pdo->prepare("
                INSERT INTO reminders (id, taskId, target, message, nextRunAt, repeatEvery, repeatTimes, createdBy, active)
                VALUES (?,?,?,?,?,?,?,?,1)
                ON DUPLICATE KEY UPDATE target=VALUES(target), message=VALUES(message),
                  nextRunAt=VALUES(nextRunAt), repeatEvery=VALUES(repeatEvery),
                  repeatTimes=VALUES(repeatTimes), active=1
            ")->execute([$id, $taskId, $target, ($input['message'] ?? '') ?: null,
                         date('Y-m-d H:i:s', $ts), $every, $times, $u['name']]);
            respond(['ok' => true, 'id' => $id]);
        }

        if ($method === 'DELETE') {
            $id = $_GET['id'] ?? '';
            if (!$id) fail('חסר מזהה');
            $pdo->prepare("DELETE FROM reminders WHERE id = ?")->execute([$id]);
            respond(['ok' => true]);
        }
        fail('Method not allowed', 405);

    // ---------- יומן שליחות ----------
    case 'notifications':
        requireAdmin();
        $taskId = $_GET['taskId'] ?? '';
        if ($taskId) {
            $q = $pdo->prepare("SELECT * FROM notifications WHERE taskId = ? ORDER BY createdAt DESC");
            $q->execute([$taskId]);
            respond($q->fetchAll());
        }
        respond($pdo->query("SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 100")->fetchAll());

    default:
        fail('פעולה לא מוכרת: ' . htmlspecialchars($action), 404);
    }
} catch (PDOException $e) {
    error_log('[bidernet-tasks] ' . $e->getMessage());
    $msg = $e->getMessage();
    // הודעה מובנת במקום "שגיאת מסד נתונים" סתום
    if (str_contains($msg, 'Unknown column')) {
        preg_match("/Unknown column '([^']+)'/", $msg, $m);
        respond(['error' => 'חסרה עמודה במסד הנתונים: ' . ($m[1] ?? '?') .
                            ' — התנתק והתחבר מחדש כדי להשלים את העדכון האוטומטי'], 500);
    }
    if (str_contains($msg, "doesn't exist")) {
        respond(['error' => 'חסרה טבלה במסד הנתונים — הרץ את repair.sql'], 500);
    }
    respond(['error' => 'שגיאת מסד נתונים: ' . mb_substr($msg, 0, 200)], 500);
} catch (Throwable $e) {
    error_log('[bidernet-tasks] ' . $e->getMessage());
    respond(['error' => 'שגיאת שרת'], 500);
}
