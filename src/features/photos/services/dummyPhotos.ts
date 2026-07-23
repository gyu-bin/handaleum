import {
  getDevDummyPhotosRaw,
  setDevDummyPhotosRaw,
} from '@/lib/storage';

import type { MonthKey, MonthlyPhotos, MonthSummary, PhotoRef } from '../types';
import { monthBounds } from '../utils/month';

export const DUMMY_ASSET_PREFIX = 'dummy:';

/**
 * Small fixed demo set — enough to see pins/journey, not a stress carpet.
 * (~18 pins across a few cities)
 */
const HUBS: { lat: number; lng: number; count: number }[] = [
  { lat: 37.5665, lng: 126.978, count: 5 }, // Seoul
  { lat: 37.2636, lng: 127.0286, count: 3 }, // Suwon
  { lat: 35.1796, lng: 129.0756, count: 3 }, // Busan
  { lat: 33.4996, lng: 126.5312, count: 2 }, // Jeju
  { lat: 36.3504, lng: 127.3845, count: 2 }, // Daejeon
  { lat: 37.4563, lng: 126.7052, count: 3 }, // Incheon
];

/**
 * Dev demo photos. On in __DEV__ unless Settings turns them off.
 * Always off in production.
 */
export function isDevDummyPhotosEnabled(): boolean {
  if (!__DEV__) {
    return false;
  }
  return getDevDummyPhotosRaw() !== '0';
}

export function setDevDummyPhotosEnabled(enabled: boolean): void {
  setDevDummyPhotosRaw(enabled);
}

function jitter(n: number, i: number): number {
  return ((i % 5) - 2) * 0.012;
}

export function buildDummyMonthlyPhotos(month: MonthKey): MonthlyPhotos {
  const { startMs, endMs } = monthBounds(month);
  const span = Math.max(1, endMs - startMs - 1);
  const photos: PhotoRef[] = [];
  let i = 0;

  for (const hub of HUBS) {
    for (let k = 0; k < hub.count; k += 1) {
      const t = startMs + Math.floor(((i + 1) / 20) * span);
      photos.push({
        assetId: `${DUMMY_ASSET_PREFIX}${month}:${i}`,
        takenAt: new Date(t).toISOString(),
        lat: hub.lat + jitter(hub.lat, i),
        lng: hub.lng + jitter(hub.lng, i + 1),
      });
      i += 1;
    }
  }

  photos.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return { month, photos, noLocationCount: 0 };
}

export function buildDummyMonthSummaries(): MonthSummary[] {
  const now = new Date();
  const out: MonthSummary[] = [];
  const total = HUBS.reduce((sum, h) => sum + h.count, 0);
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` as MonthKey;
    out.push({ month, totalCount: total });
  }
  return out;
}

export function isDummyAssetId(assetId: string): boolean {
  return assetId.startsWith(DUMMY_ASSET_PREFIX);
}

export function dummyPhotoCount(): number {
  return HUBS.reduce((sum, h) => sum + h.count, 0);
}
