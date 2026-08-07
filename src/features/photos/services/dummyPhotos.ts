import type { LocationGeocodedAddress } from 'expo-location';
import { Image } from 'react-native';

import { getDevDummyPhotosRaw, setDevDummyPhotosRaw } from '@/lib/storage';

import type { MonthKey, MonthlyPhotos, MonthSummary, PhotoRef } from '../types';
import { monthBounds } from '../utils/month';

export const DUMMY_ASSET_PREFIX = 'dummy:';

/** Bundled 1200×1600 demo stills — sharp on playback, no network. */
const DEMO_IMAGE_MODULES = [
  require('../../../../assets/demo/demo-10.jpg'),
  require('../../../../assets/demo/demo-11.jpg'),
  require('../../../../assets/demo/demo-12.jpg'),
  require('../../../../assets/demo/demo-13.jpg'),
  require('../../../../assets/demo/demo-15.jpg'),
  require('../../../../assets/demo/demo-16.jpg'),
  require('../../../../assets/demo/demo-18.jpg'),
  require('../../../../assets/demo/demo-20.jpg'),
  require('../../../../assets/demo/demo-22.jpg'),
  require('../../../../assets/demo/demo-25.jpg'),
  require('../../../../assets/demo/demo-26.jpg'),
  require('../../../../assets/demo/demo-28.jpg'),
  require('../../../../assets/demo/demo-29.jpg'),
  require('../../../../assets/demo/demo-31.jpg'),
  require('../../../../assets/demo/demo-33.jpg'),
  require('../../../../assets/demo/demo-35.jpg'),
  require('../../../../assets/demo/demo-37.jpg'),
  require('../../../../assets/demo/demo-39.jpg'),
  require('../../../../assets/demo/demo-40.jpg'),
  require('../../../../assets/demo/demo-44.jpg'),
  require('../../../../assets/demo/demo-47.jpg'),
  require('../../../../assets/demo/demo-48.jpg'),
  require('../../../../assets/demo/demo-52.jpg'),
  require('../../../../assets/demo/demo-55.jpg'),
  require('../../../../assets/demo/demo-57.jpg'),
  require('../../../../assets/demo/demo-60.jpg'),
  require('../../../../assets/demo/demo-64.jpg'),
  require('../../../../assets/demo/demo-70.jpg'),
  require('../../../../assets/demo/demo-71.jpg'),
  require('../../../../assets/demo/demo-76.jpg'),
  require('../../../../assets/demo/demo-82.jpg'),
  require('../../../../assets/demo/demo-87.jpg'),
] as const;

/**
 * iOS CLGeocoder-shaped address for one demo hub.
 * Field layout mirrors what expo-location returns on device (see
 * scripts/check-place-parse.ts): metro uses city=서울특별시 + district=구 +
 * street=동; 경기도 일반구 시는 city=성남시 + subregion=분당구 + street=동.
 */
type DummyHub = {
  lat: number;
  lng: number;
  count: number;
  /** Dev-only note — not shown in UI. */
  label: string;
  address: LocationGeocodedAddress;
};

function iosAddr(
  partial: Partial<LocationGeocodedAddress> & {
    formattedAddress: string;
  },
): LocationGeocodedAddress {
  return {
    city: null,
    country: '대한민국',
    district: null,
    isoCountryCode: 'KR',
    name: null,
    postalCode: null,
    region: null,
    street: null,
    streetNumber: null,
    subregion: null,
    timezone: 'Asia/Seoul',
    ...partial,
  } as LocationGeocodedAddress;
}

/**
 * Seoul / Gyeonggi (+ Incheon) demo set — map pins, journey chips, 발도장,
 * and card “위치별”. Coordinates stay near the named leaf so jitter
 * still resolves via offline PIP / canned geocode.
 *
 * Stress: `DUMMY_STRESS_MULT` multiplies per-hub counts.
 * Image URIs reuse a small pool so picsum/network doesn't mask JS jank.
 */
/** __DEV__ map/CPU stress. Set back to 1 after stress testing. */
export const DUMMY_STRESS_MULT = 1;

/**
 * Slim demo set — few places, many photos (playback / pin sheet stress).
 * ponytail: expand hubs again if stamp/map density demos need them.
 */
const HUBS: DummyHub[] = [
  {
    lat: 37.5345,
    lng: 126.9946,
    count: 120,
    label: '이태원',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '용산구',
      street: '이태원동',
      name: '이태원동',
      postalCode: '04350',
      formattedAddress: '대한민국 서울특별시 용산구 이태원동',
    }),
  },
  {
    lat: 37.5446,
    lng: 127.0559,
    count: 80,
    label: '성수',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '성동구',
      street: '성수동1가',
      name: '성수동1가',
      postalCode: '04779',
      formattedAddress: '대한민국 서울특별시 성동구 성수동1가',
    }),
  },
  {
    lat: 37.5563,
    lng: 126.9236,
    count: 60,
    label: '홍대',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '마포구',
      street: '서교동',
      name: '서교동',
      postalCode: '04057',
      formattedAddress: '대한민국 서울특별시 마포구 서교동',
    }),
  },
  {
    lat: 37.5007,
    lng: 127.0365,
    count: 40,
    label: '강남',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '강남구',
      street: '역삼동',
      name: '역삼동',
      postalCode: '06236',
      formattedAddress: '대한민국 서울특별시 강남구 역삼동',
    }),
  },
  {
    lat: 37.3947,
    lng: 127.1112,
    count: 30,
    label: '판교',
    address: iosAddr({
      region: '경기도',
      city: '성남시',
      subregion: '분당구',
      street: '삼평동',
      name: '삼평동',
      postalCode: '13494',
      formattedAddress: '대한민국 경기도 성남시 분당구 삼평동',
    }),
  },
];

/** Match jittered pins (~0.012°) back to their hub. */
const HUB_MATCH_DEG = DUMMY_STRESS_MULT > 1 ? 0.06 : 0.03;

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
function jitter(i: number, axis: 0 | 1, tight = false): number {
  const a = ((i * 17 + axis * 9) % 11) - 5;
  // Tight: keep a fat hub inside one playback cluster cell (~0.006°).
  const step = tight
    ? 0.00035
    : DUMMY_STRESS_MULT > 1
      ? 0.008
      : 0.004;
  return a * step;
}

function hubCount(hub: DummyHub): number {
  return hub.count * Math.max(1, DUMMY_STRESS_MULT);
}

export function buildDummyMonthlyPhotos(month: MonthKey): MonthlyPhotos {
  const { startMs, endMs } = monthBounds(month);
  const span = Math.max(1, endMs - startMs - 1);
  const photos: PhotoRef[] = [];
  const total = dummyPhotoCount();
  let i = 0;

  for (const hub of HUBS) {
    const n = hubCount(hub);
    const tight = n >= 50;
    for (let k = 0; k < n; k += 1) {
      const t = startMs + Math.floor(((i + 1) / (total + 1)) * span);
      photos.push({
        assetId: `${DUMMY_ASSET_PREFIX}${month}:${i}`,
        takenAt: new Date(t).toISOString(),
        lat: hub.lat + jitter(i, 0, tight),
        lng: hub.lng + jitter(i, 1, tight),
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
  // More months under stress → stamp library path + month warmup contend.
  const months = DUMMY_STRESS_MULT > 1 ? 18 : 8;
  for (let i = 0; i < months; i += 1) {
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
  return HUBS.reduce((sum, h) => sum + hubCount(h), 0);
}

/** Local bundled demo image URI (size ignored — assets are already 1200×1600). */
export type DummyImageSize = 128 | 256 | 512 | 1080;

export function dummyAssetImageUri(
  assetId: string,
  _size: DummyImageSize = 256,
): string {
  // Hash full id so the same index across months doesn't reuse one still.
  let h = 0;
  for (let i = 0; i < assetId.length; i += 1) {
    h = (Math.imul(h, 31) + assetId.charCodeAt(i)) >>> 0;
  }
  const pool = h % DEMO_IMAGE_MODULES.length;
  const resolved = Image.resolveAssetSource(DEMO_IMAGE_MODULES[pool]!);
  return resolved.uri;
}

/**
 * When sample pins are on, skip CLGeocoder and return the hub's canned
 * iOS-shaped address so labels match production parsing without network/
 * permission flakiness on Simulator.
 */
export function dummyGeocodeNear(
  lat: number,
  lng: number,
): LocationGeocodedAddress | null {
  if (!isDevDummyPhotosEnabled()) {
    return null;
  }
  let best: DummyHub | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const hub of HUBS) {
    const dLat = hub.lat - lat;
    const dLng = hub.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = hub;
    }
  }
  if (!best || bestDist > HUB_MATCH_DEG * HUB_MATCH_DEG) {
    return null;
  }
  return best.address;
}
