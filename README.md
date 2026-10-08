# oura-sync

Export your Oura daily trends to CSV, in the same layout as the web export
Oura retired. One row per day, 54 columns, identical headers, so
spreadsheets and scripts built on the old export keep working.

Requires Node 24 or newer. No runtime dependencies.

## One-time setup

Oura no longer issues personal access tokens, so you register your own
API application and the tool logs in through it.

1. Go to <https://cloud.ouraring.com/oauth/applications> and create an application.
2. Set the redirect URI to `http://localhost:8477/callback`.
3. Note the client ID and client secret.
4. Install and log in:

   ```sh
   npm install -g github:<owner>/oura-sync
   oura-sync login
   ```

   Or from a checkout: `npm install && npm link`.

   `login` asks for the client ID and secret the first time, then opens
   your browser to approve access. Credentials and tokens are stored in
   `~/.config/oura-sync/` (or `$XDG_CONFIG_HOME/oura-sync/`) with mode 0600.

If an export ever says "Run `oura-sync login`", the stored token could not
be refreshed (revoked, expired, or lost). Log in again; your configuration
is kept.

## Configuration

`login` writes `config.json` in the config directory with these keys:

| Key | Meaning |
|---|---|
| `clientId`, `clientSecret` | Credentials of your Oura API application |
| `redirectPort` | Local port for the login callback (default 8477) |
| `outDir` | Optional default output directory |

If port 8477 is taken, edit `redirectPort` in `config.json` and register the
matching redirect URI (`http://localhost:<port>/callback`) with Oura. Deleting
`config.json` resets the credentials; `login` will ask for them again.

`login` requests the `daily` and `heartrate` scopes.

## Exporting

`export` is the default command, so `oura-sync --start ...` works too.

```sh
oura-sync export --start 2026-01-01 --end 2026-01-31 --out ~/oura-exports
```

Writes `~/oura-exports/2026-01-01-to-2026-01-31-oura-trends.csv`.

- `--start` is required. Each run is a snapshot of exactly the range you ask
  for; the tool never infers what to fetch from earlier files. Overlapping
  exports are fine.
- `--end` defaults to yesterday, the last day whose activity totals are
  complete. Pass today explicitly if you want it.
- The output directory is, in order: `--out`, the `OURA_SYNC_OUT` environment
  variable, `outDir` in `config.json`, or the current directory. It is created
  if missing.
- A file for the identical range is replaced. Other files are never touched.
- If the range has no data at all, nothing is written and the exit code is 1.

Sleep data reaches Oura's servers when the app syncs. If a recent night is
missing, open the Oura app, let it sync, and export that range again.

## Columns

All 54 headers of the old export are reproduced exactly, including Oura's
own quirks ("Sleep Timin Score", trailing space in "Total Bedtime ").
Sources:

| Group | Columns | API collection |
|---|---|---|
| Sleep durations, HR, HRV, breathing, bedtimes | Total Sleep Duration, Average Resting Heart Rate, Lowest Resting Heart Rate, Average HRV, Respiratory Rate, Bedtime Start/End, Total Bedtime, Awake Time, Sleep Latency, REM/Deep/Light Sleep Duration, Sleep Efficiency, Restless Sleep | `sleep` (the day's `long_sleep` period; naps are ignored) |
| Sleep scores | Sleep Score, Total Sleep Score, REM/Deep Sleep Score, Sleep Efficiency Score, Sleep Latency Score, Sleep Timin Score, Restfulness Score | `daily_sleep` |
| Readiness | Readiness Score, Temperature Deviation, Temperature Trend Deviation, Temperature Score, Previous Night Score, Sleep Balance Score, Previous Day Activity Score, Activity Balance Score, Resting Heart Rate Score, HRV Balance Score, Recovery Index Score | `daily_readiness` |
| Activity | Activity Burn, Total Burn, Steps, Equivalent Walking Distance, Low/Medium/High Activity Time, Rest Time, Inactive Time, Non-wear Time, Long Periods of Inactivity, Average MET, Activity Score, Stay Active Score, Move Every Hour Score, Meet Daily Targets Score, Training Frequency Score, Training Volume Score | `daily_activity` |

Known differences from the old export:

- **Sleep Timing** is always blank. The API does not expose the raw value.
- **Average Resting Heart Rate** and **Lowest Resting Heart Rate** come from
  the API's 30-second samples; the app shows 5-minute aggregates. The two
  may differ slightly.
- Rows are sorted by date. The old export sometimes appended out-of-order
  days at the end.
- Lines end in CRLF, like the original.
- Days with no data at all are omitted. Days with partial data (for example
  activity but no sleep) keep their row with blanks.

## Troubleshooting

Errors print a single line. Set `OURA_SYNC_DEBUG=1` to get a stack trace.

## Development

```sh
npm test            # node --test, runs the TypeScript directly
npm run typecheck   # tsc --noEmit
npm run build       # emits dist/ (also runs on install via prepare)
```

Tests use synthetic fixtures; no real Oura data is in the repository.

## License

MIT
