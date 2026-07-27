import { getDevDummyPhotosRaw, setDevDummyPhotosRaw } from '@/lib/storage';

import type { MonthKey, MonthlyPhotos, MonthSummary, PhotoRef } from '../types';
import { monthBounds } from '../utils/month';

export const DUMMY_ASSET_PREFIX = 'dummy:';

/**
 * Fixed Seoul + Gyeonggi demo set — enough for map pins, journey chips,
 * and card “위치별” sections. Not a nationwide stress carpet.
 */
const HUBS: { lat: number; lng: number; count: number; label: string }[] = [
  // Seoul
  { lat: 37.5665, lng: 126.978, count: 5, label: '서울시청' },
  { lat: 37.4979, lng: 127.0276, count: 5, label: '강남' },
  { lat: 37.5563, lng: 126.9236, count: 4, label: '홍대' },
  { lat: 37.5446, lng: 127.0559, count: 4, label: '성수' },
  { lat: 37.5133, lng: 127.1001, count: 3, label: '잠실' },
  { lat: 37.5796, lng: 126.977, count: 3, label: '경복궁' },
  { lat: 37.4842, lng: 126.9297, count: 3, label: '신림' },
  // Gyeonggi
  { lat: 37.3947, lng: 127.1112, count: 5, label: '판교' },
  { lat: 37.2636, lng: 127.0286, count: 4, label: '수원' },
  { lat: 37.6584, lng: 126.832, count: 3, label: '고양' },
  { lat: 37.2411, lng: 127.1776, count: 3, label: '용인' },
  { lat: 37.5034, lng: 126.766, count: 3, label: '부천' },
  { lat: 37.3943, lng: 126.9568, count: 3, label: '안양' },
  { lat: 37.7599, lng: 126.7802, count: 3, label: '파주' },
  { lat: 37.8315, lng: 127.5095, count: 2, label: '가평' },
  { lat: 37.5394, lng: 127.2145, count: 2, label: '하남' },
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

/** Small deterministic scatter so pins don't stack on one pixel. */
function jitter(i: number, axis: 0 | 1): number {
  const a = ((i * 17 + axis * 9) % 7) - 3;
  return a * 0.004;
}

export function buildDummyMonthlyPhotos(month: MonthKey): MonthlyPhotos {
  const { startMs, endMs } = monthBounds(month);
  const span = Math.max(1, endMs - startMs - 1);
  const photos: PhotoRef[] = [];
  const total = dummyPhotoCount();
  let i = 0;

  for (const hub of HUBS) {
    for (let k = 0; k < hub.count; k += 1) {
      const t = startMs + Math.floor(((i + 1) / (total + 1)) * span);
      photos.push({
        assetId: `${DUMMY_ASSET_PREFIX}${month}:${i}`,
        takenAt: new Date(t).toISOString(),
        lat: hub.lat + jitter(i, 0),
        lng: hub.lng + jitter(i, 1),
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
  const total = dummyPhotoCount();
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

/** Deterministic remote placeholder for expo-image / Naver httpUri. */
export function dummyAssetImageUri(assetId: string): string {
  const seed = encodeURIComponent(assetId);
  return `https://picsum.photos/seed/${seed}/600/800`;
}
