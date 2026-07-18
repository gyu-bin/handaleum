import { getPinCoversRaw, setPinCoversRaw } from '@/lib/storage';

import { monthKeySchema } from '../schema';
import type { MonthKey } from '../types';

/** placeKey → assetId */
export type PinCoverMap = Record<string, string>;

export function readPinCovers(month: MonthKey): PinCoverMap {
  const key = monthKeySchema.parse(month);
  const raw = getPinCoversRaw(key);
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: PinCoverMap = {};
    for (const [placeKey, assetId] of Object.entries(parsed)) {
      if (typeof placeKey === 'string' && typeof assetId === 'string' && assetId.length > 0) {
        out[placeKey] = assetId;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writePinCover(
  month: MonthKey,
  placeKey: string,
  assetId: string,
): PinCoverMap {
  const key = monthKeySchema.parse(month);
  const next = { ...readPinCovers(key), [placeKey]: assetId };
  setPinCoversRaw(key, JSON.stringify(next));
  return next;
}

export function clearPinCover(month: MonthKey, placeKey: string): PinCoverMap {
  const key = monthKeySchema.parse(month);
  const next = { ...readPinCovers(key) };
  delete next[placeKey];
  setPinCoversRaw(key, JSON.stringify(next));
  return next;
}
