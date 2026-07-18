/** [lng, lat] */
export type LngLat = [number, number];

export type CityTier = 1 | 2 | 3;

export interface KoreaCity {
  name: string;
  /** [lng, lat] — same order as the map projection. */
  c: LngLat;
  tier: CityTier;
}

/**
 * Zoom scale where each tier starts fading in (ResumableZoom scale).
 * Labels stay constant screen size; only visibility changes with zoom.
 */
export const CITY_APPEAR_SCALE: Record<CityTier, number | undefined> = {
  1: undefined,
  2: 1.65,
  3: 2.4,
};

/** Municipality (시) labels — quiet detail when pinched in. */
export const MUNICIPALITY_APPEAR_SCALE = 3.0;

/** Province (도) names fade out once city detail takes over. */
export const PROVINCE_HIDE_SCALE = 2.15;

/**
 * Curated cities for overview / mid zoom.
 * Metros (tier 1) are not in municipalities.json (광역시·특별시),
 * so they must stay here. Tier 2–3 fill provincial hubs.
 */
export const KOREA_CITIES: readonly KoreaCity[] = [
  { name: '서울', c: [126.978, 37.5665], tier: 1 },
  { name: '인천', c: [126.7052, 37.4563], tier: 1 },
  { name: '수원', c: [127.0286, 37.2636], tier: 1 },
  { name: '부산', c: [129.0756, 35.1796], tier: 1 },
  { name: '대구', c: [128.6014, 35.8714], tier: 1 },
  { name: '광주', c: [126.8526, 35.1595], tier: 1 },
  { name: '대전', c: [127.3845, 36.3504], tier: 1 },
  { name: '울산', c: [129.3114, 35.5384], tier: 1 },
  { name: '제주', c: [126.5312, 33.4996], tier: 1 },
  { name: '강릉', c: [128.8761, 37.7519], tier: 2 },
  { name: '원주', c: [127.9202, 37.3422], tier: 2 },
  { name: '청주', c: [127.4897, 36.6424], tier: 2 },
  { name: '전주', c: [127.148, 35.8242], tier: 2 },
  { name: '창원', c: [128.6811, 35.228], tier: 2 },
  { name: '여수', c: [127.6622, 34.7604], tier: 2 },
  { name: '김해', c: [128.889, 35.228], tier: 2 },
  { name: '경주', c: [129.2247, 35.8562], tier: 3 },
  { name: '포항', c: [129.365, 36.019], tier: 3 },
  { name: '춘천', c: [127.7342, 37.8813], tier: 3 },
  { name: '천안', c: [127.1522, 36.8151], tier: 3 },
  { name: '속초', c: [128.5918, 38.207], tier: 3 },
  { name: '안동', c: [128.7294, 36.5684], tier: 3 },
  { name: '목포', c: [126.3922, 34.8118], tier: 3 },
  { name: '통영', c: [128.433, 34.8544], tier: 3 },
] as const;

/** ~50km in degrees (rough, enough for label gating on static cards). */
export const CITY_PIN_NEAR_DEG = 0.45;

export function isCityNearPins(
  city: KoreaCity,
  pins: { lng: number; lat: number }[],
): boolean {
  if (city.tier === 1) {
    return true;
  }
  for (const pin of pins) {
    const dLng = city.c[0] - pin.lng;
    const dLat = city.c[1] - pin.lat;
    if (dLng * dLng + dLat * dLat <= CITY_PIN_NEAR_DEG * CITY_PIN_NEAR_DEG) {
      return true;
    }
  }
  return false;
}

/** Display name without trailing 시 (남양주시 → 남양주). */
export function shortCityName(name: string): string {
  return name.endsWith('시') ? name.slice(0, -1) : name;
}
