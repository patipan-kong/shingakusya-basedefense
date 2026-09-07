<?php
/**
 * Base Defense save API.
 *
 * GET  ?m=load&member_id=xxx          -> { status:"ok", exists:bool, data:obj|null }
 * POST m=save, member_id=xxx, data=<json string>
 *                                      -> { status:"ok" }
 *
 * On any error: non-2xx HTTP status + { status:"error", error:"<code>" }.
 * "no save yet" (exists:false) is always HTTP 200 — it is a normal result,
 * never an error, per the client's no-save vs load-failed distinction.
 *
 * See README.md for the full contract and the member_id -> filename safety
 * strategy implemented in lib/save_store.php.
 */

require_once __DIR__ . '/lib/save_store.php';

header('Content-Type: application/json; charset=utf-8');

function respond_error($httpStatus, $code)
{
    http_response_code($httpStatus);
    echo json_encode(['status' => 'error', 'error' => $code]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_REQUEST['m'] ?? '';
$memberId = $_REQUEST['member_id'] ?? '';

if (!is_valid_member_id($memberId)) {
    respond_error(400, 'invalid_member_id');
}

switch ($action) {
    case 'load':
        if ($method !== 'GET' && $method !== 'HEAD') {
            respond_error(405, 'method_not_allowed');
        }
        try {
            $result = load_save($memberId);
        } catch (Throwable $e) {
            error_log('[api-basedefense] load failed for ' . $memberId . ': ' . $e->getMessage());
            respond_error(500, 'load_failed');
        }
        echo json_encode(['status' => 'ok', 'exists' => $result['exists'], 'data' => $result['data']]);
        break;

    case 'save':
        if ($method !== 'POST') {
            respond_error(405, 'method_not_allowed');
        }
        if (!isset($_REQUEST['data']) || $_REQUEST['data'] === '') {
            respond_error(400, 'missing_data');
        }

        $decoded = json_decode($_REQUEST['data'], true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            respond_error(400, 'invalid_json');
        }

        try {
            write_save($memberId, $decoded);
        } catch (Throwable $e) {
            error_log('[api-basedefense] save failed for ' . $memberId . ': ' . $e->getMessage());
            respond_error(500, 'save_failed');
        }
        echo json_encode(['status' => 'ok']);
        break;

    default:
        respond_error(400, 'unknown_action');
}
