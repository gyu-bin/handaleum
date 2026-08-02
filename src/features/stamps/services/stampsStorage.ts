import type { MonthKey, VisitPlace } from '@/features/photos/types';
import { isEupMyonName } from '@/features/photos/utils/adminNames';
import { monthKeyFromTimestamp } from '@/features/photos/utils/month';
import {
  getStampsRaw,
  getStampsUnseenRaw,
  setStampsRaw,
  setStampsUnseenRaw,
} from '@/lib/storage';

import { stampsCollectedSchema, stampsUnseenSchema } from '../schema';
import type { StampEntry, StampsCollected } from '../types';
import {
  inferSidoForUnit,
  isGeneralGuParentCity,
  isKnownSigungu,
  isMetroStampParent,
  normalizeSido,
  stampId,
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

/**
 * 시군구 grain from a visit place.
 * - 구 있으면 구
 * - 강화군 등 군·일반 시·군은 city
 * - 일반구 모시 / 광역시 부모명만 있고 구 없음 → null (슬롯 안 맞는 가짜 도장 방지)
 */
export function sigunguFromVisit(place: VisitPlace): string | null {
  const gu = place.gu?.trim() || null;
  const city = place.city?.trim() || null;
  if (gu) {
    return gu;
  }
  if (!city) {
    return null;
  }
  // Legacy bad parse "강화군시" → treat as 강화군
  const normalized = city.endsWith('군시') ? city.slice(0, -1) : city;
  if (isGeneralGuParentCity(normalized) || isMetroStampParent(normalized)) {
    return null;
  }
  // 주문진읍 등 — stamp grain is parent 시/군 only (lift happens in placeResolve).
  if (isEupMyonName(normalized)) {
    return null;
  }
  return normalized;
}

export type StampSyncResult = {
  collected: StampsCollected;
  unseen: string[];
  /** Newly added stamp ids this call. */
  added: string[];
  /** Orphan parent-city stamps removed. */
  pruned: string[];
};

export type StampSyncOptions = {
  /** When true, new stamps are not added to unseen (no badge / slam). */
  silent?: boolean;
  /**
   * Fallback firstMonth when a place has no usable firstTakenAt.
   * Per-place month is preferred from firstTakenAt.
   */
  month: MonthKey;
};

function monthForPlace(place: VisitPlace, fallback: MonthKey): MonthKey {
  const t = Date.parse(place.firstTakenAt);
  if (Number.isFinite(t)) {
    return monthKeyFromTimestamp(t);
  }
  return fallback;
}

/**
 * Drop collected entries that can never fill a grid slot:
 * 일반구 parent cities, metro parents (서울/대전…), legacy "○○군시".
 */
export function pruneGeneralGuParentStamps(
  collected: StampsCollected,
  unseen: string[],
): { collected: StampsCollected; unseen: string[]; pruned: string[] } {
  const next = { ...collected };
  const pruned: string[] = [];
  for (const [id, entry] of Object.entries(next)) {
    const name = entry.name;
    const badGunSi = /군시$/.test(name);
    if (
      isGeneralGuParentCity(name) ||
      isMetroStampParent(name) ||
      badGunSi
    ) {
      delete next[id];
      pruned.push(id);
    }
  }
  const prunedSet = new Set(pruned);
  const nextUnseen = unseen.filter((id) => !prunedSet.has(id));
  return { collected: next, unseen: nextUnseen, pruned };
}

/**
 * Idempotent: add stamps for visit places.
 * Batches one write. Does not reverse-geocode.
 */
export function syncStampsFromVisits(
  places: VisitPlace[],
  options: StampSyncOptions,
): StampSyncResult {
  let collected = { ...readStampsCollected() };
  let unseen = [...readStampsUnseen()];
  const prune = pruneGeneralGuParentStamps(collected, unseen);
  collected = prune.collected;
  unseen = prune.unseen;
  const unseenSet = new Set(unseen);
  const added: string[] = [];
  const silent = options.silent === true;

  for (const place of places) {
    const name = sigunguFromVisit(place);
    if (!name) {
      continue;
    }
    const sido =
      normalizeSido(place.province ?? null) ??
      inferSidoForUnit(name) ??
      (place.city ? inferSidoForUnit(place.city) : null);
    if (!sido) {
      continue;
    }
    if (isGeneralGuParentCity(name)) {
      continue;
    }
    // Domestic index only — foreign / unknown admin names never collect.
    if (!isKnownSigungu(sido, name)) {
      continue;
    }
    const id = stampId(sido, name);
    if (collected[id]) {
      continue;
    }
    const entry: StampEntry = {
      name,
      sido,
      firstMonth: monthForPlace(place, options.month),
    };
    collected[id] = entry;
    added.push(id);
    if (!silent && !unseenSet.has(id)) {
      unseenSet.add(id);
      unseen.push(id);
    }
  }

  if (added.length > 0 || prune.pruned.length > 0) {
    writeCollected(collected);
    writeUnseen(unseen);
  }

  return { collected, unseen, added, pruned: prune.pruned };
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

export function countCollectedInCity(
  collected: StampsCollected,
  sido: string,
  city: string,
  units: string[],
): number {
  let n = 0;
  for (const unit of units) {
    if (collected[stampId(sido, unit)]) {
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
