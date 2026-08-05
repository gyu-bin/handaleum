import dongsGeo from '@/assets/geo/dongs.json';

import { type PackedGeometry } from '@/features/photos/utils/geo';

import type { StampsCollected } from '../types';
import { stampId } from './dongIndex';

/**
 * Visit-map regions at 동 grain (from admdongkor, 동 only).
 */

type DongGeometry = PackedGeometry & {
  id: string;
  sido: string;
  city: string;
  name: string;
};

export type StampMapRegion = {
  key: string;
  sido: string;
  city: string;
  name: string;
  grain: 'dong';
  geometry: PackedGeometry;
};

let regionsCache: StampMapRegion[] | null = null;

function buildRegions(): StampMapRegion[] {
  const list = (dongsGeo as { dongs: DongGeometry[] }).dongs;
  return list.map((d) => ({
    key: d.id || stampId(d.sido, d.city, d.name),
    sido: d.sido,
    city: d.city,
    name: d.name,
    grain: 'dong' as const,
    geometry: d,
  }));
}

export function getStampMapRegions(): StampMapRegion[] {
  if (!regionsCache) {
    regionsCache = buildRegions();
  }
  return regionsCache;
}

export function isStampMapRegionVisited(
  collected: StampsCollected,
  region: StampMapRegion,
): boolean {
  return Boolean(collected[region.key]);
}
