<?php
/**
 * Base Defense server-side save storage.
 *
 * Every player save is one JSON file under DATA_DIR named "<member_id>.json".
 * member_id always comes from the client-decrypted d/i payload (see the game's
 * src/systems/MemberSession.js) and MUST be re-validated here — the API never
 * trusts the client. Only [A-Za-z0-9_-]{1,64} is accepted; anything else is
 * rejected before it ever touches the filesystem, so path traversal, slashes,
 * backslashes and null bytes can never reach a file path.
 */

const DATA_DIR = __DIR__ . '/../data';

/**
 * True if $memberId is safe to use as a filename component.
 * Deliberately strict allow-list (no '.', '/', '\\', spaces, etc.) rather than
 * trying to blacklist traversal sequences.
 */
function is_valid_member_id($memberId)
{
    return is_string($memberId) && preg_match('/^[A-Za-z0-9_-]{1,64}$/', $memberId) === 1;
}

/**
 * Resolve the on-disk path for a member's save file.
 * Throws if $memberId fails validation — callers must validate first, this is
 * a second (defense-in-depth) gate, not the primary check.
 */
function save_file_path($memberId)
{
    if (!is_valid_member_id($memberId)) {
        throw new InvalidArgumentException('invalid member_id');
    }

    $dataDir = realpath(DATA_DIR);
    if ($dataDir === false) {
        throw new RuntimeException('data directory missing');
    }

    $path = $dataDir . DIRECTORY_SEPARATOR . $memberId . '.json';

    // Belt-and-suspenders: confirm the resolved directory of the target file
    // really is the data directory (catches any future change to the regex
    // above that might reintroduce traversal).
    $resolvedParent = realpath(dirname($path));
    if ($resolvedParent !== $dataDir) {
        throw new RuntimeException('resolved path escapes data directory');
    }

    return $path;
}

/**
 * Load a member's save.
 * Returns ['exists' => false, 'data' => null] when there is no save yet —
 * that is NOT an error. Throws on a genuine failure (corrupt JSON on disk,
 * unreadable file) so the caller can tell "no save" apart from "load failed".
 */
function load_save($memberId)
{
    $path = save_file_path($memberId);

    if (!file_exists($path)) {
        return ['exists' => false, 'data' => null];
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException('save file unreadable');
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
        throw new RuntimeException('save file corrupted: ' . json_last_error_msg());
    }

    return ['exists' => true, 'data' => $decoded];
}

/**
 * Persist a member's save as JSON, atomically (write to a temp file in the
 * same directory, then rename over the destination) so a crash/parallel read
 * never observes a partially-written file.
 */
function write_save($memberId, array $data)
{
    $path = save_file_path($memberId);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('failed to encode save data: ' . json_last_error_msg());
    }

    $tmpPath = $path . '.tmp-' . bin2hex(random_bytes(8));

    $bytesWritten = file_put_contents($tmpPath, $json, LOCK_EX);
    if ($bytesWritten === false) {
        @unlink($tmpPath);
        throw new RuntimeException('failed to write temp save file');
    }

    // rename() replaces an existing destination atomically on both POSIX and
    // modern Windows PHP builds; fall back to unlink+rename for older
    // Windows PHP where rename() can refuse to overwrite.
    if (!@rename($tmpPath, $path)) {
        @unlink($path);
        if (!@rename($tmpPath, $path)) {
            @unlink($tmpPath);
            throw new RuntimeException('failed to move temp save file into place');
        }
    }
}
