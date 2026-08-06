import type { MonthKey, VisitPlace } from '@/features/photos/types';
import { legalDongFromAdmin } from '@/features/photos/utils/placeLabels';
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
  dongListForCity,
  inferCityForDong,
  isKnownDong,
  normalizeSido,
  parseStampId,
  resolveCityForVisit,
  stampId,
} from './dongIndex';
import { isKnownGunLeaf } from './stampNavIndex';

export function readStampsCollected(): StampsCollected {
  const raw = getStampsRaw();
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = stampsCollectedSchema.safeParse(parsed);
    if (!result.success) {
      // Legacy 시군구 keys (sido/name) fail the new schema — start fresh.
      return {};
    }
    return pruneLegacyKeys(result.data);
  } catch {
    return {};
  }
}

/** Drop pre-dong keys (`sido/name` two-part) if any slipped through. */
function pruneLegacyKeys(map: StampsCollected): StampsCollected {
  let dirty = false;
  const next: StampsCollected = { ...map };
  for (const id of Object.keys(next)) {
    if (!parseStampId(id) || !next[id]?.city) {
      delete next[id];
      dirty = true;
    }
  }
  if (dirty) {
    writeCollected(next);
  }
  return next;
}

export function readStampsUnseen(): string[] {
  const raw = getStampsUnseenRaw();
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = stampsUnseenSchema.safeParse(parsed);
    return result.success ? result.data.filter((id) => parseStampId(id)) : [];
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
 * Leaf grain from a visit place: 동, or 읍·면 under 군.
 * 리 / 구 alone → null.
 */
export function dongFromVisit(place: VisitPlace): string | null {
  const raw = place.dong?.trim() || place.eupMyon?.trim() || null;
  if (!raw) {
    return null;
  }
  if (raw.endsWith('동') || raw.endsWith('면') || raw.endsWith('읍')) {
    return raw;
  }
  return null;
}

/** Match geocoded leaf string to an index slot (admin 숫자동 · 군 읍면 허용). */
export function matchIndexedDong(
  sido: string,
  city: string,
  rawDong: string,
): string | null {
  if (isKnownDong(sido, city, rawDong)) {
    return rawDong;
  }
  if (city.endsWith('군') && isKnownGunLeaf(sido, city, rawDong)) {
    return rawDong;
  }
  const legal = legalDongFromAdmin(rawDong);
  const candidates = dongListForCity(sido, city);
  if (legal && candidates.includes(legal)) {
    return legal;
  }
  // 역삼동 → 역삼1동/2동: unique → that slot; many → first sorted (deterministic).
  const base = (legal ?? rawDong).replace(/동$/, '');
  if (!base) {
    return null;
  }
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixed = candidates
    .filter((d) => d === `${base}동` || new RegExp(`^${escaped}\\d+동$`).test(d))
    .sort((a, b) => a.localeCompare(b, 'ko'));
  return prefixed[0] ?? null;
}

export type StampSyncResult = {
  collected: StampsCollected;
  unseen: string[];
  added: string[];
  pruned: string[];
};

export type StampSyncOptions = {
  silent?: boolean;
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
 * Idempotent: add dong stamps for visit places.
 */
export function syncStampsFromVisits(
  places: VisitPlace[],
  options: StampSyncOptions,
): StampSyncResult {
  let collected = { ...readStampsCollected() };
  let unseen = [...readStampsUnseen()];
  const unseenSet = new Set(unseen);
  const added: string[] = [];
  const pruned: string[] = [];
  const silent = options.silent === true;

  for (const place of places) {
    const rawDong = dongFromVisit(place);
    if (!rawDong) {
      continue;
    }
    const sido = normalizeSido(place.province ?? null);
    if (!sido) {
      continue;
    }
    let city = resolveCityForVisit(
      sido,
      place.city?.trim() || null,
      place.gu?.trim() || null,
    );
    if (!city) {
      city = inferCityForDong(sido, rawDong);
    }
    if (!city) {
      city = inferCityForDong(sido, legalDongFromAdmin(rawDong) ?? rawDong);
    }
    let dong: string | null = null;
    if (city) {
      dong = matchIndexedDong(sido, city, rawDong);
    } else {
      // City unknown — unique dong name across the sido.
      const inferred = inferCityForDong(sido, rawDong);
      if (inferred) {
        city = inferred;
        dong = matchIndexedDong(sido, inferred, rawDong);
      }
    }
    if (!city || !dong) {
      continue;
    }
    const id = stampId(sido, city, dong);
    if (collected[id]) {
      continue;
    }
    const entry: StampEntry = {
      name: dong,
      city,
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

  if (added.length > 0 || pruned.length > 0) {
    writeCollected(collected);
    writeUnseen(unseen);
  }

  return { collected, unseen, added, pruned };
}

export function markAllStampsSeen(): string[] {
  writeUnseen([]);
  return [];
}

/** Wipe collected + unseen (e.g. switching __DEV__ sample album). */
export function clearAllStamps(): void {
  writeCollected({});
  writeUnseen([]);
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
): number {
  let n = 0;
  for (const entry of Object.values(collected)) {
    if (entry.sido === sido && entry.city === city) {
      n += 1;
    }
  }
  return n;
}

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
