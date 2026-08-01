import sigunguBySido from '@/assets/geo/sigungu-by-sido.json';

/**
 * Short sido keys as in provinces.json / sigungu-by-sido.json.
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

const INDEX = sigunguBySido as Record<string, string[]>;

/** Sido order for chips — provinces.json order. */
export const SIDO_ORDER: string[] = Object.keys(INDEX);

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
  if (INDEX[trimmed]) {
    return trimmed;
  }
  // Strip trailing 도/시 noise once.
  const stripped = trimmed
    .replace(/특별자치도$/, '')
    .replace(/광역시$/, '')
    .replace(/특별시$/, '')
    .replace(/도$/, '')
    .replace(/시$/, '');
  if (PROVINCE_TO_SIDO[stripped]) {
    return PROVINCE_TO_SIDO[stripped]!;
  }
  if (INDEX[stripped]) {
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

export function sigunguListForSido(sido: string): string[] {
  return INDEX[sido] ?? [];
}

export function totalSigunguCount(): number {
  return SIDO_ORDER.reduce((n, s) => n + (INDEX[s]?.length ?? 0), 0);
}

/**
 * Whether `name` (gu ?? city) is in the index for `sido`.
 * Logs once per miss for later correction (군 등).
 */
const warnedMiss = new Set<string>();

export function isKnownSigungu(sido: string, name: string): boolean {
  const list = INDEX[sido];
  if (!list) {
    return false;
  }
  return list.includes(name);
}

export function warnUnknownSigungu(sido: string, name: string): void {
  const key = `${sido}/${name}`;
  if (warnedMiss.has(key)) {
    return;
  }
  warnedMiss.add(key);
  console.warn('[stamps] sigungu not in index (will still collect)', sido, name);
}
