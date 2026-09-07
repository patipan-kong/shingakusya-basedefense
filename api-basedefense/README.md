# api-basedefense

Server-side save/load API for **Base Defense** (`basedefense/basedefense20260904`), keyed by `member_id`.
Plain PHP, no framework and no build step — matches the rest of this repo (`api/index.php`,
`chikatanken/*`). Each player's save is one JSON file under `data/`.

## How a player is identified

The game is launched with two query params, `d` (encrypted payload) and `i` (the AES IV used to
encrypt it). This API **never sees or handles that encryption** — decryption happens entirely
client-side in the game (`basedefense20260904/src/systems/MemberSession.js`), exactly like the
existing Dungeon Survival game (`chikatanken/chikatanken20250514/js/game.js`,
`getPlayerData()`). Once the game has decrypted `d` and pulled `member_id` out of the resulting
JSON, it talks to this API using that plain `member_id` string — same as Dungeon Survival's
`api/index.php` (`getCollection`/`setCollection`).

### Crypto convention (client-side only, documented here for completeness)

- Algorithm: AES-256-CBC.
- **Key**: 32 bytes, taken as the **first 32 characters** of a 64-character per-environment
  secret. The 64-character values are labeled "STAGING IV" / "PRODUCTION IV" by the platform
  that issues them, but functionally they are the AES **key** source, truncated — this exactly
  matches what Dungeon Survival already hardcodes (`chikatanken/chikatanken20250514/js/game.js`
  line 51, `key_str = "rMuWsfrJhVnlrQVbOcJRdMt7lRa6Htxv"`, which is byte-for-byte the first 32
  characters of the STAGING value below). **Do not "fix" this by using the full 64 characters —
  that breaks decryption.**
- **IV**: the `i` query parameter, used **at its full length, unmodified** — this is a separate,
  genuinely-16-byte value generated fresh per launch by whatever issues the URL. It is not
  related to the 64→32 truncation rule above.
- Configured secrets live in `basedefense20260904/src/config/memberAuth.js` (client-side only —
  this API has no need for them). This project has no build/env-variable system, so which one is
  active is a single hardcoded constant (`ACTIVE_ENV`) in that file, toggled by hand before
  deploying — the same convention Dungeon Survival uses (hardcoded constants, manually edited per
  environment).

## Endpoints

Single entry point: `index.php`. `m` selects the operation, `member_id` is required on every
request and is re-validated server-side regardless of what the client already checked.

### `GET index.php?m=load&member_id=<id>`

```json
{ "status": "ok", "exists": true,  "data": { ...save fields... } }
{ "status": "ok", "exists": false, "data": null }
```

`exists:false` is a normal, successful result — it means this member has never saved before, and
the game should start from its own built-in defaults. This is deliberately distinct from an
*error* response:

```json
{ "status": "error", "error": "load_failed" }
```

returned with a non-2xx HTTP status. The client (`SaveSync.js`) treats these two very
differently: `exists:false` initializes a fresh game; an error response means "we don't know what
the player's save looks like right now". Gameplay is **server-only** — there is no local cache to
fall back to — so a load error must **not** be treated as "start fresh"; the client blocks
gameplay from starting at all rather than risk saving default data over an existing server save it
simply failed to read (see "Local vs. server save precedence" below).

### `POST index.php` with body `m=save&member_id=<id>&data=<json string>`

```json
{ "status": "ok" }
```

or an error object with a non-2xx status (`invalid_member_id`, `missing_data`, `invalid_json`,
`save_failed`). `data` must be a JSON **object** (not array/scalar) — it is stored verbatim,
whatever shape the game's save currently is. The API does not know or care about individual save
fields.

### Errors (both endpoints)

| HTTP | error              | meaning                                            |
|------|--------------------|-----------------------------------------------------|
| 400  | `invalid_member_id`| missing or fails the member_id allow-list           |
| 400  | `unknown_action`   | `m` is not `load` or `save`                         |
| 400  | `missing_data`     | (`save`) no `data` field                             |
| 400  | `invalid_json`     | (`save`) `data` is not parseable JSON / not an object|
| 405  | `method_not_allowed`| wrong HTTP verb for the action (load=GET, save=POST)|
| 500  | `load_failed`      | save file exists but is unreadable/corrupted         |
| 500  | `save_failed`      | write to disk failed                                 |

## Data directory & filename safety

Files live in `data/<member_id>.json`. `member_id` is validated against a strict allow-list —
`^[A-Za-z0-9_-]{1,64}$` — **before it ever touches a filesystem path**; anything else (`../`,
`/`, `\`, null bytes, spaces, dots, unicode tricks, …) is rejected outright with
`invalid_member_id`. See `lib/save_store.php` (`is_valid_member_id`, `save_file_path`) — the
resolved path is additionally checked with `realpath()` to confirm it still lands inside `data/`
as defense-in-depth.

This is a deliberate improvement over the existing `api/index.php` convention it otherwise
mirrors (`./data/<member_id>.json` with `getCollection`/`setCollection`-style actions) — that
existing endpoint concatenates `member_id` into a path with **no validation at all**, which this
API does not copy.

`data/.htaccess` also blocks direct HTTP access to the directory (defense-in-depth; the primary
control is the validation above, not the `.htaccess`).

Writes are atomic: each save is written to a temp file in `data/` and then renamed over the
destination, so a crash or concurrent read never observes a half-written file.

## Save ordering / concurrency

The API itself does no request-level locking or versioning — each `save` call simply overwrites
the file. Preventing an older save from clobbering a newer one is handled **client-side**
(`basedefense20260904/src/systems/SaveSync.js`): saves are debounced (~900ms) and strictly
serialized — a new save request never starts while one is still in flight; if game state changes
again while a request is in flight, that's coalesced into exactly one follow-up request once the
current one finishes. This makes out-of-order responses structurally impossible without adding
server-side versioning.

On tab close (`pagehide`), a best-effort `sendBeacon` fires for any state that was debounced but
not yet sent — but **only when idle** (no request currently in flight). A `sendBeacon` is a second,
independent request outside the serialization queue above; firing one while a `fetch`-based save
is still in flight would let the two race to the server in either order, and if the beacon (newer
data) arrived first followed by the in-flight fetch (older, already-serialized data), the file
would regress to older data. So `SaveSync.js` accepts a narrower, more standard trade-off instead:
an in-flight save that gets killed by the browser mid-navigation may be lost, but a completed save
can never be overwritten by an earlier one.

## Why `stageRecords` (or any empty object field) may round-trip as `[]`

PHP's `json_decode($x, true)` turns both `{}` and `[]` into the same value (an empty PHP array),
so `json_encode` on an empty object always emits `[]`, never `{}`. This only affects **empty**
object-shaped fields — anything with actual string keys (e.g. `{"3": 12.5}`) round-trips
correctly, because PHP treats non-sequential/non-zero-starting keys as an object. This API stores
the save blob opaquely and does not special-case any field name to work around this (that would
couple it to the game's schema). The game normalizes this on its side instead —
`SaveManager.js`'s `mergeWithDefault()` converts an empty-array `stageRecords` back to `{}` after
every load from the server.

## Local vs. server save precedence (read this before assuming a "migration" happened)

Gameplay persistence is **server-only**. `localStorage` is never read or written for gameplay
save/load — not as a cache, not as an offline fallback, not as a migration source (the only
remaining `localStorage` use in the game is `TestLogger.js`'s `basedefense_testlog_v1`, an
unrelated QA/balance log, not gameplay progress). `SaveManager.data` lives purely in memory for
the life of the page. Startup behavior (`SaveSync.js`):

- No `member_id` resolvable at all (missing/invalid `d`/`i`) → the game runs with in-memory
  defaults for that page load only. Nothing is persisted anywhere (no network calls to this API,
  no `localStorage` writes) — this is a transient session, intended for local dev/testing
  (`testMode.js`/`devTools.js`) where no launch URL with `d`/`i` is present.
- `member_id` resolved, server has a save (`exists:true`) → server data wins, always. Hydrated
  directly into memory.
- `member_id` resolved, server has **no** save yet (`exists:false`) → the game starts from its own
  normal hard-coded defaults, confirmed by the server as a genuinely new player — not inferred from
  the absence of any local data.
- `member_id` resolved, but the load request itself failed (network/timeout/5xx/malformed
  response) → the client does **not** fall back to defaults and does **not** start gameplay. There
  is no local cache to fall back to, and starting with defaults would risk the player's first
  in-game action overwriting a real save on the server that the client simply failed to read. The
  game blocks at the title screen with an on-screen message asking the player to reload
  (`title.js`); this is a deliberate "fail closed" choice rather than "fail open with defaults".

An old browser-side `basedefense_save_v1` key from before this change (or from a pre-migration
build) is never read, never uploaded, and never bound to a member — it is simply inert leftover
data with no effect on gameplay. Nothing in this codebase deletes it automatically either; that
was left as a non-essential, optional follow-up rather than added complexity here.

## Configuration / deployment

- This API does no crypto at all — it only needs a standard PHP setup (7.4+ is enough; nothing
  here uses PHP 8-only syntax) with write access to `data/`.
- `data/` must be writable by the PHP process. No other configuration is required — there are no
  environment variables, secrets, or config files needed by this API.
- Staging vs. production `IV`/key selection is entirely client-side (see above) — this API is
  identical in both environments.
- Deploy `basedefense/api-basedefense` alongside `basedefense/basedefense20260904` (siblings under
  `basedefense/`), since the game calls it via the relative path `../api-basedefense/index.php`
  (`basedefense20260904/src/systems/SaveApi.js`, `API_URL`). If the real deployment layout
  differs, update that one constant.

## Tests

`tests/save_store_test.php` — plain assertion script (no test framework), run with:

```
php tests/save_store_test.php
```

Covers: member_id allow-list edge cases, path-traversal rejection, save/load round trip, two
members staying independent, overwrite semantics, and corrupted-file-on-disk being reported as a
failure rather than silently treated as "no save".
