import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNS, HEADERS } from '../src/mapping.ts';

const EXPECTED_HEADERS = [
  'date',
  'Activity Burn',
  'Total Sleep Duration',
  'Average Resting Heart Rate',
  'Restless Sleep',
  'Previous Night Score',
  'Sleep Score',
  'Bedtime End',
  'Sleep Balance Score',
  'Activity Score',
  'REM Sleep Duration',
  'Low Activity Time',
  'Previous Day Activity Score',
  'Steps',
  'High Activity Time',
  'Long Periods of Inactivity',
  'Temperature Trend Deviation',
  'Total Sleep Score',
  'Stay Active Score',
  'Readiness Score',
  'Equivalent Walking Distance',
  'Sleep Timing',
  'Rest Time',
  'Inactive Time',
  'Sleep Timin Score',
  'Total Bedtime ',
  'Total Burn',
  'Medium Activity Time',
  'Restfulness Score',
  'Training Frequency Score',
  'Deep Sleep Duration',
  'Awake Time',
  'Sleep Efficiency Score',
  'Sleep Latency',
  'Activity Balance Score',
  'Non-wear Time',
  'REM Sleep Score',
  'Recovery Index Score',
  'Move Every Hour Score',
  'Average HRV',
  'Temperature Deviation (°C)',
  'Temperature Score',
  'Lowest Resting Heart Rate',
  'Deep Sleep Score',
  'Sleep Latency Score',
  'Bedtime Start',
  'Average MET',
  'Resting Heart Rate Score',
  'Respiratory Rate',
  'Meet Daily Targets Score',
  'Training Volume Score',
  'Light Sleep Duration',
  'Sleep Efficiency',
  'HRV Balance Score',
];

test('HEADERS match the retired Oura export exactly, in order', () => {
  assert.deepEqual([...HEADERS], EXPECTED_HEADERS);
  assert.equal(HEADERS.length, 54);
});

test('every column has a value function', () => {
  for (const c of COLUMNS) assert.equal(typeof c.value, 'function', c.header);
});

test('Sleep Timing is always blank (not exposed by the API)', () => {
  const col = COLUMNS.find((c) => c.header === 'Sleep Timing')!;
  assert.equal(col.value({ day: '2025-01-02' }), null);
});

test('columns read undefined when the source document is missing', () => {
  for (const c of COLUMNS) {
    if (c.header === 'date') continue;
    const v = c.value({ day: '2025-01-02' });
    assert.ok(v === undefined || v === null, `${c.header} returned ${String(v)}`);
  }
});
