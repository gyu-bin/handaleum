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
 * Nationwide demo hubs — map pins, journey chips, 발도장, card “위치별”.
 * Coordinates stay inside the named leaf so jitter still resolves via
 * offline PIP / canned geocode (see dummyHubs.pip.check.ts).
 *
 * Stress: `DUMMY_STRESS_MULT` multiplies per-hub counts.
 * Image URIs reuse a small pool so picsum/network doesn't mask JS jank.
 */
/** __DEV__ map/CPU stress. Set back to 1 after stress testing. */
export const DUMMY_STRESS_MULT = 1;

/**
 * Bump when HUBS lat/lng set changes so 발도장 drops the stale GPS snapshot
 * and rebuilds 모은 동네 from the new sample album.
 */
export const DUMMY_HUBS_REV = 1;

/** One hub per major region — enough for glance-dot coverage. */
const HUBS: DummyHub[] = [
  {
    lat: 37.5345,
    lng: 126.9946,
    count: 30,
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
    lat: 37.2636,
    lng: 127.0286,
    count: 22,
    label: '수원',
    address: iosAddr({
      region: '경기도',
      city: '수원시',
      subregion: '팔달구',
      street: '인계동',
      name: '인계동',
      postalCode: '16488',
      formattedAddress: '대한민국 경기도 수원시 팔달구 인계동',
    }),
  },
  {
    lat: 37.3825,
    lng: 126.6564,
    count: 22,
    label: '송도',
    address: iosAddr({
      region: '인천광역시',
      city: '인천광역시',
      district: '연수구',
      street: '송도동',
      name: '송도동',
      postalCode: '21984',
      formattedAddress: '대한민국 인천광역시 연수구 송도동',
    }),
  },
  {
    lat: 37.765,
    lng: 128.897,
    count: 22,
    label: '강릉',
    address: iosAddr({
      region: '강원특별자치도',
      city: '강릉시',
      street: '교동',
      name: '교동',
      postalCode: '25533',
      formattedAddress: '대한민국 강원특별자치도 강릉시 교동',
    }),
  },
  {
    lat: 36.815,
    lng: 127.113,
    count: 18,
    label: '천안',
    address: iosAddr({
      region: '충청남도',
      city: '천안시',
      subregion: '서북구',
      street: '불당동',
      name: '불당동',
      postalCode: '31156',
      formattedAddress: '대한민국 충청남도 천안시 서북구 불당동',
    }),
  },
  {
    lat: 36.635,
    lng: 127.491,
    count: 18,
    label: '청주',
    address: iosAddr({
      region: '충청북도',
      city: '청주시',
      subregion: '상당구',
      street: '성안동',
      name: '성안동',
      postalCode: '28531',
      formattedAddress: '대한민국 충청북도 청주시 상당구 성안동',
    }),
  },
  {
    lat: 36.328,
    lng: 127.427,
    count: 22,
    label: '대전',
    address: iosAddr({
      region: '대전광역시',
      city: '대전광역시',
      district: '중구',
      street: '대흥동',
      name: '대흥동',
      postalCode: '34920',
      formattedAddress: '대한민국 대전광역시 중구 대흥동',
    }),
  },
  {
    lat: 35.815,
    lng: 127.153,
    count: 22,
    label: '전주',
    address: iosAddr({
      region: '전북특별자치도',
      city: '전주시',
      subregion: '완산구',
      street: '풍남동',
      name: '풍남동',
      postalCode: '55041',
      formattedAddress: '대한민국 전북특별자치도 전주시 완산구 풍남동',
    }),
  },
  {
    lat: 35.1498,
    lng: 126.9195,
    count: 22,
    label: '광주',
    address: iosAddr({
      region: '광주광역시',
      city: '광주광역시',
      district: '동구',
      street: '충장로',
      name: '충장동',
      postalCode: '61475',
      formattedAddress: '대한민국 광주광역시 동구 충장동',
    }),
  },
  {
    lat: 34.7395,
    lng: 127.736,
    count: 18,
    label: '여수',
    address: iosAddr({
      region: '전라남도',
      city: '여수시',
      street: '중앙동',
      name: '중앙동',
      postalCode: '59747',
      formattedAddress: '대한민국 전라남도 여수시 중앙동',
    }),
  },
  {
    lat: 35.8667,
    lng: 128.597,
    count: 22,
    label: '대구',
    address: iosAddr({
      region: '대구광역시',
      city: '대구광역시',
      district: '중구',
      street: '삼덕동',
      name: '삼덕동',
      postalCode: '41940',
      formattedAddress: '대한민국 대구광역시 중구 삼덕동',
    }),
  },
  {
    lat: 35.8372,
    lng: 129.211,
    count: 18,
    label: '경주',
    address: iosAddr({
      region: '경상북도',
      city: '경주시',
      street: '황남동',
      name: '황남동',
      postalCode: '38166',
      formattedAddress: '대한민국 경상북도 경주시 황남동',
    }),
  },
  {
    lat: 35.1587,
    lng: 129.1604,
    count: 30,
    label: '해운대',
    address: iosAddr({
      region: '부산광역시',
      city: '부산광역시',
      district: '해운대구',
      street: '우동',
      name: '우동',
      postalCode: '48094',
      formattedAddress: '대한민국 부산광역시 해운대구 우동',
    }),
  },
  {
    lat: 35.538,
    lng: 129.338,
    count: 18,
    label: '울산',
    address: iosAddr({
      region: '울산광역시',
      city: '울산광역시',
      district: '남구',
      street: '삼산동',
      name: '삼산동',
      postalCode: '44705',
      formattedAddress: '대한민국 울산광역시 남구 삼산동',
    }),
  },
  {
    lat: 35.221,
    lng: 128.685,
    count: 18,
    label: '창원',
    address: iosAddr({
      region: '경상남도',
      city: '창원시',
      subregion: '성산구',
      street: '상남동',
      name: '상남동',
      postalCode: '51496',
      formattedAddress: '대한민국 경상남도 창원시 성산구 상남동',
    }),
  },
  {
    lat: 33.4996,
    lng: 126.5312,
    count: 26,
    label: '제주',
    address: iosAddr({
      region: '제주특별자치도',
      city: '제주시',
      street: '이도이동',
      name: '이도이동',
      postalCode: '63219',
      formattedAddress: '대한민국 제주특별자치도 제주시 이도이동',
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
  return { month, photos, noLocationCount: 0, noLocationPhotos: [] };
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
