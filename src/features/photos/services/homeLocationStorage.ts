import {
  clearHomeLocationRaw,
  getHomeLocationRaw,
  setHomeLocationRaw,
} from '@/lib/storage';

import { homeLocationSchema } from '../schema';
import type { HomeLocation } from '../types';

/** Wide enough to cover the building and its block, not the neighbourhood. */
export const DEFAULT_HOME_RADIUS_M = 300;

export function readHomeLocation(): HomeLocation | null {
  const raw = getHomeLocationRaw();
  if (!raw) {
    return null;
  }
  try {
    const parsed = homeLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeHomeLocation(home: HomeLocation): HomeLocation | null {
  const parsed = homeLocationSchema.safeParse(home);
  if (!parsed.success) {
    return readHomeLocation();
  }
  setHomeLocationRaw(JSON.stringify(parsed.data));
  return parsed.data;
}

export function clearHomeLocation(): null {
  clearHomeLocationRaw();
  return null;
}
