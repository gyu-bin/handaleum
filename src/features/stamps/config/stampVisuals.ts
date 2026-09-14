import { theme } from '@/shared/constants/theme';

export type StampLevel = 'sido' | 'district' | 'neighborhood';

/** Shared symbol library (district / neighborhood). 시·도 uses full-face PNG. */
export type StampSymbol =
  | 'mountain'
  | 'water'
  | 'forest'
  | 'heritage'
  | 'city'
  | 'bridge'
  | 'street'
  | 'cafe'
  | 'market'
  | 'village'
  | 'industry'
  | 'landmark';

/** @deprecated Prefer StampSymbol. */
export type StampCategory = StampSymbol;

export type StampVariation = {
  outerWidth: number;
  innerDash: string;
  tickOffset: number;
  iconScale: number;
  iconDy: number;
  inkOpacity: number;
  accentMark: 'dots' | 'arc' | 'cross' | 'none';
};

const C = theme.colors;

export const STAMP_SYMBOLS: readonly StampSymbol[] = [
  'mountain',
  'water',
  'forest',
  'heritage',
  'city',
  'bridge',
  'street',
  'cafe',
  'market',
  'village',
  'industry',
  'landmark',
] as const;

/**
 * Path-key overrides (`sido/city` or `sido/city/dong`).
 * Collection IDs and visit judgement stay owned by the stamp index.
 */
const REGION_STAMP_SYMBOLS: Record<string, StampSymbol> = {
  '서울/종로구': 'heritage',
  '서울/중구': 'city',
  '서울/용산구': 'landmark',
  '서울/성동구': 'forest',
  '서울/광진구': 'water',
  '서울/동대문구': 'market',
  '서울/중랑구': 'forest',
  '서울/성북구': 'heritage',
  '서울/강북구': 'mountain',
  '서울/도봉구': 'forest',
  '서울/노원구': 'forest',
  '서울/은평구': 'mountain',
  '서울/서대문구': 'heritage',
  '서울/마포구': 'bridge',
  '서울/양천구': 'forest',
  '서울/강서구': 'water',
  '서울/구로구': 'city',
  '서울/금천구': 'industry',
  '서울/영등포구': 'city',
  '서울/동작구': 'water',
  '서울/관악구': 'mountain',
  '서울/서초구': 'city',
  '서울/강남구': 'city',
  '서울/송파구': 'water',
  '서울/강동구': 'bridge',
  // stampId = sido/stampCity/leaf (서울 metro stampCity is "서울")
  '서울/서울/이태원동': 'street',
  '서울/서울/한남동': 'cafe',
  '서울/서울/후암동': 'mountain',
  '서울/서울/용산동': 'landmark',
  '서울/서울/청파동': 'heritage',
  '서울/서울/연남동': 'cafe',
  '서울/서울/성수동': 'street',
  '서울/서울/잠실동': 'water',
};

/** Short-name legacy fallback when path key is missing. */
const DISTRICT_SYMBOLS: Record<string, StampSymbol> = {
  종로구: 'heritage',
  중구: 'city',
  용산구: 'landmark',
  성동구: 'forest',
  광진구: 'water',
  동대문구: 'market',
  중랑구: 'forest',
  성북구: 'heritage',
  강북구: 'mountain',
  도봉구: 'forest',
  노원구: 'forest',
  은평구: 'mountain',
  서대문구: 'heritage',
  마포구: 'bridge',
  양천구: 'forest',
  강서구: 'water',
  구로구: 'city',
  금천구: 'industry',
  영등포구: 'city',
  동작구: 'water',
  관악구: 'mountain',
  서초구: 'city',
  강남구: 'city',
  송파구: 'water',
  강동구: 'bridge',
  해운대구: 'water',
  수영구: 'bridge',
  남구: 'city',
  북구: 'forest',
  제주시: 'landmark',
  서귀포시: 'water',
  수원시: 'heritage',
  고양시: 'forest',
  성남시: 'city',
  용인시: 'forest',
  춘천시: 'water',
  강릉시: 'water',
  전주시: 'heritage',
  경주시: 'heritage',
  포항시: 'water',
  창원시: 'city',
};

const NEIGHBORHOOD_SYMBOLS: Record<string, StampSymbol> = {
  이태원동: 'street',
  한남동: 'cafe',
  용산동: 'landmark',
  후암동: 'mountain',
  청파동: 'heritage',
  원효로1동: 'city',
  원효로2동: 'city',
  연남동: 'cafe',
  성수동: 'street',
  잠실동: 'water',
};

function hash(key: string): number {
  let value = 0;
  for (let i = 0; i < key.length; i += 1) {
    value = (value * 31 + key.charCodeAt(i)) >>> 0;
  }
  return value;
}

function symbolFromHash(key: string): StampSymbol {
  return STAMP_SYMBOLS[hash(key) % STAMP_SYMBOLS.length]!;
}

/**
 * Resolve reusable symbol for district / neighborhood.
 * Path mapping → short-name legacy → deterministic hash. Never random.
 */
export function stampSymbolFor(
  stampKey: string | undefined,
  name: string,
  level: StampLevel,
): StampSymbol {
  if (level === 'sido') {
    return 'landmark';
  }
  const key = stampKey ?? name;
  const fromPath = REGION_STAMP_SYMBOLS[key];
  if (fromPath) {
    return fromPath;
  }
  if (level === 'district') {
    return DISTRICT_SYMBOLS[name] ?? symbolFromHash(key);
  }
  return NEIGHBORHOOD_SYMBOLS[name] ?? symbolFromHash(key);
}

/** @deprecated Use stampSymbolFor. */
export function stampCategoryFor(
  name: string,
  level: StampLevel,
  stampKey?: string,
): StampSymbol {
  return stampSymbolFor(stampKey, name, level);
}

/** Ink follows visit state only — not region rainbow. */
export function stampInkForState(collected: boolean): string {
  return collected ? C.stampInk : C.stampInkEmpty;
}

/**
 * @deprecated Prefer stampInkForState. Kept for callers; always state ink.
 */
export function stampInkFor(
  _name: string,
  _level: StampLevel,
  _stampKey?: string,
  collected = true,
): string {
  return stampInkForState(collected);
}

/** Stable micro-variation; never changes for the same collection ID. */
export function stampVariationFor(key: string): StampVariation {
  const value = hash(key);
  return {
    outerWidth: [2.2, 2.4, 2.6][value % 3]!,
    innerDash: ['2 3', '2.4 3.2', '1.8 3'][Math.floor(value / 3) % 3]!,
    tickOffset: Math.floor(value / 9) % 4,
    iconScale: [0.95, 0.98, 1, 1.03, 1.05][Math.floor(value / 27) % 5]!,
    iconDy: [-1.2, -0.4, 0, 0.4, 1.2][Math.floor(value / 135) % 5]!,
    inkOpacity: [0.86, 0.9, 0.94][Math.floor(value / 108) % 3]!,
    accentMark: ['dots', 'arc', 'cross', 'none'][
      Math.floor(value / 324) % 4
    ]! as StampVariation['accentMark'],
  };
}

const CHOSEONG = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j',
  'jj', 'ch', 'k', 't', 'p', 'h',
];
const JUNGSEONG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe',
  'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
];
const JONGSEONG = [
  '', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls',
  'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 't', 'ng', 't', 't', 'k', 't',
  'p', 't',
];

/** Compact, deterministic Latin helper for leaf stamp micro copy. */
export function romanizeStampName(name: string): string {
  let output = '';
  for (const character of name) {
    const offset = character.charCodeAt(0) - 0xac00;
    if (offset < 0 || offset > 11171) {
      output += character;
      continue;
    }
    const initial = Math.floor(offset / 588);
    const medial = Math.floor((offset % 588) / 28);
    const final = offset % 28;
    output += `${CHOSEONG[initial]}${JUNGSEONG[medial]}${JONGSEONG[final]}`;
  }
  return output.toUpperCase();
}
