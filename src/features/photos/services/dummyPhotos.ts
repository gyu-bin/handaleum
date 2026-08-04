import type { LocationGeocodedAddress } from 'expo-location';

import { getDevDummyPhotosRaw, setDevDummyPhotosRaw } from '@/lib/storage';

import type { MonthKey, MonthlyPhotos, MonthSummary, PhotoRef } from '../types';
import { monthBounds } from '../utils/month';

export const DUMMY_ASSET_PREFIX = 'dummy:';

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
 * Fixed Seoul + Gyeonggi demo set — enough for map pins, journey chips,
 * and card “위치별” sections. Coordinates stay near the named 법정동 so
 * jitter (~0.012°) still resolves to the same hub address.
 */
const HUBS: DummyHub[] = [
  // —— Seoul (region/city both 서울특별시; 구 in district; 동 in street) ——
  {
    lat: 37.5665,
    lng: 126.978,
    count: 5,
    label: '서울시청',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '중구',
      street: '태평로1가',
      name: '서울시청',
      postalCode: '04524',
      formattedAddress: '대한민국 서울특별시 중구 태평로1가',
    }),
  },
  {
    lat: 37.4979,
    lng: 127.0276,
    count: 5,
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
    lat: 37.5563,
    lng: 126.9236,
    count: 4,
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
    lat: 37.5446,
    lng: 127.0559,
    count: 4,
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
    lat: 37.5133,
    lng: 127.1001,
    count: 3,
    label: '잠실',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '송파구',
      street: '잠실동',
      name: '잠실동',
      postalCode: '05510',
      formattedAddress: '대한민국 서울특별시 송파구 잠실동',
    }),
  },
  {
    lat: 37.5796,
    lng: 126.977,
    count: 3,
    label: '경복궁',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '종로구',
      street: '세종로',
      name: '경복궁',
      postalCode: '03045',
      formattedAddress: '대한민국 서울특별시 종로구 세종로',
    }),
  },
  {
    lat: 37.4842,
    lng: 126.9297,
    count: 3,
    label: '신림',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '관악구',
      street: '신림동',
      name: '신림동',
      postalCode: '08758',
      formattedAddress: '대한민국 서울특별시 관악구 신림동',
    }),
  },
  // —— Gyeonggi (region=경기도; 일반구 시는 subregion=구) ——
  {
    lat: 37.3947,
    lng: 127.1112,
    count: 5,
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
  {
    lat: 37.2636,
    lng: 127.0286,
    count: 4,
    label: '수원',
    address: iosAddr({
      region: '경기도',
      city: '수원시',
      subregion: '영통구',
      street: '원천동',
      name: '원천동',
      postalCode: '16512',
      formattedAddress: '대한민국 경기도 수원시 영통구 원천동',
    }),
  },
  {
    lat: 37.6584,
    lng: 126.832,
    count: 3,
    label: '고양',
    address: iosAddr({
      region: '경기도',
      city: '고양시',
      subregion: '일산동구',
      street: '장항동',
      name: '장항동',
      postalCode: '10403',
      formattedAddress: '대한민국 경기도 고양시 일산동구 장항동',
    }),
  },
  {
    lat: 37.2411,
    lng: 127.1776,
    count: 3,
    label: '용인',
    address: iosAddr({
      region: '경기도',
      city: '용인시',
      subregion: '수지구',
      street: '풍덕천동',
      name: '풍덕천동',
      postalCode: '16827',
      formattedAddress: '대한민국 경기도 용인시 수지구 풍덕천동',
    }),
  },
  {
    lat: 37.5034,
    lng: 126.766,
    count: 3,
    label: '부천',
    address: iosAddr({
      region: '경기도',
      city: '부천시',
      street: '중동',
      name: '중동',
      postalCode: '14547',
      formattedAddress: '대한민국 경기도 부천시 중동',
    }),
  },
  {
    lat: 37.3943,
    lng: 126.9568,
    count: 3,
    label: '안양',
    address: iosAddr({
      region: '경기도',
      city: '안양시',
      subregion: '동안구',
      street: '평촌동',
      name: '평촌동',
      postalCode: '14071',
      formattedAddress: '대한민국 경기도 안양시 동안구 평촌동',
    }),
  },
  {
    lat: 37.7599,
    lng: 126.7802,
    count: 3,
    label: '파주',
    address: iosAddr({
      region: '경기도',
      city: '파주시',
      street: '야당동',
      name: '야당동',
      postalCode: '10881',
      formattedAddress: '대한민국 경기도 파주시 야당동',
    }),
  },
  {
    lat: 37.8315,
    lng: 127.5095,
    count: 2,
    label: '가평',
    address: iosAddr({
      region: '경기도',
      city: '가평군',
      district: '가평읍',
      name: '읍내리',
      street: '읍내리',
      postalCode: '12416',
      formattedAddress: '대한민국 경기도 가평군 가평읍 읍내리',
    }),
  },
  {
    lat: 37.5394,
    lng: 127.2145,
    count: 2,
    label: '하남',
    address: iosAddr({
      region: '경기도',
      city: '하남시',
      street: '신장동',
      name: '신장동',
      postalCode: '12942',
      formattedAddress: '대한민국 경기도 하남시 신장동',
    }),
  },
];

/** Match jittered pins (~0.012°) back to their hub. */
const HUB_MATCH_DEG = 0.03;

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
