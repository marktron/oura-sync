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
  '300', // Activity Burn
  '26400', // Total Sleep Duration
  '55.5', // Average Resting Heart Rate
  '150', // Restless Sleep
  '88', // Previous Night Score
  '80', // Sleep Score
  '2025-01-02T08:30:00-05:00', // Bedtime End
  '66', // Sleep Balance Score
  '70', // Activity Score
  '6000', // REM Sleep Duration
  '3000', // Low Activity Time
  '70', // Previous Day Activity Score
  '6000', // Steps
  '0', // High Activity Time
  '2', // Long Periods of Inactivity
  '-0.2', // Temperature Trend Deviation
  '88', // Total Sleep Score
  '60', // Stay Active Score
  '75', // Readiness Score
  '4500', // Equivalent Walking Distance
  '', // Sleep Timing
  '36000', // Rest Time
  '40000', // Inactive Time
  '85', // Sleep Timin Score
  '32400', // Total Bedtime
  '2500', // Total Burn
  '1800', // Medium Activity Time
  '65', // Restfulness Score
  '96', // Training Frequency Score
  '5400', // Deep Sleep Duration
  '3000', // Awake Time
  '75', // Sleep Efficiency Score
  '600', // Sleep Latency
  '80', // Activity Balance Score
  '0', // Non-wear Time
  '70', // REM Sleep Score
  '60', // Recovery Index Score
  '80', // Move Every Hour Score
  '60', // Average HRV
  '0.15', // Temperature Deviation (°C)
  '90', // Temperature Score
  '48', // Lowest Resting Heart Rate
  '90', // Deep Sleep Score
  '95', // Sleep Latency Score
  '2025-01-01T23:30:00-05:00', // Bedtime Start
  '1.25', // Average MET
  '95', // Resting Heart Rate Score
  '14.5', // Respiratory Rate
  '25', // Meet Daily Targets Score
  '90', // Training Volume Score
  '15000', // Light Sleep Duration
  '85', // Sleep Efficiency
  '85', // HRV Balance Score
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
  const lines = csv.split('\n');
  assert.equal(lines[0], HEADERS.join(','));
  assert.deepEqual(lines[1]!.split(','), FULL_ROW);
  assert.equal(lines[2], '');
  assert.equal(lines.length, 3);
  assert.ok(csv.endsWith('\n'));
  assert.ok(!csv.includes('\r'));
});

test('toCsv blanks sleep and readiness columns on an activity-only day', () => {
  const csv = toCsv(
    assembleDays({ dailySleep: [], sleep: [], readiness: [], activity: [ACTIVITY_NEXT_DAY] }, RANGE),
  );
  const cells = csv.split('\n')[1]!.split(',');
  assert.equal(cells.length, 54);
  assert.equal(cells[0], '2025-01-03');
  assert.equal(cells[HEADERS.indexOf('Steps')], '100');
  assert.equal(cells[HEADERS.indexOf('Total Sleep Duration')], '');
  assert.equal(cells[HEADERS.indexOf('Readiness Score')], '');
});
