<?php
/**
 * ============================================
 * bidernet · שולח התזכורות (Cron)
 * ============================================
 * מופעל אוטומטית על ידי השרת, כל 5 דקות.
 *
 * cPanel → Cron Jobs → Add New Cron Job
 *   Common Settings:  Every 5 minutes  (*/5 * * * *)
 *   Command:
 *     /usr/local/bin/php /home/USER/public_html/tasks.bidernet.co.il/cron.php
 *
 * אפשר גם דרך URL עם המפתח שב-config.php:
 *   https://tasks.bidernet.co.il/cron.php?key=SECRET
 * ============================================
 */

date_default_timezone_set('Asia/Jerusalem');
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib_wa.php';

$isCli = php_sapi_name() === 'cli';

// גישה דרך הדפדפן מחייבת מפתח — כדי שלא כל אחד יוכל להפעיל שליחות
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    $key = $_GET['key'] ?? '';
    if (!isset($CRON_KEY) || $CRON_KEY === '' || !hash_equals($CRON_KEY, $key)) {
        http_response_code(403);
        exit("אין הרשאה\n");
    }
}

// ---------- בלמים נגד חסימת המספר ----------
const MAX_PER_RUN   = 5;    // הודעות בהרצה אחת (כל 5 דקות)
const MAX_PER_DAY   = 60;   // תקרה יומית
const GAP_SECONDS   = 8;    // המתנה בין הודעה להודעה

$log = function ($msg) use ($isCli) {
    $line = date('H:i:s') . "  $msg\n";
    echo $line;
    if (!$isCli) flush();
};

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
    $log('שגיאת חיבור למסד: ' . $e->getMessage());
    exit(1);
}

$s = $pdo->query("SELECT * FROM settings WHERE id = 1")->fetch();
if (empty($s['waEnabled']) || empty($s['waToken'])) {
    $log('חיבור הוואטסאפ כבוי — אין מה לשלוח');
    exit(0);
}

// תקרה יומית
$todayCount = $pdo->query("SELECT COUNT(*) FROM notifications
                           WHERE status = 'sent' AND DATE(createdAt) = CURDATE()")->fetchColumn();
if ($todayCount >= MAX_PER_DAY) {
    $log("נעצר: הגעת לתקרה היומית ({$todayCount}/" . MAX_PER_DAY . ")");
    exit(0);
}

// ---------- תזכורות שהגיע זמנן ----------
$due = $pdo->prepare("
    SELECT r.*, t.title, t.status, t.priority, t.dueDate, t.clientName, t.assignedTo
    FROM reminders r
    JOIN tasks t ON t.id = r.taskId
    WHERE r.active = 1
      AND r.nextRunAt <= NOW()
      AND t.status <> 'done'
    ORDER BY r.nextRunAt
    LIMIT " . MAX_PER_RUN);
$due->execute();
$rows = $due->fetchAll();

if (!$rows) { $log('אין תזכורות לשליחה'); exit(0); }
$log(count($rows) . ' תזכורות לשליחה');

$sent = 0;
foreach ($rows as $r) {
    // המשימה בוצעה בינתיים → כיבוי התזכורת
    if ($r['status'] === 'done') {
        $pdo->prepare("UPDATE reminders SET active = 0 WHERE id = ?")->execute([$r['id']]);
        $log("· {$r['title']} — בוצעה, התזכורת כובתה");
        continue;
    }

    // ----- קביעת היעד -----
    $staff = null; $client = null; $to = ''; $tpl = '';

    if ($r['target'] === 'staff') {
        if (!$r['assignedTo']) { $log("· {$r['title']} — אין אחראי, דילוג"); continue; }
        $q = $pdo->prepare("SELECT name, phone FROM users WHERE username = ? AND active = 1");
        $q->execute([$r['assignedTo']]);
        $staff = $q->fetch();
        $to  = $staff['phone'] ?? '';
        $tpl = $r['message'] ?: ($s['waStaffTemplate'] ?? '');
    } else {
        $q = $pdo->prepare("SELECT * FROM clients WHERE name = ?");
        $q->execute([$r['clientName']]);
        $client = $q->fetch();
        $to  = $r['target'] === 'group' ? ($client['waGroupId'] ?? '') : ($client['phone'] ?? '');
        $tpl = $r['message'] ?: ($s['waTemplate'] ?? '');
    }

    if (!$to) {
        $log("· {$r['title']} — אין יעד ({$r['target']}), דילוג");
        $pdo->prepare("UPDATE reminders SET active = 0 WHERE id = ?")->execute([$r['id']]);
        continue;
    }

    $task = ['title' => $r['title'], 'clientName' => $r['clientName'], 'status' => $r['status'],
             'priority' => $r['priority'], 'dueDate' => $r['dueDate']];
    $msg = wa_fill($tpl, $task, $client, $staff);

    // ----- שליחה -----
    $res = wa_send($s, $r['target'], $to, $msg);
    $sent++;

    $pdo->prepare("INSERT INTO notifications
                   (id, taskId, clientName, target, channel, message, status, response, sentBy)
                   VALUES (?,?,?,?,?,?,?,?,?)")
        ->execute(['n_' . bin2hex(random_bytes(6)), $r['taskId'], $r['clientName'],
                   $res['target'], $r['target'], $msg,
                   $res['ok'] ? 'sent' : 'failed',
                   mb_substr(($res['ok'] ? '' : "HTTP {$res['code']} · ") . $res['detail'], 0, 1500),
                   'תזכורת אוטומטית']);

    if ($res['ok']) {
        $log("· נשלח: {$r['title']} → {$res['target']}");

        $count = (int)$r['sentCount'] + 1;
        $times = (int)$r['repeatTimes'];
        $every = (int)$r['repeatEvery'];   // בשעות

        // הגענו למספר החזרות, או שאין חזרות → כיבוי
        if ($every <= 0 || ($times > 0 && $count >= $times)) {
            $pdo->prepare("UPDATE reminders SET sentCount = ?, active = 0, lastSentAt = NOW() WHERE id = ?")
                ->execute([$count, $r['id']]);
            $log("  התזכורת הושלמה ({$count}/{$times})");
        } else {
            $pdo->prepare("UPDATE reminders
                           SET sentCount = ?, lastSentAt = NOW(),
                               nextRunAt = DATE_ADD(NOW(), INTERVAL ? HOUR)
                           WHERE id = ?")
                ->execute([$count, $every, $r['id']]);
            $log("  הבאה בעוד {$every} שעות ({$count}/{$times})");
        }
    } else {
        $log("· נכשל: {$r['title']} — HTTP {$res['code']} {$res['detail']}");
        // דחייה בשעה, כדי לא להתעקש על יעד בעייתי
        $pdo->prepare("UPDATE reminders SET nextRunAt = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?")
            ->execute([$r['id']]);
    }

    if ($sent < count($rows)) sleep(GAP_SECONDS);   // קצב אנושי
}

$log("סיום. נשלחו {$sent} הודעות.");
