import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleDays, formatCell, selectSleepPeriod, toCsv } from '../src/csv.ts';
import { HEADERS } from '../src/mapping.ts';
import {
  ACTIVITY,
  ACTIVITY_NEXT_DAY,
  DAILY_SLEEP,
  DAY,
  LONG_SLEEP,
  NAP,
  READINESS,
  SHORT_LONG_SLEEP,
} from './fixtures.ts';

const RANGE = { start: '2025-01-01', end: '2025-01-03' };

const FULL_ROW = [
  '2025-01-02', // date
  '310', // Activity Burn
  '26420', // Total Sleep Duration
  '55.5', // Average Resting Heart Rate
  '150', // Restless Sleep
  '83', // Previous Night Score
  '81', // Sleep Score
  '2025-01-02T08:30:00-05:00', // Bedtime End
  '68', // Sleep Balance Score
  '73', // Activity Score
  '6020', // REM Sleep Duration
  '3010', // Low Activity Time
  '72', // Previous Day Activity Score
  '6010', // Steps
  '420', // High Activity Time
  '3', // Long Periods of Inactivity
  '-0.2', // Temperature Trend Deviation
  '89', // Total Sleep Score
  '63', // Stay Active Score
  '77', // Readiness Score
  '4510', // Equivalent Walking Distance
  '', // Sleep Timing
  '36010', // Rest Time
  '40010', // Inactive Time
  '86', // Sleep Timin Score
  '32420', // Total Bedtime
  '2510', // Total Burn
  '1810', // Medium Activity Time
  '66', // Restfulness Score
  '98', // Training Frequency Score
  '5410', // Deep Sleep Duration
  '3020', // Awake Time
  '76', // Sleep Efficiency Score
  '610', // Sleep Latency
  '82', // Activity Balance Score
  '0', // Non-wear Time
  '71', // REM Sleep Score
  '62', // Recovery Index Score
  '78', // Move Every Hour Score
  '61', // Average HRV
  '0.15', // Temperature Deviation (°C)
  '92', // Temperature Score
  '48', // Lowest Resting Heart Rate
  '91', // Deep Sleep Score
  '96', // Sleep Latency Score
  '2025-01-01T23:30:00-05:00', // Bedtime Start
  '1.25', // Average MET
  '97', // Resting Heart Rate Score
  '14.5', // Respiratory Rate
  '27', // Meet Daily Targets Score
  '93', // Training Volume Score
  '15020', // Light Sleep Duration
  '84', // Sleep Efficiency
  '87', // HRV Balance Score
];

test('selectSleepPeriod prefers long_sleep over a nap', () => {
  assert.equal(selectSleepPeriod([NAP, LONG_SLEEP])?.id, LONG_SLEEP.id);
});

test('selectSleepPeriod picks the longest long_sleep', () => {
  assert.equal(selectSleepPeriod([SHORT_LONG_SLEEP, LONG_SLEEP])?.id, LONG_SLEEP.id);
  assert.equal(selectSleepPeriod([LONG_SLEEP, SHORT_LONG_SLEEP])?.id, LONG_SLEEP.id);
});

test('selectSleepPeriod returns undefined when there is only a nap', () => {
  assert.equal(selectSleepPeriod([NAP]), undefined);
  assert.equal(selectSleepPeriod([]), undefined);
});

test('assembleDays joins all four collections by day', () => {
  const days = assembleDays(
    { dailySleep: [DAILY_SLEEP], sleep: [LONG_SLEEP], readiness: [READINESS], activity: [ACTIVITY] },
    RANGE,
  );
  assert.equal(days.length, 1);
  assert.deepEqual(days[0], {
    day: DAY,
    dailySleep: DAILY_SLEEP,
    sleep: LONG_SLEEP,
    readiness: READINESS,
    activity: ACTIVITY,
  });
});

test('assembleDays keeps a day with activity but no sleep', () => {
  const days = assembleDays(
    { dailySleep: [], sleep: [], readiness: [], activity: [ACTIVITY_NEXT_DAY] },
    RANGE,
  );
  assert.deepEqual(days, [{ day: '2025-01-03', activity: ACTIVITY_NEXT_DAY }]);
});

test('assembleDays omits a day that only has a nap', () => {
  const days = assembleDays({ dailySleep: [], sleep: [NAP], readiness: [], activity: [] }, RANGE);
  assert.deepEqual(days, []);
});

test('assembleDays sorts rows by day ascending', () => {
  const days = assembleDays(
    { dailySleep: [], sleep: [], readiness: [], activity: [ACTIVITY_NEXT_DAY, ACTIVITY] },
    RANGE,
  );
  assert.deepEqual(
    days.map((d) => d.day),
    ['2025-01-02', '2025-01-03'],
  );
});

test('assembleDays drops documents whose day is outside the range', () => {
  const before = { ...LONG_SLEEP, id: 'sleep-before', day: '2024-12-31' };
  const days = assembleDays(
    { dailySleep: [], sleep: [before, LONG_SLEEP], readiness: [], activity: [] },
    RANGE,
  );
  assert.deepEqual(
    days.map((d) => d.day),
    ['2025-01-02'],
  );
});

test('formatCell prints zero as "0" and null/undefined as blank', () => {
  assert.equal(formatCell(0), '0');
  assert.equal(formatCell(null), '');
  assert.equal(formatCell(undefined), '');
  assert.equal(formatCell(-0.2), '-0.2');
  assert.equal(formatCell('plain'), 'plain');
});

test('formatCell quotes fields containing commas, quotes, or newlines', () => {
  assert.equal(formatCell('a,b'), '"a,b"');
  assert.equal(formatCell('say "hi"'), '"say ""hi"""');
  assert.equal(formatCell('line\nbreak'), '"line\nbreak"');
});

test('toCsv writes the exact header line and a full row', () => {
  const csv = toCsv(
    assembleDays(
      { dailySleep: [DAILY_SLEEP], sleep: [LONG_SLEEP], readiness: [READINESS], activity: [ACTIVITY] },
      RANGE,
    ),
  );
  const lines = csv.split('\r\n');
  assert.equal(lines[0], HEADERS.join(','));
  assert.deepEqual(lines[1]!.split(','), FULL_ROW);
  assert.equal(lines[2], '');
  assert.equal(lines.length, 3);
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(!csv.replaceAll('\r\n', '').includes('\n'), 'no bare LF');
  assert.ok(!csv.replaceAll('\r\n', '').includes('\r'), 'no bare CR');
});

test('toCsv blanks sleep and readiness columns on an activity-only day', () => {
  const csv = toCsv(
    assembleDays({ dailySleep: [], sleep: [], readiness: [], activity: [ACTIVITY_NEXT_DAY] }, RANGE),
  );
  const cells = csv.split('\r\n')[1]!.split(',');
  assert.equal(cells.length, 54);
  assert.equal(cells[0], '2025-01-03');
  assert.equal(cells[HEADERS.indexOf('Steps')], '100');
  assert.equal(cells[HEADERS.indexOf('Total Sleep Duration')], '');
  assert.equal(cells[HEADERS.indexOf('Readiness Score')], '');
});
