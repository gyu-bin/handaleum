import * as Location from 'expo-location';

import type { PhotoRef, VisitAdminLevel, VisitPlace } from '../types';
import {
  cleanPart,
  endsWithGu,
  extractDong,
  extractGu,
  extractProvince,
  isMetroCity,
  looksLikeSeoul,
  METRO_SHORT,
  shortCityName,
} from './adminNames';
import {
  composeFineLabel,
  guForDong,
  toSiForm,
} from './placeLabels';

// Re-exported so existing consumers keep importing it from `placeJourney`.
export { labelsForVisitLevel } from './placeLabels';

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

const labelCache = new Map<string, ParsedPlace | null>();

export function placeBucketKey(lat: number, lng: number): string {
  return `${lat.toFixed(BUCKET_DECIMALS)},${lng.toFixed(BUCKET_DECIMALS)}`;
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

/**
 * Card plate region: "경기도 · 성남시" / "서울 · 마포구".
 * Requests location permission if needed (user-initiated card flow).
 */
export async function resolveCardRegionLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    const requested = await Location.requestForegroundPermissionsAsync();
    if (requested.status !== 'granted') {
      return null;
    }
  }

  const parsed = await reverseParsed(lat, lng);
  if (!parsed) {
    return null;
  }

  const province = parsed.province?.trim() || null;
  const city = parsed.city?.trim() || null;
  const gu = parsed.gu?.trim() || null;

  if (province && gu && (province === '서울' || city?.startsWith('서울'))) {
    return `${province} · ${gu}`;
  }
  if (province && city && province !== city && !city.startsWith(province)) {
    return `${province} · ${city}`;
  }
  if (city && gu) {
    return `${city} · ${gu}`;
  }
  return city ?? province ?? parsed.journeyLabel ?? null;
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
