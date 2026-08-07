import stampMapUnitsGeo from '@/assets/geo/stamp-map-units.json';
import provincesGeo from '@/assets/geo/provinces.json';

import { type PackedGeometry } from '@/features/photos/utils/geo';

import type { StampsCollected } from '../types';
import { findL1ForStamp } from './stampNavIndex';

/**
 * Visit atlas at L1 (구·시·군) grain — coloring-book empty cells.
 */

type ProvinceFeature = PackedGeometry & {
  id: string;
  name: string;
};

export type StampMapUnit = {
  key: string;
  sido: string;
  label: string;
  stampCity: string;
  geometry: PackedGeometry;
};

export type StampMapProvince = {
  id: string;
  name: string;
  geometry: PackedGeometry;
};

/** Map tap → stamp screen navigation. */
export type StampMapSelection = {
  sido: string;
  /** L1 nav key; null = sido root only. */
  l1Key: string | null;
};

type PackedUnit = {
  key: string;
  sido: string;
  label: string;
  stampCity: string;
  type: 'MultiPolygon' | 'Polygon';
  coordinates: PackedGeometry['coordinates'];
};

let unitsCache: StampMapUnit[] | null = null;
let provincesCache: StampMapProvince[] | null = null;

function buildUnits(): StampMapUnit[] {
  const list = (stampMapUnitsGeo as { units: PackedUnit[] }).units;
  const units = list.map((u) => ({
    key: u.key,
    sido: u.sido,
    label: u.label,
    stampCity: u.stampCity,
    geometry: {
      type: u.type,
      coordinates: u.coordinates,
    },
  }));

  // Homonyms across 시·도 (고성군 in 강원 + 경남) — prefix sido on map label.
  const byLabel = new Map<string, StampMapUnit[]>();
  for (const u of units) {
    const group = byLabel.get(u.label);
    if (group) {
      group.push(u);
    } else {
      byLabel.set(u.label, [u]);
    }
  }
  for (const group of byLabel.values()) {
    if (group.length < 2) {
      continue;
    }
    for (const u of group) {
      u.label = `${u.sido} ${u.label}`;
    }
  }

  return units;
}

function buildProvinces(): StampMapProvince[] {
  const list = provincesGeo.provinces as unknown as ProvinceFeature[];
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    geometry: p,
  }));
}

export function getStampMapUnits(): StampMapUnit[] {
  if (!unitsCache) {
    unitsCache = buildUnits();
  }
  return unitsCache;
}

export function getStampMapProvinces(): StampMapProvince[] {
  if (!provincesCache) {
    provincesCache = buildProvinces();
  }
  return provincesCache;
}

/** L1 keys that have at least one collected 동/읍·면 (sido-scoped; 고성군×2). */
export function mapVisitKey(sido: string, l1Key: string): string {
  return `${sido}/${l1Key}`;
}

export function visitedL1Keys(collected: StampsCollected): Set<string> {
  const keys = new Set<string>();
  for (const entry of Object.values(collected)) {
    const l1 = findL1ForStamp(entry.sido, entry.city, entry.name);
    if (l1) {
      keys.add(mapVisitKey(entry.sido, l1.key));
    }
  }
  return keys;
}

/** 시·도 with at least one collected leaf. */
export function visitedSidoNames(collected: StampsCollected): Set<string> {
  const names = new Set<string>();
  for (const entry of Object.values(collected)) {
    names.add(entry.sido);
  }
  return names;
}

export function unitsForSido(sido: string): StampMapUnit[] {
  return getStampMapUnits().filter((u) => u.sido === sido);
}

export function countVisitedL1InSido(
  collected: StampsCollected,
  sido: string,
): number {
  const visited = visitedL1Keys(collected);
  let n = 0;
  for (const u of unitsForSido(sido)) {
    if (visited.has(mapVisitKey(sido, u.key))) {
      n += 1;
    }
  }
  return n;
}

export function countVisitedDongsInSido(
  collected: StampsCollected,
  sido: string,
): number {
  let n = 0;
  for (const entry of Object.values(collected)) {
    if (entry.sido === sido) {
      n += 1;
    }
  }
  return n;
}

export function selectionFromUnit(unit: StampMapUnit): StampMapSelection {
  return { sido: unit.sido, l1Key: unit.key };
}

export function selectionFromProvince(sido: string): StampMapSelection {
  return { sido, l1Key: null };
}
