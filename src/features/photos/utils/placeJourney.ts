import * as Location from 'expo-location';

import dongGu from '@/assets/geo/dong-gu.json';

import type { PhotoRef, VisitAdminLevel, VisitPlace } from '../types';

/**
 * 시 → (법정동 → 구). iOS reverse-geocoding returns the 법정동 (도화동) but never
 * the 구 for cities that have one, so we recover the 구 from this reference table.
 * Generated from the official 법정동코드 전체자료, covering Seoul's 자치구 and every
 * 일반구 시 (성남·수원·고양·용인·창원·청주 등). Keyed by 시 so identically named
 * dongs in different cities don't collide; the few intra-city name collisions are
 * pinned (Seoul 신사동→강남구, 신정동→양천구) or omitted so they fall back to 시.
 */
const DONG_GU = dongGu as Record<string, Record<string, string>>;

/** ~110m buckets — nearby photos share one reverse-geocode call. */
const BUCKET_DECIMALS = 3;

type Bucket = {
  key: string;
  lat: number;
  lng: number;
  firstTakenAt: string;
};

type ParsedPlace = {
  journeyLabel: string;
  province: string | null;
  city: string | null;
  gu: string | null;
  dong: string | null;
};

/**
 * Familiar colloquial area names so the finest label reads like a place people
 * know (판교) instead of an official dong (삼평동). Entries also cover dongs that
 * are themselves the well-known name (성수동 → 성수). Anything not listed falls
 * back to the 구. Keyed by dong; a "구 동" key disambiguates repeated dongs.
 * Extend freely.
 */
const AREA_ALIAS: Record<string, string> = {
  삼평동: '판교',
  백현동: '판교',
  판교동: '판교',
  서교동: '홍대',
  동교동: '홍대',
  연남동: '연남동',
  성수동1가: '성수',
  성수동2가: '성수',
  이태원동: '이태원',
  한남동: '한남',
  여의도동: '여의도',
  잠실동: '잠실',
  압구정동: '압구정',
  청담동: '청담',
  '강남구 신사동': '가로수길',
};

/** Recover the 구 for a 법정동 when iOS returns the dong but not the 구. */
function guForDong(cityShort: string, dong: string | null): string | null {
  if (!dong) {
    return null;
  }
  return DONG_GU[cityShort]?.[dong] ?? null;
}

/** Colloquial alias for a dong, if we have one. */
function areaAlias(gu: string | null, dong: string | null): string | null {
  if (!dong) {
    return null;
  }
  if (gu && AREA_ALIAS[`${gu} ${dong}`]) {
    return AREA_ALIAS[`${gu} ${dong}`]!;
  }
  return AREA_ALIAS[dong] ?? null;
}

/**
 * Finest-grain label people recognize: a famous-area alias if known (판교), else
 * the 구 (서울 마포구), else the dong (강릉시 홍제동), else the city.
 */
function composeFineLabel(
  city: string | null,
  gu: string | null,
  dong: string | null,
): string | null {
  const alias = areaAlias(gu, dong);
  if (alias) {
    return alias;
  }
  if (!city) {
    return gu ?? dong ?? null;
  }
  if (gu) {
    return `${city} ${gu}`;
  }
  if (dong) {
    return `${city} ${dong}`;
  }
  return city;
}

const labelCache = new Map<string, ParsedPlace | null>();

/** Normalize metro official names → short display names. */
const METRO_SHORT: Record<string, string> = {
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

export function placeBucketKey(lat: number, lng: number): string {
  return `${lat.toFixed(BUCKET_DECIMALS)},${lng.toFixed(BUCKET_DECIMALS)}`;
}

function cleanPart(value: string | null | undefined): string | null {
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

function shortCityName(raw: string): string {
  if (METRO_SHORT[raw]) {
    return METRO_SHORT[raw]!;
  }
  return raw
    .replace(/광역시$/, '')
    .replace(/특별시$/, '')
    .replace(/특별자치시$/, '');
}

function isMetroCity(rawCity: string): boolean {
  if (rawCity in METRO_SHORT) {
    return true;
  }
  const short = shortCityName(rawCity);
  return Object.values(METRO_SHORT).includes(short);
}

function endsWithGu(value: string): boolean {
  return /구$/.test(value.replace(/\s+/g, ''));
}

function endsWithDong(value: string): boolean {
  return /[동리가]$/.test(value.replace(/\s+/g, ''));
}

/** Pull the first "○○구" from any address field (iOS often buries it in formattedAddress). */
function extractGu(
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

function extractDong(
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

function looksLikeSeoul(addr: Location.LocationGeocodedAddress, rawCity: string): boolean {
  if (isMetroCity(rawCity) && shortCityName(rawCity) === '서울') {
    return true;
  }
  const blob = [addr.city, addr.district, addr.subregion, addr.region, addr.formattedAddress]
    .filter(Boolean)
    .join(' ');
  return /서울/.test(blob);
}

function extractProvince(
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

/**
 * Clean journey labels:
 * - 구가 있는 시 → "서울 - 마포구" / "성남시 - 분당구" (구 appended when known)
 * - 그 외 → "파주시" / "강릉시" (시 only)
 */
export function formatAlbumPlaceLabel(
  addr: Location.LocationGeocodedAddress,
): string | null {
  return parseGeocodedPlace(addr)?.journeyLabel ?? null;
}

export function parseGeocodedPlace(
  addr: Location.LocationGeocodedAddress,
): ParsedPlace | null {
  const rawCity =
    cleanPart(addr.city) ??
    cleanPart(addr.subregion) ??
    cleanPart(addr.region);
  if (!rawCity) {
    return null;
  }

  if (/도$/.test(rawCity) && !/시$/.test(rawCity) && !METRO_SHORT[rawCity]) {
    if (!looksLikeSeoul(addr, rawCity)) {
      return null;
    }
  }

  const cityShort = looksLikeSeoul(addr, rawCity)
    ? '서울'
    : shortCityName(rawCity);

  const metro =
    looksLikeSeoul(addr, rawCity) ||
    isMetroCity(rawCity) ||
    Object.values(METRO_SHORT).includes(cityShort);

  const dong = extractDong(
    addr.district,
    addr.name,
    addr.street,
    addr.formattedAddress,
  );

  // iOS returns the 법정동 but not the 구 for cities that have one; recover it
  // from the dong when direct extraction finds nothing.
  const gu =
    extractGu(
      addr.district,
      addr.name,
      addr.street,
      addr.subregion,
      addr.city,
      addr.formattedAddress,
    ) ?? guForDong(cityShort, dong);

  // The city stays at 시 grain; the 구 lives in its own field.
  let cityLabel: string;
  if (metro) {
    cityLabel = cityShort;
  } else if (/시$/.test(rawCity)) {
    cityLabel = rawCity;
  } else if (/시$/.test(cityShort)) {
    cityLabel = cityShort;
  } else {
    cityLabel = `${cityShort}시`;
  }

  // Append the 구 whenever we have one (metro or 일반구 시) so distinct 구 stay
  // distinct — resolveVisitPlaces dedupes buckets by this label.
  const journeyLabel = gu ? `${cityLabel} - ${gu}` : cityLabel;

  const province = extractProvince(addr, cityShort, metro);

  return {
    journeyLabel,
    province,
    city: cityLabel,
    gu: gu && endsWithGu(gu) ? gu : null,
    dong: dong && !endsWithGu(dong) ? dong : null,
  };
}

/** City name in its "…시" form: 서울 → 서울시, 부산 → 부산시, 수원시 → 수원시. */
function toSiForm(cityShort: string): string {
  return /시$/.test(cityShort) ? cityShort : `${cityShort}시`;
}

/**
 * Detail-sheet location label. Shown to 구 grain where the city has one
 * (서울시 서대문구, 수원시 영통구), to dong grain elsewhere (강릉시 홍제동), and
 * falling back to the city alone (파주시) when no finer part is found.
 */
export function formatDetailPlaceLabel(
  addr: Location.LocationGeocodedAddress,
): string | null {
  const parsed = parseGeocodedPlace(addr);
  if (!parsed?.city) {
    return null;
  }
  return composeFineLabel(toSiForm(parsed.city), parsed.gu, parsed.dong);
}

const detailLabelCache = new Map<string, string | null>();

/** Reverse-geocode a cluster center to its detail-sheet label. Cached per bucket. */
export async function resolveClusterDetailLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  const key = placeBucketKey(lat, lng);
  if (detailLabelCache.has(key)) {
    return detailLabelCache.get(key) ?? null;
  }

  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return null; // don't prompt from the detail sheet
  }

  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    const label = results[0] ? formatDetailPlaceLabel(results[0]) : null;
    detailLabelCache.set(key, label);
    return label;
  } catch {
    detailLabelCache.set(key, null);
    return null;
  }
}

async function reverseParsed(lat: number, lng: number): Promise<ParsedPlace | null> {
  const key = `v6:${placeBucketKey(lat, lng)}`;
  if (labelCache.has(key)) {
    return labelCache.get(key) ?? null;
  }

  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    const parsed = results[0] ? parseGeocodedPlace(results[0]) : null;
    labelCache.set(key, parsed);
    return parsed;
  } catch {
    labelCache.set(key, null);
    return null;
  }
}

function collectBuckets(photos: PhotoRef[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const photo of photos) {
    const key = placeBucketKey(photo.lat, photo.lng);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        lat: Number(photo.lat.toFixed(BUCKET_DECIMALS)),
        lng: Number(photo.lng.toFixed(BUCKET_DECIMALS)),
        firstTakenAt: photo.takenAt,
      });
    } else if (photo.takenAt < existing.firstTakenAt) {
      existing.firstTakenAt = photo.takenAt;
    }
  }
  return [...map.values()].sort((a, b) =>
    a.firstTakenAt.localeCompare(b.firstTakenAt),
  );
}

/**
 * Unique journey places, first-visit order.
 * Example: 성남시, 서울 - 마포구, 서울 - 종로구, 용인시, 고양시, 파주시
 */
export async function placesVisitedAlbumStyle(
  photos: PhotoRef[],
): Promise<string[]> {
  const places = await resolveVisitPlaces(photos);
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const place of places) {
    if (seen.has(place.label)) {
      continue;
    }
    seen.add(place.label);
    labels.push(place.label);
  }
  return labels;
}

/**
 * Full visit places with admin fields for zoom-scoped bottom bar.
 * Labels use journey style at city grain; province/dong from geocode when available.
 */
export async function resolveVisitPlaces(photos: PhotoRef[]): Promise<VisitPlace[]> {
  if (photos.length === 0) {
    return [];
  }

  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    const requested = await Location.requestForegroundPermissionsAsync();
    if (requested.status !== 'granted') {
      return [];
    }
  }

  const buckets = collectBuckets(photos);
  const out: VisitPlace[] = [];
  const seen = new Set<string>();

  for (const bucket of buckets) {
    const parsed = await reverseParsed(bucket.lat, bucket.lng);
    if (!parsed?.journeyLabel) {
      continue;
    }
    if (seen.has(parsed.journeyLabel)) {
      continue;
    }
    seen.add(parsed.journeyLabel);

    const level: VisitAdminLevel =
      parsed.gu || parsed.dong ? 'dong' : parsed.city ? 'city' : 'province';

    out.push({
      key: bucket.key,
      label: parsed.journeyLabel,
      level,
      province: parsed.province ?? undefined,
      city: parsed.city ?? undefined,
      gu: parsed.gu ?? undefined,
      dong: parsed.dong ?? undefined,
      firstTakenAt: bucket.firstTakenAt,
    });
  }

  return out;
}

/** Collapse visit places to labels for a given zoom grain. */
export function labelsForVisitLevel(
  places: VisitPlace[],
  level: VisitAdminLevel,
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const place of places) {
    let label: string | null = null;
    if (level === 'province') {
      label = place.province ?? place.city ?? place.label;
    } else if (level === 'city') {
      label = place.city ?? place.label;
    } else {
      // Finest grain: famous-area alias > 구 > 동, computed together.
      label =
        composeFineLabel(
          place.city ?? null,
          place.gu ?? null,
          place.dong ?? null,
        ) ??
        place.label;
    }
    if (!label || seen.has(label)) {
      continue;
    }
    seen.add(label);
    labels.push(label);
  }

  return labels;
}
