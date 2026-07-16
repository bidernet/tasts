<?php
/**
 * ============================================
 * DATABASE CONFIGURATION — tasks.bidernet.co.il
 * ============================================
 * מלא בפרטים של מסד הנתונים בשרת החדש
 * (cPanel → MySQL Databases)
 * ============================================
 */

$DB_HOST = 'localhost';
$DB_NAME = 'YOUR_DB_NAME';       // ⚠️ שם מסד הנתונים
$DB_USER = 'YOUR_DB_USER';       // ⚠️ שם המשתמש
$DB_PASS = 'YOUR_DB_PASSWORD';   // ⚠️ הסיסמה

// מפתח להפעלת cron.php דרך הדפדפן (החלף למחרוזת אקראית משלך)
$CRON_KEY = 'CHANGE_ME_' . 'a7f3d9e2b1c4';

// ---------- Meta (Facebook) App ----------
// developers.facebook.com → bidernet clienst → Settings → Basic
$META_APP_ID     = '1391009979523790';
$META_APP_SECRET = 'PASTE_APP_SECRET_HERE';   // ⚠️ הדבק כאן, לעולם לא ב-Git
$META_REDIRECT   = 'https://tasks.bidernet.co.il/api.php?action=meta_callback';
$META_CONFIG_ID  = '1530498852109328';   // Facebook Login for Business — Configuration ID
