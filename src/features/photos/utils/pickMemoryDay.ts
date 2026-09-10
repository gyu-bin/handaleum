import type { MonthKey, PhotoRef } from '../types';

import { monthBounds } from './month';

/** Local hour for the mid-month memory reminder (before month-end 21:00). */
export const MEMORY_REMINDER_HOUR = 20;

/** Do not fire on the last N calendar days (month-end recap owns that window). */
export const MONTH_END_AVOID_DAYS = 2;

export type MemoryPickKind = 'newDong' | 'mostPhotos' | 'fallback';

export type MemoryPick = {
  contentMonth: MonthKey;
  /** Local day-of-month in contentMonth (1–31). */
  day: number;
  kind: MemoryPickKind;
  /** Display 동 for newDong copy. */
  dongName?: string;
  assetId: string;
};

export type NewStampSeed = {
  id: string;
  name: string;
};

function localDay(takenAt: string): number {
  return new Date(takenAt).getDate();
}

function lastDayOfMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m, 0).getDate();
}

/** True when `day` sits in the month-end avoid window (inclusive). */
export function isNearMonthEnd(day: number, lastDay: number): boolean {
  return day >= lastDay - MONTH_END_AVOID_DAYS;
}

/**
 * Clamp a preferred day so the send date avoids the month-end reminder window.
 * Falls back to (lastDay - avoid - 1) when the preferred day is too late.
 */
export function clampDayAwayFromMonthEnd(day: number, lastDay: number): number {
  const capped = Math.min(Math.max(1, day), lastDay);
  if (!isNearMonthEnd(capped, lastDay)) {
    return capped;
  }
  return Math.max(1, lastDay - MONTH_END_AVOID_DAYS - 1);
}

export function photosInMonth(
  photos: PhotoRef[],
  month: MonthKey,
): PhotoRef[] {
  const { startMs, endMs } = monthBounds(month);
  return photos.filter((photo) => {
    const t = Date.parse(photo.takenAt);
    return Number.isFinite(t) && t >= startMs && t < endMs;
  });
}

/**
 * Pick one meaningful day inside `contentMonth`.
 * Priority: new-dong first-visit day (stamp firstMonth) → GPS photo max day.
 * `stampIdOf` maps a photo to stampId (null = skip).
 */
export function pickMemoryDay(
  contentMonth: MonthKey,
  photos: PhotoRef[],
  newStamps: NewStampSeed[],
  stampIdOf: (lat: number, lng: number) => string | null,
): MemoryPick | null {
  const inMonth = photosInMonth(photos, contentMonth);
  if (inMonth.length === 0) {
    return null;
  }

  const sorted = [...inMonth].sort((a, b) =>
    a.takenAt.localeCompare(b.takenAt),
  );
  const lastDay = lastDayOfMonth(contentMonth);

  const photoStamp = new Map<string, string>();
  for (const photo of sorted) {
    const id = stampIdOf(photo.lat, photo.lng);
    if (id) {
      photoStamp.set(photo.assetId, id);
    }
  }

  if (newStamps.length > 0) {
    const firstDayByStamp = new Map<string, { day: number; photo: PhotoRef }>();
    for (const stamp of newStamps) {
      for (const photo of sorted) {
        if (photoStamp.get(photo.assetId) !== stamp.id) {
          continue;
        }
        const day = localDay(photo.takenAt);
        firstDayByStamp.set(stamp.id, { day, photo });
        break;
      }
    }

    const byDay = new Map<
      number,
      { count: number; photo: PhotoRef; name: string }
    >();
    for (const stamp of newStamps) {
      const hit = firstDayByStamp.get(stamp.id);
      if (!hit || isNearMonthEnd(hit.day, lastDay)) {
        continue;
      }
      const prev = byDay.get(hit.day);
      if (!prev) {
        byDay.set(hit.day, { count: 1, photo: hit.photo, name: stamp.name });
        continue;
      }
      const earlier = hit.photo.takenAt < prev.photo.takenAt;
      byDay.set(hit.day, {
        count: prev.count + 1,
        photo: earlier ? hit.photo : prev.photo,
        name: earlier ? stamp.name : prev.name,
      });
    }

    let best: { day: number; count: number; photo: PhotoRef; name: string } | null =
      null;
    for (const [day, row] of byDay) {
      if (
        !best ||
        row.count > best.count ||
        (row.count === best.count && day < best.day)
      ) {
        best = { day, ...row };
      }
    }
    if (best) {
      return {
        contentMonth,
        day: best.day,
        kind: 'newDong',
        dongName: best.name,
        assetId: best.photo.assetId,
      };
    }
  }

  const countByDay = new Map<number, { count: number; photo: PhotoRef }>();
  for (const photo of sorted) {
    const day = localDay(photo.takenAt);
    if (isNearMonthEnd(day, lastDay)) {
      continue;
    }
    const prev = countByDay.get(day);
    if (!prev) {
      countByDay.set(day, { count: 1, photo });
      continue;
    }
    countByDay.set(day, {
      count: prev.count + 1,
      photo: prev.photo,
    });
  }

  let most: { day: number; count: number; photo: PhotoRef } | null = null;
  for (const [day, row] of countByDay) {
    if (
      !most ||
      row.count > most.count ||
      (row.count === most.count && day < most.day)
    ) {
      most = { day, ...row };
    }
  }
  if (most) {
    return {
      contentMonth,
      day: most.day,
      kind: 'mostPhotos',
      assetId: most.photo.assetId,
    };
  }

  // All photos sit in the avoid window — still pick something (clamped later).
  const hero = sorted[0]!;
  return {
    contentMonth,
    day: localDay(hero.takenAt),
    kind: 'fallback',
    assetId: hero.assetId,
  };
}
