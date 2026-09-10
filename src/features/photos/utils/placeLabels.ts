import dongGu from '@/assets/geo/dong-gu.json';

import type { VisitAdminLevel, VisitPlace } from '../types';

/**
 * How a place is turned into a label people recognize: colloquial aliases (판교),
 * landmark bboxes (광화문), 구 recovery from the 법정동, and collapsing visit
 * places to a zoom grain.
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
 * Metro / admin-dong aliases so iOS "우2동" (행정동) recovers the same 구 as
 * legal 우동. Prefer `legalDongFromAdmin` strip for numbered 동 (신정1동→신정동);
 * keep explicit entries only when strip is not enough.
 */
const EXTRA_DONG_GU: Record<string, Record<string, string>> = {
  부산: {
    우동: '해운대구',
    우1동: '해운대구',
    우2동: '해운대구',
    우3동: '해운대구',
  },
};

/**
 * iOS often returns 행정동 with a digit (신정1동, 목3동, 우2동). The 법정동
 * table only has 신정동/목동/우동 — strip the digit so 양천구 etc. recover.
 * Leaves 성수동1가 alone (…가 suffix).
 */
export function legalDongFromAdmin(dong: string): string | null {
  const match = dong.match(/^([가-힣]+)\d+동$/);
  if (!match?.[1]) {
    return null;
  }
  return `${match[1]}동`;
}

function lookupDongGu(cityShort: string, dong: string): string | null {
  return (
    DONG_GU[cityShort]?.[dong] ??
    EXTRA_DONG_GU[cityShort]?.[dong] ??
    null
  );
}

/** Recover the 구 for a 법정동 when iOS returns the dong but not the 구. */
export function guForDong(cityShort: string, dong: string | null): string | null {
  if (!dong) {
    return null;
  }
  const direct = lookupDongGu(cityShort, dong);
  if (direct) {
    return direct;
  }
  const legal = legalDongFromAdmin(dong);
  if (legal && legal !== dong) {
    return lookupDongGu(cityShort, legal);
  }
  return null;
}

/**
 * Familiar colloquial area names so the finest label reads like a place people
 * know (판교) instead of an official dong (삼평동). Entries also cover dongs that
 * are themselves the well-known name (성수동 → 성수). Anything not listed falls
 * back to city+구+동. Keyed by dong; a "구 동" key disambiguates repeated dongs.
 *
 * Do NOT map whole 법정동 to a street nickname (e.g. 신사동→가로수길): 한남대교
 * GPS often reverse-geocodes to 신사동 and was mislabeled. Street/landmark names
 * are bbox-only via {@link LANDMARKS}.
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

export type PlaceCoords = { lat: number; lng: number };

type LandmarkBox = {
  label: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * Curated Seoul landmarks — first match wins. Keep boxes tight so nearby streets
 * do not inherit the nickname. Order: smaller / more specific first.
 */
const LANDMARKS: LandmarkBox[] = [
  // 광화문 광장·문루 (경복궁 본궁보다 남쪽).
  {
    label: '광화문',
    minLat: 37.5718,
    maxLat: 37.5772,
    minLng: 126.9748,
    maxLng: 126.9792,
  },
  // 경복궁 내부 (광화문 박스와 겹치면 광화문이 이김).
  {
    label: '경복궁',
    minLat: 37.5768,
    maxLat: 37.5895,
    minLng: 126.974,
    maxLng: 126.9818,
  },
  {
    label: '명동',
    minLat: 37.5605,
    maxLat: 37.5658,
    minLng: 126.9835,
    maxLng: 126.9905,
  },
  {
    label: '남산타워',
    minLat: 37.5502,
    maxLat: 37.5528,
    minLng: 126.9868,
    maxLng: 126.9902,
  },
  {
    label: '롯데타워',
    minLat: 37.5112,
    maxLat: 37.5142,
    minLng: 127.1005,
    maxLng: 127.1045,
  },
  // Core 가로수길 corridor (압구정로 일대) — not all of 신사동 / 한남대교.
  {
    label: '가로수길',
    minLat: 37.5198,
    maxLat: 37.5248,
    minLng: 127.0205,
    maxLng: 127.0258,
  },
];

function landmarkAt(lat: number, lng: number): string | null {
  for (const box of LANDMARKS) {
    if (
      lat >= box.minLat &&
      lat <= box.maxLat &&
      lng >= box.minLng &&
      lng <= box.maxLng
    ) {
      return box.label;
    }
  }
  return null;
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
  // 신사동 is huge; shopping-street nickname is landmark bbox only.
  if (gu === '강남구' && dong === '신사동') {
    if (coords && landmarkAt(coords.lat, coords.lng) === '가로수길') {
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
 * Finest-grain label: landmark bbox > dong alias > city+구+동 > 읍·면 > 시.
 * Never drop 읍·면 just because parent 시 exists (강릉시 주문진읍).
 * Pass coords when available so landmarks (광화문) work even if geocode is
 * city-only ("서울").
 *
 * `city` is used verbatim (서울 종로구 사직동, not 서울시 …) so chips, pin
 * sheet, playback and recap read the same for a metro.
 */
export function composeFineLabel(
  city: string | null,
  gu: string | null,
  dong: string | null,
  coords?: PlaceCoords | null,
  eupMyon?: string | null,
): string | null {
  if (coords) {
    const landmark = landmarkAt(coords.lat, coords.lng);
    if (landmark) {
      return landmark;
    }
  }
  const alias = areaAlias(gu, dong, coords);
  if (alias) {
    return alias;
  }
  if (!city) {
    return gu ?? dong ?? eupMyon ?? null;
  }
  if (gu && dong) {
    return `${city} ${gu} ${dong}`;
  }
  if (gu) {
    return `${city} ${gu}`;
  }
  // 동·리 is finer than 읍·면 — prefer 교항리 over 주문진읍 when both exist.
  if (dong) {
    return `${city} ${dong}`;
  }
  if (eupMyon && eupMyon !== city) {
    return `${city} ${eupMyon}`;
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
      // Finest grain: landmark / alias / city+구+동.
      label =
        composeFineLabel(
          place.city ?? null,
          place.gu ?? null,
          place.dong ?? null,
          coordsFromBucketKey(place.key),
          place.eupMyon ?? null,
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
