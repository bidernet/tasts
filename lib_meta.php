<?php
/**
 * ============================================
 * bidernet · Meta Graph API
 * ============================================
 * חיבור דף עסקי, משיכת לידים ונתוני קמפיינים.
 * ============================================
 */

const META_API = 'https://graph.facebook.com/v21.0';

function meta_get(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err) throw new RuntimeException("רשת: $err");
    $data = json_decode($res, true) ?? [];
    if ($code >= 400) {
        $msg = $data['error']['message'] ?? "HTTP $code";
        throw new RuntimeException($msg);
    }
    return $data;
}

/** code → access token */
function meta_getToken(string $appId, string $secret, string $redirect, string $code): array {
    return meta_get(META_API . '/oauth/access_token?' . http_build_query([
        'client_id'     => $appId,
        'client_secret' => $secret,
        'redirect_uri'  => $redirect,
        'code'          => $code,
    ]));
}

/** short-lived → long-lived (~60 יום) */
function meta_extendToken(string $appId, string $secret, string $token): array {
    return meta_get(META_API . '/oauth/access_token?' . http_build_query([
        'grant_type'        => 'fb_exchange_token',
        'client_id'         => $appId,
        'client_secret'     => $secret,
        'fb_exchange_token' => $token,
    ]));
}

/** הדפים שלמשתמש יש גישה אליהם, כולל page token לכל דף */
function meta_getPages(string $userToken): array {
    $out = [];
    $data = meta_get(META_API . '/me/accounts?' . http_build_query([
        'fields'       => 'id,name,access_token,category',
        'access_token' => $userToken,
        'limit'        => 100,
    ]));
    foreach ($data['data'] ?? [] as $p) {
        $out[] = [
            'id'       => $p['id'],
            'name'     => $p['name'],
            'category' => $p['category'] ?? '',
            'token'    => $p['access_token'],   // page access token
        ];
    }
    return $out;
}

/** חשבונות המודעות שלמשתמש יש גישה אליהם */
function meta_getAdAccounts(string $userToken): array {
    $out = [];
    try {
        $data = meta_get(META_API . '/me/adaccounts?' . http_build_query([
            'fields'       => 'id,name,account_status',
            'access_token' => $userToken,
            'limit'        => 100,
        ]));
        foreach ($data['data'] ?? [] as $a) {
            $out[] = ['id' => $a['id'], 'name' => $a['name'] ?? $a['id']];
        }
    } catch (Throwable $e) { /* ads_read אולי לא מאושר — לא חוסם */ }
    return $out;
}

/**
 * לידים חדשים מדף, מאז תאריך.
 * מחזיר מערך: [['id'=>, 'created_time'=>, 'form'=>, 'name'=>], ...]
 */
function meta_fetchLeads(string $pageId, string $pageToken, ?string $since = null): array {
    $forms = meta_get(META_API . "/$pageId/leadgen_forms?" . http_build_query([
        'fields'       => 'id,name',
        'access_token' => $pageToken,
        'limit'        => 50,
    ]));

    $leads = [];
    foreach ($forms['data'] ?? [] as $form) {
        $params = ['access_token' => $pageToken, 'limit' => 100, 'fields' => 'id,created_time'];
        if ($since) $params['filtering'] = json_encode([[
            'field' => 'time_created', 'operator' => 'GREATER_THAN', 'value' => strtotime($since),
        ]]);
        try {
            $res = meta_get(META_API . "/{$form['id']}/leads?" . http_build_query($params));
            foreach ($res['data'] ?? [] as $l) {
                $leads[] = ['id' => $l['id'], 'created_time' => $l['created_time'],
                            'formId' => $form['id'], 'formName' => $form['name']];
            }
        } catch (Throwable $e) { /* טופס בלי הרשאה — דלג */ }
    }
    return $leads;
}

/**
 * insights של חשבון מודעות לתקופה: חשיפות, קליקים, עלות.
 * @param string $datePreset  'this_month' | 'last_month' | 'last_7d'...
 */
function meta_fetchInsights(string $adAccount, string $userToken, string $datePreset = 'this_month'): array {
    if (!$adAccount) return [];
    $acct = str_starts_with($adAccount, 'act_') ? $adAccount : "act_$adAccount";
    try {
        $data = meta_get(META_API . "/$acct/insights?" . http_build_query([
            'fields'       => 'impressions,clicks,spend,reach',
            'date_preset'  => $datePreset,
            'access_token' => $userToken,
        ]));
        $row = $data['data'][0] ?? [];
        return [
            'reach'  => (int)($row['reach'] ?? 0),
            'clicks' => (int)($row['clicks'] ?? 0),
            'spend'  => (float)($row['spend'] ?? 0),
            'impr'   => (int)($row['impressions'] ?? 0),
        ];
    } catch (Throwable $e) {
        error_log('[meta insights] ' . $e->getMessage());
        return [];
    }
}
