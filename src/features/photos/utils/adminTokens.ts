import type { LocationGeocodedAddress } from 'expo-location';

import citiesBySido from '@/assets/geo/cities-by-sido.json';
import dongGu from '@/assets/geo/dong-gu.json';
import municipalitiesGeo from '@/assets/geo/municipalities.json';
import sigunguBySido from '@/assets/geo/sigungu-by-sido.json';

import { cleanPart, METRO_SHORT, shortCityName } from './adminNames';

/**
 * Korean admin-unit tokens. One pipeline for every iOS geocode field — no
 * per-field special cases (name vs district vs glued strings).
 */

export type AdminKind =
  | 'metro'
  | 'province'
  | 'si'
  | 'gun'
  | 'gu'
  | 'eup'
  | 'myon'
  | 'dong';

export type AdminToken = {
  kind: AdminKind;
  /** Full unit text, e.g. 강릉시 / 교항리 / 서울특별시. */
  text: string;
};

/** Domestic 시 names — blocks POI false-si like "엘리시". */
const KNOWN_SI: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const m of municipalitiesGeo.municipalities as { name: string }[]) {
    if (/시$/.test(m.name)) {
      set.add(m.name);
    }
  }
  for (const list of Object.values(sigunguBySido as Record<string, string[]>)) {
    for (const name of list) {
      if (/시$/.test(name)) {
        set.add(name);
      }
    }
  }
  for (const map of Object.values(
    citiesBySido as Record<string, Record<string, string[]>>,
  )) {
    for (const name of Object.keys(map)) {
      if (/시$/.test(name)) {
        set.add(name);
      }
    }
  }
  return set;
})();

/**
 * Two-letter 법정동 (우동, 중동, 목동…). A bare 2-char run is too short to be a
 * safe 동 guess, so only names in the reference table are accepted — without
 * this, 부산 우동 produced no dong token at all and lost its 구 recovery.
 */
const KNOWN_SHORT_DONG: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const map of Object.values(
    dongGu as Record<string, Record<string, string>>,
  )) {
    for (const name of Object.keys(map)) {
      if (name.length === 2 && /[동리가]$/.test(name)) {
        set.add(name);
      }
    }
  }
  return set;
})();

const KNOWN_GUN: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const list of Object.values(sigunguBySido as Record<string, string[]>)) {
    for (const name of list) {
      if (/군$/.test(name)) {
        set.add(name);
      }
    }
  }
  return set;
})();

/**
 * Classify a candidate slice. Scanner walks left→right and takes the
 * *shortest* valid unit at each index so "강릉시교항리" → 강릉시 + 교항리.
 */
function kindFromText(text: string): AdminKind | null {
  if (/광역시$|특별시$|특별자치시$/.test(text)) {
    return text.length >= 4 ? 'metro' : null;
  }
  if (/특별자치도$|자치도$/.test(text)) {
    return text.length >= 3 ? 'province' : null;
  }
  if (/도$/.test(text)) {
    if (text === '도' || text.length < 2) {
      return null;
    }
    return 'province';
  }
  if (/시$/.test(text)) {
    // Must be a real 시 — "엘리시" from 엘리시움 must not win.
    return KNOWN_SI.has(text) ? 'si' : null;
  }
  if (/군$/.test(text)) {
    return KNOWN_GUN.has(text) ? 'gun' : null;
  }
  if (/구$/.test(text)) {
    if (text === '특구' || text.length < 2) {
      return null;
    }
    return 'gu';
  }
  if (/읍$/.test(text)) {
    return text.length >= 2 ? 'eup' : null;
  }
  if (/면$/.test(text)) {
    return text.length >= 2 ? 'myon' : null;
  }
  if (/[동리가]$/.test(text)) {
    // Real 동/리 ≥3 (도화동, 교항리). Blocks "엘리".
    if (text.length > 12) {
      return null;
    }
    if (text.length === 2) {
      return KNOWN_SHORT_DONG.has(text) ? 'dong' : null;
    }
    return text.length >= 3 ? 'dong' : null;
  }
  return null;
}

/**
 * Extract admin tokens from one string (spaced or glued).
 * Left-to-right, shortest valid unit at each position.
 */
export function tokenizeAdminText(input: string): AdminToken[] {
  const out: AdminToken[] = [];
  const runs = input.split(/[^가-힣0-9]+/).filter((r) => r.length > 0);
  for (const run of runs) {
    let i = 0;
    while (i < run.length) {
      let matched: AdminToken | null = null;
      for (let j = i + 1; j <= run.length; j += 1) {
        const text = run.slice(i, j);
        const kind = kindFromText(text);
        if (kind) {
          matched = { kind, text };
          break;
        }
      }
      if (!matched) {
        i += 1;
        continue;
      }
      // A 2-char 동 can be the head of a longer one (중동 ⊂ 중동리). Extend
      // within the same kind only, so 강릉시교항리 still splits at 강릉시.
      if (matched.kind === 'dong') {
        for (let j = i + matched.text.length + 1; j <= run.length; j += 1) {
          const text = run.slice(i, j);
          if (kindFromText(text) === 'dong') {
            matched = { kind: 'dong', text };
          }
        }
      }
      out.push(matched);
      i += matched.text.length;
    }
  }
  return out;
}

/** All iOS address fields, same rules — field role does not matter. */
export function tokenizeGeocodedAddress(
  addr: LocationGeocodedAddress,
): AdminToken[] {
  const fields = [
    addr.region,
    addr.city,
    addr.subregion,
    addr.district,
    addr.name,
    addr.street,
    addr.formattedAddress,
  ];
  const out: AdminToken[] = [];
  const seen = new Set<string>();
  for (const field of fields) {
    const cleaned = cleanPart(field);
    if (!cleaned) {
      continue;
    }
    for (const token of tokenizeAdminText(cleaned)) {
      const key = `${token.kind}:${token.text}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(token);
    }
  }
  return out;
}

export type AssembledAdmin = {
  province: string | null;
  /** Stamp / journey city grain: 시·군 or metro short (서울). Never 읍·면. */
  city: string | null;
  gu: string | null;
  /** 읍·면 — kept even when parent 시 is present (주문진읍 under 강릉시). */
  eupMyon: string | null;
  /** Finest 동·리·가, if present. */
  dong: string | null;
  /** True when city is a metro short name. */
  metro: boolean;
};

function lastOf(
  tokens: AdminToken[],
  kind: AdminKind | AdminKind[],
): AdminToken | null {
  const kinds = Array.isArray(kind) ? kind : [kind];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const t = tokens[i]!;
    if (kinds.includes(t.kind)) {
      return t;
    }
  }
  return null;
}

/**
 * Build hierarchy from tokens.
 * Eup/myon never become `city` when a 시/군/metro exists — but they are
 * always kept in `eupMyon` so labels don't collapse to bare 시.
 */
export function assembleAdminParts(tokens: AdminToken[]): AssembledAdmin {
  const metroTok = lastOf(tokens, 'metro');
  const provinceTok = lastOf(tokens, 'province');
  const siTok = lastOf(tokens, 'si');
  const gunTok = lastOf(tokens, 'gun');
  const guTok = lastOf(tokens, 'gu');
  const eupMyonTok = lastOf(tokens, ['eup', 'myon']);
  const dongTok = lastOf(tokens, 'dong');

  let metro = false;
  let city: string | null = null;

  if (gunTok) {
    city = gunTok.text;
  } else if (metroTok) {
    metro = true;
    city = shortCityName(metroTok.text);
  } else if (siTok) {
    const short = shortCityName(siTok.text);
    if (
      Object.values(METRO_SHORT).includes(short) ||
      siTok.text in METRO_SHORT
    ) {
      metro = true;
      city = short;
    } else {
      city = /시$/.test(siTok.text) ? siTok.text : `${short}시`;
    }
  } else if (eupMyonTok) {
    // No parent 시/군 in address — temporary city until polygon lift.
    city = eupMyonTok.text;
  }

  let province: string | null = null;
  if (provinceTok) {
    province = provinceTok.text
      .replace(/특별자치도$/, '도')
      .replace(/자치도$/, '도');
  } else if (metroTok) {
    // 인천광역시 강화군 — city is 군 but sido is still the metro.
    province = shortCityName(metroTok.text);
  } else if (metro && city) {
    province = city;
  }

  return {
    province,
    city,
    gu: guTok?.text ?? null,
    // Always keep 읍·면 token — never drop when parent 시 exists.
    eupMyon: eupMyonTok?.text ?? null,
    dong: dongTok?.text ?? null,
    metro,
  };
}
