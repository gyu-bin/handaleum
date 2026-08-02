import type { LocationGeocodedAddress } from 'expo-location';

import {
  cleanPart,
  endsWithGu,
  isEupMyonName,
  isMetroCity,
  isProvinceName,
  looksLikeSeoul,
  shortCityName,
} from './adminNames';
import {
  assembleAdminParts,
  tokenizeGeocodedAddress,
} from './adminTokens';
import { composeFineLabel, guForDong } from './placeLabels';

export type ParsedPlace = {
  journeyLabel: string;
  province: string | null;
  city: string | null;
  gu: string | null;
  /** 읍·면 under parent 시 — never discarded when 시 is present. */
  eupMyon: string | null;
  dong: string | null;
};

/**
 * Normalize iOS LocationGeocodedAddress into Korean admin parts.
 *
 * Root approach: tokenize every field by admin suffixes (도/시/군/구/읍/면/동/리),
 * then assemble hierarchy. Field roles (name vs district) do not matter —
 * POIs without admin suffixes never become tokens.
 */
export function parseGeocodedPlace(
  addr: LocationGeocodedAddress,
): ParsedPlace | null {
  const tokens = tokenizeGeocodedAddress(addr);
  let { province, city, gu, eupMyon, dong, metro } = assembleAdminParts(tokens);

  const rawCity =
    cleanPart(addr.city) ??
    cleanPart(addr.subregion) ??
    cleanPart(addr.region);

  // Bare metro short in city ("서울") has no 시 suffix — not a token.
  if (!city && rawCity && isMetroCity(rawCity)) {
    city = shortCityName(rawCity);
    metro = true;
    province = province ?? city;
  }

  // Province-only geocode (no 시·군·동 in any field).
  if (!city && rawCity && isProvinceName(rawCity)) {
    const p = rawCity.replace(/특별자치도$/, '도');
    return {
      journeyLabel: p,
      province: p,
      city: p,
      gu: null,
      eupMyon: null,
      dong: null,
    };
  }

  if (!city && province && isProvinceName(province)) {
    return {
      journeyLabel: province,
      province,
      city: province,
      gu: null,
      eupMyon: null,
      dong: null,
    };
  }

  if (!city) {
    return null;
  }

  if (looksLikeSeoul(addr, city)) {
    city = '서울';
    metro = true;
    province = '서울';
  }

  const cityShort = shortCityName(city);
  if (!gu) {
    gu = guForDong(cityShort, dong);
  }

  // 군 is the stamp unit — never also attach a 구.
  if (/군$/.test(city)) {
    gu = null;
  }

  if (!province) {
    if (metro) {
      province = cityShort;
    } else {
      const region = cleanPart(addr.region);
      if (region && (isProvinceName(region) || /도$/.test(region))) {
        province = region.replace(/특별자치도$/, '도');
      }
    }
  }

  const guFinal = gu && endsWithGu(gu) ? gu : null;
  const dongFinal = dong && !endsWithGu(dong) ? dong : null;
  const eupFinal =
    (eupMyon && isEupMyonName(eupMyon) ? eupMyon : null) ??
    (isEupMyonName(city) ? city : null);

  const journeyLabel =
    /군$/.test(city) || !guFinal ? city : `${city} - ${guFinal}`;

  return {
    journeyLabel,
    province,
    city,
    gu: guFinal,
    eupMyon: eupFinal,
    dong: dongFinal,
  };
}

export function formatAlbumPlaceLabel(
  addr: LocationGeocodedAddress,
): string | null {
  return parseGeocodedPlace(addr)?.journeyLabel ?? null;
}

export function formatDetailPlaceLabel(
  addr: LocationGeocodedAddress,
  lat?: number,
  lng?: number,
): string | null {
  const parsed = parseGeocodedPlace(addr);
  if (parsed?.city) {
    const coords =
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : null;
    return composeFineLabel(
      parsed.city,
      parsed.gu,
      parsed.dong,
      coords,
      parsed.eupMyon,
    );
  }
  return (
    cleanPart(addr.district) ??
    cleanPart(addr.city) ??
    cleanPart(addr.subregion) ??
    cleanPart(addr.name) ??
    cleanPart(addr.region) ??
    null
  );
}
