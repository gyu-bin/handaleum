import citiesBySido from '@/assets/geo/cities-by-sido.json';
import dongGu from '@/assets/geo/dong-gu.json';

/**
 * Short sido keys as in provinces.json / cities-by-sido.json.
 * VisitPlace.province may be full forms (경기도, 서울특별시) — normalize here.
 */
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

/** sido → city → stamp units (구 list, or [] if city itself is the stamp). */
type CitiesIndex = Record<string, Record<string, string[]>>;

const CITIES = citiesBySido as CitiesIndex;

/** 일반구 모시 — stamp grain is 구 only; city name alone must not collect. */
export const GENERAL_GU_CITIES: ReadonlySet<string> = new Set(
  Object.keys(dongGu as Record<string, unknown>).filter((k) => k !== '서울'),
);

/** Sido order for chips — provinces.json / cities-by-sido order. */
export const SIDO_ORDER: string[] = Object.keys(CITIES);

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
  if (CITIES[trimmed]) {
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
  if (CITIES[stripped]) {
    return stripped;
  }
  return null;
}

/** Stable id — avoids 중구 collisions across sidos. */
export function stampId(sido: string, name: string): string {
  return `${sido}/${name}`;
}

export function parseStampId(id: string): { sido: string; name: string } | null {
  const i = id.indexOf('/');
  if (i <= 0 || i === id.length - 1) {
    return null;
  }
  return { sido: id.slice(0, i), name: id.slice(i + 1) };
}

export function cityListForSido(sido: string): string[] {
  const cities = CITIES[sido];
  if (!cities) {
    return [];
  }
  return Object.keys(cities);
}

/**
 * Stamp units under a city. Empty array means the city name itself is the unit.
 */
export function unitsForCity(sido: string, city: string): string[] {
  const units = CITIES[sido]?.[city];
  if (!units) {
    return [];
  }
  if (units.length === 0) {
    return [city];
  }
  return units;
}

/** Flat stamp-unit list for a sido (구 + leaf 시/군). */
export function sigunguListForSido(sido: string): string[] {
  const cities = CITIES[sido];
  if (!cities) {
    return [];
  }
  const out: string[] = [];
  for (const [city, gus] of Object.entries(cities)) {
    if (gus.length === 0) {
      out.push(city);
    } else {
      out.push(...gus);
    }
  }
  return out;
}

/** Parent city for a stamp unit name within sido, or null. */
export function cityForUnit(sido: string, unit: string): string | null {
  const cities = CITIES[sido];
  if (!cities) {
    return null;
  }
  if (cities[unit] && cities[unit]!.length === 0) {
    return unit;
  }
  for (const [city, gus] of Object.entries(cities)) {
    if (gus.includes(unit)) {
      return city;
    }
  }
  return null;
}

export function totalSigunguCount(): number {
  return SIDO_ORDER.reduce((n, s) => n + sigunguListForSido(s).length, 0);
}

/**
 * Whether `name` (gu ?? city) is a valid stamp unit for `sido`.
 */
const warnedMiss = new Set<string>();

export function isKnownSigungu(sido: string, name: string): boolean {
  return sigunguListForSido(sido).includes(name);
}

/** Parent 시 names that must never be collected as stamps. */
export function isGeneralGuParentCity(name: string): boolean {
  return GENERAL_GU_CITIES.has(name);
}

/**
 * Metro parents whose stamp grain is 구 (or leaf 군 under the sido).
 * Collecting "대전" / "서울" alone never fills a slot in the grid.
 */
export const METRO_STAMP_PARENTS: ReadonlySet<string> = new Set([
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
]);

export function isMetroStampParent(name: string): boolean {
  return METRO_STAMP_PARENTS.has(name);
}

export function warnUnknownSigungu(sido: string, name: string): void {
  const key = `${sido}/${name}`;
  if (warnedMiss.has(key)) {
    return;
  }
  warnedMiss.add(key);
  console.warn('[stamps] sigungu not in index (will still collect)', sido, name);
}
