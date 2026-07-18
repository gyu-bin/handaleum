import type { MonthKey } from '../types';
import { monthKeySchema } from '../schema';

export function currentMonthKey(now = new Date()): MonthKey {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthKeySchema.parse(key);
}

export function monthKeyFromTimestamp(ms: number): MonthKey {
  const d = new Date(ms);
  return currentMonthKey(d);
}

/** Inclusive start / exclusive end of a YYYY-MM month in local time. */
export function monthBounds(month: MonthKey): { startMs: number; endMs: number } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function monthTimeBoundsIso(month: MonthKey): { from: string; to: string } {
  const { startMs, endMs } = monthBounds(month);
  return {
    from: new Date(startMs).toISOString(),
    to: new Date(endMs - 1).toISOString(),
  };
}
