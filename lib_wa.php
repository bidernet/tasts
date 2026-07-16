<?php
/**
 * ============================================
 * bidernet · שכבת שליחה לוואטסאפ
 * ============================================
 * משותפת ל-api.php (שליחה ידנית) ול-cron.php (תזכורות).
 * החלפת ספק = שינוי הגדרה, לא שינוי קוד.
 * ============================================
 */

/**
 * נרמול טלפון לפורמט בינלאומי.
 * 052-660-4361 · 0526604361 · +972526604361  →  972526604361
 */
function wa_normalizePhone($raw, $cc = '972') {
    $d = preg_replace('/\D/', '', (string)$raw);
    if ($d === '') return '';
    if (str_starts_with($d, '00')) $d = substr($d, 2);
    if (str_starts_with($d, '0'))  $d = $cc . substr($d, 1);
    elseif (!str_starts_with($d, $cc) && strlen($d) <= 9) $d = $cc . $d;
    return $d;
}

/**
 * שליחת הודעה.
 * @return array{ok:bool, code:int, detail:string, target:string}
 */
function wa_send(array $s, string $channel, string $rawTo, string $message): array {
    $to = $rawTo;

    // יעד ישיר (מספר) — נרמול והוספת הסיומת שהספק דורש
    if (!str_contains($to, '@')) {
        $to = wa_normalizePhone($to);
        if (strlen($to) < 11) return ['ok' => false, 'code' => 0, 'detail' => "מספר לא תקין: $rawTo", 'target' => $rawTo];
        if (($s['waProvider'] ?? '') === 'greenapi') $to .= '@c.us';
    }

    $base = rtrim($s['waBaseUrl'] ?? '', '/');
    if (($s['waProvider'] ?? '') === 'greenapi') {
        $url     = "$base/waInstance{$s['waInstanceId']}/sendMessage/{$s['waToken']}";
        $body    = ['chatId' => $to, 'message' => $message];
        $headers = ['Content-Type: application/json'];
    } else {
        $url     = "$base/messages/text";
        $body    = ['to' => $to, 'body' => $message];
        $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . ($s['waToken'] ?? '')];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
    ]);
    $res  = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cErr = curl_error($ch);
    curl_close($ch);

    $ok = !$cErr && $code >= 200 && $code < 300;

    // הסבר קריא מגוף התשובה של הספק
    $detail = $cErr ?: (string)$res;
    $parsed = json_decode((string)$res, true);
    if (is_array($parsed)) {
        $desc = $parsed['invokeStatus']['description']
             ?? $parsed['correspondentsStatus']['description']
             ?? $parsed['message'] ?? $parsed['error'] ?? null;
        if ($desc) $detail = $desc;
    }
    return ['ok' => $ok, 'code' => $code, 'detail' => (string)$detail, 'target' => $to];
}

/** מילוי המשתנים בתבנית ההודעה */
function wa_fill(string $tpl, array $task, ?array $client, ?array $staff): string {
    $prios = ['urgent' => 'דחוף', 'high' => 'גבוה', 'normal' => 'רגיל', 'low' => 'נמוך'];
    $stat  = ['todo' => 'לביצוע', 'in_progress' => 'בעבודה', 'review' => 'לבדיקה', 'done' => 'בוצע'];
    $due   = $task['dueDate'] ? date('j.n.Y', strtotime($task['dueDate'])) : 'ללא';

    return strtr($tpl, [
        '{task}'     => $task['title'] ?? '',
        '{client}'   => $task['clientName'] ?: '—',
        '{status}'   => $stat[$task['status']] ?? ($task['status'] ?? ''),
        '{priority}' => $prios[$task['priority']] ?? ($task['priority'] ?? ''),
        '{due}'      => $due,
        '{user}'     => $staff['name'] ?? '',
    ]);
}
