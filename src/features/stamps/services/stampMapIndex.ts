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
  return list.map((u) => ({
    key: u.key,
    sido: u.sido,
    label: u.label,
    stampCity: u.stampCity,
    geometry: {
      type: u.type,
      coordinates: u.coordinates,
    },
  }));
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

/** L1 keys that have at least one collected 동/읍·면. */
export function visitedL1Keys(collected: StampsCollected): Set<string> {
  const keys = new Set<string>();
  for (const entry of Object.values(collected)) {
    const l1 = findL1ForStamp(entry.sido, entry.city, entry.name);
    if (l1) {
      keys.add(l1.key);
    }
  }
  return keys;
}

export function selectionFromUnit(unit: StampMapUnit): StampMapSelection {
  return { sido: unit.sido, l1Key: unit.key };
}

export function selectionFromProvince(sido: string): StampMapSelection {
  return { sido, l1Key: null };
}
