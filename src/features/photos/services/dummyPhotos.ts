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

const HUBS: DummyHub[] = [
  // —— Seoul ——
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
    lat: 37.5007,
    lng: 127.0365,
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
    lat: 37.527,
    lng: 127.0286,
    count: 3,
    label: '압구정',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '강남구',
      street: '압구정동',
      name: '압구정동',
      postalCode: '06001',
      formattedAddress: '대한민국 서울특별시 강남구 압구정동',
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
    lat: 37.5605,
    lng: 126.923,
    count: 3,
    label: '연남',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '마포구',
      street: '연남동',
      name: '연남동',
      postalCode: '03998',
      formattedAddress: '대한민국 서울특별시 마포구 연남동',
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
    lat: 37.5112,
    lng: 127.0981,
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
    lat: 37.5826,
    lng: 126.983,
    count: 3,
    label: '북촌',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '종로구',
      street: '가회동',
      name: '가회동',
      postalCode: '03057',
      formattedAddress: '대한민국 서울특별시 종로구 가회동',
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
  {
    lat: 37.5345,
    lng: 126.9946,
    count: 3,
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
    lat: 37.5219,
    lng: 126.9245,
    count: 3,
    label: '여의도',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '영등포구',
      street: '여의도동',
      name: '여의도동',
      postalCode: '07325',
      formattedAddress: '대한민국 서울특별시 영등포구 여의도동',
    }),
  },
  // —— Gyeonggi ——
  {
    lat: 37.3947,
    lng: 127.1112,
    count: 4,
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
    count: 3,
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
    count: 2,
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
    count: 2,
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
    count: 2,
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
    count: 2,
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
  // —— More Seoul leaves (denser 발도장) ——
  {
    lat: 37.5665,
    lng: 126.991,
    count: 3,
    label: '을지로',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '중구',
      street: '을지로2가',
      name: '을지로2가',
      postalCode: '04537',
      formattedAddress: '대한민국 서울특별시 중구 을지로2가',
    }),
  },
  {
    lat: 37.5704,
    lng: 126.992,
    count: 3,
    label: '종로',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '종로구',
      street: '종로3가',
      name: '종로3가',
      postalCode: '03188',
      formattedAddress: '대한민국 서울특별시 종로구 종로3가',
    }),
  },
  {
    lat: 37.5045,
    lng: 127.049,
    count: 3,
    label: '선릉',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '강남구',
      street: '삼성동',
      name: '삼성동',
      postalCode: '06164',
      formattedAddress: '대한민국 서울특별시 강남구 삼성동',
    }),
  },
  {
    lat: 37.5112,
    lng: 127.022,
    count: 3,
    label: '논현',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '강남구',
      street: '논현동',
      name: '논현동',
      postalCode: '06120',
      formattedAddress: '대한민국 서울특별시 강남구 논현동',
    }),
  },
  {
    lat: 37.5485,
    lng: 126.912,
    count: 2,
    label: '합정',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '마포구',
      street: '합정동',
      name: '합정동',
      postalCode: '04015',
      formattedAddress: '대한민국 서울특별시 마포구 합정동',
    }),
  },
  {
    lat: 37.5571,
    lng: 126.936,
    count: 2,
    label: '신촌',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '서대문구',
      street: '창천동',
      name: '창천동',
      postalCode: '03789',
      formattedAddress: '대한민국 서울특별시 서대문구 창천동',
    }),
  },
  {
    lat: 37.4979,
    lng: 126.927,
    count: 2,
    label: '노량진',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '동작구',
      street: '노량진동',
      name: '노량진동',
      postalCode: '06911',
      formattedAddress: '대한민국 서울특별시 동작구 노량진동',
    }),
  },
  {
    lat: 37.6542,
    lng: 127.0568,
    count: 2,
    label: '노원',
    address: iosAddr({
      region: '서울특별시',
      city: '서울특별시',
      district: '노원구',
      street: '상계동',
      name: '상계동',
      postalCode: '01695',
      formattedAddress: '대한민국 서울특별시 노원구 상계동',
    }),
  },
  // —— Incheon (수도권) ——
  {
    lat: 37.4485,
    lng: 126.701,
    count: 2,
    label: '인천시청',
    address: iosAddr({
      region: '인천광역시',
      city: '인천광역시',
      district: '남동구',
      street: '구월동',
      name: '구월동',
      postalCode: '21554',
      formattedAddress: '대한민국 인천광역시 남동구 구월동',
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
function jitter(i: number, axis: 0 | 1): number {
  const a = ((i * 17 + axis * 9) % 11) - 5;
  // Wider scatter under stress so clustering / remount paths get exercise.
  return a * (DUMMY_STRESS_MULT > 1 ? 0.008 : 0.004);
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
    for (let k = 0; k < n; k += 1) {
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
