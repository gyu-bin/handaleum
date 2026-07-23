import {
  getIsProRaw,
  getPlaceFirstSeenRaw,
  setIsProRaw,
  setPlaceFirstSeenRaw,
} from '@/lib/storage';

import type { MonthKey } from '@/features/photos/types';

export type PlaceFirstSeenMap = Record<string, MonthKey>;

export function readPlaceFirstSeen(): PlaceFirstSeenMap {
  const raw = getPlaceFirstSeenRaw();
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: PlaceFirstSeenMap = {};
    for (const [label, month] of Object.entries(parsed)) {
      if (
        typeof label === 'string' &&
        typeof month === 'string' &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ) {
        out[label] = month as MonthKey;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Merge this month's place labels into the index, keeping the earliest month
 * per label (so browsing months out of order still records first visits).
 */
export function mergePlaceFirstSeen(
  month: MonthKey,
  labels: string[],
): PlaceFirstSeenMap {
  const next = { ...readPlaceFirstSeen() };
  for (const label of labels) {
    const existing = next[label];
    if (!existing || month < existing) {
      next[label] = month;
    }
  }
  setPlaceFirstSeenRaw(JSON.stringify(next));
  return next;
}

/** Distinct YYYY-MM values stored — used for cold-start gating. */
export function countDistinctMonthsInIndex(index: PlaceFirstSeenMap): number {
  return new Set(Object.values(index)).size;
}

export function readIsPro(): boolean {
  return getIsProRaw();
}

export function writeIsPro(value: boolean): void {
  setIsProRaw(value);
}
