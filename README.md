# בידרנט · מערכת משימות ועדכונים

**גרסה 1.1.0** · `tasks.bidernet.co.il`

מערכת ניהול משימות פנימית לצוות משרד הפרסום: לוח קנבן, עדכוני צוות, קבצים, הרשאות לקוחות, והתראות וואטסאפ.

**סטאק:** PHP 8 + MySQL + React 18 (ללא build, ללא Node בשרת).

---

## 1. דרישות שרת

| | |
|---|---|
| PHP | 8.0 ומעלה |
| הרחבות PHP | `pdo_mysql`, `curl`, `mbstring` |
| MySQL / MariaDB | 5.7+ / 10.3+ |
| SSL | חובה (Let's Encrypt מספיק) |

---

## 2. התקנה — לחברת האחסון

### א. העלאת הקבצים

חלץ את התוכן של ה-ZIP אל תיקיית השורש של הדומיין:

```
/public_html/tasks.bidernet.co.il/
```

**חשוב:** הקבצים צריכים לשבת בשורש, לא בתת-תיקייה. `index.html` צריך להיות נגיש ישירות ב-`https://tasks.bidernet.co.il/`.

### ב. מסד הנתונים

1. cPanel → MySQL Databases → צור מסד נתונים חדש + משתמש, ושייך אותו עם הרשאות מלאות.
2. phpMyAdmin → בחר את מסד הנתונים → לשונית Import → העלה את `schema.sql` → Go.

⚠️ **בתיבה "Character set of the file" חייב להיות `utf-8`.** אם לא — כל העברית תיהפך ל-`??????`
ותצטרך להתחיל מחדש.

הסכמה יוצרת 11 טבלאות ומזינה משתמש מנהל ורשימת לקוחות התחלתית.

**להתקנה קיימת שנשברה:** הרץ במקום זאת את `repair.sql`, בלשונית **SQL** (לא Import).
הוא משלים טבלאות ועמודות חסרות ומתקן שמות שבורים, בלי למחוק משימות.

### ג. פרטי החיבור

ערוך את `config.php` ומלא את שלושת הערכים:

```php
$DB_NAME = 'biderne1_tasks';
$DB_USER = 'biderne1_tasks';
$DB_PASS = '...';
```

### ד. הרשאות

```
uploads/   → 755   (חייבת להיות ניתנת לכתיבה על ידי PHP)
config.php → 600
```

### ה. בדיקה

גלוש אל `https://tasks.bidernet.co.il/api.php?action=ping` — התשובה התקינה:

```json
{"ok":true,"version":"1.0.0","time":"..."}
```

---

## 3. כניסה ראשונה

```
שם משתמש: admin
סיסמה:    bidernet2026
```

**החלף את הסיסמה מיד** במסך "צוות".

---

## 4. מבנה הקבצים

```
index.html         שלד הדף + טעינת React מ-CDN
app.js             כל הממשק (React + htm)
api.php            כל ה-API: ?action=login|tasks|clients|users|...
config.php         פרטי מסד הנתונים  ← לא נכנס ל-Git
schema.sql         סכמת מסד הנתונים
php.ini            הגדלת מגבלות העלאה ל-50MB
manifest.json      הגדרות PWA
.htaccess          הגנה על config.php + חסימת הרצת קוד ב-uploads
fonts/             PingHL-Regular (פונט המותג)
uploads/           קבצים מצורפים למשימות
logo.png           לוגו
favicon.ico, icon-*.png, apple-touch-icon.png
```

---

## 5. ה-API

כל הקריאות דרך `api.php?action=<שם>`:

| פעולה | מה עושה |
|---|---|
| `login` / `logout` / `me` | הזדהות (PHP session + "זכור אותי" 30 יום) |
| `forgot` / `reset_password` | שחזור סיסמה במייל |
| `board` | טעינת הלוח בקריאה אחת (משימות, לקוחות, משתמשים, מונים) |
| `tasks` / `task_status` | יצירה, עדכון, מחיקה, מעבר סטטוס |
| `task_comments` | עדכוני צוות (פנימי / גלוי ללקוח) |
| `task_activity` | יומן שינויים אוטומטי |
| `task_files` | העלאה והורדה של קבצים |
| `updates` | פיד העדכונים לפעמון |
| `users` / `clients` | ניהול צוות ולקוחות |
| `settings` | הגדרות וואטסאפ |
| `whatsapp_send` / `whatsapp_groups` / `whatsapp_status` | שליחה ידנית לוואטסאפ |
| `notifications` | יומן שליחות |

---

## 6. וואטסאפ (אופציונלי)

מסך "הגדרות" → ספק (Green API / Whapi), כתובת שרת, Instance ID, טוקן.
"בדיקת חיבור" מאמת את הסטטוס. "משוך קבוצות" במסך הלקוחות מושך את הקבוצות אוטומטית.

השליחה **ידנית בלבד** — בלחיצת כפתור על משימה. אין שליחה אוטומטית.

---

## 7. תזכורות אוטומטיות (Cron)

התזכורות נשלחות על ידי `cron.php`, שהשרת מריץ בלוח זמנים קבוע.

**cPanel → Cron Jobs → Add New Cron Job:**

```
Common Settings:  Every 5 minutes
Command:          /usr/local/bin/php /home/USER/public_html/tasks.bidernet.co.il/cron.php
```

(החלף `USER` בשם המשתמש שלך בשרת. את הנתיב המדויק ל-PHP אפשר לקבל מחברת האחסון.)

**בלמים מובנים נגד חסימת מספר הוואטסאפ:**

| | |
|---|---|
| מקסימום בהרצה אחת | 5 הודעות |
| תקרה יומית | 60 הודעות |
| מרווח בין הודעות | 8 שניות |
| עצירה אוטומטית | ברגע שהמשימה סומנה "בוצע" |
| מקסימום חזרות לתזכורת | 20 |

הערכים בראש `cron.php` (`MAX_PER_RUN`, `MAX_PER_DAY`, `GAP_SECONDS`).

**בדיקה ידנית:** `https://tasks.bidernet.co.il/cron.php?key=<CRON_KEY>`
(המפתח נמצא ב-`config.php` — **החלף אותו למחרוזת אקראית משלך**.)

---

## 8. מייל

שחזור סיסמה משתמש ב-`mail()` של PHP. בראש `api.php`:

```php
$APP_URL   = 'https://tasks.bidernet.co.il';
$MAIL_FROM = 'no-reply@bidernet.co.il';
```

ודא שתיבת הדואר `no-reply@bidernet.co.il` קיימת בדומיין, אחרת המיילים ייפלו לספאם.

---

## 9. עדכון גרסה

מספר הגרסה מופיע ב-3 מקומות: `VERSION`, `api.php` (`APP_VERSION`), `app.js` (`APP_VERSION`), ומוצג בתחתית סרגל הצד.

בעדכון: החלף את `app.js`, `index.html`, `api.php` בלבד. **אין לדרוס** את `config.php` ואת `uploads/`.
