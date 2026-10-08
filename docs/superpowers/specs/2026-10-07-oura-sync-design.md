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

- TypeScript, run directly on Node 24 (type stripping, built-in `fetch`). No runtime dependencies.
- devDependencies: `typescript` (for `tsc --noEmit`), `@types/node`.
- Tests: `node --test` over `test/*.test.ts`.
- `package.json` `bin` entry `oura-sync` pointing at `src/cli.ts`, so `npm install -g .` or `npx` works.

## Authentication

Oura deprecated personal access tokens in December 2025. The only path is OAuth2. The user registers their own API application once at <https://cloud.ouraring.com/oauth/applications> with redirect URI `http://localhost:8477/callback` (port configurable) and gives the tool the client id and client secret.

Flow (`oura-sync login`):

1. If no config exists, prompt for client id and client secret and save them.
2. Generate a PKCE `code_verifier` and `code_challenge` (S256) and a random `state`.
3. Start a one-shot HTTP server on the configured port.
4. Open the browser to `https://cloud.ouraring.com/oauth/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `scope=daily heartrate`, `state`, `code_challenge`, `code_challenge_method=S256`. Print the URL as well in case the browser does not open.
5. On callback, verify `state`, exchange `code` at `https://api.ouraring.com/oauth/token` with `grant_type=authorization_code`, `code_verifier`, `client_id`, `client_secret`, `redirect_uri`.
6. Save `access_token`, `refresh_token`, and `expires_at` (now + `expires_in`). Respond to the browser with a plain "You can close this tab" page and shut the server down.

Token refresh: before any API call, if `expires_at` is within 60 seconds, POST `grant_type=refresh_token`. On a 401 from the API, refresh once and retry. If refresh fails (Oura expires refresh tokens after 30 days of non-use), print `Run oura-sync login` and exit 1.

## Configuration

Directory: `$XDG_CONFIG_HOME/oura-sync` or `~/.config/oura-sync`.

- `config.json`: `{ clientId, clientSecret, redirectPort, outDir }`. `redirectPort` defaults to 8477. `outDir` is optional.
- `tokens.json`: `{ accessToken, refreshToken, expiresAt }`. Written with mode 0600.

Output directory resolution order: `--out` flag, `OURA_SYNC_OUT` environment variable, `outDir` in config, current working directory.

## Commands

### `oura-sync login`

As above. Idempotent; re-running replaces tokens.

### `oura-sync export [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--out DIR]`

Also the default command when none is given.

- `--end` defaults to today (local date). The old export included the export day, so this keeps the convention. The current day's activity figures are necessarily partial.
- `--start` defaults to the day after the latest date found in filenames matching `YYYY-MM-DD-oura-trends.csv` in the output directory. If none exist and `--start` is absent, exit 1 with a message asking for `--start`.
- If start is after end, exit 1.
- Fetches four collections for `[start, end]`: `daily_sleep`, `sleep`, `daily_readiness`, `daily_activity`. Each is paginated with `next_token` until exhausted.
- Writes `<end>-oura-trends.csv` to the output directory and prints the path and row count. If the file already exists, overwrite it (the run is deterministic for the same range, and re-exporting the same day is the common correction case).

## API client (`src/api.ts`)

- `GET https://api.ouraring.com/v2/usercollection/<collection>?start_date=&end_date=&next_token=` with `Authorization: Bearer`.
- Query params for sleep: the `sleep` collection filters on `day`, same as the daily collections, so one date range serves all four.
- 429: wait `Retry-After` seconds (default 5 if the header is missing) and retry, up to 3 attempts, then fail.
- 401: refresh token once and retry; a second 401 fails with the login message.
- Any other non-2xx: print status and response body, exit 1. Nothing is written to disk on failure.
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

Known difference from the old export: the API computes `average_heart_rate` and `lowest_heart_rate` from 30-second samples, while the app shows values from 5-minute aggregates. Sub-bpm differences against an old export are expected and documented in the README.

## Testing

Unit tests, with synthetic fixture documents that follow the schemas in the Oura OpenAPI document (the document has no example responses; no real user data in the repo):

- `mapping`: header list equals the 54 names in order, byte for byte.
- `csv`: a day with all four documents produces the expected row; a day with activity only produces blanks in sleep and readiness columns; a day with no documents is omitted; rows are sorted; `long_sleep` is chosen over a nap, and the longest `long_sleep` over a shorter one; quoting rules.
- `api`: pagination follows `next_token` to the end; 429 honours `Retry-After` then succeeds; 401 triggers one refresh then succeeds; second 401 fails with the login message; non-2xx fails. All via an injected `fetch`.
- `cli` date logic: default start derived from existing filenames; missing files without `--start` is an error; start after end is an error.
- `auth`: PKCE challenge derivation against a known vector; token store round-trip and file mode.

The browser login flow is verified manually once.

## Repository contents

```
README.md          setup (register app, redirect URI, scopes), install, login, export, column notes
LICENSE            MIT
package.json       bin, scripts: test, typecheck
tsconfig.json
src/{cli,auth,api,mapping,csv,config}.ts
test/*.test.ts, test/fixtures/*.json
docs/oura-openapi-1.41.json
docs/superpowers/specs/
.gitignore         node_modules, *.csv, .env
```

Nothing under `sample data/` is committed.
