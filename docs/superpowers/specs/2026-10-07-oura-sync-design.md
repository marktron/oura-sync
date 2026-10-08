# oura-sync design

Date: 2026-10-07

## Purpose

Oura removed the web "Trends" view that let users download a CSV of their daily data. `oura-sync` is a command-line tool that reproduces that CSV from the Oura API v2, so existing spreadsheets, notes, and analyses built on the old export keep working.

Target users: individual Oura members exporting their own data. Published on GitHub under the MIT license. The tool contains nothing specific to the author.

## Non-goals

- Webhooks, continuous sync, or a daemon.
- Any data not in the old Trends CSV (SpO2, stress, resilience, workouts, heart-rate time series).
- Multi-user or hosted operation.
- Analysis of the data. The tool writes a file and exits.

## Stack

- TypeScript on Node 24, built-in `fetch`. No runtime dependencies.
- devDependencies: `typescript`, `@types/node`.
- Development runs the TypeScript directly (Node 24 type stripping). Distribution is compiled: `tsc -p tsconfig.build.json` emits `dist/`, `package.json` `bin` points at `dist/bin/oura-sync.js`, and a `prepare` script builds on install so `npm install -g github:<user>/oura-sync` works. Node refuses to strip types inside `node_modules`, so the raw `.ts` entry cannot be the published bin.
- Tests: `node --test` over `test/*.test.ts`, importing from `src/` directly. A packed-tarball smoke test (`npm pack`, install into a temp dir, run `--help`) guards the build.

## Authentication

Oura deprecated personal access tokens in December 2025. The only path is OAuth2. The user registers their own API application once at <https://cloud.ouraring.com/oauth/applications> with redirect URI `http://localhost:8477/callback` (port configurable) and gives the tool the client id and client secret.

Flow (`oura-sync login`):

1. If no config exists, prompt for client id and client secret and save them.
2. Generate a PKCE `code_verifier` and `code_challenge` (S256) and a random `state`.
3. Start a one-shot HTTP server on the configured port.
4. Open the browser to `https://cloud.ouraring.com/oauth/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `scope=daily heartrate`, `state`, `code_challenge`, `code_challenge_method=S256`. Print the URL as well in case the browser does not open.
5. On callback, verify `state`, exchange `code` at `https://api.ouraring.com/oauth/token` with `grant_type=authorization_code`, `code_verifier`, `client_id`, `client_secret`, `redirect_uri`.
6. Save `access_token`, `refresh_token`, and `expires_at` (now + `expires_in`). Respond to the browser with a plain "You can close this tab" page and shut the server down.

Token refresh: before any API call, if `expires_at` is within 60 seconds, POST `grant_type=refresh_token`. On a 401 from the API, refresh once and retry. Oura refresh tokens are single-use: every refresh response must carry a new `refresh_token`, and a response without one is treated as invalid. The new tokens are saved atomically (temp file plus rename) before the access token is used, so a crash cannot strand a consumed refresh token. If refresh fails for any reason, print `Run oura-sync login` and exit 1.

Callback handling: the `state` parameter is checked before anything else in the redirect is read. The browser page says only that authorization was received and to return to the terminal; "Logged in" is printed by the CLI after the code exchange succeeds and tokens are saved.

All HTTP requests carry a 30-second timeout.

## Configuration

Directory: `$XDG_CONFIG_HOME/oura-sync` or `~/.config/oura-sync`.

- `config.json`: `{ clientId, clientSecret, redirectPort, outDir }`. `redirectPort` defaults to 8477. `outDir` is optional.
- `tokens.json`: `{ accessToken, refreshToken, expiresAt }`.
- Both are written with mode 0600 via a temp file in the same directory followed by rename, so an interrupted write never leaves a truncated file. On read, the JSON is shape-checked (required string and number fields present); a malformed file is reported by path rather than failing deep inside the run.

Output directory resolution order: `--out` flag, `OURA_SYNC_OUT` environment variable, `outDir` in config, current working directory.

## Commands

### `oura-sync login`

As above. Idempotent; re-running replaces tokens.

### `oura-sync export --start YYYY-MM-DD [--end YYYY-MM-DD] [--out DIR]`

Also the default command when none is given.

- `--start` is required. Each export is an explicit snapshot of a range; the tool does not infer coverage from earlier files, because that would freeze partial days (today's activity, a night whose sleep had not synced yet) into the record. Overlapping ranges across exports are expected and harmless.
- `--end` defaults to yesterday (local date), the last day whose activity total is complete. Pass today explicitly if wanted.
- If start is after end, or either date is malformed, exit 1.
- Fetches four collections for `[start, end]`: `daily_sleep`, `sleep`, `daily_readiness`, `daily_activity`. Each is paginated with `next_token` until exhausted.
- If no day in the range has any data, nothing is written and the exit code is 1 with a message.
- Writes `<start>-to-<end>-oura-trends.csv` to the output directory (created if missing) and prints the path and row count. The file is written to a temp name and renamed into place. An existing file for the identical range is replaced; that is the correction case. Files for other ranges are never touched.

## API client (`src/api.ts`)

- `GET https://api.ouraring.com/v2/usercollection/<collection>?start_date=&end_date=&next_token=` with `Authorization: Bearer`.
- Query params for sleep: the `sleep` collection filters on `day`, same as the daily collections, so one date range serves all four.
- 429: wait `Retry-After` seconds (default 5 if the header is missing) and retry, up to 3 attempts, then fail.
- 401: refresh token once and retry; a second 401 fails with the login message.
- Any other non-2xx: print status and response body, exit 1. Failure never creates or modifies a CSV file; refreshed tokens may have been saved, which is correct since the old refresh token is already consumed.
- `fetch` is injectable for tests.

## Row assembly (`src/csv.ts`)

- Build a map `day -> { dailySleep?, sleep?, readiness?, activity? }` over every day from start to end inclusive.
- Sleep period selection: among `sleep` documents for a day, take those with `type === "long_sleep"`; if several, the one with the largest `total_sleep_duration`. Naps (`sleep`, `late_nap`) and `rest`/`deleted` periods are ignored. If none, all sleep-derived columns are blank.
- A day with no data in any collection is omitted. A day with partial data (for example activity but no sleep) is emitted with blanks in the missing columns.
- Rows sorted by day ascending. (The old export appended out-of-order gap days at the end; sorting is the one deliberate deviation.)
- Null or undefined values become empty cells. Numbers are written with JavaScript's default `String()` formatting. Timestamps are written exactly as the API returns them.
- CSV quoting: a field is quoted only if it contains a comma, a quote, or a newline. Header is written verbatim from the mapping table, which preserves two Oura quirks: `Sleep Timin Score` and the trailing space in `Total Bedtime `.
- Line endings `\n`, UTF-8, no BOM.

## Column mapping (`src/mapping.ts`)

An ordered array of `{ header, source }` where `source` is a function from the day record to a value, or `null` for columns the API cannot supply.

| # | Header | Source |
|---|--------|--------|
| 1 | date | day |
| 2 | Activity Burn | activity.active_calories |
| 3 | Total Sleep Duration | sleep.total_sleep_duration |
| 4 | Average Resting Heart Rate | sleep.average_heart_rate |
| 5 | Restless Sleep | sleep.restless_periods |
| 6 | Previous Night Score | readiness.contributors.previous_night |
| 7 | Sleep Score | dailySleep.score |
| 8 | Bedtime End | sleep.bedtime_end |
| 9 | Sleep Balance Score | readiness.contributors.sleep_balance |
| 10 | Activity Score | activity.score |
| 11 | REM Sleep Duration | sleep.rem_sleep_duration |
| 12 | Low Activity Time | activity.low_activity_time |
| 13 | Previous Day Activity Score | readiness.contributors.previous_day_activity |
| 14 | Steps | activity.steps |
| 15 | High Activity Time | activity.high_activity_time |
| 16 | Long Periods of Inactivity | activity.inactivity_alerts |
| 17 | Temperature Trend Deviation | readiness.temperature_trend_deviation |
| 18 | Total Sleep Score | dailySleep.contributors.total_sleep |
| 19 | Stay Active Score | activity.contributors.stay_active |
| 20 | Readiness Score | readiness.score |
| 21 | Equivalent Walking Distance | activity.equivalent_walking_distance |
| 22 | Sleep Timing | (not available in API; always blank) |
| 23 | Rest Time | activity.resting_time |
| 24 | Inactive Time | activity.sedentary_time |
| 25 | Sleep Timin Score | dailySleep.contributors.timing |
| 26 | Total Bedtime␠ | sleep.time_in_bed |
| 27 | Total Burn | activity.total_calories |
| 28 | Medium Activity Time | activity.medium_activity_time |
| 29 | Restfulness Score | dailySleep.contributors.restfulness |
| 30 | Training Frequency Score | activity.contributors.training_frequency |
| 31 | Deep Sleep Duration | sleep.deep_sleep_duration |
| 32 | Awake Time | sleep.awake_time |
| 33 | Sleep Efficiency Score | dailySleep.contributors.efficiency |
| 34 | Sleep Latency | sleep.latency |
| 35 | Activity Balance Score | readiness.contributors.activity_balance |
| 36 | Non-wear Time | activity.non_wear_time |
| 37 | REM Sleep Score | dailySleep.contributors.rem_sleep |
| 38 | Recovery Index Score | readiness.contributors.recovery_index |
| 39 | Move Every Hour Score | activity.contributors.move_every_hour |
| 40 | Average HRV | sleep.average_hrv |
| 41 | Temperature Deviation (°C) | readiness.temperature_deviation |
| 42 | Temperature Score | readiness.contributors.body_temperature |
| 43 | Lowest Resting Heart Rate | sleep.lowest_heart_rate |
| 44 | Deep Sleep Score | dailySleep.contributors.deep_sleep |
| 45 | Sleep Latency Score | dailySleep.contributors.latency |
| 46 | Bedtime Start | sleep.bedtime_start |
| 47 | Average MET | activity.average_met_minutes |
| 48 | Resting Heart Rate Score | readiness.contributors.resting_heart_rate |
| 49 | Respiratory Rate | sleep.average_breath |
| 50 | Meet Daily Targets Score | activity.contributors.meet_daily_targets |
| 51 | Training Volume Score | activity.contributors.training_volume |
| 52 | Light Sleep Duration | sleep.light_sleep_duration |
| 53 | Sleep Efficiency | sleep.efficiency |
| 54 | HRV Balance Score | readiness.contributors.hrv_balance |

Row 26's header is `Total Bedtime` followed by one space, exactly as Oura wrote it.

Known difference from the old export: the API computes `average_heart_rate` and `lowest_heart_rate` from 30-second samples, while the app shows values from 5-minute aggregates. The two may differ slightly; the README says so without promising a bound. The final verification diffs a fresh export against an old Trends CSV for the same range, which also confirms the `long_sleep` selection rule and the units of `Restless Sleep`.

## Testing

Unit tests, with synthetic fixture documents that follow the schemas in the Oura OpenAPI document (the document has no example responses; no real user data in the repo):

- `mapping`: header list equals the 54 names in order, byte for byte.
- `csv`: a day with all four documents produces the expected row; a day with activity only produces blanks in sleep and readiness columns; a day with no documents is omitted; rows are sorted; `long_sleep` is chosen over a nap, and the longest `long_sleep` over a shorter one; quoting rules.
- `api`: pagination follows `next_token` to the end; 429 honours `Retry-After` then succeeds; 401 triggers one refresh then succeeds; second 401 fails with the login message; non-2xx fails. All via an injected `fetch`.
- `cli` date logic: `--start` required; default end is yesterday; start after end and malformed dates are errors; empty results write nothing.
- `auth`: PKCE challenge derivation against a known vector; refresh without a new refresh token is rejected; token store round-trip, file mode, and atomic replacement.

Manual verification: the browser login once; an `npm pack` install into a temp directory runs `--help`; an export over a range covered by an old Trends CSV is diffed against that file (the old file is local and not committed).

## Repository contents

```
README.md          setup (register app, redirect URI, scopes), install, login, export, column notes
LICENSE            MIT
package.json       bin -> dist/bin/oura-sync.js; scripts: test, typecheck, build, prepare
tsconfig.json      type-check config (src, bin, test; noEmit)
tsconfig.build.json emit config (src, bin -> dist)
bin/oura-sync.ts
src/{cli,auth,api,mapping,csv,config,dates,errors,oura-types}.ts
test/*.test.ts, test/fixtures/*.json
docs/oura-openapi-1.41.json
docs/superpowers/specs/
.gitignore         node_modules, dist, *.csv, .env
```

Nothing under `sample data/` is committed.
