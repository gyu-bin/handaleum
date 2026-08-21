import {
  getPhotoStreakDaysRaw,
  getPhotoStreakEpoch,
  getPhotoStreakMilestoneSent,
  setPhotoStreakDaysRaw,
  setPhotoStreakEpoch,
  setPhotoStreakMilestoneSent,
} from '@/lib/storage';

import type { MonthKey, PhotoRef } from '../types';
import {
  dayKeyFromDate,
  dayKeysFromPhotos,
  isDayKey,
  parsePhotoStreakDays,
  streakMilestone,
} from '../utils/photoStreak';

let streakEpoch: string | null | undefined;
let streakDaysCache: Record<string, string[]> | undefined;
let streakVersion = 0;
const streakListeners = new Set<() => void>();

function emitStreak(): void {
  streakVersion += 1;
  streakListeners.forEach((listener) => listener());
}

export function subscribePhotoStreak(listener: () => void): () => void {
  streakListeners.add(listener);
  return () => {
    streakListeners.delete(listener);
  };
}

export function getPhotoStreakVersion(): number {
  return streakVersion;
}

export function ensurePhotoStreakEpoch(now = new Date()): string {
  if (streakEpoch === undefined) {
    streakEpoch = getPhotoStreakEpoch();
  }
  if (streakEpoch && isDayKey(streakEpoch)) {
    return streakEpoch;
  }
  const day = dayKeyFromDate(now);
  setPhotoStreakEpoch(day);
  streakEpoch = day;
  emitStreak();
  return day;
}

function readDaysMap(): Record<string, string[]> {
  if (!streakDaysCache) {
    streakDaysCache = parsePhotoStreakDays(getPhotoStreakDaysRaw());
  }
  return streakDaysCache;
}

export function recordPhotoStreakMonth(
  month: MonthKey,
  photos: PhotoRef[],
): void {
  const epoch = ensurePhotoStreakEpoch();
  const nextDays = dayKeysFromPhotos(photos).filter(
    (day) => day.startsWith(month) && day >= epoch,
  );
  const map = { ...readDaysMap() };
  const prev = map[month] ?? [];
  if (
    prev.length === nextDays.length &&
    prev.every((day, i) => day === nextDays[i])
  ) {
    return;
  }
  map[month] = nextDays;
  streakDaysCache = map;
  setPhotoStreakDaysRaw(JSON.stringify(map));
  emitStreak();
}

export function readPhotoStreakDays(): Record<string, string[]> {
  return readDaysMap();
}

let pendingMilestone = 0;

export function peekStreakMilestonePopup(): number {
  return pendingMilestone;
}

/** Offer a one-shot in-app popup for a newly reached 10-day step. */
export function offerStreakMilestonePopup(current: number): void {
  const milestone = streakMilestone(current);
  if (milestone < 10 || milestone <= getPhotoStreakMilestoneSent()) {
    return;
  }
  if (pendingMilestone === milestone) {
    return;
  }
  pendingMilestone = milestone;
  emitStreak();
}

export function dismissStreakMilestonePopup(): void {
  if (pendingMilestone >= 10) {
    setPhotoStreakMilestoneSent(pendingMilestone);
  }
  pendingMilestone = 0;
  emitStreak();
}
