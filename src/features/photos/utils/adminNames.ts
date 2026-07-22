import * as Location from 'expo-location';

/**
 * Korean administrative-name normalization and address-field extraction. These
 * are pure string helpers over an iOS `LocationGeocodedAddress`; the meaning we
 * build on top of them (labels, journey) lives in placeLabels/placeJourney.
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

const METRO_PROVINCE: Record<string, string> = {
  서울: '서울',
  부산: '부산',
  대구: '대구',
  인천: '인천',
  광주: '광주',
  대전: '대전',
  울산: '울산',
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

function endsWithDong(value: string): boolean {
  return /[동리가]$/.test(value.replace(/\s+/g, ''));
}

/** Pull the first "○○구" from any address field (iOS often buries it in formattedAddress). */
export function extractGu(
  ...parts: (string | null | undefined)[]
): string | null {
  for (const part of parts) {
    if (part == null || !part.trim()) {
      continue;
    }
    const compact = part.replace(/\s+/g, '');
    if (endsWithGu(compact)) {
      return compact;
    }
    const match = part.match(/([가-힣]{1,10}구)/);
    if (match?.[1] && match[1] !== '특구') {
      return match[1];
    }
  }
  return null;
}

export function extractDong(
  ...parts: (string | null | undefined)[]
): string | null {
  for (const part of parts) {
    if (part == null || !part.trim()) {
      continue;
    }
    const compact = part.replace(/\s+/g, '');
    if (endsWithDong(compact) && compact.length <= 12) {
      return compact;
    }
    const match = part.match(/([가-힣0-9]{1,12}[동리가])/);
    if (match?.[1] && !endsWithGu(match[1])) {
      return match[1];
    }
  }
  return null;
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

export function extractProvince(
  addr: Location.LocationGeocodedAddress,
  cityShort: string,
  metro: boolean,
): string | null {
  if (metro && METRO_PROVINCE[cityShort]) {
    return METRO_PROVINCE[cityShort]!;
  }
  const region = cleanPart(addr.region);
  if (region) {
    if (/도$/.test(region) || /특별자치도$/.test(region)) {
      return region.replace(/특별자치도$/, '도');
    }
    if (METRO_SHORT[region]) {
      return METRO_SHORT[region]!;
    }
  }
  return cityShort || null;
}
