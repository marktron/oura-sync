import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, AuthRequiredError, NoDataError, UsageError } from '../src/errors.ts';

test('ApiError carries status and body in its message', () => {
  const err = new ApiError(503, 'upstream down');
  assert.equal(err.status, 503);
  assert.equal(err.body, 'upstream down');
  assert.match(err.message, /503/);
  assert.match(err.message, /upstream down/);
  assert.equal(err.name, 'ApiError');
});

test('AuthRequiredError default message tells the user to log in', () => {
  assert.match(new AuthRequiredError().message, /oura-sync login/);
});

test('UsageError and NoDataError are Errors', () => {
  assert.ok(new UsageError('bad') instanceof Error);
  assert.ok(new NoDataError('empty') instanceof Error);
});
