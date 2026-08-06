import dongsBySidoCity from '@/assets/geo/dongs-by-sido-city.json';

/**
 * Leaf-grain stamp index: 행정동 + 군 읍·면 (도농복합 시 읍·면 제외).
 * Shape: sido → city → leaf[].
 */

type DongsIndex = Record<string, Record<string, string[]>>;

const DONGS = dongsBySidoCity as DongsIndex;

const PROVINCE_TO_SIDO: Record<string, string> = {
  서울: '서울',
  서울시: '서울',
  서울특별시: '서울',
  부산: '부산',
  부산시: '부산',
  부산광역시: '부산',
  대구: '대구',
  대구시: '대구',
  대구광역시: '대구',
  인천: '인천',
  인천시: '인천',
  인천광역시: '인천',
  광주: '광주',
  광주시: '광주',
  광주광역시: '광주',
  대전: '대전',
  대전시: '대전',
  대전광역시: '대전',
  울산: '울산',
  울산시: '울산',
  울산광역시: '울산',
  세종: '세종',
  세종시: '세종',
  세종특별자치시: '세종',
  경기: '경기',
  경기도: '경기',
  강원: '강원',
  강원도: '강원',
  강원특별자치도: '강원',
  충북: '충북',
  충청북도: '충북',
  충남: '충남',
  충청남도: '충남',
  전북: '전북',
  전라북도: '전북',
  전북특별자치도: '전북',
  전남: '전남',
  전라남도: '전남',
  경북: '경북',
  경상북도: '경북',
  경남: '경남',
  경상남도: '경남',
  제주: '제주',
  제주도: '제주',
  제주특별자치도: '제주',
};

export const SIDO_ORDER: string[] = Object.keys(DONGS);

export function normalizeSido(province: string | null | undefined): string | null {
  if (!province) {
    return null;
  }
  const trimmed = province.trim();
  if (!trimmed) {
    return null;
  }
  if (PROVINCE_TO_SIDO[trimmed]) {
    return PROVINCE_TO_SIDO[trimmed]!;
  }
  if (DONGS[trimmed]) {
    return trimmed;
  }
  const stripped = trimmed
    .replace(/특별자치도$/, '')
    .replace(/광역시$/, '')
    .replace(/특별시$/, '')
    .replace(/도$/, '')
    .replace(/시$/, '');
  if (PROVINCE_TO_SIDO[stripped]) {
    return PROVINCE_TO_SIDO[stripped]!;
  }
  if (DONGS[stripped]) {
    return stripped;
  }
  return null;
}

/** stamp id — sido/city/leaf (동·읍·면 충돌 방지). */
export function stampId(sido: string, city: string, dong: string): string {
  return `${sido}/${city}/${dong}`;
}

export function parseStampId(
  id: string,
): { sido: string; city: string; dong: string } | null {
  const parts = id.split('/');
  if (parts.length !== 3) {
    return null;
  }
  const [sido, city, dong] = parts;
  if (!sido || !city || !dong) {
    return null;
  }
  return { sido, city, dong };
}

export function cityListForSido(sido: string): string[] {
  const cities = DONGS[sido];
  if (!cities) {
    return [];
  }
  return Object.keys(cities);
}

export function dongListForCity(sido: string, city: string): string[] {
  return DONGS[sido]?.[city] ?? [];
}

export function isKnownDong(sido: string, city: string, dong: string): boolean {
  return dongListForCity(sido, city).includes(dong);
}

/** Infer city inside sido for a dong name (unique only). */
export function inferCityForDong(sido: string, dong: string): string | null {
  const cities = DONGS[sido];
  if (!cities) {
    return null;
  }
  const matches: string[] = [];
  for (const [city, dongs] of Object.entries(cities)) {
    if (dongs.includes(dong)) {
      matches.push(city);
    }
  }
  return matches.length === 1 ? matches[0]! : null;
}

export function totalDongCount(): number {
  let n = 0;
  for (const sido of SIDO_ORDER) {
    for (const city of cityListForSido(sido)) {
      n += dongListForCity(sido, city).length;
    }
  }
  return n;
}

/**
 * Resolve parent city for a visit inside sido.
 * Metro: city key is the sido (서울) or 세종시.
 * Prefer place.city / place.gu when they map into the index.
 */
export function resolveCityForVisit(
  sido: string,
  placeCity: string | null,
  placeGu: string | null,
): string | null {
  const cities = DONGS[sido];
  if (!cities) {
    return null;
  }
  if (placeCity && cities[placeCity]) {
    return placeCity;
  }
  // 수원시 + 장안구 style — city may be 수원시
  if (placeCity) {
    const prefix = placeCity.endsWith('시') ? placeCity : `${placeCity}시`;
    if (cities[prefix]) {
      return prefix;
    }
  }
  // Metro parent stored as sido key
  if (cities[sido]) {
    return sido;
  }
  if (sido === '세종' && cities['세종시']) {
    return '세종시';
  }
  void placeGu;
  return null;
}
