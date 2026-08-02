import * as Location from 'expo-location';

/**
 * Korean administrative-name helpers (metro tables, cleanPart, kind checks).
 * Full address parsing lives in adminTokens + parseGeocodedPlace.
 */

/** Normalize metro official names → short display names. */
export const METRO_SHORT: Record<string, string> = {
  서울특별시: '서울',
  서울시: '서울',
  서울: '서울',
  부산광역시: '부산',
  부산시: '부산',
  부산: '부산',
  대구광역시: '대구',
  대구시: '대구',
  대구: '대구',
  인천광역시: '인천',
  인천시: '인천',
  인천: '인천',
  광주광역시: '광주',
  광주시: '광주',
  광주: '광주',
  대전광역시: '대전',
  대전시: '대전',
  대전: '대전',
  울산광역시: '울산',
  울산시: '울산',
  울산: '울산',
  세종특별자치시: '세종',
  세종시: '세종',
  세종: '세종',
};

export function cleanPart(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === '대한민국' || trimmed === 'South Korea' || trimmed === 'KR') {
    return null;
  }
  return trimmed;
}

export function shortCityName(raw: string): string {
  if (METRO_SHORT[raw]) {
    return METRO_SHORT[raw]!;
  }
  return raw
    .replace(/광역시$/, '')
    .replace(/특별시$/, '')
    .replace(/특별자치시$/, '');
}

export function isMetroCity(rawCity: string): boolean {
  if (rawCity in METRO_SHORT) {
    return true;
  }
  const short = shortCityName(rawCity);
  return Object.values(METRO_SHORT).includes(short);
}

export function endsWithGu(value: string): boolean {
  return /구$/.test(value.replace(/\s+/g, ''));
}

/** True for 경기도 / 제주특별자치도 — not a usable city grain by itself. */
export function isProvinceName(name: string): boolean {
  const compact = name.replace(/\s+/g, '');
  if (METRO_SHORT[compact] || METRO_SHORT[name]) {
    return false;
  }
  return /도$/.test(compact) && !/시$/.test(compact);
}

/** True for 주문진읍 / 손양면 — not a stamp unit; lift to parent 시/군. */
export function isEupMyonName(name: string): boolean {
  return /[읍면]$/.test(name.replace(/\s+/g, ''));
}

export function looksLikeSeoul(
  addr: Location.LocationGeocodedAddress,
  rawCity: string,
): boolean {
  if (isMetroCity(rawCity) && shortCityName(rawCity) === '서울') {
    return true;
  }
  const blob = [addr.city, addr.district, addr.subregion, addr.region, addr.formattedAddress]
    .filter(Boolean)
    .join(' ');
  return /서울/.test(blob);
}