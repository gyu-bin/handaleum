import { monthKeySchema } from '../schema';
import type { MonthKey, PhotoRef } from '../types';

const DAY_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export type PhotoStreakKind = 'live' | 'liveBest' | 'best';

export type PhotoStreak = {
  kind: PhotoStreakKind;
  current: number;
  best: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dayKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function shiftDayKey(day: string, deltaDays: number): string {
  const [year, month, date] = day.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return dayKeyFromDate(new Date(year, month - 1, date + deltaDays));
}

export function dayKeysFromPhotos(photos: PhotoRef[]): string[] {
  const days = new Set<string>();
  for (const photo of photos) {
    const key = dayKeyFromDate(new Date(photo.takenAt));
    if (DAY_KEY.test(key)) {
      days.add(key);
    }
  }
  return [...days].sort();
}

function isDayKey(value: string): boolean {
  return DAY_KEY.test(value);
}

export { isDayKey };

export function parsePhotoStreakDays(raw: string | null): Record<string, string[]> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string[]> = {};
    for (const [month, days] of Object.entries(parsed)) {
      if (!monthKeySchema.safeParse(month).success || !Array.isArray(days)) {
        continue;
      }
      out[month] = days.filter(
        (day): day is string => typeof day === 'string' && isDayKey(day),
      );
    }
    return out;
  } catch {
    return {};
  }
}

export function collectStreakDays(
  stored: Record<string, string[]>,
  viewedMonth: MonthKey,
  liveDays: string[],
  epoch: string,
  today: string,
): string[] {
  const days = new Set<string>();
  for (const [month, list] of Object.entries(stored)) {
    if (month === viewedMonth) {
      continue;
    }
    for (const day of list) {
      days.add(day);
    }
  }
  for (const day of liveDays) {
    days.add(day);
  }
  return [...days].filter((day) => day >= epoch && day <= today).sort();
}

function runEndingAt(days: Set<string>, end: string): number {
  let count = 0;
  let cursor = end;
  while (days.has(cursor)) {
    count += 1;
    cursor = shiftDayKey(cursor, -1);
    if (count > 40000) {
      break;
    }
  }
  return count;
}

function longestRun(sortedDays: string[]): number {
  if (sortedDays.length === 0) {
    return 0;
  }
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i += 1) {
    const prev = sortedDays[i - 1];
    const next = sortedDays[i];
    if (!prev || !next || next === prev) {
      continue;
    }
    if (next === shiftDayKey(prev, 1)) {
      run += 1;
      if (run > best) {
        best = run;
      }
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Current run may end yesterday if today is still empty (the day is not over).
 * A gap of two local days breaks current to 0. Best is the longest run in `days`.
 */
export function computePhotoStreak(
  days: string[],
  today: string,
): { current: number; best: number } {
  const set = new Set(days);
  const yesterday = shiftDayKey(today, -1);
  let current = 0;
  if (set.has(today)) {
    current = runEndingAt(set, today);
  } else if (set.has(yesterday)) {
    current = runEndingAt(set, yesterday);
  }
  const best = Math.max(longestRun(days), current);
  return { current, best };
}

export function photoStreakView(
  current: number,
  best: number,
): PhotoStreak | null {
  if (current >= 2 && current >= best) {
    return { kind: 'live', current, best };
  }
  if (current >= 2 && current < best) {
    return { kind: 'liveBest', current, best };
  }
  if (best >= 2) {
    return { kind: 'best', current, best };
  }
  return null;
}

/** Highest 10-day step reached (0 below 10). */
export function streakMilestone(current: number): number {
  if (current < 10) {
    return 0;
  }
  return Math.floor(current / 10) * 10;
}
export function streakFlamePx(current: number): number {
  const tier = Math.floor(current / 10);
  if (tier < 1) {
    return 0;
  }
  return Math.min(28 + (tier - 1) * 8, 44);
}
