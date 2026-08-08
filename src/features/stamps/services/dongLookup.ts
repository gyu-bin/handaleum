import dongsGeo from '@/assets/geo/dongs.json';

import {
  bboxOf,
  pointInGeometry,
  type GeoBBox,
  type PackedGeometry,
} from '@/features/photos/utils/geo';

/**
 * Offline admin-leaf lookup for stamp indexing (동 + 군 읍·면).
 * Uses packed `dongs.json` + a coarse lng/lat grid so each query only tests
 * a handful of MultiPolygons instead of all ~3k.
 */

export type DongLookupHit = {
  id: string;
  sido: string;
  city: string;
  name: string;
};

type DongFeature = PackedGeometry & {
  id: string;
  sido: string;
  city: string;
  name: string;
};

type IndexedDong = DongFeature & { bbox: GeoBBox };

/** ~5.5km cells — balances candidate count vs grid memory. */
const CELL_DEG = 0.05;

let items: IndexedDong[] | null = null;
let grid: Map<string, number[]> | null = null;
/** stampId → bbox center (glance map dots). */
let centroidsById: Map<string, { lat: number; lng: number }> | null = null;

function cellKey(lng: number, lat: number): string {
  return `${Math.floor(lng / CELL_DEG)},${Math.floor(lat / CELL_DEG)}`;
}

function ensureIndex(): void {
  if (items && grid) {
    return;
  }
  const raw = (dongsGeo as { dongs: DongFeature[] }).dongs;
  const nextItems: IndexedDong[] = [];
  const nextGrid = new Map<string, number[]>();

  for (let i = 0; i < raw.length; i += 1) {
    const d = raw[i]!;
    const bbox = bboxOf(d);
    nextItems.push({ ...d, bbox });
    const minX = Math.floor(bbox.minLng / CELL_DEG);
    const maxX = Math.floor(bbox.maxLng / CELL_DEG);
    const minY = Math.floor(bbox.minLat / CELL_DEG);
    const maxY = Math.floor(bbox.maxLat / CELL_DEG);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = `${x},${y}`;
        const list = nextGrid.get(key);
        if (list) {
          list.push(i);
        } else {
          nextGrid.set(key, [i]);
        }
      }
    }
  }

  items = nextItems;
  grid = nextGrid;
  centroidsById = null;
}

function ensureCentroids(): Map<string, { lat: number; lng: number }> {
  ensureIndex();
  if (centroidsById) {
    return centroidsById;
  }
  const next = new Map<string, { lat: number; lng: number }>();
  for (const d of items!) {
    const id = d.id || `${d.sido}/${d.city}/${d.name}`;
    const { bbox } = d;
    next.set(id, {
      lng: (bbox.minLng + bbox.maxLng) / 2,
      lat: (bbox.minLat + bbox.maxLat) / 2,
    });
  }
  centroidsById = next;
  return next;
}

/** BBox center for a stamp leaf id (`sido/city/dong`), or null if unknown. */
export function centroidForDongId(
  stampId: string,
): { lat: number; lng: number } | null {
  return ensureCentroids().get(stampId) ?? null;
}

/**
 * Containing 행정동/군읍면 for a WGS84 point, or null if outside the packed
 * atlas (overseas, sea, simplified-boundary gaps).
 */
export function lookupDong(lat: number, lng: number): DongLookupHit | null {
  ensureIndex();
  const candidates = grid!.get(cellKey(lng, lat));
  if (!candidates || candidates.length === 0) {
    return null;
  }
  for (const idx of candidates) {
    const d = items![idx]!;
    const { bbox } = d;
    if (
      lng < bbox.minLng ||
      lng > bbox.maxLng ||
      lat < bbox.minLat ||
      lat > bbox.maxLat
    ) {
      continue;
    }
    if (pointInGeometry(lng, lat, d)) {
      return {
        id: d.id || `${d.sido}/${d.city}/${d.name}`,
        sido: d.sido,
        city: d.city,
        name: d.name,
      };
    }
  }
  return null;
}

/** Test helper — drop memoized index between cases. */
export function resetDongLookupForTests(): void {
  items = null;
  grid = null;
  centroidsById = null;
}
