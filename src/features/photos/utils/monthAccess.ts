import type { MonthKey } from '../types';
import { monthKeySchema } from '../schema';
import { currentMonthKey } from './month';

/** Free tier: current month + previous (N-1) months = N months total. */
export const FREE_MONTH_WINDOW = 3;

/** Oldest YYYY-MM included in the free window (inclusive). */
export function oldestFreeMonthKey(now = new Date()): MonthKey {
  const d = new Date(now.getFullYear(), now.getMonth() - (FREE_MONTH_WINDOW - 1), 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return monthKeySchema.parse(key);
}

/**
 * Pro: every month. Free: only the last FREE_MONTH_WINDOW calendar months
 * (e.g. in July → May, June, July).
 */
export function canAccessMonth(
  month: MonthKey,
  isPro: boolean,
  now = new Date(),
): boolean {
  if (isPro) {
    return true;
  }
  return month >= oldestFreeMonthKey(now);
}

/** If the stored month is outside the free window, fall back to this month. */
export function clampMonthToAccess(
  month: MonthKey,
  isPro: boolean,
  now = new Date(),
): MonthKey {
  if (canAccessMonth(month, isPro, now)) {
    return month;
  }
  return currentMonthKey(now);
}
