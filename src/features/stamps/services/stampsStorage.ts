import {
  getStampsRaw,
  getStampsUnseenRaw,
  setStampsRaw,
  setStampsUnseenRaw,
} from '@/lib/storage';

import type { MonthKey, VisitPlace } from '@/features/photos/types';

import { stampsCollectedSchema, stampsUnseenSchema } from '../schema';
import type { StampEntry, StampsCollected } from '../types';
import {
  isKnownSigungu,
  normalizeSido,
  stampId,
  warnUnknownSigungu,
} from './sigunguIndex';

export function readStampsCollected(): StampsCollected {
  const raw = getStampsRaw();
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = stampsCollectedSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function readStampsUnseen(): string[] {
  const raw = getStampsUnseenRaw();
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = stampsUnseenSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function writeCollected(map: StampsCollected): void {
  setStampsRaw(JSON.stringify(map));
}

function writeUnseen(ids: string[]): void {
  setStampsUnseenRaw(JSON.stringify(ids));
}

/** 시군구 grain from a visit place. */
export function sigunguFromVisit(place: VisitPlace): string | null {
  const name = place.gu ?? place.city ?? null;
  if (!name || !name.trim()) {
    return null;
  }
  return name.trim();
}

export type StampSyncResult = {
  collected: StampsCollected;
  unseen: string[];
  /** Newly added stamp ids this call. */
  added: string[];
};

/**
 * Idempotent: add stamps for visit places missing from the index.
 * Batches one write. Does not reverse-geocode.
 */
export function syncStampsFromVisits(
  month: MonthKey,
  places: VisitPlace[],
): StampSyncResult {
  const collected = { ...readStampsCollected() };
  const unseen = [...readStampsUnseen()];
  const unseenSet = new Set(unseen);
  const added: string[] = [];

  for (const place of places) {
    const name = sigunguFromVisit(place);
    const sido = normalizeSido(place.province ?? null);
    if (!name || !sido) {
      continue;
    }
    if (!isKnownSigungu(sido, name)) {
      warnUnknownSigungu(sido, name);
    }
    const id = stampId(sido, name);
    if (collected[id]) {
      continue;
    }
    const entry: StampEntry = { name, sido, firstMonth: month };
    collected[id] = entry;
    added.push(id);
    if (!unseenSet.has(id)) {
      unseenSet.add(id);
      unseen.push(id);
    }
  }

  if (added.length > 0) {
    writeCollected(collected);
    writeUnseen(unseen);
  }

  return { collected, unseen, added };
}

export function markAllStampsSeen(): string[] {
  writeUnseen([]);
  return [];
}

export function countCollected(collected: StampsCollected): number {
  return Object.keys(collected).length;
}

export function countCollectedInSido(
  collected: StampsCollected,
  sido: string,
): number {
  let n = 0;
  for (const entry of Object.values(collected)) {
    if (entry.sido === sido) {
      n += 1;
    }
  }
  return n;
}

/** Stamp ids whose firstMonth is the given month. */
export function firstsInMonth(
  collected: StampsCollected,
  month: MonthKey,
): number {
  let n = 0;
  for (const entry of Object.values(collected)) {
    if (entry.firstMonth === month) {
      n += 1;
    }
  }
  return n;
}
