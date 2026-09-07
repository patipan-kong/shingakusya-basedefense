<?php
/**
 * Plain assertion-style tests for lib/save_store.php — no test framework,
 * matching the rest of this repo's tooling-free convention.
 *
 * Run:  php tests/save_store_test.php
 */

require_once __DIR__ . '/../lib/save_store.php';

$failures = 0;
$passed = 0;

function check($label, $condition)
{
    global $failures, $passed;
    if ($condition) {
        $passed++;
        echo "PASS: $label\n";
    } else {
        $failures++;
        echo "FAIL: $label\n";
    }
}

function checkThrows($label, callable $fn)
{
    try {
        $fn();
        check($label, false);
    } catch (Throwable $e) {
        check($label, true);
    }
}

// --- member_id validation -------------------------------------------------

check('accepts simple alnum id', is_valid_member_id('sample111'));
check('accepts underscores/hyphens', is_valid_member_id('member_id-01'));
check('rejects empty string', !is_valid_member_id(''));
check('rejects path traversal ../../etc/passwd', !is_valid_member_id('../../etc/passwd'));
check('rejects embedded slash', !is_valid_member_id('a/b'));
check('rejects embedded backslash', !is_valid_member_id('a\\b'));
check('rejects null byte', !is_valid_member_id("a\0b"));
check('rejects dot-dot alone', !is_valid_member_id('..'));
check('rejects overly long id (65 chars)', !is_valid_member_id(str_repeat('a', 65)));
check('accepts max length id (64 chars)', is_valid_member_id(str_repeat('a', 64)));
check('rejects non-string input', !is_valid_member_id(['member_id' => 'x']));

// --- path resolution stays inside data/ ------------------------------------

checkThrows('save_file_path rejects traversal id', function () {
    save_file_path('../../evil');
});

$path = save_file_path('sample111');
check('resolved path lands inside data dir', strpos($path, realpath(__DIR__ . '/../data')) === 0);
check('resolved filename matches member id', basename($path) === 'sample111.json');

// --- save/load round trip ---------------------------------------------------

$memberA = 'test_member_a_' . getmypid();
$memberB = 'test_member_b_' . getmypid();

try {
    $before = load_save($memberA);
    check('fresh member has no save (exists=false)', $before['exists'] === false && $before['data'] === null);

    $payload = [
        'coins' => 1234,
        'turretLevels' => [1, 2, 3, 1, 1],
        'baseLevel' => 3,
        'currentStage' => 5,
        'quizEnabled' => true,
        'bestSimulationStage' => 7,
        'stageRecords' => ['1' => 12.5, '2' => 4.0]
    ];
    write_save($memberA, $payload);

    $after = load_save($memberA);
    check('save round-trips exactly', $after['exists'] === true && $after['data'] == $payload);

    // separate member must not see memberA's data
    $bBefore = load_save($memberB);
    check('separate member has independent (empty) save', $bBefore['exists'] === false);

    write_save($memberB, ['coins' => 999, 'turretLevels' => [1, 1, 1, 1, 1], 'baseLevel' => 1, 'currentStage' => 1, 'quizEnabled' => false, 'bestSimulationStage' => 0, 'stageRecords' => []]);
    $bAfter = load_save($memberB);
    $aAfter = load_save($memberA);
    check('memberA and memberB saves stay separate', $aAfter['data']['coins'] === 1234 && $bAfter['data']['coins'] === 999);

    // overwrite (newer save wins)
    $payload['coins'] = 5555;
    write_save($memberA, $payload);
    $overwritten = load_save($memberA);
    check('overwrite replaces previous save', $overwritten['data']['coins'] === 5555);

    // corrupted file on disk must be reported as a failure, not "no save"
    $corruptPath = save_file_path($memberA);
    file_put_contents($corruptPath, '{not valid json');
    checkThrows('corrupted save file throws (load-failed, not no-save)', function () use ($memberA) {
        load_save($memberA);
    });
} finally {
    // cleanup test artifacts
    foreach ([$memberA, $memberB] as $m) {
        $p = __DIR__ . '/../data/' . $m . '.json';
        if (file_exists($p)) unlink($p);
    }
}

echo "\n$passed passed, $failures failed\n";
exit($failures > 0 ? 1 : 0);
