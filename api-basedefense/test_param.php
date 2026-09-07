<?php
/**
 * ============================================================================
 * TEST / DEVELOPER UTILITY — NOT part of the production authentication flow.
 *
 * This page generates valid encrypted `d`/`i` game-entry parameters for a
 * chosen member_id. Anyone who can load this page can mint a working entry
 * URL for ANY member_id. Do NOT expose this file on a publicly reachable
 * production host unless it is intentionally access-restricted (e.g. IP
 * allow-list, HTTP auth, or simply not deployed there at all).
 * ============================================================================
 *
 * Crypto convention reproduced here (confirmed against the actual current
 * implementation, not assumed):
 *   - src/config/memberAuth.js  → STAGING_SECRET / PRODUCTION_SECRET (64
 *     chars each); only the FIRST 32 CHARACTERS are used, as the AES-256 key.
 *   - src/systems/MemberSession.js → decryptPayload():
 *       key = CryptoJS.enc.Utf8.parse(first 32 chars of the env secret)
 *       iv  = CryptoJS.enc.Utf8.parse(i)   // `i` used verbatim, full length
 *       AES-256-CBC, PKCS7 padding, `d` is base64 of the raw ciphertext
 *       (no OpenSSL "Salted__" header — matches OPENSSL_RAW_DATA).
 *   - Because CryptoJS.enc.Utf8.parse(i) treats `i` as literal UTF-8 text
 *     whose bytes ARE the IV, `i` must be exactly 16 ASCII (1-byte) chars —
 *     not hex, not base64, not raw binary.
 * This matches the convention already round-trip-verified in a real browser
 * (Chrome via Playwright) against the unmodified game code.
 */

declare(strict_types=1);

require __DIR__ . '/lib/save_store.php'; // reuse the real is_valid_member_id() — do not duplicate the regex

// Same 64-char secrets as src/config/memberAuth.js. Only used here to reproduce
// client-side test parameters; this API never uses them for anything else.
const SECRETS = [
    'staging'    => 'rMuWsfrJhVnlrQVbOcJRdMt7lRa6HtxvpmDqAwegwPg1pzYkfXSIIHjbVmwK6TNu',
    'production' => '6PBVPcjME9He7Bcwh90nO2SwwcLP0M93iVe6zpmBXqC2iVtT98T6YFcNjNl4T6RT',
];

const IV_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** First 32 chars of the chosen environment's secret — the AES-256 key, byte-for-byte what getMemberAuthKey() returns. */
function member_auth_key(string $env): string
{
    return substr(SECRETS[$env], 0, 32);
}

/** Cryptographically secure 16-ASCII-char IV — its UTF-8 bytes are used directly as the 16-byte AES IV, matching MemberSession.js. */
function generate_iv(): string
{
    $iv = '';
    for ($n = 0; $n < 16; $n++) {
        $iv .= IV_ALPHABET[random_int(0, strlen(IV_ALPHABET) - 1)];
    }
    return $iv;
}

/**
 * Locate the sibling game directory dynamically rather than hardcoding a
 * folder name that may change (it currently is basedefense20260904_edit,
 * not basedefense20260904). Matches SaveApi.js's own sibling-path
 * convention (`../api-basedefense/index.php`) in reverse.
 */
function detect_game_dir(): ?string
{
    $parent = dirname(__DIR__);
    $candidates = glob($parent . '/basedefense2*', GLOB_ONLYDIR) ?: [];
    foreach ($candidates as $dir) {
        if (is_file($dir . '/index.html') && is_file($dir . '/src/systems/MemberSession.js')) {
            return basename($dir);
        }
    }
    return null;
}

function build_entry_url(string $gameDir, string $d, string $i): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // .../basedefense/api-basedefense/test_param.php -> .../basedefense
    $basePath = dirname(dirname($_SERVER['SCRIPT_NAME']));
    $basePath = rtrim(str_replace('\\', '/', $basePath), '/');
    $query = http_build_query(['d' => $d, 'i' => $i]);
    return $scheme . '://' . $host . $basePath . '/' . $gameDir . '/?' . $query;
}

$env = 'staging';
$memberIdInput = 'sample111';
$error = null;
$result = null; // ['d','i','entryUrl','plaintext','verified']

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $env = ($_POST['env'] ?? 'staging') === 'production' ? 'production' : 'staging';
    $memberIdInput = trim((string)($_POST['member_id'] ?? ''));

    if (!is_valid_member_id($memberIdInput)) {
        $error = 'Invalid member_id — must match ^[A-Za-z0-9_-]{1,64}$ (same rule as the save API).';
    } else {
        $gameDir = detect_game_dir();
        if ($gameDir === null) {
            $error = 'Could not locate the sibling game directory next to api-basedefense/. Expected a folder like basedefense20260904* containing index.html and src/systems/MemberSession.js.';
        } else {
            $key = member_auth_key($env);
            $iv = generate_iv();
            $plaintext = json_encode(['member_id' => $memberIdInput], JSON_UNESCAPED_SLASHES);
            $cipher = openssl_encrypt($plaintext, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);

            if ($cipher === false) {
                $error = 'openssl_encrypt failed.';
            } else {
                $d = base64_encode($cipher);

                // Round-trip self-check using the exact inverse of MemberSession.js's decryptPayload():
                // same key/iv, AES-256-CBC, PKCS7 padding, raw (non-base64-wrapped) ciphertext.
                $decrypted = openssl_decrypt($cipher, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
                $decodedPayload = $decrypted !== false ? json_decode($decrypted, true) : null;
                $verified = is_array($decodedPayload) && ($decodedPayload['member_id'] ?? null) === $memberIdInput;

                $result = [
                    'd' => $d,
                    'i' => $iv,
                    'entryUrl' => build_entry_url($gameDir, $d, $iv),
                    'plaintext' => $plaintext,
                    'gameDir' => $gameDir,
                    'verified' => $verified,
                ];
            }
        }
    }
}

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>Base Defense — Test Parameter Generator</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { font-size: 1.25rem; }
  .warn { background: #fff3cd; border: 1px solid #e0c26f; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1.5rem; font-size: 0.9rem; }
  form { display: grid; gap: 0.75rem; max-width: 360px; margin-bottom: 1.5rem; }
  label { font-weight: 600; font-size: 0.9rem; }
  input[type=text], select { padding: 0.4rem; font-size: 1rem; }
  button { padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }
  .error { color: #a4262c; font-weight: 600; }
  .field { display: grid; gap: 0.25rem; margin-bottom: 0.75rem; }
  .field textarea, .field input[readonly] { width: 100%; font-family: monospace; padding: 0.4rem; box-sizing: border-box; }
  .row { display: flex; gap: 0.5rem; align-items: center; }
  .row input { flex: 1; }
  .ok { color: #0d6b0d; font-weight: 600; }
  .bad { color: #a4262c; font-weight: 600; }
  small { color: #666; }
</style>
</head>
<body>

<h1>BASE DEFENSE — Test Parameter Generator</h1>
<div class="warn">Developer/test utility. Generates working game-entry parameters for any member_id. Do not expose on a public production host without access control.</div>

<form method="post">
  <div class="field">
    <label for="env">Environment</label>
    <select id="env" name="env">
      <option value="staging" <?= $env === 'staging' ? 'selected' : '' ?>>STAGING</option>
      <option value="production" <?= $env === 'production' ? 'selected' : '' ?>>PRODUCTION</option>
    </select>
  </div>
  <div class="field">
    <label for="member_id">Member ID</label>
    <input type="text" id="member_id" name="member_id" value="<?= h($memberIdInput) ?>" placeholder="sample111">
  </div>
  <button type="submit">Generate</button>
</form>

<?php if ($error): ?>
  <p class="error"><?= h($error) ?></p>
<?php endif; ?>

<?php if ($result): ?>
  <p><?= $result['verified'] ? '<span class="ok">✓ Round-trip verified — decrypts back to member_id=' . h($memberIdInput) . '</span>' : '<span class="bad">✗ Round-trip self-check FAILED — do not use this output</span>' ?></p>

  <div class="field">
    <label for="out_d">d</label>
    <div class="row">
      <input type="text" id="out_d" readonly value="<?= h($result['d']) ?>">
      <button type="button" onclick="copyField('out_d')">Copy</button>
    </div>
  </div>

  <div class="field">
    <label for="out_i">i</label>
    <div class="row">
      <input type="text" id="out_i" readonly value="<?= h($result['i']) ?>">
      <button type="button" onclick="copyField('out_i')">Copy</button>
    </div>
  </div>

  <div class="field">
    <label for="out_url">Entry URL</label>
    <div class="row">
      <input type="text" id="out_url" readonly value="<?= h($result['entryUrl']) ?>">
      <button type="button" onclick="copyField('out_url')">Copy</button>
    </div>
    <small>Game directory detected: <?= h($result['gameDir']) ?></small>
  </div>

  <p><a href="<?= h($result['entryUrl']) ?>" target="_blank" rel="noopener"><button type="button">Open Game</button></a></p>
<?php endif; ?>

<script>
function copyField(id) {
  const el = document.getElementById(id);
  el.select();
  navigator.clipboard.writeText(el.value).catch(() => document.execCommand('copy'));
}
</script>
</body>
</html>
