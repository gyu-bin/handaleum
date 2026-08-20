import { getHiddenPhotosRaw, setHiddenPhotosRaw } from '@/lib/storage';

import { monthKeySchema } from '../schema';
import type { MonthKey } from '../types';

export type HiddenPhotoSet = ReadonlySet<string>;

export function readHiddenPhotos(month: MonthKey): HiddenPhotoSet {
  const parsedKey = monthKeySchema.safeParse(month);
  if (!parsedKey.success) {
    return new Set();
  }
  const raw = getHiddenPhotosRaw(parsedKey.data);
  if (!raw) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    const out = new Set<string>();
    for (const id of parsed) {
      if (typeof id === 'string' && id.length > 0) {
        out.add(id);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}

function persist(month: MonthKey, next: HiddenPhotoSet): HiddenPhotoSet {
  const key = monthKeySchema.parse(month);
  setHiddenPhotosRaw(key, JSON.stringify([...next]));
  return next;
}

export function hidePhoto(month: MonthKey, assetId: string): HiddenPhotoSet {
  const next = new Set(readHiddenPhotos(month));
  next.add(assetId);
  return persist(month, next);
}

export function unhidePhoto(month: MonthKey, assetId: string): HiddenPhotoSet {
  const next = new Set(readHiddenPhotos(month));
  next.delete(assetId);
  return persist(month, next);
}

export function clearHiddenPhotos(month: MonthKey): HiddenPhotoSet {
  return persist(month, new Set());
}
