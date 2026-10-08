import { UsageError } from './errors.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function exportFileName(start: string, end: string): string {
  return `${start}-to-${end}-oura-trends.csv`;
}

export interface RangeOptions {
  start?: string;
  end?: string;
  /** Used when `end` is absent. The CLI passes yesterday. */
  defaultEnd: string;
}

export function resolveRange(opts: RangeOptions): { start: string; end: string } {
  const { start } = opts;
  if (start === undefined) throw new UsageError('--start YYYY-MM-DD is required.');
  if (!isIsoDate(start)) throw new UsageError(`--start must be YYYY-MM-DD, got "${start}"`);
  const end = opts.end ?? opts.defaultEnd;
  if (!isIsoDate(end)) throw new UsageError(`--end must be YYYY-MM-DD, got "${end}"`);
  if (start > end) throw new UsageError(`--start ${start} is after --end ${end}`);
  return { start, end };
}
