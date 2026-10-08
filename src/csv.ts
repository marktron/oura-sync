import { COLUMNS, type CellValue, type Column, type DayRecord } from './mapping.ts';
import type { DailyActivity, DailyReadiness, DailySleep, SleepPeriod } from './oura-types.ts';

export interface Collections {
  dailySleep: readonly DailySleep[];
  sleep: readonly SleepPeriod[];
  readiness: readonly DailyReadiness[];
  activity: readonly DailyActivity[];
}

export interface DateRange {
  start: string;
  end: string;
}

/** The night's main sleep: the long_sleep period, longest if several. Naps are ignored. */
export function selectSleepPeriod(periods: readonly SleepPeriod[]): SleepPeriod | undefined {
  let best: SleepPeriod | undefined;
  for (const p of periods) {
    if (p.type !== 'long_sleep') continue;
    if (!best || (p.total_sleep_duration ?? 0) > (best.total_sleep_duration ?? 0)) best = p;
  }
  return best;
}

/** Join the four collections by day. Days with no documents are omitted; rows are sorted ascending. */
export function assembleDays(c: Collections, range: DateRange): DayRecord[] {
  const inRange = (day: string) => day >= range.start && day <= range.end;
  const byDay = new Map<string, DayRecord>();
  const record = (day: string): DayRecord => {
    let r = byDay.get(day);
    if (!r) {
      r = { day };
      byDay.set(day, r);
    }
    return r;
  };

  for (const d of c.dailySleep) if (inRange(d.day)) record(d.day).dailySleep = d;
  for (const d of c.readiness) if (inRange(d.day)) record(d.day).readiness = d;
  for (const d of c.activity) if (inRange(d.day)) record(d.day).activity = d;

  const sleepByDay = new Map<string, SleepPeriod[]>();
  for (const p of c.sleep) {
    if (!inRange(p.day)) continue;
    const list = sleepByDay.get(p.day) ?? [];
    list.push(p);
    sleepByDay.set(p.day, list);
  }
  for (const [day, periods] of sleepByDay) {
    const chosen = selectSleepPeriod(periods);
    if (chosen) record(day).sleep = chosen;
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function formatCell(v: CellValue): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(records: readonly DayRecord[], columns: readonly Column[] = COLUMNS): string {
  const lines = [columns.map((c) => formatCell(c.header)).join(',')];
  for (const r of records) lines.push(columns.map((c) => formatCell(c.value(r))).join(','));
  return lines.join('\n') + '\n';
}
