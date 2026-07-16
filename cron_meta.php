<?php
/**
 * ============================================
 * bidernet · משיכת נתונים מ-Meta (Cron)
 * ============================================
 * מושך לידים ונתוני קמפיינים מכל לקוח מחובר,
 * ורושם אותם בטיימליין. מריצים פעם ביום.
 *
 * cPanel → Cron Jobs:
 *   Once a day (0 6 * * *)
 *   /usr/local/bin/php /home/USER/public_html/tasks.bidernet.co.il/cron_meta.php
 * ============================================
 */

date_default_timezone_set('Asia/Jerusalem');
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib_meta.php';

$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    $key = $_GET['key'] ?? '';
    if (!isset($CRON_KEY) || !hash_equals($CRON_KEY, $key)) { http_response_code(403); exit("אין הרשאה\n"); }
}
$log = fn($m) => print(date('H:i:s') . "  $m\n");

try {
    $pdo = new PDO("mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4", $DB_USER, $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
         PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"]);
} catch (PDOException $e) { $log('DB: ' . $e->getMessage()); exit(1); }

$clients = $pdo->query("SELECT * FROM clients WHERE metaPageId IS NOT NULL AND metaToken IS NOT NULL AND active = 1")->fetchAll();
if (!$clients) { $log('אין לקוחות מחוברים ל-Meta'); exit(0); }
$log(count($clients) . ' לקוחות מחוברים');

$tlIns = $pdo->prepare("INSERT INTO timeline
    (id, clientName, type, title, body, eventDate, metricLeads, metricReach, metricClicks, metricSpend,
     platform, source, refId, visible, createdBy)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'facebook', 'meta', ?, 1, 'Meta')
    ON DUPLICATE KEY UPDATE metricLeads=VALUES(metricLeads), metricReach=VALUES(metricReach),
     metricClicks=VALUES(metricClicks), metricSpend=VALUES(metricSpend)");

foreach ($clients as $c) {
    $name = $c['name'];
    $log("— $name");

    // התראה אם הטוקן עומד לפוג
    if ($c['metaTokenExp'] && strtotime($c['metaTokenExp']) < time() + 7 * 86400) {
        $log("  ⚠️ הטוקן פג בקרוב ({$c['metaTokenExp']}) — צריך לחבר מחדש");
    }

    // ----- לידים -----
    try {
        $since = date('Y-m-01');   // מתחילת החודש
        $leads = meta_fetchLeads($c['metaPageId'], $c['metaToken'], $since);
        $byDay = [];
        foreach ($leads as $l) {
            $day = substr($l['created_time'], 0, 10);
            $byDay[$day] = ($byDay[$day] ?? 0) + 1;
        }
        foreach ($byDay as $day => $count) {
            $tlIns->execute(['tl_' . bin2hex(random_bytes(6)), $name, 'campaign',
                "לידים מפייסבוק · $count", null, $day, $count, null, null, null,
                'meta_leads_' . $c['metaPageId'] . '_' . $day]);
        }
        $log('  לידים: ' . count($leads));
    } catch (Throwable $e) { $log('  לידים נכשל: ' . $e->getMessage()); }

    // ----- insights של הקמפיינים (חשיפות, קליקים, עלות) -----
    if ($c['metaAdAccount']) {
        $ins = meta_fetchInsights($c['metaAdAccount'], $c['metaToken'], 'this_month');
        if ($ins) {
            $month = date('Y-m-01');
            $tlIns->execute(['tl_' . bin2hex(random_bytes(6)), $name, 'campaign',
                'סיכום קמפיינים · ' . date('n/Y'), null, $month,
                null, $ins['reach'], $ins['clicks'], $ins['spend'],
                'meta_insights_' . $c['metaAdAccount'] . '_' . date('Y-m')]);
            $log("  חשיפות {$ins['reach']} · קליקים {$ins['clicks']} · ₪{$ins['spend']}");
        }
    }
    sleep(2);
}
$log('סיום.');
