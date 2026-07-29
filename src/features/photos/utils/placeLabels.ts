import dongGu from '@/assets/geo/dong-gu.json';

import type { VisitAdminLevel, VisitPlace } from '../types';

/**
 * How a place is turned into a label people recognize: colloquial aliases (판교),
 * 구 recovery from the 법정동, and collapsing visit places to a zoom grain.
 */

/**
 * 시 → (법정동 → 구). iOS reverse-geocoding returns the 법정동 (도화동) but never
 * the 구 for cities that have one, so we recover the 구 from this reference table.
 * Generated from the official 법정동코드 전체자료, covering Seoul's 자치구 and every
 * 일반구 시 (성남·수원·고양·용인·창원·청주 등). Keyed by 시 so identically named
 * dongs in different cities don't collide; the few intra-city name collisions are
 * pinned (Seoul 신사동→강남구, 신정동→양천구) or omitted so they fall back to 시.
 */
const DONG_GU = dongGu as Record<string, Record<string, string>>;

/**
 * Familiar colloquial area names so the finest label reads like a place people
 * know (판교) instead of an official dong (삼평동). Entries also cover dongs that
 * are themselves the well-known name (성수동 → 성수). Anything not listed falls
 * back to the 구. Keyed by dong; a "구 동" key disambiguates repeated dongs.
 * Extend freely.
 *
 * Do NOT map whole 법정동 to a street nickname (e.g. 신사동→가로수길): 한남대교
 * GPS often reverse-geocodes to 신사동 and was mislabeled. Garosu-gil is bbox-only.
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
};

/** Core 가로수길 corridor (압구정로 일대) — not all of 신사동 / 한남대교. */
const GAROSU_GIL = {
  minLat: 37.5198,
  maxLat: 37.5248,
  minLng: 127.0205,
  maxLng: 127.0258,
};

export type PlaceCoords = { lat: number; lng: number };

function inGarosuGil(lat: number, lng: number): boolean {
  return (
    lat >= GAROSU_GIL.minLat &&
    lat <= GAROSU_GIL.maxLat &&
    lng >= GAROSU_GIL.minLng &&
    lng <= GAROSU_GIL.maxLng
  );
}

/** Recover the 구 for a 법정동 when iOS returns the dong but not the 구. */
export function guForDong(cityShort: string, dong: string | null): string | null {
  if (!dong) {
    return null;
  }
  return DONG_GU[cityShort]?.[dong] ?? null;
}

/** Colloquial alias for a dong, if we have one. */
function areaAlias(
  gu: string | null,
  dong: string | null,
  coords?: PlaceCoords | null,
): string | null {
  if (!dong) {
    return null;
  }
  // 신사동 is huge; only the shopping street itself is "가로수길".
  if (gu === '강남구' && dong === '신사동') {
    if (coords && inGarosuGil(coords.lat, coords.lng)) {
      return '가로수길';
    }
    return '신사동';
  }
  if (gu && AREA_ALIAS[`${gu} ${dong}`]) {
    return AREA_ALIAS[`${gu} ${dong}`]!;
  }
  return AREA_ALIAS[dong] ?? null;
}

/**
 * Finest-grain label people recognize: a famous-area alias if known (판교), else
 * the 구 (서울 마포구), else the dong (강릉시 홍제동), else the city.
 * Pass coords when available so street-level aliases (가로수길) stay accurate.
 */
export function composeFineLabel(
  city: string | null,
  gu: string | null,
  dong: string | null,
  coords?: PlaceCoords | null,
): string | null {
  const alias = areaAlias(gu, dong, coords);
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

/** Parse `placeBucketKey` ("37.517,127.028") back to coords for alias bbox checks. */
export function coordsFromBucketKey(key: string): PlaceCoords | null {
  const [latRaw, lngRaw] = key.split(',');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

/** City name in its "…시" form: 서울 → 서울시, 부산 → 부산시, 수원시 → 수원시. */
export function toSiForm(cityShort: string): string {
  return /시$/.test(cityShort) ? cityShort : `${cityShort}시`;
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
          coordsFromBucketKey(place.key),
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
