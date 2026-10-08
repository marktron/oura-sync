# Column reference

Every column in the export, in file order, with the Oura API v2 field it comes from and its unit. The header strings are reproduced exactly as the retired web export wrote them, including Oura's typo in `Sleep Timin Score` and the trailing space in `Total Bedtime `.

Collections: `sleep` is the night's main sleep period (the `long_sleep` document for that day, longest if there are several; naps are ignored). `daily_sleep`, `daily_readiness`, and `daily_activity` are the per-day summaries. A day with no documents at all is omitted; a day with some documents keeps its row with blanks in the rest.

Scores and "contributor" scores are integers from 1 to 100. Durations are seconds. Times are ISO 8601 with the ring's local offset, for example `2026-01-02T08:30:00.000-05:00`.

| # | Header | Source | Unit / notes |
|---|--------|--------|--------------|
| 1 | `date` | `day` | The day the row belongs to. A night's sleep is filed under the morning it ends. |
| 2 | `Activity Burn` | `daily_activity.active_calories` | kcal |
| 3 | `Total Sleep Duration` | `sleep.total_sleep_duration` | seconds |
| 4 | `Average Resting Heart Rate` | `sleep.average_heart_rate` | bpm, average over the main sleep period. See "Heart rate" below. |
| 5 | `Restless Sleep` | `sleep.restless_periods` | count of restless periods |
| 6 | `Previous Night Score` | `daily_readiness.contributors.previous_night` | 1 to 100 |
| 7 | `Sleep Score` | `daily_sleep.score` | 1 to 100 |
| 8 | `Bedtime End` | `sleep.bedtime_end` | timestamp |
| 9 | `Sleep Balance Score` | `daily_readiness.contributors.sleep_balance` | 1 to 100 |
| 10 | `Activity Score` | `daily_activity.score` | 1 to 100 |
| 11 | `REM Sleep Duration` | `sleep.rem_sleep_duration` | seconds |
| 12 | `Low Activity Time` | `daily_activity.low_activity_time` | seconds |
| 13 | `Previous Day Activity Score` | `daily_readiness.contributors.previous_day_activity` | 1 to 100 |
| 14 | `Steps` | `daily_activity.steps` | count |
| 15 | `High Activity Time` | `daily_activity.high_activity_time` | seconds |
| 16 | `Long Periods of Inactivity` | `daily_activity.inactivity_alerts` | count of inactivity alerts |
| 17 | `Temperature Trend Deviation` | `daily_readiness.temperature_trend_deviation` | °C |
| 18 | `Total Sleep Score` | `daily_sleep.contributors.total_sleep` | 1 to 100 |
| 19 | `Stay Active Score` | `daily_activity.contributors.stay_active` | 1 to 100 |
| 20 | `Readiness Score` | `daily_readiness.score` | 1 to 100 |
| 21 | `Equivalent Walking Distance` | `daily_activity.equivalent_walking_distance` | metres |
| 22 | `Sleep Timing` | none | Always blank. The API does not expose this raw value, only its contributor score (column 25). |
| 23 | `Rest Time` | `daily_activity.resting_time` | seconds |
| 24 | `Inactive Time` | `daily_activity.sedentary_time` | seconds |
| 25 | `Sleep Timin Score` | `daily_sleep.contributors.timing` | 1 to 100 |
| 26 | `Total Bedtime ` | `sleep.time_in_bed` | seconds, bedtime start to bedtime end |
| 27 | `Total Burn` | `daily_activity.total_calories` | kcal, including resting metabolism |
| 28 | `Medium Activity Time` | `daily_activity.medium_activity_time` | seconds |
| 29 | `Restfulness Score` | `daily_sleep.contributors.restfulness` | 1 to 100 |
| 30 | `Training Frequency Score` | `daily_activity.contributors.training_frequency` | 1 to 100 |
| 31 | `Deep Sleep Duration` | `sleep.deep_sleep_duration` | seconds |
| 32 | `Awake Time` | `sleep.awake_time` | seconds awake while in bed |
| 33 | `Sleep Efficiency Score` | `daily_sleep.contributors.efficiency` | 1 to 100 |
| 34 | `Sleep Latency` | `sleep.latency` | seconds to fall asleep |
| 35 | `Activity Balance Score` | `daily_readiness.contributors.activity_balance` | 1 to 100 |
| 36 | `Non-wear Time` | `daily_activity.non_wear_time` | seconds |
| 37 | `REM Sleep Score` | `daily_sleep.contributors.rem_sleep` | 1 to 100 |
| 38 | `Recovery Index Score` | `daily_readiness.contributors.recovery_index` | 1 to 100 |
| 39 | `Move Every Hour Score` | `daily_activity.contributors.move_every_hour` | 1 to 100 |
| 40 | `Average HRV` | `sleep.average_hrv` | ms (rMSSD), average over the main sleep period |
| 41 | `Temperature Deviation (°C)` | `daily_readiness.temperature_deviation` | °C from the user's baseline |
| 42 | `Temperature Score` | `daily_readiness.contributors.body_temperature` | 1 to 100 |
| 43 | `Lowest Resting Heart Rate` | `sleep.lowest_heart_rate` | bpm. See "Heart rate" below. |
| 44 | `Deep Sleep Score` | `daily_sleep.contributors.deep_sleep` | 1 to 100 |
| 45 | `Sleep Latency Score` | `daily_sleep.contributors.latency` | 1 to 100 |
| 46 | `Bedtime Start` | `sleep.bedtime_start` | timestamp |
| 47 | `Average MET` | `daily_activity.average_met_minutes` | average metabolic equivalent over the day (1.0 is resting) |
| 48 | `Resting Heart Rate Score` | `daily_readiness.contributors.resting_heart_rate` | 1 to 100 |
| 49 | `Respiratory Rate` | `sleep.average_breath` | breaths per minute |
| 50 | `Meet Daily Targets Score` | `daily_activity.contributors.meet_daily_targets` | 1 to 100 |
| 51 | `Training Volume Score` | `daily_activity.contributors.training_volume` | 1 to 100 |
| 52 | `Light Sleep Duration` | `sleep.light_sleep_duration` | seconds |
| 53 | `Sleep Efficiency` | `sleep.efficiency` | percent, 1 to 100 |
| 54 | `HRV Balance Score` | `daily_readiness.contributors.hrv_balance` | 1 to 100 |

## Heart rate

The API computes `average_heart_rate` and `lowest_heart_rate` from 30-second samples. The Oura app, and the retired export, used 5-minute aggregates. In a 63-day comparison against a real export from the old web tool, the average differed on most nights by at most 0.06 bpm and the lowest heart rate never differed. Treat the two sources as interchangeable for trend work.

## Verified against the old export

An export of the same 63-day range was compared cell by cell with a file downloaded from the retired web tool. Identical: the header line, CRLF line endings, every timestamp including milliseconds, every duration, every score and contributor score, restless sleep, HRV, lowest heart rate, steps, and the set of days (including days with activity but no sleep). Differences:

- `Sleep Timing` is blank in this tool's output.
- `Average Resting Heart Rate` differs by hundredths of a bpm, as above.
- Whole-number floats print without a decimal point: `68` where the old file had `68.0`. The values are equal.
- The old file's final row covered a partial day because it was exported mid-morning. This tool defaults `--end` to yesterday so every activity row is complete; pass today's date explicitly to reproduce a partial final day.
- Rows are sorted by date. The old export sometimes appended out-of-order days at the end.

## Things to know when analysing

- **Sleep is dated by the morning.** The night of 1 to 2 January is row `2025-01-02`. Readiness for that day is computed from that night.
- **A missing night keeps its row.** If the ring was off or the app had not synced, the sleep and readiness columns are blank and the activity columns are present. Re-exporting the range after the app syncs fills them in.
- **Activity for the current day is partial** until midnight. That is why the default end date is yesterday.
- **Naps are excluded** from the sleep columns. Only the main `long_sleep` period counts, which matches what the old export did.
- **Temperature columns are deviations**, not readings. Oura never exposes absolute skin temperature.
- **Durations are seconds**, so divide by 3600 for hours. `Total Bedtime ` equals `Total Sleep Duration` plus `Awake Time` exactly, and `Sleep Latency` is part of `Awake Time`.
