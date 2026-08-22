import adminDongGu from '@/assets/geo/admin-dong-gu.json';
import citiesBySido from '@/assets/geo/cities-by-sido.json';
import gunEupMyeon from '@/assets/geo/gun-eupmyeon-by-sido.json';

import {
  dongListForCity,
  SIDO_ORDER as DONG_SIDO_ORDER,
  stampId,
} from './dongIndex';
import type { StampsCollected } from '../types';

/**
 * Stamp navigation: 시·도 → L1(구|시|군) → L2(동, or 읍·면 for 군).
 * Collection grain stays leaf names in `sido/stampCity/leaf`.
 */

type CitiesIndex = Record<string, Record<string, string[]>>;
type AdminGuTable = Record<string, Record<string, string>>;
type GunLeaves = Record<string, Record<string, string[]>>;

const CITIES = citiesBySido as CitiesIndex;
const ADMIN_GU = adminDongGu as AdminGuTable;
const GUN_LEAVES = gunEupMyeon as GunLeaves;

export type StampL1Kind = 'gu' | 'si' | 'gun';

export type StampL1Unit = {
  /** Stable nav key within a sido. */
  key: string;
  label: string;
  kind: StampL1Kind;
  /** Parent city key for stampId / dongs index (서울, 수원시, 가평군…). */
  stampCity: string;
  /** 구 name when kind=gu; otherwise equals stampCity. */
  unitName: string;
};

/** Prefer cities-by-sido order; fall back to dong index. */
export const SIDO_ORDER: string[] =
  Object.keys(CITIES).length > 0 ? Object.keys(CITIES) : DONG_SIDO_ORDER;

export function l1UnitsForSido(sido: string): StampL1Unit[] {
  const cities = CITIES[sido];
  if (!cities) {
    return [];
  }
  const out: StampL1Unit[] = [];
  for (const [city, units] of Object.entries(cities)) {
    if (units.length > 0) {
      for (const gu of units) {
        out.push({
          key: `${city}/${gu}`,
          label: gu,
          kind: 'gu',
          stampCity: city,
          unitName: gu,
        });
      }
      continue;
    }
    const kind: StampL1Kind = city.endsWith('군') ? 'gun' : 'si';
    out.push({
      key: city,
      label: city,
      kind,
      stampCity: city,
      unitName: city,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

/** Which 구 an admin dong belongs to inside stampCity (서울 / 수원시 / …). */
export function guForDong(stampCity: string, dong: string): string | null {
  return ADMIN_GU[stampCity]?.[dong] ?? null;
}

function eupMyeonForGun(sido: string, gun: string): string[] {
  return GUN_LEAVES[sido]?.[gun] ?? [];
}

/**
 * L2 leaf labels under an L1 unit (동 for 구/시, 읍·면 for 군).
 * Gun leaves prefer packed dongs index (PIP source of truth).
 */
export function l2LeavesForUnit(sido: string, unit: StampL1Unit): string[] {
  if (unit.kind === 'gun') {
    const fromAtlas = dongListForCity(sido, unit.stampCity);
    const leaves =
      fromAtlas.length > 0 ? fromAtlas : eupMyeonForGun(sido, unit.unitName);
    return [...leaves].sort((a, b) => a.localeCompare(b, 'ko'));
  }
  const dongs = dongListForCity(sido, unit.stampCity);
  if (unit.kind === 'si') {
    return [...dongs].sort((a, b) => a.localeCompare(b, 'ko'));
  }
  const scoped = dongs.filter((d) => guForDong(unit.stampCity, d) === unit.unitName);
  return scoped.sort((a, b) => a.localeCompare(b, 'ko'));
}

export function countCollectedInLeaves(
  collected: StampsCollected,
  sido: string,
  stampCity: string,
  leaves: string[],
): number {
  let n = 0;
  for (const leaf of leaves) {
    if (collected[stampId(sido, stampCity, leaf)]) {
      n += 1;
    }
  }
  return n;
}

export function findL1ForStamp(
  sido: string,
  stampCity: string,
  leaf: string,
): StampL1Unit | null {
  const units = l1UnitsForSido(sido);
  const byCity = units.find(
    (u) =>
      (u.kind === 'si' || u.kind === 'gun') && u.stampCity === stampCity,
  );
  if (byCity) {
    return byCity;
  }
  const gu = guForDong(stampCity, leaf);
  if (gu) {
    return (
      units.find(
        (u) =>
          u.kind === 'gu' &&
          u.stampCity === stampCity &&
          u.unitName === gu,
      ) ?? null
    );
  }
  return units.find((u) => u.stampCity === stampCity) ?? null;
}

export type CityListSort = 'most' | 'least' | 'name';

/** L1 (구·시·군) list order. Ties break 가나다. */
export function sortCityRows<T extends { label: string; collected: number }>(
  rows: T[],
  sort: CityListSort,
): T[] {
  return [...rows].sort((a, b) => {
    if (sort === 'most' && a.collected !== b.collected) {
      return b.collected - a.collected;
    }
    if (sort === 'least' && a.collected !== b.collected) {
      return a.collected - b.collected;
    }
    return a.label.localeCompare(b.label, 'ko');
  });
}

/** Whether `leaf` is a known 읍·면 slot under a 군 stampCity. */
export function isKnownGunLeaf(
  sido: string,
  gun: string,
  leaf: string,
): boolean {
  return (GUN_LEAVES[sido]?.[gun] ?? []).includes(leaf);
}
