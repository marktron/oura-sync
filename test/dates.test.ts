import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UsageError } from '../src/errors.ts';
import { exportFileName, isIsoDate, previousDay, resolveRange, todayLocal } from '../src/dates.ts';

test('isIsoDate accepts YYYY-MM-DD and rejects everything else', () => {
  assert.equal(isIsoDate('2026-09-01'), true);
  assert.equal(isIsoDate('2026-9-1'), false);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-13-01'), false);
  assert.equal(isIsoDate('20260901'), false);
  assert.equal(isIsoDate('2026-09-01T00:00:00Z'), false);
});

test('todayLocal formats the local calendar date', () => {
  assert.equal(todayLocal(new Date(2026, 9, 7, 23, 59)), '2026-10-07');
  assert.equal(todayLocal(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
});

test('previousDay crosses month and year boundaries', () => {
  assert.equal(previousDay('2026-09-11'), '2026-09-10');
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousDay('2028-03-01'), '2028-02-29');
  assert.equal(previousDay('2027-01-01'), '2026-12-31');
});

test('exportFileName encodes both dates', () => {
  assert.equal(exportFileName('2026-09-11', '2026-10-06'), '2026-09-11-to-2026-10-06-oura-trends.csv');
});

test('resolveRange defaults end to defaultEnd', () => {
  assert.deepEqual(
    resolveRange({ start: '2026-09-11', defaultEnd: '2026-10-06' }),
    { start: '2026-09-11', end: '2026-10-06' },
  );
});

test('resolveRange uses explicit dates when given', () => {
  assert.deepEqual(
    resolveRange({ start: '2026-01-01', end: '2026-01-31', defaultEnd: '2026-10-06' }),
    { start: '2026-01-01', end: '2026-01-31' },
  );
});

test('resolveRange allows a single-day range', () => {
  assert.deepEqual(
    resolveRange({ start: '2026-01-01', end: '2026-01-01', defaultEnd: '2026-10-06' }),
    { start: '2026-01-01', end: '2026-01-01' },
  );
});

test('resolveRange requires --start', () => {
  assert.throws(() => resolveRange({ defaultEnd: '2026-10-06' }), UsageError);
  assert.throws(() => resolveRange({ defaultEnd: '2026-10-06' }), /--start/);
});

test('resolveRange rejects malformed dates', () => {
  assert.throws(() => resolveRange({ start: '2026-9-1', defaultEnd: '2026-10-06' }), UsageError);
  assert.throws(() => resolveRange({ start: '2026-09-01', end: 'yesterday', defaultEnd: '2026-10-06' }), UsageError);
});

test('resolveRange rejects start after end', () => {
  assert.throws(() => resolveRange({ start: '2026-10-07', defaultEnd: '2026-10-06' }), /after/);
});
